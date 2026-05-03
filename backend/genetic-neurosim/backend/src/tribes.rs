/// Tribal simulation data structures.
///
/// `TribeState` is the canonical runtime record for a single tribe, seeded from
/// a `ClusterProfile` produced by the graph-analytics pipeline.  The neural
/// genome (`crate::simulation::Genome`) is stored as an `Option` because it
/// requires an `InnovationTracker` + RNG to construct; callers that run the
/// simulation loop are expected to populate it before the first brain evaluation.

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[repr(u8)]
pub enum BehaviorState {
    Settling = 0,
    Foraging = 1,
    Migrating = 2,
    AtWar = 3,
    Occupying = 4,
    Peace = 5,
    Allied = 6,
    Starving = 7,
    Desperate = 8,
    Imploding = 9,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum RiverCrossing {
    None,
    Bridges,
    Boats,
}

impl Default for RiverCrossing {
    fn default() -> Self {
        RiverCrossing::None
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FounderTag {
    pub puuid: String,
    pub inherited_at_generation: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TribeStats {
    pub a_combat: f32,
    pub a_risk: f32,
    pub a_resource: f32,
    pub a_map_objective: f32,
    pub a_team: f32,
    pub feed_risk: f32,
    pub fight_conversion: f32,
    pub damage_pressure: f32,
    pub death_cost: f32,
    pub survival_quality: f32,
    pub economy: f32,
    pub tempo: f32,
    pub vision_control: f32,
    pub objective_conversion: f32,
    pub setup_control: f32,
    pub protection_support: f32,
}

impl TribeStats {
    pub fn from_profile(p: &crate::simulation::ClusterProfile) -> TribeStats {
        TribeStats {
            a_combat: p.a_combat,
            a_risk: p.a_risk,
            a_resource: p.a_resource,
            a_map_objective: p.a_map_objective,
            a_team: p.a_team,
            feed_risk: p.feed_risk,
            fight_conversion: p.fight_conversion,
            damage_pressure: p.damage_pressure,
            death_cost: p.death_cost,
            survival_quality: p.survival_quality,
            economy: p.economy,
            tempo: p.tempo,
            vision_control: p.vision_control,
            objective_conversion: p.objective_conversion,
            setup_control: p.setup_control,
            protection_support: p.protection_support,
        }
    }
}

/// Full runtime state for one tribe.
///
/// `genome` is `Option` because a tribe created from a cluster profile does not
/// yet have an initialised NEAT genome — the simulation engine assigns one
/// (via `Genome::new`) before the first tick.  The field is skipped during
/// serialisation so that HTTP responses stay clean JSON.
#[derive(Debug, Clone, serde::Serialize)]
pub struct TribeState {
    pub id: usize,
    pub cluster_id: String,
    pub population: u32,
    pub max_population: u32,
    pub food_stores: f32,
    pub territory: Vec<u16>,
    pub home_tile: u16,
    pub behavior: BehaviorState,
    pub target_tribe: Option<usize>,
    pub ally_tribe: Option<usize>,
    pub ticks_in_state: u32,
    pub ticks_near_river: u32,
    pub river_crossings: u32,
    pub river_crossing_tech: RiverCrossing,
    pub stats: TribeStats,
    /// Neural genome — assigned by the simulation engine before the first tick.
    #[serde(skip)]
    pub genome: Option<crate::simulation::Genome>,
    pub generation: u32,
    pub lineage: Vec<String>,
    #[serde(skip_serializing)]
    pub founders: Vec<FounderTag>,
    pub ticks_alive: u64,
    pub last_inputs: [f32; 8],
    pub last_outputs: [f32; 3],
    pub alive: bool,
}

impl TribeState {
    /// Build a tribe from a cluster profile, placing it on `home_tile`.
    ///
    /// The genome is left as `None`; the caller must assign one before running
    /// the simulation loop (use `Genome::new(8, 3)` or `Genome::minimal`).
    pub fn from_cluster(
        id: usize,
        profile: &crate::simulation::ClusterProfile,
        home_tile: u16,
    ) -> TribeState {
        let max_population = (profile.cluster_size * 25).min(2000).max(50);
        let founders = profile
            .founder_puuids
            .iter()
            .map(|p| FounderTag {
                puuid: p.clone(),
                inherited_at_generation: 0,
            })
            .collect();
        TribeState {
            id,
            cluster_id: profile.id.clone(),
            population: max_population / 2,
            max_population,
            food_stores: (max_population / 2) as f32 * 0.5,
            territory: vec![home_tile],
            home_tile,
            behavior: BehaviorState::Settling,
            target_tribe: None,
            ally_tribe: None,
            ticks_in_state: 0,
            ticks_near_river: 0,
            river_crossings: 0,
            river_crossing_tech: RiverCrossing::None,
            stats: TribeStats::from_profile(profile),
            genome: None,
            generation: 0,
            lineage: vec![],
            founders,
            ticks_alive: 0,
            last_inputs: [0.0; 8],
            last_outputs: [0.0; 3],
            alive: true,
        }
    }

    /// River move cost modifier based on current tech level.
    pub fn river_move_cost(&self) -> f32 {
        match self.river_crossing_tech {
            RiverCrossing::None => 3.0,
            RiverCrossing::Bridges => 1.5,
            RiverCrossing::Boats => 0.8,
        }
    }
}
