# Task G4 + Run Summary Run

**Date:** 2026-05-04
**Tasks:** G4 (Events REST endpoints), Route path fix (axum 0.8), Run Summary endpoint, Experiment run

---

## Files Changed

- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/backend/src/main.rs`

---

## What Was Done

### Axum 0.8 Path Fix (Critical Bug)

All `:param` style Axum routes panicked at startup in Axum 0.8. Fixed:
- `/api/tribes/:id` → `/api/tribes/{id}`
- `/api/tribes/:id/events` → `/api/tribes/{id}/events`

Previous `cargo check` did not catch this (runtime panic only). The backend was failing to start.

### G4 — Events REST Endpoints

**Methods added to `TribeSimulation`:**
- `events_response(limit: usize) -> RecentEventsResponse` — most-recent-first slice of global ring buffer, capped by `MAX_GLOBAL_EVENTS`
- `tribe_events_response(tribe_id, limit) -> TribeEventsResponse` — per-tribe journal slice (extinct tribes supported), capped by `MAX_TRIBE_EVENTS`

**Response structs:**
```rust
RecentEventsResponse { events: Vec<SimulationEvent>, total_buffered: usize }
TribeEventsResponse  { tribe_id, events: Vec<SimulationEvent>, total_buffered: usize }
```

**New routes in `main.rs`:**
- `GET /api/events/recent?limit=N` — default limit 50
- `GET /api/tribes/{id}/events?limit=N` — default limit 50

Uses `axum::extract::Query<LimitQuery>` where `LimitQuery { limit: Option<usize> }`.

### Run Summary Endpoint

**Response structs:**
```rust
TribeSummaryRecord {
    id, cluster_id, alive, population, territory_count,
    generation, ticks_alive, lineage,
    wars_as_attacker, wars_as_defender, wars_won, wars_lost,
    casualties_dealt, casualties_received,
    a_combat, a_resource, feed_risk
}
RunSummary {
    tick, generation, alive_count, extinct_count, total_tribes,
    world_seed, scenario_id, halted, war_count,
    tribes: Vec<TribeSummaryRecord>  // sorted: alive by territory desc, extinct by ticks_alive desc
}
```

**Method:** `TribeSimulation::run_summary() -> RunSummary`
- Iterates all tribes (alive + extinct)
- Aggregates war statistics from `active_wars` per tribe
- Sorts survivors by territory, then extinct by longevity

**New route:** `GET /api/simulation/summary`

---

## Validation

```
cargo check -> 0 errors, 14 pre-existing warnings
cargo build -> Finished dev profile in 4.18s
```

---

## Experiment: Flexset vs SoloQ Tribal Simulation

### Flexset (active dataset)

**Setup:** 599 clusters, 55×55 grid (3025 tiles), seed=42
**Result:**
- Run ended at tick 3085, generation 3, all tribes extinct
- 687 wars declared

**Top 5 tribes (by longevity):**

| Rank | Cluster ID | Ticks | Gen | Territory | Wars W/L | Absorbed |
|------|-----------|-------|-----|-----------|----------|---------|
| 1 | rust_pathfinding:474 | 3084 | 3 | 10 | 4/0 | 3 tribes |
| 2 | rust_pathfinding:577 | 2819 | 2 | 15 | 3/1 | 2 tribes |
| 3 | rust_pathfinding:375 | 2719 | 2 | 2 | 2/1 | 1 tribe |
| 4 | rust_pathfinding:399 | 2629 | 2 | 2 | 2/0 | 1 tribe |
| 5 | rust_pathfinding:531 | 2609 | 2 | 9 | 4/1 | 2 tribes |

**Winner: `rust_pathfinding:474`** — last tribe alive, reached gen 3, 4 wins 0 losses, absorbed 3 clusters (471, 480, 375).

**Late-game event log excerpt:**
```
t3085 gen3 [important] tribe_extinct T473
t3081 gen3 [info]      behavior_changed T473 va=8 vb=0.87  (Imploding)
t2820 gen2 [important] tribe_extinct T576
t2813 gen2 [important] war_declared T576->T473
t2720 gen2 [important] tribe_extinct T374
t2685 gen2 [important] war_declared T473->T374
```

### SoloQ (140 clusters)

**Setup:** 140 clusters, 40×40 grid (1600 tiles), seed=42
**Result:**
- Run ended at tick 2030, generation 2, all tribes extinct
- 94 wars declared

**Top 5 tribes (by longevity):**

| Rank | Cluster ID | Ticks | Gen | Territory | Wars W/L | Absorbed |
|------|-----------|-------|-----|-----------|----------|---------|
| 1 | rust_pathfinding:12 | 2029 | 2 | 5 | 3/0 | 2 tribes |
| 2 | rust_pathfinding:2 | 1919 | 1 | 8 | 3/1 | 3 tribes |
| 3 | rust_pathfinding:42 | 1859 | 1 | 7 | 1/1 | 2 tribes |
| 4 | rust_pathfinding:67 | 1859 | 1 | 5 | 5/0 | 3 tribes |
| 5 | rust_pathfinding:79 | 1649 | 1 | 2 | 2/1 | 1 tribe |

**Winner: `rust_pathfinding:12`** — last tribe alive, gen 2, 3 wins 0 losses, absorbed clusters 105 and 118.

### Cross-Dataset Comparison

| Metric | Flexset | SoloQ |
|--------|---------|-------|
| Clusters / tribes | 599 | 140 |
| Grid size | 55×55 (3025) | 40×40 (1600) |
| Final tick | 3085 | 2030 |
| Generations reached | 3 | 2 |
| Wars declared | 687 | 94 |
| Extinction | total (all 599) | total (all 140) |

**Observations:**
- Both datasets collapsed to full extinction — the 55×55 grid is still cramped for 599 tribes (5 tiles/tribe avg)
- High `a_resource=1.0` is a consistent trait among long survivors in both datasets (resource-driven tribes outlasted purely aggressive ones)
- Cluster stat values hit the `[0,1]` clamp from generation boundary nudges because many initial cluster artifact scores exceed 1.0 — a normalization gap to address
- Wars start at tick 1 in both runs — almost all tribes immediately declare war (very high initial aggression drives), suggesting the neural weights need calibration
- The event system correctly logged lifecycle, war, and behavior events throughout both runs

---

## Notes

- G5 (global event log panel in frontend) still pending — events are now queryable via REST
- G6 (tribe journal panel) still pending — tribe events are now queryable via REST
- Artifact normalization: raw cluster stats exceed 1.0 for many clusters; the generation boundary nudge clamps them but the simulation starts with out-of-range values. Follow-up: normalize artifact scores in the cluster export or in `TribeStats::from_profile`
- War start at tick 1: all tribes go to AtWar immediately because neural outputs are random (untrained NEAT) and aggression drive > 0.7 threshold is easy to exceed. This is expected NEAT behavior; the genome learns over generations but the run is too short
