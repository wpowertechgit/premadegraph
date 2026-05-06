# Task R2 — Tombstone Ledger (Ghost War Fix) — Run Report

**Date:** 2026-05-06
**Run by:** Claude Code
**WAIT-FOR:** Task R1 (lineage registry) — complete

## Summary

Implemented tombstone ledger for dead tribes. Eliminates ghost wars. Dead tribes consume ~100 bytes (tombstone record) instead of active state. REST endpoint at `GET /api/tombstones`.

## Files Changed

### Created
- `backend/src/tombstone.rs` — new module

### Modified
- `backend/src/war.rs` — added `WarCancelled` variant to `WarStatus`
- `backend/src/simulation.rs` — integrated `TombstoneLedger` into `TribeSimulation`, added `cleanup_tribe()` method, extinction handling in `step()`
- `backend/src/main.rs` — added `pub mod tombstone`, `GET /api/tombstones` route + handler

### Fixed (pre-existing)
- Commented out `apply_merger()` / `apply_rebellion_check()` stubs from R5 that referenced non-existent methods (pre-existing build error)

## What Was Built

### `tombstone.rs`
- `ArtifactSnapshot` — 5 artifact scores captured at death
- `TombstoneRecord` — tribe_id, cluster_id, tick_died, generation_died, population_at_death, territory_at_death, cause, lineage_summary, final_artifacts
- `TombstoneLedger` — vec of records, methods: `record_death()`, `is_dead()`, `all_records()`, `count()`
- Lineage summary filtered to `seed-*` and `gen-*` entries only (compact)

### `war.rs` Changes
- `WarStatus::WarCancelled` variant — signals war terminated by participant death

### `simulation.rs` Integration
- `tombstone: TombstoneLedger` field on `TribeSimulation`
- Initialized fresh in `shared()` and `reinitialize()`
- `cleanup_tribe(tribe_id, cause)` — atomic: record tombstone, cancel active wars, remove territory
- Called in `step()` for every tribe that dies during a tick (detected via `was_alive` snapshot)
- Public methods: `tombstones()`, `tombstone_record(tribe_id)`
- Response type: `TombstonesResponse` with count + records

### `main.rs` Endpoint
- `GET /api/tombstones` — returns all tombstone records with count

## Validation

| Check | Result |
|-------|--------|
| `cargo build` | Pass (0 errors, 17 pre-existing warnings) |
| `cargo test` | 13/13 pass (all pre-existing) |
| `npm --prefix frontend run build` | Pass (959 modules, 0 errors) |

## Acceptance

- No ghost wars: `cleanup_tribe()` cancels all Active wars involving dead tribe (`WarCancelled`)
- Dead tribe never counted: `alive_count` uses `t.alive` filter, tombstone is separate
- TombstoneRecords queryable via `GET /api/tombstones`
- Memory discipline: dead tribes consume only tombstone record (~100 bytes), territory removed from tile ownership map
- Cleanup is atomic: record death → cancel wars → remove territory (all-or-nothing per tick)
- Idempotent: `is_dead()` check prevents double-recording if `cleanup_tribe()` called multiple times for same tribe

## Edge Cases Handled

- **Combat absorption**: Defender dies in combat → territory already transferred. `cleanup_tribe()` records tombstone with pre-transfer territory count (cloned in absorption, not moved) and cancels wars. Tile occupant removal is no-op on already-transferred tiles.
- **Attacker dies in combat**: War status already set to `DefenderWon`. `cleanup_tribe()` only affects wars still `Active`.
- **Multiple deaths same tick**: Each tribe cleaned up independently via `extinct_ids` vec.
- **Reinitialize**: Fresh `TombstoneLedger` on reset — no stale tombstones.
- **CullPopulation intervention**: Population = 0 → `alive = false` → caught by `was_alive` snapshot → cleanup in step().

## Asset Impact

None — pure data structure.
