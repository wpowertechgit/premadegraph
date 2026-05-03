# NeuroSim Tribal Simulation — Progress Log
**Date:** 2026-05-03  
**Branch:** `feature/neurosim-tribal-simulation`  
**Worktree:** `.worktrees/tribal-sim`

---

## Status: 4/14 tasks complete

---

## Completed Tasks

### Task 1 ✅ — Extend ClusterProfile + db.rs
**Commit:** `94b4a0d`  
**Files:** `backend/genetic-neurosim/backend/src/simulation.rs`, `backend/genetic-neurosim/backend/src/db.rs`

`ClusterProfile` extended from 6 → 22 fields:
- Original 6 unchanged
- 5 primary artifacts: `a_combat`, `a_risk`, `a_resource`, `a_map_objective`, `a_team`
- 10 sub-artifacts: `fight_conversion`, `damage_pressure`, `death_cost`, `survival_quality`, `economy`, `tempo`, `vision_control`, `objective_conversion`, `setup_control`, `protection_support`
- 3 derived: `feed_risk: f32`, `cluster_size: u32`, `founder_puuids: Vec<String>`
- All 16 new fields have `#[serde(default)]`

`db.rs` Postgres fallback sets all new fields to `0.0`/`0`/`vec![]` explicitly.

`cargo check` passes.

**Note:** The `genetic-neurosim/` directory was untracked in the main repo (nested `.git`). The subagent copied it into the worktree, stripping the nested `.git` and `target/`. It is now tracked on the feature branch.

---

### Task 2 ✅ — Extend server.js cluster-export SQL
**Commits:** two commits (implementation + `Number(r.cluster_size)` fix)  
**File:** `backend/server.js`

Added `computeNeurosimClusterProfiles(dataset)` function with:
- Weighted averages of 5 primary artifact DB columns (`artifact_combat_impact`, `artifact_risk_discipline`, `artifact_resource_tempo`, `artifact_map_objective_control`, `artifact_team_enablement`) using `matches_processed` as weight
- `HAVING c.size >= 2` (was >= 3)
- JS mapping: all 10 sub-artifacts, 5 primaries, `feed_risk`, `cluster_size`, `founder_puuids` (top-3 by match count)
- `feed_risk = feedscore_wa / 10.0` (adapted from spec — actual DB has `feedscore` column, not raw `artifact_tanking`)

Routes added:
- `GET /api/neurosim/cluster-export`
- `GET /api/neurosim/datasets/:datasetId/cluster-export`

`node --check` passes.

---

### Task 3 ✅ — Create world.rs
**Commit:** in feature branch  
**File:** `backend/genetic-neurosim/backend/src/world.rs`

Full WorldGrid implementation:
- Constants: `WORLD_W=2000`, `WORLD_H=2000`, `TILE_SIZE=50`, `GRID_W=40`, `GRID_H=40`, `TOTAL_TILES=1600`
- `Biome` enum (Plains/Forest/Desert/Mountain/Swamp/River, `#[repr(u8)]`)
- `BiomeStats` + `impl Biome { fn stats() }` with full 6-row table
- `BiomeTile` struct
- `WorldGrid::new(seed, n_tribes)`: seeded SmallRng, Voronoi biome assignment (Manhattan distance), 2 river random-walk paths
- `tick_food()`, `changed_food_tiles()`, `tile_xy()`, `xy_tile()`, `find_spawn_tiles()`, `adjacent_tiles()`

`pub mod world;` added to `main.rs`. `cargo check` passes.

---

### Task 4 ✅ — Create tribes.rs
**Commit:** in feature branch  
**File:** `backend/genetic-neurosim/backend/src/tribes.rs`

- `BehaviorState` enum (10 variants: Settling/Foraging/Migrating/AtWar/Occupying/Peace/Allied/Starving/Desperate/Imploding)
- `RiverCrossing` enum (None/Bridges/Boats) with `Default`
- `FounderTag` struct
- `TribeStats` struct with `from_profile(&ClusterProfile)`
- `TribeState` struct with `from_cluster()` and `river_move_cost()`

**Deviation from spec:** `genome` field is `Option<Genome>` (not `Genome`) because `Genome` had no public constructor when the task ran. The subagent also:
- Made `Genome` pub in `simulation.rs`
- Added `#[derive(Debug)]` to `Genome` and internals
- Added `Genome::new(input_count, output_count)` public constructor

`pub mod tribes;` added to `main.rs`. `cargo check` passes.

---

## Remaining Tasks (10)

| # | Task | Notes |
|---|------|-------|
| 5 | Update constants + rewrite Simulation→TribeSimulation shell | Replace `AgentStorage`/`Environment`; keep recording infra; `INPUT_COUNT=8`, `OUTPUT_COUNT=3` |
| 6 | Implement `initialize_tribes()` + `step()` + `pack_frame()` | Binary WS frame: 20-byte header + 36 bytes/tribe + 6 bytes/food tile |
| 7 | Implement state machine transitions | Full 10-state transition table per plan |
| 8 | Implement combat (Box-Muller normal + Knuth Poisson) | War declaration, per-tick combat, territory absorption |
| 9 | Implement alliance + peace mechanic | Allied food sharing, break conditions |
| 10 | Implement generation boundary + stat mutation + lineage | Every 1000 ticks; genome mutation; feed_risk nudge |
| 11 | Implement river crossing evolution | None→Bridges→Boats tech progression |
| 12 | Update main.rs routes | Rename `/ws/simulation` → `/ws/tribal-simulation` |
| 13 | Create `neurosim-bridge.js` + wire `server.js` | TCP-level WS proxy via Node `net`; no new npm deps |
| 14 | Create `TribalSimulationPage.tsx` + App.tsx route | Canvas2D, binary frame parsing via DataView |

---

## Key Decisions / Deviations from Original Spec

1. **`genetic-neurosim/` is now tracked** in the feature branch (was a nested git repo). `target/` excluded.
2. **DB artifact columns**: actual schema uses 5 aggregate columns (`artifact_combat_impact` etc.) not 8 raw ones. Sub-artifacts split evenly from primaries.
3. **`feed_risk`** uses `feedscore_wa / 10.0` in Node (feedscore is 0–10 scale), not `1 − tanking/4.5/2`.
4. **`Genome` field** in TribeState is `Option<Genome>` — set to `Some(Genome::new(8,3))` during initialization.
5. **`Genome::new(8, 3)`** was added as a public constructor to simulation.rs.

---

## To Resume

```bash
# Verify worktree
git worktree list

# Check branch state
git -C .worktrees/tribal-sim log --oneline -10

# Continue from Task 5
# Plan: docs/superpowers/plans/2026-05-03-neurosim-tribal-simulation.md
# Progress: this file
```

Next step: **Task 5** — rewrite `simulation.rs` to replace per-agent NEAT loop with `TribeSimulation` struct, keep recording infrastructure, keep `Genome`/`InnovationTracker`/`Vec2`/`SpatialHash`, remove `AgentStorage` and `Environment`.
