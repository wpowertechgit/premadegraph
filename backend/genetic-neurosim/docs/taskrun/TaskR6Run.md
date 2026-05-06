# Task R6 — Reproduction & Entity-Level Population — Run Report

**Date:** 2026-05-06
**Run by:** Claude Code
**Dependencies:** R1 (Lineage Registry), R3 (V3 State Machine — citizens field)

## Summary

Implemented reproduction mechanics. Tribes with 2+ citizens birth offspring every 50 ticks. Offspring inherit blended + mutated 5 artifacts. LineageRegistry populated with parent pointers. Seed citizens initialized at tribe creation with weighting by `size_ratio`.

## Files Changed

### Modified

| File | Change |
|------|--------|
| `backend/src/events.rs` | Added `OffspringBorn = 55` event type |
| `backend/src/simulation.rs` | Seed citizen init in `initialize_tribes()` + `initialize_two_tribes_scenario()`, `blend_artifacts()` + `try_reproduction()` methods, hook in `step()` |

## Implementation Details

### Seed Population (initialize_tribes)
- Each tribe gets minimum 2 citizens (required for reproduction)
- **Weighting:** clusters with `size_ratio > 0.8` get 3 seeds, `> 0.5` get 2 seeds, else 1 seed + 1 same-gene twin
- Same-gene twin satisfies "Same-gene breeding permitted" rule
- Seed entity IDs from `LineageRegistry::register_seed()`

### Reproduction Mechanics (try_reproduction)
- Fires every 50 ticks (`tick % 50 == 0`)
- Only alive tribes with `citizens.len() >= 2`
- Picks 2 distinct random citizens
- Registers child entity in `LineageRegistry` via `register(parent_a, parent_b)`
- Creates `CitizenRecord` with child entity ID, parent pointers, current generation
- No string concatenation in hot path

### Artifact Blending (blend_artifacts)
- Averages 5 artifact fields from parent tribe stats: `a_combat`, `a_risk`, `a_resource`, `a_map_objective`, `a_team`
- Applies uniform random mutation in `[-mutation_rate, +mutation_rate]`
- Results clamped to `[0.0, 1.0]`
- Tribe stats nudged 5% toward blended values per birth (`lerp factor 0.05`)

### Event Emission
- Each birth emits `OffspringBorn` event
- `value_a` = child entity ID, `value_b` = new citizen count

## Validation

| Check | Result |
|-------|--------|
| `cargo build` | Pass (21 pre-existing warnings) |
| `cargo test` | 13/13 pass |
| `npm --prefix frontend run build` | Pass (pre-existing chunk size warning) |

## Acceptance Criteria

| Criteria | Status |
|----------|--------|
| Reproduction fires every N ticks for eligible tribes | Done (50 ticks) |
| Offspring has blended + mutated artifacts | Done (5 artifact lerp + mutation) |
| LineageRegistry populated with parent pointers | Done (via `register()`) |
| Entity-level population visible via tribe snapshot API | Done (`citizen_count` in `TribeSnapshotResponse`) |
| Minimum 2 living entities in tribe for reproduction | Done |
| Unisex breeding model | Done (any 2 citizens) |
| Same-gene breeding permitted | Done (twin scenario) |
| Configurable mutation rate on every birth | Done (`config.mutation_rate`, default 0.05) |
| Cross-tribe breeding after merger | Not implemented (merge not done, requires R5) |
