use serde::{Deserialize, Serialize};

// ─── WarStatus ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WarStatus {
    Active,
    Peace,
    AttackerWon,
    DefenderWon,
    /// R2: War terminated because one participant died before resolution.
    WarCancelled,
}

// ─── WarKind ──────────────────────────────────────────────────────────────────

/// Distinguishes a full-scale existential war from a limited border skirmish.
/// BorderDispute wars resolve by transferring only the contested tiles — neither
/// tribe is absorbed or destroyed. FullScale wars end with full absorption.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WarKind {
    FullScale,
    BorderDispute,
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
    pub kind: WarKind,
    pub attacker_casualties: u32,
    pub defender_casualties: u32,
    /// Home tile of defender at war start; used as approximate battle location.
    pub battle_tile: Option<u32>,
    /// For BorderDispute wars: the specific tile indices at stake.
    /// Empty for FullScale wars.
    pub contested_tiles: Vec<u32>,
}

// ─── Response types ───────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct WarSummary {
    pub war_id: u32,
    pub attacker_id: u32,
    pub defender_id: u32,
    pub start_tick: u64,
    pub status: WarStatus,
    pub kind: WarKind,
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
