// ─── ArtifactSnapshot ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ArtifactSnapshot {
    pub a_combat: f32,
    pub a_risk: f32,
    pub a_resource: f32,
    pub a_map_objective: f32,
    pub a_team: f32,
}

// ─── ExtinctionCause ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
pub enum ExtinctionCause {
    Starved,
    ConqueredByWar { conqueror_id: u32 },
    AbsorbedByAlliance { absorber_id: u32 },
    Imploded,
    Unknown,
}

impl ExtinctionCause {
    pub fn to_cause_string(&self) -> String {
        match self {
            Self::Starved => "starved".into(),
            Self::ConqueredByWar { conqueror_id } => format!("conquered-by-{}", conqueror_id),
            Self::AbsorbedByAlliance { absorber_id } => format!("absorbed-by-{}", absorber_id),
            Self::Imploded => "imploded".into(),
            Self::Unknown => "unknown".into(),
        }
    }
}

// ─── TombstoneRecord ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TombstoneRecord {
    pub tribe_id: u32,
    pub cluster_id: String,
    pub tick_died: u64,
    pub generation_died: u32,
    pub population_at_death: u32,
    pub max_population: u32,
    pub territory_at_death: usize,
    pub polity_tier_reached: String,
    pub cause: String,
    pub extinction_cause: ExtinctionCause,
    /// Compact lineage summary: seed cluster references and generation milestones.
    pub lineage_summary: Vec<String>,
    pub final_artifacts: ArtifactSnapshot,
    /// PUUIDs of the founding players from the flexset cluster profile.
    /// Links the simulation tribe back to real League of Legends players.
    pub founder_puuids: Vec<String>,
    /// Display names resolved from the dataset DB at tribe creation time.
    pub founder_names: Vec<String>,
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
    pub fn record_death(&mut self, tribe: &crate::tribes::TribeState, tick: u64, extinction_cause: ExtinctionCause) {
        if self.is_dead(tribe.id as u32) {
            return;
        }

        let lineage_summary: Vec<String> = tribe
            .lineage
            .iter()
            .filter(|s| {
                s.starts_with("seed-")
                    || s.starts_with("gen-")
                    || s.starts_with("merged-")
                    || s.starts_with("merge-parent-")
            })
            .cloned()
            .collect();

        let founder_puuids: Vec<String> = tribe.founders.iter().map(|f| f.puuid.clone()).collect();
        let founder_names: Vec<String>  = tribe.founders.iter().map(|f| f.name.clone()).collect();

        self.records.push(TombstoneRecord {
            tribe_id: tribe.id as u32,
            cluster_id: tribe.cluster_id.clone(),
            tick_died: tick,
            generation_died: tribe.generation,
            population_at_death: tribe.population,
            max_population: tribe.max_population,
            territory_at_death: tribe.territory.len(),
            polity_tier_reached: format!("{:?}", tribe.polity_tier),
            cause: extinction_cause.to_cause_string(),
            extinction_cause,
            lineage_summary,
            final_artifacts: ArtifactSnapshot {
                a_combat: tribe.stats.a_combat,
                a_risk: tribe.stats.a_risk,
                a_resource: tribe.stats.a_resource,
                a_map_objective: tribe.stats.a_map_objective,
                a_team: tribe.stats.a_team,
            },
            founder_puuids,
            founder_names,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tribes::{TribeState, BehaviorState, PolityTier, SpecializationRole, RiverCrossing, TribeStats};

    fn make_tribe(id: usize, lineage: Vec<String>) -> TribeState {
        let t = TribeState {
            id,
            cluster_id: format!("cluster-{}", id),
            population: 10,
            max_population: 1000,
            food_stores: 50.0,
            territory: vec![0],
            home_tile: 0,
            behavior: BehaviorState::Settling,
            target_tribe: None,
            ally_tribe: None,
            ticks_in_state: 0,
            ticks_near_river: 0,
            river_crossings: 0,
            river_crossing_tech: RiverCrossing::None,
            stats: TribeStats {
                a_combat: 0.5, a_risk: 0.4, a_resource: 0.6,
                a_map_objective: 0.5, a_team: 0.5, feed_risk: 0.1,
                fight_conversion: 0.0, damage_pressure: 0.0, death_cost: 0.0,
                survival_quality: 0.0, economy: 0.0, tempo: 0.0,
                vision_control: 0.0, objective_conversion: 0.0,
                setup_control: 0.0, protection_support: 0.0,
            },
            genome: None,
            generation: 2,
            lineage,
            founders: vec![],
            ticks_alive: 100,
            last_inputs: [0.0; crate::simulation::INPUT_COUNT],
            last_outputs: [0.0; crate::simulation::OUTPUT_COUNT],
            alive: false,
            polity_tier: PolityTier::Tribe,
            parent_polity_id: None,
            constituent_tribe_ids: vec![],
            specialization_role: SpecializationRole::Generalist,
            veterancy_xp: 0,
            main_camp_tile: 0,
            citizens: vec![],
            last_expansion_tick: 0,
            expansion_cooldown_ticks: 8,
            tile_integration: std::collections::HashMap::new(),
            migration_target_tile: u16::MAX,
            fitness_score: 0.0,
            tier_entered_tick: 0,
            war_exhaustion_ticks: 0,
        };
        t
    }

    #[test]
    fn tombstone_captures_merger_history() {
        let mut ledger = TombstoneLedger::new();
        let tribe = make_tribe(1, vec![
            "gen-0-fitness-0.42".to_string(),
            "merged-cluster-beta".to_string(),
            "some-other-entry".to_string(),
        ]);
        ledger.record_death(&tribe, 150, ExtinctionCause::Unknown);

        let rec = ledger.all_records().first().unwrap();
        assert!(rec.lineage_summary.iter().any(|s| s == "merged-cluster-beta"),
            "merger entry must appear in tombstone lineage_summary");
        assert!(rec.lineage_summary.iter().any(|s| s.starts_with("gen-")),
            "generation entry must appear in tombstone lineage_summary");
        assert!(!rec.lineage_summary.iter().any(|s| s == "some-other-entry"),
            "unrecognised entries must be excluded");
    }

    #[test]
    fn tombstone_is_dead_idempotent() {
        let mut ledger = TombstoneLedger::new();
        let tribe = make_tribe(7, vec![]);
        assert!(!ledger.is_dead(7));
        ledger.record_death(&tribe, 10, ExtinctionCause::Starved);
        assert!(ledger.is_dead(7));
        assert_eq!(ledger.count(), 1);
    }

    #[test]
    fn tombstone_records_cause_and_generation() {
        let mut ledger = TombstoneLedger::new();
        let tribe = make_tribe(3, vec![]);
        ledger.record_death(&tribe, 500, ExtinctionCause::ConqueredByWar { conqueror_id: 5 });
        let rec = &ledger.all_records()[0];
        assert_eq!(rec.cause, "conquered-by-5");
        assert_eq!(rec.generation_died, 2);
        assert_eq!(rec.tick_died, 500);
    }

    #[test]
    fn founder_puuids_captured_in_tombstone() {
        use crate::tribes::FounderTag;
        let mut ledger = TombstoneLedger::new();
        let mut tribe = make_tribe(9, vec![]);
        tribe.founders = vec![
            FounderTag { puuid: "puuid-aaa".into(), name: "PlayerA".into(), inherited_at_generation: 0 },
            FounderTag { puuid: "puuid-bbb".into(), name: "PlayerB".into(), inherited_at_generation: 0 },
        ];
        ledger.record_death(&tribe, 100, ExtinctionCause::Starved);
        let rec = &ledger.all_records()[0];
        assert_eq!(rec.founder_puuids, vec!["puuid-aaa", "puuid-bbb"]);
    }

    #[test]
    fn extinction_cause_serializes_correctly() {
        let cause = ExtinctionCause::ConqueredByWar { conqueror_id: 42 };
        let json = serde_json::to_value(&cause).unwrap();
        assert_eq!(json["type"], "ConqueredByWar");
        assert_eq!(json["conqueror_id"], 42);
        assert_eq!(cause.to_cause_string(), "conquered-by-42");
    }

    #[test]
    fn extinction_cause_strings() {
        assert_eq!(ExtinctionCause::Starved.to_cause_string(), "starved");
        assert_eq!(ExtinctionCause::Imploded.to_cause_string(), "imploded");
        assert_eq!(ExtinctionCause::Unknown.to_cause_string(), "unknown");
        assert_eq!(ExtinctionCause::AbsorbedByAlliance { absorber_id: 7 }.to_cause_string(), "absorbed-by-7");
    }
}
