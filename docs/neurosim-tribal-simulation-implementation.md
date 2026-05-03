# NeuroSim Tribal Simulation — Implementation

> **Superseded for future work.** The current implementation is a backend streaming prototype.
> The critical redesign and agent task plan define the next implementation pass:
> - `docs/neurosim-tribal-simulation-critical-redesign.md`
> - `docs/superpowers/plans/2026-05-03-neurosim-tribal-simulation-agent-tasks.md`

**Branch merged:** `feature/neurosim-tribal-simulation` → `main`  
**Date:** 2026-05-03

---

## What It Is

Dataset-driven evolutionary tribal simulation. Every graph cluster from the premadegraph dataset becomes a living tribe competing in a 2000×2000 world grid. Tribes eat, fight, ally, evolve, and die across generations. A NEAT neural network drives each tribe's behavior.

Replaces the previous per-agent NEAT simulation (individual agents with food/poison) entirely.

---

## Architecture

```
React frontend (/tribal-simulation)
    ↓ WebSocket binary frames
Express backend (port 3001)
    ↓ TCP tunnel (neurosim-bridge.js)
Rust neurosim backend (port 8000)
    ↓ HTTP cluster-export on startup
Express /api/neurosim/cluster-export
    ↓ SQLite query
playersrefined.db
```

---

## Files Changed / Created

### Rust (`backend/genetic-neurosim/backend/src/`)

| File | Change |
|------|--------|
| `simulation.rs` | Full rewrite. Removed `AgentStorage`, `Environment`, per-agent loop. Added `TribeSimulation` with full tribal step loop. `INPUT_COUNT=8`, `OUTPUT_COUNT=3`. |
| `world.rs` | **New.** `WorldGrid` (40×40 tiles, 50 world-units each). Seeded Voronoi biome assignment + 2 random-walk river paths. Food regen each tick. Changed food tile delta tracking for WS frame packing. |
| `tribes.rs` | **New.** `TribeState`, `TribeStats`, `BehaviorState` (10 states), `RiverCrossing` (None/Bridges/Boats), `FounderTag`. |
| `main.rs` | Added `/ws/tribal-simulation` route. Cleaned up `refresh_from_db` handler. |

### Node / Express (`backend/`)

| File | Change |
|------|--------|
| `server.js` | Added `computeNeurosimClusterProfiles()` with weighted-average artifact SQL. Routes: `GET /api/neurosim/cluster-export`, `GET /api/neurosim/datasets/:id/cluster-export`. WS upgrade handler for `/api/neurosim/ws/tribal-simulation`. |
| `neurosim-bridge.js` | **New.** HTTP proxy + raw TCP WebSocket tunnel to Rust port 8000. Spawns binary locally (dev) or connects to Docker service (`NEUROSIM_HOST` env). |

### Frontend (`frontend/src/`)

| File | Change |
|------|--------|
| `pages/TribalSimulationPage.tsx` | **New.** Canvas2D 800×800 viewer. Binary frame parser (`DataView`). Behavior dot markers, food overlay, MUI controls (tick rate slider, God Mode, legend). |
| `App.tsx` | Added `/tribal-simulation` route. |
| `AppNavbar.tsx` | Added "Tribal Simulation" / "Törzsi Szimuláció" nav link with `FaGlobe` icon. |

### Docker

| File | Change |
|------|--------|
| `docker-compose.yml` | Added `neurosim` service (builds `backend/genetic-neurosim/backend`, port 8000, `PREMADEGRAPH_URL=http://backend:3001`). Backend gets `NEUROSIM_HOST=neurosim`. |

---

## Simulation Design

### World

- 2000×2000 units, 40×40 tile grid (50 units/tile = 1600 tiles total)
- **Biomes** (seeded Voronoi): Plains, Forest, Desert, Mountain, Swamp, River
- Each biome has: food density, move cost, defense bonus, disease rate
- Food regenerates each tick; River tiles fixed at 0.6 food
- 2 random-walk river paths seeded from `world_seed`

### Tribes

Each tribe maps 1:1 to a database cluster:
- **Population** = `min(2000, cluster_size × 25)`
- **Stats** derived from cluster artifact scores (normalized to 0–1)
- **Genome** = NEAT network, 8 inputs → 3 outputs (aggression, resource, goal drives)

#### Neural Net Inputs (8)
1. `food_stores / population`
2. `population / max_population`
3. `territory_count / 100`
4. `feed_risk`
5. `a_combat`
6. `a_resource`
7. nearest enemy distance
8. nearest ally distance

#### Outputs (3)
- `aggression_drive` → triggers war / desperate attacks
- `resource_drive` → foraging intensity
- `goal_drive` → migration / alliance / river tech

### Behavior State Machine (10 states)

```
Settling ──food low──> Foraging ──food critical──> Starving ──timer──> Desperate ──timer──> Imploding → dead
    │                      │                                                │
    └──aggression > 0.7──> AtWar ──resolve──> Occupying / Peace            └──aggression > 0.6──> AtWar
    └──goal > 0.6 ──────> Migrating
    └──goal > 0.7 ──────> Allied ◄──mutual goal > 0.6──
```

### Combat (every 10 ticks)
- Attacker/defender strength = `population × stat × Box-Muller(μ=1, σ=0.15)`
- Casualties = `Knuth Poisson(λ = opponent_combat × my_pop × 0.02)`
- Winner absorbs loser's territory tiles and `FounderTag` list
- War timeout at 300 ticks → both enter Peace

### Alliances (every 50 ticks)
- Two Settling tribes with `goal_drive > 0.7 / 0.6` form mutual alliance
- Allied tribes share food (5% equalization transfer per 50 ticks)
- Alliance breaks on war / desperation

### Generation Boundary (every 1000 ticks)
- Genome mutation at configured `mutation_rate`
- All 5 primary artifact stats nudged ±0.02 (random walk, clamped 0–1)
- High `feed_risk` (> 0.6) → `a_resource += 0.03` (struggling tribes get better at foraging)
- Lineage event logged to tribe's `lineage: Vec<String>`

### River Crossing Tech
- `ticks_near_river > 50` + `goal_drive > 0.7` → unlock **Bridges** (River move cost 3.0 → 1.5)
- `river_crossings > 20` + `goal_drive > 0.8` → unlock **Boats** (move cost → 0.8, can claim River tiles)

---

## Wire Frame Format (binary WS)

```
Header: 20 bytes
  u32 tick_lo      lower 32 bits of tick
  u32 tick_hi      upper 32 bits of tick
  u32 alive_count
  u32 food_tile_count
  u32 generation

Per alive tribe: 36 bytes
  u32 id
  u32 population
  u16 home_tile
  u8  behavior (BehaviorState as u8)
  u8  padding
  f32 food_stores
  f32 a_combat
  f32 a_risk
  f32 a_resource
  f32 a_map_objective
  u16 territory_count
  u16 generation

Per changed food tile: 6 bytes
  u16 tile_index
  f32 food
```

All values little-endian. Food tiles only sent when delta > 0.05 since last frame.

---

## Cluster → Tribe Artifact Mapping

DB columns (`artifact_combat_impact` etc.) are weighted-averaged by `matches_processed`, then normalized by PRIMARY_CAP = 5.0:

| DB column | Tribe sub-artifacts |
|-----------|-------------------|
| `artifact_combat_impact` | `fight_conversion`, `damage_pressure` |
| `artifact_risk_discipline` | `death_cost`, `survival_quality` |
| `artifact_resource_tempo` | `economy`, `tempo` |
| `artifact_map_objective_control` | `vision_control`, `objective_conversion` |
| `artifact_team_enablement` | `setup_control`, `protection_support` |

`feed_risk = clamp(0, 1, feedscore_wa / 10.0)` (feedscore is 0–10 scale)

---

## Running

### Local dev
```bash
# Build Rust binary first
cd backend/genetic-neurosim/backend
cargo build --release

# Start everything
cd ../../..
npm run dev
# → Express on :3001, neurosim auto-spawned on :8000, frontend on :5173
```

### Docker
```bash
docker-compose up --build
# neurosim service builds and starts automatically
# Express connects to it via NEUROSIM_HOST=neurosim
```

### Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `NEUROSIM_HOST` | `127.0.0.1` | Neurosim backend host. Set to service name in Docker. |
| `NEUROSIM_PORT` | `8000` | Neurosim backend port. |
| `NEUROSIM_RUST_BIN` | auto-detected | Override path to neurosim binary (local dev). |
| `PREMADEGRAPH_URL` | — | Set on neurosim service; it fetches clusters from this URL on startup. |

---

## Thesis Relevance

Tribal simulation seeds initial tribe parameters from validated graph-cluster profiles (opscore artifacts, feed risk, cluster cohesion). This demonstrates the pipeline:

> Graph analysis → cluster profiles → behavioral initialization → evolutionary simulation

Tribes with high `a_combat` are more aggressive; high `a_resource` tribes forage better; high `feed_risk` clusters start fragile but evolve resource efficiency under pressure. Alliance formation correlates with `goal_drive` derived from `a_team` artifact.

This is an **exploratory simulation layer** on top of the existing graph analytics — not a thesis empirical result itself.
