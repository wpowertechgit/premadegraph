# Task Run Evidence — Track I (I1–I5): Neural / Genetic Mechanics Visibility

**Date:** 2026-05-04  
**Plan:** `docs/superpowers/plans/2026-05-03-neurosim-tribal-simulation-agent-tasks.md`  
**Tasks:** I1, I2, I3, I4, I5

---

## Task completed: Track I — Neural / Genetic Mechanics Visibility (I1–I5)

---

## Files Changed

- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/backend/src/tribes.rs`
- `frontend/src/pages/TribalSimulationPage.tsx`

---

## What Was Done Per Task

### I1 — Define Canonical Tribe Brain Schema

Added label constants alongside the existing count constants in `simulation.rs`:

```rust
pub const INPUT_COUNT: usize = 8;
pub const OUTPUT_COUNT: usize = 3;

pub const INPUT_LABELS: [&str; INPUT_COUNT] = [
    "food_ratio", "pop_ratio", "territory", "feed_risk",
    "combat", "resource", "nearest_enemy", "nearest_ally",
];

pub const OUTPUT_LABELS: [&str; OUTPUT_COUNT] = [
    "aggression", "resource_drive", "goal_drive",
];
```

`TribeSnapshotResponse` now includes `input_labels` and `output_labels` fields (`&'static [&'static str]`), populated from the constants.

`TribeState.last_inputs` and `TribeState.last_outputs` array sizes changed from hardcoded `8`/`3` to `crate::simulation::INPUT_COUNT` / `crate::simulation::OUTPUT_COUNT` in both `tribes.rs` field declarations and `from_cluster` initializers.

`TribeSnapshotResponse.last_inputs` / `last_outputs` array sizes updated to `INPUT_COUNT` / `OUTPUT_COUNT`.

### I2 — Stop Recompiling Genome Every Tick If Unchanged

`Genome::compile()` already returns `&self.compiled` — the cached `CompiledGenome` — without rebuilding. No inference-path recompile existed.

The risk was future implementations of `mutate()` forgetting to invalidate the cache. Added `self.rebuild_compiled()` at the end of `mutate()` so any weight/topology mutation automatically refreshes the compiled activation plan:

```rust
pub fn mutate(&mut self, _rng: &mut rand::rngs::SmallRng, _rate: f32) {
    // TODO: real weight/topology mutation
    self.rebuild_compiled();
}
```

### I3 — Log Neural Decisions For Major Actions

In `apply_state_machine()`, when a tribe's behavior state transitions (`next != current`), a `BehaviorChanged` event is now collected and emitted after the transition loop (outside the mutable loop to avoid borrow conflicts):

```
value_a = old behavior state id (u8 cast to f32)
value_b = dominant output drive (max of last_outputs)
flags   = new behavior state id (u8 cast to u32)
```

Events are indexed into the tribe's per-tribe journal by `push_event`, so the tribe's event log explains why it changed state.

### I4 — Brain Tab In Frontend

The Tribe panel now has a two-tab header: **DOSSIER** and **BRAIN**.

- **DOSSIER** tab: cluster id, state, population, food, territory, generation, ticks alive, target, ally, stats table.
- **BRAIN** tab: neural inputs (8 values with labels from backend `input_labels` field or fallback constants), neural outputs (3 values with labels from backend `output_labels`), dominant output highlighted with `▶` marker and bold value.

`TribeSnapshot` TS interface extended with optional `input_labels?: string[]` and `output_labels?: string[]` to consume backend schema when present.

State variable `tribeTab: "dossier" | "brain"` added. Default tab is `"dossier"`.

### I5 — Mutation Event Logging

In `apply_generation_boundary()`, after the stat nudge loop, `GenomeMutated` events are emitted per tribe (alongside the existing `GenerationAdvanced` events):

```
value_a = mutation_rate (from config)
value_b = new a_combat after nudge (compact representative stat)
```

Full genome copies are not stored. The event is a compact summary: mutation rate applied + new combat stat as a one-number snapshot of the stat drift. Events are indexed into the tribe's per-tribe journal.

---

## Validation Run

```
cd backend/genetic-neurosim/backend
cargo check
→ Finished `dev` profile — 0 errors, 13 pre-existing warnings (none introduced by this task)

npm --prefix frontend run build
→ ✓ built in 5.38s — 0 errors
```

---

## Notes / Intentionally Deferred

- `Genome::mutate()` is still a stub (TODO comment preserved). The `rebuild_compiled()` call at its end ensures future real mutation logic automatically invalidates the cache without additional changes.
- Neural input sensing (nearest_enemy / nearest_ally placeholders at `0.5`) not replaced — that is Phase 10 scope (out of Track I).
- `GenomeMutated` event carries only `a_combat` as the representative stat delta; a richer diff of all five stat nudges would require a larger event struct or a separate summary payload. Deferred per I5 scope constraint ("do not store full genome copies").
- G4 events REST endpoint (`/api/events/recent`, `/api/tribes/:id/events`) not in Track I — Events panel in frontend still shows placeholder text.
