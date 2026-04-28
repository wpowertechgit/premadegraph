DROP TABLE IF EXISTS path_queries CASCADE;
DROP TABLE IF EXISTS performance_snapshots CASCADE;
DROP TABLE IF EXISTS cluster_members CASCADE;
DROP TABLE IF EXISTS clusters CASCADE;
DROP TABLE IF EXISTS player_relationships CASCADE;
DROP TABLE IF EXISTS match_participants CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS analysis_runs CASCADE;
DROP TABLE IF EXISTS players CASCADE;

CREATE TABLE players (
    player_id BIGSERIAL PRIMARY KEY,
    puuid TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'EUNE',
    detected_role TEXT NOT NULL DEFAULT 'UNKNOWN',
    role_confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
    match_count INTEGER NOT NULL DEFAULT 0,
    opscore NUMERIC(5,2) NOT NULL DEFAULT 0,
    feedscore NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (opscore BETWEEN 0 AND 10),
    CHECK (feedscore BETWEEN 0 AND 10)
);

CREATE TABLE matches (
    match_id BIGSERIAL PRIMARY KEY,
    riot_match_id TEXT NOT NULL UNIQUE,
    queue_type TEXT NOT NULL,
    region TEXT NOT NULL,
    patch_version TEXT NOT NULL,
    started_at TIMESTAMP NOT NULL,
    duration_seconds INTEGER NOT NULL,
    winning_side TEXT NOT NULL CHECK (winning_side IN ('BLUE', 'RED')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE teams (
    team_id BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    side TEXT NOT NULL CHECK (side IN ('BLUE', 'RED')),
    win BOOLEAN NOT NULL,
    kills INTEGER NOT NULL DEFAULT 0,
    towers_destroyed INTEGER NOT NULL DEFAULT 0,
    dragons_taken INTEGER NOT NULL DEFAULT 0,
    barons_taken INTEGER NOT NULL DEFAULT 0,
    UNIQUE (match_id, side)
);

CREATE TABLE match_participants (
    participant_id BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    team_id BIGINT NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    champion_name TEXT NOT NULL,
    lane TEXT NOT NULL,
    role TEXT NOT NULL,
    kills INTEGER NOT NULL DEFAULT 0,
    deaths INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    gold_earned INTEGER NOT NULL DEFAULT 0,
    vision_score INTEGER NOT NULL DEFAULT 0,
    damage_to_champions INTEGER NOT NULL DEFAULT 0,
    win BOOLEAN NOT NULL,
    UNIQUE (match_id, player_id)
);

CREATE TABLE player_relationships (
    relationship_id BIGSERIAL PRIMARY KEY,
    player_a_id BIGINT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    player_b_id BIGINT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL CHECK (relation_type IN ('ally', 'enemy', 'mixed')),
    ally_count INTEGER NOT NULL DEFAULT 0,
    enemy_count INTEGER NOT NULL DEFAULT 0,
    weight NUMERIC(8,3) NOT NULL DEFAULT 0,
    confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
    first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (player_a_id <> player_b_id),
    UNIQUE (player_a_id, player_b_id)
);

CREATE TABLE clusters (
    cluster_id BIGSERIAL PRIMARY KEY,
    cluster_code TEXT NOT NULL UNIQUE,
    cluster_type TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    member_count INTEGER NOT NULL DEFAULT 0,
    density NUMERIC(8,5) NOT NULL DEFAULT 0,
    average_opscore NUMERIC(5,2) NOT NULL DEFAULT 0,
    average_feedscore NUMERIC(5,2) NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cluster_members (
    cluster_member_id BIGSERIAL PRIMARY KEY,
    cluster_id BIGINT NOT NULL REFERENCES clusters(cluster_id) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    member_role TEXT NOT NULL DEFAULT 'member',
    is_bridge BOOLEAN NOT NULL DEFAULT FALSE,
    is_star BOOLEAN NOT NULL DEFAULT FALSE,
    centrality_score NUMERIC(12,6) NOT NULL DEFAULT 0,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cluster_id, player_id)
);

CREATE TABLE analysis_runs (
    run_id BIGSERIAL PRIMARY KEY,
    run_type TEXT NOT NULL,
    graph_mode TEXT NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'running',
    processed_nodes INTEGER NOT NULL DEFAULT 0,
    processed_edges INTEGER NOT NULL DEFAULT 0,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE performance_snapshots (
    snapshot_id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    run_id BIGINT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
    match_sample_size INTEGER NOT NULL DEFAULT 0,
    opscore NUMERIC(5,2) NOT NULL DEFAULT 0,
    feedscore NUMERIC(5,2) NOT NULL DEFAULT 0,
    score_spread NUMERIC(8,4) NOT NULL DEFAULT 0,
    sample_quality TEXT NOT NULL DEFAULT 'sample',
    source_dataset TEXT NOT NULL DEFAULT 'flexset',
    computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (player_id, run_id)
);

CREATE TABLE path_queries (
    path_query_id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
    source_player_id BIGINT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    target_player_id BIGINT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    algorithm TEXT NOT NULL,
    graph_mode TEXT NOT NULL,
    path_length INTEGER,
    total_weight NUMERIC(10,3),
    path_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (source_player_id <> target_player_id)
);

CREATE INDEX idx_matches_started_at ON matches(started_at);
CREATE INDEX idx_participants_player ON match_participants(player_id);
CREATE INDEX idx_relationships_a ON player_relationships(player_a_id);
CREATE INDEX idx_relationships_b ON player_relationships(player_b_id);
CREATE INDEX idx_cluster_members_player ON cluster_members(player_id);
CREATE INDEX idx_snapshots_player ON performance_snapshots(player_id);
CREATE INDEX idx_path_queries_source_target ON path_queries(source_player_id, target_player_id);
