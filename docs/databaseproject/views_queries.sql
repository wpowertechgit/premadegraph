CREATE OR REPLACE VIEW v_player_performance_summary AS
SELECT
    p.player_id,
    p.display_name,
    p.region,
    p.detected_role,
    p.match_count,
    p.opscore,
    p.feedscore,
    COALESCE(AVG(ps.volatility_index), 0) AS average_volatility,
    COUNT(DISTINCT cm.cluster_id) AS cluster_count,
    COUNT(DISTINCT pq.path_query_id) FILTER (
        WHERE pq.source_player_id = p.player_id OR pq.target_player_id = p.player_id
    ) AS path_query_count
FROM players p
LEFT JOIN performance_snapshots ps ON ps.player_id = p.player_id
LEFT JOIN cluster_members cm ON cm.player_id = p.player_id
LEFT JOIN path_queries pq ON pq.source_player_id = p.player_id OR pq.target_player_id = p.player_id
GROUP BY p.player_id;

CREATE OR REPLACE VIEW v_cluster_health AS
SELECT
    c.cluster_id,
    c.cluster_code,
    c.cluster_type,
    c.algorithm,
    COUNT(cm.player_id) AS actual_member_count,
    c.member_count AS reported_member_count,
    c.density,
    AVG(p.opscore) AS live_average_opscore,
    AVG(p.feedscore) AS live_average_feedscore,
    SUM(CASE WHEN cm.is_bridge THEN 1 ELSE 0 END) AS bridge_count
FROM clusters c
LEFT JOIN cluster_members cm ON cm.cluster_id = c.cluster_id
LEFT JOIN players p ON p.player_id = cm.player_id
GROUP BY c.cluster_id;

-- 1. Join query: player participation with match and team outcome.
SELECT p.display_name, m.riot_match_id, t.side, mp.champion_name, mp.kills, mp.deaths, mp.assists, mp.win
FROM match_participants mp
JOIN players p ON p.player_id = mp.player_id
JOIN matches m ON m.match_id = mp.match_id
JOIN teams t ON t.team_id = mp.team_id
ORDER BY m.started_at, p.display_name;

-- 2. Nested select: players above the average opscore.
SELECT display_name, opscore
FROM players
WHERE opscore > (SELECT AVG(opscore) FROM players)
ORDER BY opscore DESC;

-- 3. Aggregate and HAVING: roles with strong average performance.
SELECT detected_role, COUNT(*) AS player_count, AVG(opscore) AS avg_opscore
FROM players
GROUP BY detected_role
HAVING COUNT(*) >= 2 AND AVG(opscore) > 7.0
ORDER BY avg_opscore DESC;

-- 4. JSON query: analysis runs whose JSON parameters request min_weight >= 3.
SELECT run_id, run_type, parameters ->> 'min_weight' AS min_weight
FROM analysis_runs
WHERE COALESCE((parameters ->> 'min_weight')::int, 0) >= 3;

-- 5. JSON result query: signed-balance runs with reported balanced ratio.
SELECT run_id, graph_mode, (result_summary ->> 'balanced_ratio')::numeric AS balanced_ratio
FROM analysis_runs
WHERE run_type = 'signed_balance';

-- 6. Set difference using EXCEPT: players not assigned to any cluster.
SELECT player_id, display_name FROM players
EXCEPT
SELECT p.player_id, p.display_name
FROM players p
JOIN cluster_members cm ON cm.player_id = p.player_id;

-- 7. Window function: role ranking by opscore.
SELECT display_name, detected_role, opscore,
       RANK() OVER (PARTITION BY detected_role ORDER BY opscore DESC) AS role_rank
FROM players
ORDER BY detected_role, role_rank;

-- 8. Conditional aggregation: relation evidence by type.
SELECT relation_type,
       COUNT(*) AS edge_count,
       SUM(ally_count) AS total_ally_evidence,
       SUM(enemy_count) AS total_enemy_evidence,
       AVG(confidence) AS avg_confidence
FROM player_relationships
GROUP BY relation_type;

-- 9. Self-join style graph query: ally edges with names on both endpoints.
SELECT a.display_name AS player_a, b.display_name AS player_b, r.ally_count, r.enemy_count, r.weight
FROM player_relationships r
JOIN players a ON a.player_id = r.player_a_id
JOIN players b ON b.player_id = r.player_b_id
WHERE r.relation_type = 'ally'
ORDER BY r.weight DESC;

-- 10. Correlated subquery: players whose feedscore is lower than their role average.
SELECT p.display_name, p.detected_role, p.feedscore
FROM players p
WHERE p.feedscore < (
    SELECT AVG(p2.feedscore)
    FROM players p2
    WHERE p2.detected_role = p.detected_role
)
ORDER BY p.detected_role, p.feedscore;

-- 11. Recursive CTE: walk relationship graph from player 1 up to depth 3.
WITH RECURSIVE relationship_walk(player_id, depth, path) AS (
    SELECT 1::bigint, 0, ARRAY[1::bigint]
    UNION ALL
    SELECT
        CASE WHEN r.player_a_id = rw.player_id THEN r.player_b_id ELSE r.player_a_id END,
        rw.depth + 1,
        rw.path || CASE WHEN r.player_a_id = rw.player_id THEN r.player_b_id ELSE r.player_a_id END
    FROM relationship_walk rw
    JOIN player_relationships r
      ON r.player_a_id = rw.player_id OR r.player_b_id = rw.player_id
    WHERE rw.depth < 3
      AND NOT (CASE WHEN r.player_a_id = rw.player_id THEN r.player_b_id ELSE r.player_a_id END = ANY(rw.path))
)
SELECT rw.depth, p.display_name, rw.path
FROM relationship_walk rw
JOIN players p ON p.player_id = rw.player_id
ORDER BY rw.depth, p.display_name;

-- 12. View usage: strongest summary rows.
SELECT *
FROM v_player_performance_summary
WHERE match_count >= 30
ORDER BY opscore DESC, average_volatility ASC;

-- 13. Cluster health report with bridge count.
SELECT cluster_code, cluster_type, density, live_average_opscore, live_average_feedscore, bridge_count
FROM v_cluster_health
WHERE actual_member_count > 0
ORDER BY density DESC;

-- 14. Many-table query: path request endpoints with analysis run metadata.
SELECT pq.path_query_id, ar.run_type, pq.algorithm,
       s.display_name AS source_player,
       t.display_name AS target_player,
       pq.path_length,
       pq.path_json
FROM path_queries pq
JOIN analysis_runs ar ON ar.run_id = pq.run_id
JOIN players s ON s.player_id = pq.source_player_id
JOIN players t ON t.player_id = pq.target_player_id
ORDER BY pq.path_length NULLS LAST;

-- 15. Anti-join: players who never appear as a path source.
SELECT p.player_id, p.display_name
FROM players p
LEFT JOIN path_queries pq ON pq.source_player_id = p.player_id
WHERE pq.path_query_id IS NULL
ORDER BY p.display_name;

-- 16. Aggregate over participant stats.
SELECT p.display_name,
       COUNT(mp.participant_id) AS sampled_matches,
       AVG(mp.kills) AS avg_kills,
       AVG(mp.deaths) AS avg_deaths,
       AVG(mp.assists) AS avg_assists,
       SUM(mp.damage_to_champions) AS total_damage
FROM players p
JOIN match_participants mp ON mp.player_id = p.player_id
GROUP BY p.player_id
ORDER BY total_damage DESC;

-- 17. CASE expression: classify relationship balance evidence.
SELECT a.display_name AS player_a,
       b.display_name AS player_b,
       CASE
           WHEN ally_count > enemy_count THEN 'dominant ally'
           WHEN enemy_count > ally_count THEN 'dominant enemy'
           ELSE 'tie'
       END AS dominant_sign,
       confidence
FROM player_relationships r
JOIN players a ON a.player_id = r.player_a_id
JOIN players b ON b.player_id = r.player_b_id
ORDER BY confidence DESC;

-- 18. JSON array expansion: list node ids stored in a path.
SELECT pq.path_query_id, jsonb_array_elements_text(pq.path_json)::bigint AS path_node_id
FROM path_queries pq
ORDER BY pq.path_query_id, path_node_id;

-- 19. Date grouping: analysis work per day.
SELECT started_at::date AS run_date, COUNT(*) AS run_count, SUM(processed_nodes) AS nodes_processed
FROM analysis_runs
GROUP BY started_at::date
ORDER BY run_date;

-- 20. Composite analytical query: high performers in dense clusters with stable snapshots.
SELECT p.display_name, c.cluster_code, c.density, ps.opscore, ps.volatility_index
FROM players p
JOIN cluster_members cm ON cm.player_id = p.player_id
JOIN clusters c ON c.cluster_id = cm.cluster_id
JOIN performance_snapshots ps ON ps.player_id = p.player_id
WHERE c.density >= 0.6
  AND ps.opscore >= 7.0
  AND ps.volatility_index < 1.0
ORDER BY c.density DESC, ps.opscore DESC;
