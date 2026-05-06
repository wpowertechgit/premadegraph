# Task H1 + H2 Run Evidence

**Date:** 2026-05-04
**Tasks:** H1 – Add Tribe Snapshot Endpoint, H2 – Frontend Tribe Dossier Panel

## Files Changed

- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/backend/src/main.rs`
- `frontend/src/pages/TribalSimulationPage.tsx`

## What Was Implemented

### H1 – Tribe Snapshot Endpoint

Added `TribeSnapshotResponse` struct to `simulation.rs`:
- id, cluster_id, population, max_population, food_stores
- behavior (BehaviorState, serialized as string name)
- territory_count, target_tribe, ally_tribe
- stats (TribeStats), last_inputs ([f32; 8]), last_outputs ([f32; 3])
- generation, ticks_alive, alive

Added `tribe_snapshot(&self, id: usize) -> Option<TribeSnapshotResponse>` method to `TribeSimulation`.

Added `GET /api/tribes/:id` route to `main.rs` with handler `get_tribe_snapshot`.
- Returns 200 + JSON on found tribe
- Returns 404 + message for unknown tribe id

### H2 – Frontend Tribe Dossier Panel

Added to `TribalSimulationPage.tsx`:
- `TribeSnapshot`, `TribeSnapshotStats` TypeScript interfaces
- `INPUT_LABELS` (8 inputs) and `OUTPUT_LABELS` (3 outputs) constant arrays
- `showTribe` / `selectedTribeId` / `tribeSnapshot` state
- Canvas `onClick` handler (`handleCanvasClick`) — finds nearest tribe home marker within `hexSize * 3` px, sets `selectedTribeId`, auto-opens Tribe panel
- `useEffect` that fetches `/api/neurosim/api/tribes/:id` on selection change and polls every 1 s
- `"Tribe"` button in the panel toggle toolbar (between Controls and Events)
- Tribe dossier `<Paper>` panel showing: cluster id, behavior state, population/max, food, territory count, generation, ticks alive, target/ally tribe, primary stats (a_combat, a_risk, a_resource, a_map_objective, a_team, feed_risk), neural input vector with labels, neural output vector with labels (dominant output shown bold)

## Validation

```
cargo check (backend/genetic-neurosim/backend)
-> Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.03s (15 pre-existing warnings, 0 errors)

npm --prefix frontend run build
-> ✓ built in 5.40s (0 errors, chunk size warnings are pre-existing)
```

## Notes

- `BehaviorState` serializes as its variant name string (e.g. `"Settling"`) via default serde, not as the numeric discriminant used in the binary frame. The dossier displays it directly.
- No full genome graph included in snapshot (per task scope).
- Canvas click selects nearest tribe within `hexSize * 3` pixels to avoid accidental selection on empty map areas.
- G6 (click-to-select via events journal) is not yet implemented; H2 adds its own minimal click-to-select on the canvas.
