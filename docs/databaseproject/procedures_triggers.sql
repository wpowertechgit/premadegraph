CREATE OR REPLACE FUNCTION fn_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_players_touch_updated_at
BEFORE UPDATE ON players
FOR EACH ROW
EXECUTE FUNCTION fn_touch_updated_at();

CREATE OR REPLACE FUNCTION fn_sync_cluster_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    affected_cluster_id BIGINT;
BEGIN
    affected_cluster_id := COALESCE(NEW.cluster_id, OLD.cluster_id);

    UPDATE clusters
    SET member_count = (
        SELECT COUNT(*)
        FROM cluster_members
        WHERE cluster_id = affected_cluster_id
    )
    WHERE cluster_id = affected_cluster_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cluster_member_count_insert
AFTER INSERT OR DELETE ON cluster_members
FOR EACH ROW
EXECUTE FUNCTION fn_sync_cluster_member_count();

-- Routine 1: output-parameter style summary for one player.
CREATE OR REPLACE PROCEDURE sp_get_player_summary(
    IN p_player_id BIGINT,
    OUT p_display_name TEXT,
    OUT p_opscore NUMERIC,
    OUT p_feedscore NUMERIC,
    OUT p_cluster_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT p.display_name, p.opscore, p.feedscore, COUNT(cm.cluster_id)::integer
    INTO p_display_name, p_opscore, p_feedscore, p_cluster_count
    FROM players p
    LEFT JOIN cluster_members cm ON cm.player_id = p.player_id
    WHERE p.player_id = p_player_id
    GROUP BY p.player_id;
END;
$$;

-- Routine 2: parameterized recalculation of a player's current scores.
CREATE OR REPLACE PROCEDURE sp_refresh_player_scores(
    IN p_player_id BIGINT,
    OUT p_new_opscore NUMERIC,
    OUT p_new_feedscore NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT
        ROUND(LEAST(10, GREATEST(0, AVG((kills * 1.1 + assists * 0.7 + vision_score * 0.08) - deaths * 0.9)))::numeric, 2),
        ROUND(LEAST(10, GREATEST(0, AVG((deaths * 1.3) - (assists * 0.15))))::numeric, 2)
    INTO p_new_opscore, p_new_feedscore
    FROM match_participants
    WHERE player_id = p_player_id;

    UPDATE players
    SET opscore = COALESCE(p_new_opscore, opscore),
        feedscore = COALESCE(p_new_feedscore, feedscore),
        match_count = (
            SELECT COUNT(*)
            FROM match_participants
            WHERE player_id = p_player_id
        )
    WHERE player_id = p_player_id;
END;
$$;

-- Routine 3: nested routine call. It calls sp_refresh_player_scores and then stores a snapshot.
CREATE OR REPLACE PROCEDURE sp_refresh_player_and_snapshot(
    IN p_player_id BIGINT,
    IN p_run_id BIGINT,
    OUT p_snapshot_id BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    refreshed_opscore NUMERIC;
    refreshed_feedscore NUMERIC;
BEGIN
    CALL sp_refresh_player_scores(p_player_id, refreshed_opscore, refreshed_feedscore);

    INSERT INTO performance_snapshots (
        player_id,
        run_id,
        match_sample_size,
        opscore,
        feedscore,
        score_spread,
        sample_quality,
        source_dataset
    )
    VALUES (
        p_player_id,
        p_run_id,
        (SELECT COUNT(*) FROM match_participants WHERE player_id = p_player_id),
        COALESCE(refreshed_opscore, 0),
        COALESCE(refreshed_feedscore, 0),
        GREATEST(0, 10 - COALESCE(refreshed_opscore, 0)) / 5.0,
        'derived',
        'flexset'
    )
    ON CONFLICT (player_id, run_id) DO UPDATE
    SET opscore = EXCLUDED.opscore,
        feedscore = EXCLUDED.feedscore,
        score_spread = EXCLUDED.score_spread,
        sample_quality = EXCLUDED.sample_quality,
        source_dataset = EXCLUDED.source_dataset,
        computed_at = CURRENT_TIMESTAMP
    RETURNING snapshot_id INTO p_snapshot_id;
END;
$$;

-- Routine 4: recursive graph reachability function.
CREATE OR REPLACE FUNCTION fn_relationship_reach_count(
    p_start_player_id BIGINT,
    p_max_depth INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    reached_count INTEGER;
BEGIN
    WITH RECURSIVE walk(player_id, depth, path) AS (
        SELECT p_start_player_id, 0, ARRAY[p_start_player_id]
        UNION ALL
        SELECT
            CASE WHEN r.player_a_id = walk.player_id THEN r.player_b_id ELSE r.player_a_id END,
            walk.depth + 1,
            walk.path || CASE WHEN r.player_a_id = walk.player_id THEN r.player_b_id ELSE r.player_a_id END
        FROM walk
        JOIN player_relationships r
          ON r.player_a_id = walk.player_id OR r.player_b_id = walk.player_id
        WHERE walk.depth < p_max_depth
          AND NOT (
              CASE WHEN r.player_a_id = walk.player_id THEN r.player_b_id ELSE r.player_a_id END
              = ANY(walk.path)
          )
    )
    SELECT COUNT(DISTINCT player_id) - 1
    INTO reached_count
    FROM walk;

    RETURN reached_count;
END;
$$;

-- Routine 5: parameterized path-query insertion with output id.
CREATE OR REPLACE PROCEDURE sp_create_path_query(
    IN p_run_id BIGINT,
    IN p_source_player_id BIGINT,
    IN p_target_player_id BIGINT,
    IN p_algorithm TEXT,
    IN p_graph_mode TEXT,
    IN p_path_json JSONB,
    OUT p_created_path_query_id BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO path_queries (
        run_id,
        source_player_id,
        target_player_id,
        algorithm,
        graph_mode,
        path_length,
        total_weight,
        path_json
    )
    VALUES (
        p_run_id,
        p_source_player_id,
        p_target_player_id,
        p_algorithm,
        p_graph_mode,
        jsonb_array_length(p_path_json) - 1,
        NULL,
        p_path_json
    )
    RETURNING path_query_id INTO p_created_path_query_id;
END;
$$;

-- Routine 6: finish an analysis run and return a compact JSON summary.
CREATE OR REPLACE PROCEDURE sp_finish_analysis_run(
    IN p_run_id BIGINT,
    IN p_status TEXT,
    OUT p_summary JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE analysis_runs
    SET status = p_status,
        finished_at = CURRENT_TIMESTAMP,
        result_summary = result_summary || jsonb_build_object(
            'finished_by_procedure', true,
            'finished_at', CURRENT_TIMESTAMP
        )
    WHERE run_id = p_run_id
    RETURNING result_summary INTO p_summary;
END;
$$;

-- Example calls:
-- CALL sp_get_player_summary(1, NULL, NULL, NULL, NULL);
-- CALL sp_refresh_player_scores(1, NULL, NULL);
-- CALL sp_refresh_player_and_snapshot(1, 3, NULL);
-- SELECT fn_relationship_reach_count(1, 3);
-- CALL sp_create_path_query(6, 1, 10, 'astar', 'ally', '[1,2,3,5,10]'::jsonb, NULL);
-- CALL sp_finish_analysis_run(6, 'finished', NULL);
