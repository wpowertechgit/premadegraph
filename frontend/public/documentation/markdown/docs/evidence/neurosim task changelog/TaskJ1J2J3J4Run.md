# Task Run Evidence — Track J (J1–J4): Intervention Toolkit

**Date:** 2026-05-04  
**Plan:** `docs/superpowers/plans/2026-05-03-neurosim-tribal-simulation-agent-tasks.md`  
**Tasks:** J1, J2, J3, J4

---

## Task completed: Track J — Intervention Toolkit (J1–J4)

---

## Files Changed

- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/backend/src/world.rs`
- `backend/genetic-neurosim/backend/src/main.rs`
- `frontend/src/pages/TribalSimulationPage.tsx`

---

## What Was Done Per Task

### J1 — Define Intervention Request Types

Added to `simulation.rs`:

```rust
#[serde(rename_all = "snake_case")]
pub enum InterventionScope { Global, Tribe { tribe_id: usize } }

#[serde(tag = "type", rename_all = "snake_case")]
pub enum InterventionRequest {
    CullPopulation { scope: InterventionScope, percent: f32 },
    SpawnFood      { scope: InterventionScope, amount: f32  },
    Drought,
    MutationPulse  { severity: f32 },
}

pub struct InterventionResponse { pub ok: bool, pub message: String }
```

`TribeSimulation::apply_intervention` dispatches on variant:
- `CullPopulation` → J2 implementation
- `SpawnFood` → J3 implementation
- `Drought` / `MutationPulse` → returns `Err(...)` → HTTP 501

`main.rs`:
- Added `InterventionRequest` / `InterventionResponse` to imports
- Added `.route("/api/interventions", post(handle_intervention))`
- Added `handle_intervention` async handler (returns 501 for unimplemented variants)

### J2 — Implement Cull Population Intervention

`TribeSimulation::cull_population(scope, percent)` in `simulation.rs`:
- Clamps percent to `[0.0, 1.0]`
- Iterates tribes: applies kill to matching scope (Global = all alive, Tribe = selected)
- `tribe.population.saturating_sub(kill)` — sets `alive = false` if reaches 0
- Emits `InterventionApplied` event: `value_a = percent`, `value_b = total casualties`, `flags = 0` (cull variant)
- Returns `InterventionResponse` with casualty count

Preserves `/api/god-mode` legacy endpoint unchanged.

### J3 — Implement Spawn Food Intervention

`WorldGrid::spawn_food_global(amount)` in `world.rs`:
- Adds `amount` to `tile.food`, capped at `tile.max_food`, skips River tiles
- Returns count of modified tiles

`TribeSimulation::spawn_food(scope, amount)` in `simulation.rs`:
- `Global` scope → delegates to `world.spawn_food_global`
- `Tribe` scope → looks up tribe territory tiles and spawns directly
- Emits `InterventionApplied` event: `value_a = amount`, `value_b = tile count`, `flags = 1` (spawn_food variant)

### J4 — Frontend Intervention Menu V1

`sendIntervention(type, extra)` helper added — fires `POST /api/neurosim/api/interventions` with typed JSON body.

God Mode button replaced with:
- **"Cull 50%"** (red outlined) → `{"type":"cull_population","scope":"global","percent":0.5}`
- **"Spawn Food"** (green outlined) → `{"type":"spawn_food","scope":"global","amount":0.5}`
- Legacy "Kill Half" button kept as small text-variant fallback for backwards compat

---

## Validation Run

```
cd backend/genetic-neurosim/backend
cargo check
→ Finished dev — 0 errors, 14 warnings
  (13 pre-existing + 1 new: dead_code on MutationPulse.severity, expected for unimplemented stub)

npm --prefix frontend run build
→ ✓ built in 5.29s — 0 errors
```

---

## Notes / Intentionally Deferred

- `Drought` and `MutationPulse` variants are defined (J1 scope: "handler can return 501 for unimplemented variants") — both return HTTP 501 with a message.
- No modal or confirmation UI for interventions — per J4 spec: "Keep simple, no modals."
- Tribe-scoped interventions exist in the API (`scope: {"tribe": {"tribe_id": N}}`); no UI for tribe selection yet — that belongs to a later task or J4 extension.
- G4 events endpoint (`/api/events/recent`) not yet wired — intervention events ARE stored in the global ring buffer and will be queryable once G4 is implemented.
