use serde::{Deserialize, Serialize};

/// Sentinel value for tribe_id / other_tribe_id when no tribe is involved.
pub const NO_TRIBE: u32 = u32::MAX;
/// Sentinel value for tile_id when no tile is involved.
pub const NO_TILE: u32 = u32::MAX;
/// Sentinel value for war_id when no war is involved.
pub const NO_WAR: u32 = u32::MAX;

// ─── EventSeverity ────────────────────────────────────────────────────────────

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventSeverity {
    Debug = 0,
    Info = 1,
    Important = 2,
    Critical = 3,
}

// ─── EventType ────────────────────────────────────────────────────────────────

#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    // Lifecycle (0–9)
    TribeSpawned = 0,
    GenerationAdvanced = 1,
    TribeExtinct = 2,
    SimulationReset = 3,
    TribeSurvived = 4,

    // Resources (10–19)
    FoodGained = 10,
    FoodShortage = 11,
    StarvationEntered = 12,
    ResourceBloomReceived = 13,

    // Territory (20–29)
    TileClaimed = 20,
    TileLost = 21,
    TribeAbsorbed = 22,
    TileFortified = 23,
    TribeMigrated = 24,

    // War (30–39)
    WarDeclared = 30,
    CombatRound = 31,
    WarEnded = 32,
    WarTimeout = 33,

    // Diplomacy (40–49)
    AllianceFormed = 40,
    AllianceBroken = 41,

    // Neural/Genetic (50–59)
    BehaviorChanged = 50,
    GenomeMutated = 51,
    NeuralDecision = 52,

    // Tech (60–69)
    BridgesUnlocked = 60,
    BoatsUnlocked = 61,
    RiverCrossed = 62,

    // Intervention (70–79)
    InterventionApplied = 70,
}

// ─── SimulationEvent ──────────────────────────────────────────────────────────

/// Compact event record. Sentinel values: NO_TRIBE, NO_TILE, NO_WAR for absent fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationEvent {
    pub event_id: u64,
    pub tick: u64,
    pub generation: u32,
    pub event_type: EventType,
    pub severity: EventSeverity,
    /// Primary tribe involved. NO_TRIBE if global event.
    pub tribe_id: u32,
    /// Secondary tribe (war target, ally, absorbed, etc.). NO_TRIBE if absent.
    pub other_tribe_id: u32,
    /// Tile where event occurred. NO_TILE if absent.
    pub tile_id: u32,
    /// War associated with the event. NO_WAR if absent.
    pub war_id: u32,
    /// Numeric payload slot A (population, food, casualties, etc.).
    pub value_a: f32,
    /// Numeric payload slot B (ratio, delta, secondary value, etc.).
    pub value_b: f32,
    /// Packed flags for booleans / small categorical data.
    pub flags: u32,
}

impl SimulationEvent {
    pub fn new(
        event_id: u64,
        tick: u64,
        generation: u32,
        event_type: EventType,
        severity: EventSeverity,
        tribe_id: u32,
    ) -> Self {
        Self {
            event_id,
            tick,
            generation,
            event_type,
            severity,
            tribe_id,
            other_tribe_id: NO_TRIBE,
            tile_id: NO_TILE,
            war_id: NO_WAR,
            value_a: 0.0,
            value_b: 0.0,
            flags: 0,
        }
    }
}
