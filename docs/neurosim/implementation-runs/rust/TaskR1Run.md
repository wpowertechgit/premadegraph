# Task R1 — Lineage Registry (DAG ID System) — Run Report

**Date:** 2026-05-06
**Run by:** Claude Code

## Summary

Implemented entity DAG lineage registry. Replaces string-based lineage with `u32` entity ID system. Hot path uses O(1) HashMap lookups, no string concatenation.

## Files Changed

### Created
- `backend/src/lineage_registry.rs` — new module

### Modified
- `backend/src/simulation.rs` — integrated registry into TribeSimulation, added response types + query methods
- `backend/src/main.rs` — added `mod lineage_registry`, new REST routes

### Fixed (pre-existing)
- Type mismatch in `assign_specialization_role` — (role, &score) → &(role, score)
- Removed dangling route/handler from R3 that had no implementation

## What Was Built

### `lineage_registry.rs`
- `LineageRegistry` struct with `HashMap<u32, (u32, u32)>` mapping entity_id → (parent_a, parent_b)
- `u32::MAX` sentinel for seed entities (no parents)
- `seed_to_entity_ids: HashMap<String, Vec<u32>>` — cluster_id → seed entity IDs
- Methods: `register`, `register_seed`, `resolve_lineage`, `seed_from_entity`, `contains`, `total_entity_count`, `seed_clusters`, `parents`

### `simulation.rs` Integration
- `lineage_registry: LineageRegistry` field on `TribeSimulation`
- Initialized fresh in `shared()` and `reinitialize()`
- Seed entities registered per cluster during `initialize_tribes()` and `initialize_two_tribes_scenario()`
- Public methods: `resolve_lineage(entity_id)`, `lineage_seed(entity_id)`, `lineage_stats()`
- Response types: `LineageResolveResponse`, `LineageSeedResponse`, `LineageStatsResponse`, `SeedClusterEntry`

### `main.rs` Endpoints
- `GET /api/lineage/resolve/{entity_id}` — returns parent chain DAG
- `GET /api/lineage/seed/{entity_id}` — traces to original seed cluster
- `GET /api/lineage/stats` — total entity count + seed cluster breakdown

## Validation

| Check | Result |
|-------|--------|
| `cargo build` | Pass (0 errors, 17 pre-existing warnings) |
| `cargo test` | 13/13 pass (5 new lineage + 8 pre-existing) |
| `npm --prefix frontend run build` | Pass (959 modules, 0 errors) |

## Acceptance

- No string concatenation in hot path
- Every entity has two parent pointers
- `resolve_lineage(5432)` traces back to seed IDs via O(1) lookups
- Thread-safe under outer RwLock
- Seed entities registered at tribe init
- REST endpoints for lineage queries
- 5 unit tests covering register, resolve, seed tracing, nonexistent entities, cluster grouping

## Asset Impact

None — pure data structure.
