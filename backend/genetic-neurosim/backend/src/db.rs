use crate::simulation::{ClusterProfile, ControlConfig};
use sqlx::postgres::PgPoolOptions;
use sqlx::Row;
use std::env;

#[derive(serde::Deserialize)]
struct PremadegraphExportResponse {
    clusters: Vec<ClusterProfile>,
}

pub struct Database {
    pool: sqlx::PgPool,
}

impl Database {
    pub async fn connect() -> Result<Self, sqlx::Error> {
        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/premadegraph".to_string());

        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await?;

        Ok(Self { pool })
    }

    /// Returns a Database that skips postgres and relies solely on PREMADEGRAPH_URL.
    pub fn dummy() -> Self {
        // Build a pool that will never actually be used (HTTP path takes priority).
        // We create a disconnected pool by using a deliberately invalid URL — it
        // won't be connected to until `fetch_from_postgres` is called, which only
        // happens when `try_fetch_from_premadegraph` returns None.
        let pool = sqlx::PgPool::connect_lazy("postgres://dummy:dummy@localhost/dummy")
            .expect("lazy pool construction");
        Self { pool }
    }

    pub async fn fetch_simulation_config(&self) -> Result<ControlConfig, sqlx::Error> {
        if let Some(config) = try_fetch_from_premadegraph().await {
            return Ok(config);
        }
        self.fetch_from_postgres().await
    }

    async fn fetch_from_postgres(&self) -> Result<ControlConfig, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT cluster_id::TEXT, size_ratio, mean_opscore, opscore_stddev, cohesion, internal_edge_ratio FROM player_clusters",
        )
        .fetch_all(&self.pool)
        .await?;

        let profiles = rows
            .into_iter()
            .map(|r| ClusterProfile {
                id: r.get::<String, _>("cluster_id"),
                size_ratio: r.get::<f64, _>("size_ratio") as f32,
                mean_opscore: r.get::<f64, _>("mean_opscore") as f32,
                opscore_stddev: r.get::<f64, _>("opscore_stddev") as f32,
                cohesion: r.get::<f64, _>("cohesion") as f32,
                internal_edge_ratio: r.get::<f64, _>("internal_edge_ratio") as f32,
                a_combat: 0.0,
                a_risk: 0.0,
                a_resource: 0.0,
                a_map_objective: 0.0,
                a_team: 0.0,
                fight_conversion: 0.0,
                damage_pressure: 0.0,
                death_cost: 0.0,
                survival_quality: 0.0,
                economy: 0.0,
                tempo: 0.0,
                vision_control: 0.0,
                objective_conversion: 0.0,
                setup_control: 0.0,
                protection_support: 0.0,
                feed_risk: 0.0,
                cluster_size: 0,
                founder_puuids: vec![],
            })
            .collect();

        let mut config = ControlConfig::default();
        config.clusters = profiles;
        Ok(config)
    }
}

async fn try_fetch_from_premadegraph() -> Option<ControlConfig> {
    let base_url = env::var("PREMADEGRAPH_URL").ok()?;
    let dataset_id = env::var("PREMADEGRAPH_DATASET_ID").unwrap_or_default();

    let url = if dataset_id.is_empty() {
        format!("{}/api/neurosim/cluster-export", base_url.trim_end_matches('/'))
    } else {
        format!(
            "{}/api/neurosim/datasets/{}/cluster-export",
            base_url.trim_end_matches('/'),
            dataset_id
        )
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .ok()?;

    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        println!("[db] premadegraph cluster-export returned {}", resp.status());
        return None;
    }

    let export: PremadegraphExportResponse = resp.json().await.ok()?;
    println!(
        "[db] loaded {} clusters from premadegraph ({})",
        export.clusters.len(),
        url
    );

    let mut config = ControlConfig::default();
    config.clusters = export.clusters;
    Some(config)
}
