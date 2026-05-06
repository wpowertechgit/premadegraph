# Task L Run — War Visibility (L1, L2, L3)

**Date:** 2026-05-04
**Plan:** `docs/superpowers/plans/2026-05-03-neurosim-tribal-simulation-agent-tasks.md`
**Tasks:** L1 (WarState struct), L2 (war snapshot endpoint), L3 (frontend wars panel)

---

## Files Changed

- `backend/genetic-neurosim/backend/src/war.rs` — **created**
- `backend/genetic-neurosim/backend/src/simulation.rs` — modified
- `backend/genetic-neurosim/backend/src/main.rs` — modified
- `frontend/src/pages/TribalSimulationPage.tsx` — modified

---

## What Was Done

### L1 — WarState Struct (`war.rs` + `simulation.rs`)

Created `backend/genetic-neurosim/backend/src/war.rs` with:
- `WarStatus` enum: `Active`, `Peace`, `AttackerWon`, `DefenderWon`
- `WarState` struct: `war_id`, `attacker_id`, `defender_id`, `start_tick`, `status`, `attacker_casualties`, `defender_casualties`, `battle_tile`
- `WarSummary` response type (adds `duration_ticks` computed at query time)
- `ActiveWarsResponse` wrapper

Added to `TribeSimulation`:
- `active_wars: Vec<crate::war::WarState>` field
- `next_war_id: u32` monotonic counter
- Initialization in `shared()` and cleared in `reinitialize()`

Updated `apply_combat` to:
- Collect new war pairs when `AtWar` tribes pick a target (deduplicates Active pairs)
- Create `WarState` records and emit `WarDeclared` events after the declaration loop
- Capture `atk_id`/`def_id` before population mutations to avoid borrow issues
- Accumulate `attacker_casualties` and `defender_casualties` every combat tick
- Set `status = AttackerWon` when defender is absorbed
- Set `status = DefenderWon` when attacker population drops to zero
- Set `status = Peace` on war timeout (ticks_in_state > 300)

### L2 — War Snapshot Endpoint (`main.rs`)

- Added `pub mod war;` to `main.rs`
- Added `use war::ActiveWarsResponse;` import
- Added `active_wars_snapshot()` method on `TribeSimulation` — filters to `Active` wars, computes `duration_ticks`
- Added `GET /api/wars/active` route
- Added `get_active_wars` Axum handler

### L3 — Frontend Wars Panel (`TribalSimulationPage.tsx`)

- Added `WarRecord` and `ActiveWarsResponse` TypeScript types
- Added `showWars: boolean` and `wars: WarRecord[]` state
- Added `"Wars"` toggle button in the toolbar (between Tribe and Events)
- Added `useEffect` that polls `/api/neurosim/api/wars/active` every 2 s when `showWars` is true
- Renders a compact `Paper` panel with one row per active war: attacker→defender IDs, duration in ticks, casualty counts (attacker / defender), battle tile

---

## Validation

```
cargo check (backend/genetic-neurosim/backend)
→ Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.41s
   14 pre-existing warnings, 0 errors

npm --prefix frontend run build
→ ✓ built in 5.53s  (no new errors)
```

---

## Notes / Deferred

- War visibility depends on wars actually starting: tribes must reach `AtWar` behavior (requires high aggression drive from NEAT + having a neighbor). Running simulation will populate wars over time.
- `battle_tile` is currently set to the defender's home tile at war start; a future task can replace this with the actual contested tile during combat.
- Combat still uses 4-neighbor `adjacent_tiles` for the `has_neighbor` check; hex neighbor check (`hex_adjacent_tiles`) is used only for territory expansion. This is pre-existing behavior, not changed in this task.
- War events (WarDeclared) are now emitted and stored in global/tribe event journals, but the Events panel UI (G5) is still pending.
