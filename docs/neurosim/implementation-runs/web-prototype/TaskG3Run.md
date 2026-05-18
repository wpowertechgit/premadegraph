# Task G3 Run Evidence — Emit Lifecycle Events

**Task:** G3 from `docs/superpowers/plans/2026-05-03-neurosim-tribal-simulation-agent-tasks.md`

## What Was Done

Implemented lifecycle event emission in
`backend/genetic-neurosim/backend/src/simulation.rs`.

Four event types are now emitted using the event infrastructure from G1/G2:

### TribeSpawned
- Added at the end of `initialize_tribes()`.
- Emits one `TribeSpawned` (severity: Info) per tribe after the tribe Vec is built.
- Triggered on first run and on every `reinitialize()` call.

### SimulationReset
- Added in `reinitialize()` after `global_events.clear()` and before `initialize_tribes()`.
- Emits one global `SimulationReset` (severity: Important, tribe_id = NO_TRIBE).
- Appears at the head of the global event buffer before spawn events.

### GenerationAdvanced
- Added in `apply_generation_boundary()`.
- Collects alive tribe ids in `gen_advanced: Vec<u32>` during the mutation loop.
- After the loop, emits one `GenerationAdvanced` (severity: Info) per alive tribe.
- Avoids borrow-checker conflict by collecting ids first, pushing events after.

### TribeExtinct
- Added in `step()`.
- Snapshots `was_alive: Vec<bool>` at the start of each tick.
- After all state-machine, combat, and population updates, detects tribes that
  flipped from alive to dead and emits one `TribeExtinct` (severity: Important) each.
- Covers all extinction paths: Imploding state, combat casualties, population == 0.

## Files Changed

- `backend/genetic-neurosim/backend/src/simulation.rs`

## Validation

```
cd backend/genetic-neurosim/backend && cargo check
```
→ `Finished dev profile. 15 pre-existing warnings, 0 errors.`

```
npm --prefix frontend run build
```
→ `✓ built in 5.28s`

## Notes

- No frontend changes required for G3.
- No new event types added; all four types were defined in G1/G2.
- Extinction detection does not log every tick — only on the tick the tribe dies.
- GenerationAdvanced fires every 1000 ticks (per existing boundary condition).
- Per-tribe journals receive their own spawn/extinction/generation events via `push_event`.
