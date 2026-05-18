# Track B Run — B1–B5 Paused State + Control Endpoints

**Task completed:** Track B (B1, B2, B3, B4, B5) — Backend pause semantics and control endpoints

## Files changed

- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/backend/src/main.rs`

## Changes summary

### simulation.rs

**B1 — Paused state:**
- Added `paused: bool` field to `TribeSimulation` (initialized `false`)
- Added `paused: bool` to `StatusResponse`
- Added `ControlResponse { ok, status }` struct (used by all control endpoints)
- Added `RestartSeedRequest { world_seed }` struct for B5
- Added methods: `is_paused()`, `pause()`, `resume()`

**B3 — Step tick:**
- Added `step_once_when_paused()` — calls `step()` only when paused and not halted; returns `None` otherwise

**B4 — Reset same seed:**
- Added `reset_same_seed()` — clears paused, calls existing `reinitialize()`, preserves `world_seed`

**B5 — New seed restart:**
- Added `restart_with_seed(seed)` — sets `config.world_seed`, clears paused, calls `reinitialize()`

### main.rs

**B1 — Simulation loop paused handling:**
- Loop now checks `is_paused()` alongside `is_halted()`; when either is true, sleeps 250ms and re-sends current frame without advancing

**B2 — Pause/resume endpoints:**
- `POST /api/control/pause` → calls `pause()`, returns `ControlResponse`
- `POST /api/control/resume` → calls `resume()`, returns `ControlResponse`

**B3 — Step tick endpoint:**
- `POST /api/control/step-tick` → calls `step_once_when_paused()`, returns `ControlResponse`

**B4 — Reset endpoint:**
- `POST /api/control/reset` → calls `reset_same_seed()`, returns `ControlResponse`

**B5 — Restart seed endpoint:**
- `POST /api/control/restart-seed` body `{ "world_seed": u64 }` → calls `restart_with_seed()`, returns `ControlResponse`

## Validation

```
cargo check (backend/genetic-neurosim/backend)
  -> Finished dev profile, 14 pre-existing warnings, 0 errors

npm --prefix frontend run build
  -> ✓ built in 16.12s, 0 errors
```

## Notes

- No frontend controls added (scope: Track B only, Track C handles UI)
- `/api/status` now always includes `paused` field; existing frontend ignores unknown fields
- `step_once_when_paused` is a no-op when halted, preserving halted semantics unchanged
- Existing behavior is fully unchanged when `paused=false`
