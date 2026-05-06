// ─── ArtifactSnapshot ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ArtifactSnapshot {
    pub a_combat: f32,
    pub a_risk: f32,
    pub a_resource: f32,
    pub a_map_objective: f32,
    pub a_team: f32,
}

// ─── TombstoneRecord ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TombstoneRecord {
    pub tribe_id: u32,
    pub cluster_id: String,
    pub tick_died: u64,
    pub generation_died: u32,
    pub population_at_death: u32,
    pub territory_at_death: usize,
    pub cause: String,
    /// Compact lineage summary: seed cluster references and generation milestones.
    pub lineage_summary: Vec<String>,
    pub final_artifacts: ArtifactSnapshot,
}

// ─── TombstoneLedger ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TombstoneLedger {
    records: Vec<TombstoneRecord>,
}

impl TombstoneLedger {
    pub fn new() -> Self {
        Self { records: Vec::new() }
    }

    /// Record a tribe's death. Takes snapshot of tribe state at death time.
    /// `lineage` filter: only entries starting with "seed-" or "gen-" for compact summary.
    pub fn record_death(&mut self, tribe: &crate::tribes::TribeState, tick: u64, cause: &str) {
        let lineage_summary: Vec<String> = tribe
            .lineage
            .iter()
            .filter(|s| s.starts_with("seed-") || s.starts_with("gen-"))
            .cloned()
            .collect();

        self.records.push(TombstoneRecord {
            tribe_id: tribe.id as u32,
            cluster_id: tribe.cluster_id.clone(),
            tick_died: tick,
            generation_died: tribe.generation,
            population_at_death: tribe.population,
            territory_at_death: tribe.territory.len(),
            cause: cause.to_string(),
            lineage_summary,
            final_artifacts: ArtifactSnapshot {
                a_combat: tribe.stats.a_combat,
                a_risk: tribe.stats.a_risk,
                a_resource: tribe.stats.a_resource,
                a_map_objective: tribe.stats.a_map_objective,
                a_team: tribe.stats.a_team,
            },
        });
    }

    /// Check if a tribe_id has a tombstone (already dead).
    pub fn is_dead(&self, tribe_id: u32) -> bool {
        self.records.iter().any(|r| r.tribe_id == tribe_id)
    }

    /// All tombstone records (extinct tribes).
    pub fn all_records(&self) -> &[TombstoneRecord] {
        &self.records
    }

    /// Number of recorded deaths.
    pub fn count(&self) -> usize {
        self.records.len()
    }
}
