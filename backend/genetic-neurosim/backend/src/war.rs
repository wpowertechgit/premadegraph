use serde::{Deserialize, Serialize};

// ─── WarStatus ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WarStatus {
    Active,
    Peace,
    AttackerWon,
    DefenderWon,
}

// ─── WarState ─────────────────────────────────────────────────────────────────

/// First-class war record tracking an ongoing or resolved conflict.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarState {
    pub war_id: u32,
    pub attacker_id: u32,
    pub defender_id: u32,
    pub start_tick: u64,
    pub status: WarStatus,
    pub attacker_casualties: u32,
    pub defender_casualties: u32,
    /// Home tile of defender at war start; used as approximate battle location.
    pub battle_tile: Option<u32>,
}

// ─── Response types ───────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct WarSummary {
    pub war_id: u32,
    pub attacker_id: u32,
    pub defender_id: u32,
    pub start_tick: u64,
    pub status: WarStatus,
    pub attacker_casualties: u32,
    pub defender_casualties: u32,
    pub battle_tile: Option<u32>,
    /// Current tick minus start_tick, computed at query time.
    pub duration_ticks: u64,
}

#[derive(Serialize)]
pub struct ActiveWarsResponse {
    pub wars: Vec<WarSummary>,
    pub active_count: usize,
}
