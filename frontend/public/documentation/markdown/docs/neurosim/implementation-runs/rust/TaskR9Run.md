# Task R9 Run — Tombstone Ledger: Founder PUUIDs, Structured Cause, Conqueror Wiring, Dedicated Log

**Completed:** 2026-05-18
**Branch:** main
**Status:** Done

## What Was Done

Wired founder PUUIDs from the server.js cluster export into Rust tribes so tombstones record real player identities. Added a structured `ExtinctionCause` enum replacing the flat opaque cause string (kept for backward compat). Wired conqueror IDs at all four death callsites. Added a tribe-level conquest/absorption DAG to `LineageRegistry`. Added a dedicated `.tombstones.json` report written after each CLI run.

### server.js Fix (Root Cause — Founder PUUIDs)

**`backend/server.js`** (`computeNeurosimClusterProfiles`)
- Added `GROUP_CONCAT(DISTINCT cm.puuid) AS member_puuids` to the cluster SQL SELECT
- Added `founder_puuids: r.member_puuids ? r.member_puuids.split(',') : []` to the `.map()` return object
- `ClusterProfile` in Rust already has `founder_puuids: Vec<String>` with `#[serde(default)]` — no Rust change needed
- Without this fix, `tribe.founders` was always empty; tombstones could never record player identities

### Rust Changes

**`backend/src/tombstone.rs`**
- Added `ExtinctionCause` enum with `#[serde(tag = "type")]`:
  - `Starved`
  - `ConqueredByWar { conqueror_id: u32 }`
  - `AbsorbedByAlliance { absorber_id: u32 }`
  - `Imploded`
  - `Unknown`
- Added `impl ExtinctionCause { pub fn to_cause_string(&self) -> String }` — derives the existing `cause: String` from the enum
- Added `pub extinction_cause: ExtinctionCause` field to `TombstoneRecord` (alongside the kept `cause: String`)
- Changed `record_death` signature: `cause: &str` → `extinction_cause: ExtinctionCause`
- `cause` field now derived from `extinction_cause.to_cause_string()`
- Added 4 new tests: `founder_puuids_captured_in_tombstone`, `extinction_cause_serializes_correctly`, `extinction_cause_strings`
- Updated 3 existing tests to pass `ExtinctionCause` values instead of raw strings

**`backend/src/lineage_registry.rs`**
- Added `TribeLineageNode` struct: `tribe_id`, `cluster_id`, `tick_born`, `tick_died: Option<u64>`, `extinction_cause: Option<ExtinctionCause>`
- Added `tribe_nodes: HashMap<u32, TribeLineageNode>` to `LineageRegistry`
- Added methods:
  - `register_tribe(tribe_id, cluster_id, tick)` — called at spawn
  - `record_tribe_death(tribe_id, cause, tick)` — fills `tick_died` and `extinction_cause`
  - `tribe_node(tribe_id) -> Option<&TribeLineageNode>`
  - `all_tribe_nodes() -> impl Iterator<Item = &TribeLineageNode>`
- Added `tribe_dag_register_and_death` test

**`backend/src/simulation.rs`**
- Line ~1645 (starvation): `ExtinctionCause::Starved` + `lineage_registry.record_tribe_death`
- Line ~2924 (attacker dies, defender won): `ExtinctionCause::ConqueredByWar { conqueror_id: def_id }` + `lineage_registry.record_tribe_death`
- Line ~2981 (defender dies, attacker won): `ExtinctionCause::ConqueredByWar { conqueror_id: atk_id }` + `lineage_registry.record_tribe_death`
- `cleanup_tribe`: removed `cause: &str` param; internally computes `war_enemy_id` and `heir_id` before `record_death`; determines `ExtinctionCause` (ConqueredByWar / AbsorbedByAlliance if ally is heir / Imploded); calls `lineage_registry.record_tribe_death` before tombstone
- Line ~1730: general cleanup call simplified to `self.cleanup_tribe(*tribe_idx)` (no cause arg)
- `register_tribe` wired after both `from_cluster` init loops (normal and scenario paths)
- `LineageStatsResponse` extended with `tribe_nodes: Vec<TribeLineageNode>`
- `lineage_stats()` now includes `all_tribe_nodes().cloned().collect()`

**`backend/src/main.rs`**
- After `final_summary` JSONL flush, writes a dedicated tombstone report at `<log_path>.tombstones.json`
- Report format: `{ run_seed, run_ticks, total_tribes, tombstones: [...] }`
- Default path: `backend/genetic-neurosim/logs/neurosim-cli-run.tombstones.json`
- No new CLI flags needed

## Validation

- **Rust:** `cargo check` — 0 errors
- **Rust tests:** `cargo test` — 37/37 pass (1 ignored harness-only test), 119s total
- New tests: `founder_puuids_captured_in_tombstone`, `extinction_cause_serializes_correctly`, `extinction_cause_strings`, `tribe_dag_register_and_death`

## Tombstone Report Location

After any CLI run the file lands at:
```
backend/genetic-neurosim/logs/neurosim-cli-run.tombstones.json
```

## Structured Cause JSON Example

```json
{
  "type": "ConqueredByWar",
  "conqueror_id": 3
}
```

The `cause` string field on the same record: `"conquered-by-3"`.
