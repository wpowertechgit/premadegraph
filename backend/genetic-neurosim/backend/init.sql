-- NeuroSim cluster seed schema.
-- Only needed when feeding cluster profiles from Postgres instead of PREMADEGRAPH_URL.
-- Artifact columns (a_combat, a_risk, etc.) are NOT stored here; they come from the
-- PREMADEGRAPH_URL cluster-export endpoint.

CREATE TABLE IF NOT EXISTS player_clusters (
    cluster_id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    size_ratio          FLOAT   NOT NULL DEFAULT 0.5,
    mean_opscore        FLOAT   NOT NULL DEFAULT 50.0,
    opscore_stddev      FLOAT   NOT NULL DEFAULT 10.0,
    cohesion            FLOAT   NOT NULL DEFAULT 0.5,
    internal_edge_ratio FLOAT   NOT NULL DEFAULT 0.3
);
