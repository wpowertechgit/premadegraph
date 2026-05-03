# NeuroSim Tribal Simulation — Implementation Plan
**Date:** 2026-05-03  
**Scope:** Replace per-agent NEAT with tribe-level NEAT; dataset clusters become living tribes in a 2000×2000 world.

---

## Context

- Design spec: `docs/neurosim-tribal-simulation-design.md`
- Artifact formula: `docs/opscore-v2-local-formula.md`
- Rust backend: `backend/genetic-neurosim/backend/src/simulation.rs` (1744 lines — full rewrite of simulation loop)
- DB layer: `backend/genetic-neurosim/backend/src/db.rs`
- Server: `backend/genetic-neurosim/backend/src/main.rs`
- Node glue: `backend/server.js` (`computeNeurosimClusterProfiles()` at ~line 3246)
- Cargo: `backend/genetic-neurosim/backend/Cargo.toml`

---

## Artifact Column Mapping (v1 DB → v2 tribe stats)

| DB column | artifact_ prefix | v2 tribe stat(s) |
|-----------|-----------------|------------------|
| `artifact_kda` | kda | fight_conversion |
| `artifact_damage` | damage | damage_pressure |
| `artifact_objectives` | objectives | objective_conversion |
| `artifact_map_awareness` | map_awareness | vision_control |
| `artifact_economy` | economy | economy |
| `artifact_early_game` | early_game | tempo |
| `artifact_tanking` | tanking | death_cost, survival_quality |
| `artifact_utility` | utility | setup_control, protection_support |

Normalization: divide weighted average by **4.5** (artifact soft cap).  
`feed_risk = clamp(0.0, 1.0, 1.0 − artifact_tanking_weighted / 9.0)`

---

## Tasks

### Task 1 — Extend `ClusterProfile` + `db.rs` Postgres fallback
**File:** `backend/genetic-neurosim/backend/src/simulation.rs`  
**File:** `backend/genetic-neurosim/backend/src/db.rs`

Add to `ClusterProfile` struct:
```rust
// Primary artifacts (0.0–1.0 after /4.5 normalization)
pub a_combat: f32,       // (fight_conversion + damage_pressure) / 2
pub a_risk: f32,         // (death_cost + survival_quality) / 2
pub a_resource: f32,     // (economy + tempo) / 2
pub a_map_objective: f32,// (vision_control + objective_conversion) / 2
pub a_team: f32,         // (setup_control + protection_support) / 2
// Sub-artifacts
pub fight_conversion: f32,
pub damage_pressure: f32,
pub death_cost: f32,
pub survival_quality: f32,
pub economy: f32,
pub tempo: f32,
pub vision_control: f32,
pub objective_conversion: f32,
pub setup_control: f32,
pub protection_support: f32,
// Derived
pub feed_risk: f32,       // clamp(0,1, 1 − a_risk_tanking / 9.0)
pub cluster_size: u32,
pub founder_puuids: Vec<String>, // top-3 by match count
```

In `db.rs` Postgres fallback, add `default 0.0` for all new fields; keep Postgres path compiling.  
In `PremadegraphExportResponse` deserialization, `#[serde(default)]` all new fields.

---

### Task 2 — Extend `computeNeurosimClusterProfiles()` SQL in `backend/server.js`
**File:** `backend/server.js` (~line 3246)

Change `HAVING c.size >= 3` → `HAVING c.size >= 2`.

Add weighted-average columns for all 8 artifact_ columns:
```sql
SUM(ps.artifact_kda * ps.match_count) / SUM(ps.match_count)           AS artifact_kda_wa,
SUM(ps.artifact_damage * ps.match_count) / SUM(ps.match_count)        AS artifact_damage_wa,
-- ... (all 8)
```

Add `cluster_size` (alias `c.size`), `founder_puuids` as `STRING_AGG` of top-3 players by match count.

Map to the export JSON shape consumed by `db.rs`:
- Compute sub-artifacts: `fight_conversion = artifact_kda_wa / 4.5`, etc.
- Compute primaries: `a_combat = (fight_conversion + damage_pressure) / 2`
- `feed_risk = Math.max(0, Math.min(1, 1 - (artifact_tanking_wa / 4.5) / 2.0))`

Update `/api/neurosim/cluster-export` and `/api/neurosim/datasets/:id/cluster-export` routes to return extended shape.

---

### Task 3 — Create `world.rs` (WorldGrid, Biome, BiomeTile)
**File:** `backend/genetic-neurosim/backend/src/world.rs`

```
WORLD_W = 2000, WORLD_H = 2000
TILE_SIZE = 50
GRID_W = 40, GRID_H = 40   → 1600 tiles
```

Biome enum (u8):
```rust
Plains=0, Forest=1, Desert=2, Mountain=3, Swamp=4, River=5
```

BiomeTile struct:
```rust
pub biome: Biome,
pub food: f32,          // 0.0–1.0
pub max_food: f32,
pub food_regen: f32,
pub move_cost: f32,
pub defense_bonus: f32,
pub disease_rate: f32,
```

Biome stats table:
| Biome | food_density | move_cost | defense_bonus | disease_rate |
|-------|-------------|-----------|---------------|--------------|
| Plains | 0.7 | 1.0 | 0.0 | 0.01 |
| Forest | 0.9 | 1.4 | 0.3 | 0.03 |
| Desert | 0.2 | 1.2 | 0.1 | 0.02 |
| Mountain | 0.3 | 2.0 | 0.5 | 0.01 |
| Swamp | 0.5 | 1.8 | 0.1 | 0.08 |
| River | 0.6 | 3.0 | 0.0 | 0.02 |

`WorldGrid::new(seed: u64, n_tribes: usize) -> WorldGrid`:
1. Seed `SmallRng::seed_from_u64(seed)`.
2. Voronoi: pick `n_tribes` random centroid tiles; assign each tile to nearest centroid; map centroid index → Biome via `rng.gen_range(0..5)` (no River).
3. River pass: 2–4 random-walk paths from top to bottom edge; each walked tile overrides biome to River, food = 0.6, move_cost = 3.0.
4. Initialize `food` per tile to `biome.food_density × rng.uniform(0.8..1.0)`.

`WorldGrid::tick_food(&mut self)`: each tile `food = (food + regen).min(max_food)`. River tiles unchanged.

Export: `changed_food_tiles() -> Vec<(u16, f32)>` — tiles where `|food - last_sent_food| > 0.05`.

---

### Task 4 — Create `tribes.rs` (TribeState, TribeStats, BehaviorState)
**File:** `backend/genetic-neurosim/backend/src/tribes.rs`

```rust
#[repr(u8)]
pub enum BehaviorState {
    Settling=0, Foraging=1, Migrating=2, AtWar=3,
    Occupying=4, Peace=5, Allied=6,
    Starving=7, Desperate=8, Imploding=9,
}

pub enum RiverCrossing { None, Bridges, Boats }

pub struct FounderTag {
    pub puuid: String,
    pub inherited_at_generation: u32,
}

pub struct TribeStats {
    pub a_combat: f32,
    pub a_risk: f32,
    pub a_resource: f32,
    pub a_map_objective: f32,
    pub a_team: f32,
    pub feed_risk: f32,
    // sub-artifacts
    pub fight_conversion: f32,
    pub damage_pressure: f32,
    pub death_cost: f32,
    pub survival_quality: f32,
    pub economy: f32,
    pub tempo: f32,
    pub vision_control: f32,
    pub objective_conversion: f32,
    pub setup_control: f32,
    pub protection_support: f32,
}

pub struct TribeState {
    pub id: usize,
    pub cluster_id: String,
    pub population: u32,
    pub max_population: u32,      // min(2000, cluster_size × 25)
    pub food_stores: f32,
    pub territory: Vec<u16>,      // tile indices owned
    pub home_tile: u16,
    pub behavior: BehaviorState,
    pub target_tribe: Option<usize>,
    pub ally_tribe: Option<usize>,
    pub ticks_in_state: u32,
    pub ticks_near_river: u32,
    pub river_crossings: u32,
    pub river_crossing_tech: RiverCrossing,
    pub stats: TribeStats,
    pub genome: Genome,
    pub generation: u32,
    pub lineage: Vec<String>,     // absorbed cluster_ids
    pub founders: Vec<FounderTag>,
    pub ticks_alive: u64,
    // Neural net inputs cache
    pub last_inputs: [f32; 8],
    pub last_outputs: [f32; 3],
}
```

`TribeState::from_cluster(id, profile, home_tile) -> TribeState` — construct from ClusterProfile; genome = `Genome::new(8, 3)`.

`TribeState::nn_inputs(world, tribes) -> [f32; 8]`:
1. `food_stores / max_population as f32`
2. `population / max_population as f32`
3. `territory.len() / 100.0`
4. `stats.feed_risk`
5. `stats.a_combat`
6. `stats.a_resource`
7. nearest enemy distance (tile distance, / 40.0)
8. nearest ally distance (/ 40.0)

`TribeState::nn_outputs_to_drive(outputs: [f32; 3]) -> (f32, f32, f32)`:
- `(aggression_drive, resource_drive, goal_drive)` — each `tanh(output)` mapped to 0..1.

---

### Task 5 — Update constants + rewrite `Simulation` → `TribeSimulation` shell in `simulation.rs`
**File:** `backend/genetic-neurosim/backend/src/simulation.rs`

Remove: `AgentStorage`, `Environment` (food tiles / poison / agent step loop).  
Keep: `Genome`, `InnovationTracker`, `Vec2`, `SpatialHash`, `push_u32`, `push_f32`, recording infrastructure, `SharedSimulation` type alias, `ConfigPatch`, `ControlConfig` (extend), `StatusResponse`, `GodModeResponse`, `RecordingSummary`, `SaveRecordingRequest`, `ReplayRecordingRequest`.

Update constants:
```rust
const INPUT_COUNT: usize = 8;
const OUTPUT_COUNT: usize = 3;
```

Extend `ControlConfig`:
```rust
pub clusters: Vec<ClusterProfile>,
pub world_seed: u64,
pub tick_rate: u32,
pub population_size: u32,  // kept for compat; unused in tribal mode
pub mutation_rate: f32,
pub max_generations: u32,
pub food_spawn_rate: f32,   // kept for compat
pub energy_decay: f32,      // kept for compat
```

New `TribeSimulation` struct:
```rust
pub struct TribeSimulation {
    config: ControlConfig,
    world: WorldGrid,
    tribes: Vec<TribeState>,
    tick: u64,
    generation: u32,
    rng: SmallRng,
    halted: bool,
    recordings: Vec<Recording>,  // reuse existing type
    replay_frame: Option<Vec<u8>>,
}
```

Implement existing trait surface:
- `is_halted()`, `config()`, `apply_config_patch()`, `status()`, `current_packet()`, `pack_current_frame()`, `kill_half_population()`, `list_recordings()`, `save_recording()`, `replay_recording()`

`SharedSimulation = Arc<RwLock<TribeSimulation>>`

---

### Task 6 — Implement `initialize_tribes()` + basic `step()` + `pack_frame()`
**File:** `backend/genetic-neurosim/backend/src/simulation.rs`

`initialize_tribes(config, world, rng)`:
- Place tribes on distinct home tiles (spread via `world.find_spawn_tile(i, n, rng)` — Voronoi centroid positions).
- Each tribe claims 1 starting tile.
- Population = `min(2000, cluster_size × 25)`.
- `food_stores = population as f32 × 0.5`.

`step(&mut self)`:
1. `world.tick_food()`
2. For each tribe: run neural net → get drives
3. Apply state machine transitions (Task 7)
4. Process combat if AtWar (Task 8)
5. Process alliances (Task 9)
6. Forage: tribes in Foraging/Settling eat from territory tiles
7. Population change: `Δpop = floor((food_stores / population as f32 - 0.8) × 0.05 × population)` clamped
8. Every 1000 ticks: generation boundary (Task 10)
9. Check river crossing evolution (Task 11)
10. Detect extinction: if `population == 0` → mark tribe dead

`pack_frame() -> Vec<u8>` (binary WS format):
```
Header: 20 bytes
  u32 tick_lo, u32 tick_hi (split u64 → 2×u32)
  u32 tribe_count
  u32 changed_food_tile_count
  u32 generation

Per tribe: 36 bytes
  u32 id
  u32 population
  u16 home_tile
  u16 behavior (u8 cast)
  u16 target_tribe (0xFFFF = none)
  u16 ally_tribe (0xFFFF = none)
  f32 food_stores
  f32 a_combat
  f32 a_risk
  f32 a_resource
  f32 a_map_objective  [4 bytes]
  // territory_count u16 + padding u16
  u16 territory_count
  u16 generation

Per changed food tile: 6 bytes
  u16 tile_index
  f32 food
```

All multi-byte fields little-endian. Use existing `push_u32` / `push_f32` helpers. Add `push_u16`.

---

### Task 7 — State machine transitions
**File:** `backend/genetic-neurosim/backend/src/simulation.rs` (or `tribes.rs`)

Full transition table:

| Current state | Condition | Next state |
|--------------|-----------|------------|
| Settling | `food_stores < population × 0.3` | Foraging |
| Settling | `aggression > 0.7` AND neighbor exists | AtWar |
| Foraging | `food_stores > population × 0.8` | Settling |
| Foraging | `food_stores < population × 0.1` | Starving |
| Migrating | arrived at new tile | Settling |
| AtWar | combat resolved | Settling or Occupying |
| Occupying | `ticks_in_state > 200` | Settling |
| Peace | `ticks_in_state > 500` | Settling |
| Allied | ally tribe dead | Settling |
| Starving | `food_stores == 0` AND `ticks_in_state > 50` | Desperate |
| Starving | food found | Foraging |
| Desperate | `ticks_in_state > 100` | Imploding |
| Desperate | `aggression > 0.6` | AtWar |
| Imploding | every tick: `population -= max(1, population / 20)` | dies at 0 |

`goal_drive > 0.6` + no active war → consider Migrating (pick highest-food adjacent unowned tile).

---

### Task 8 — Combat resolution
**File:** `backend/genetic-neurosim/backend/src/simulation.rs`

War declaration: tribe A in Settling/Foraging with `aggression_drive > 0.7` and a neighboring tribe B within 5 tiles. Set A→AtWar, target=B.

Each combat tick (every 10 ticks while AtWar):
```
attacker_strength = A.population × A.stats.a_combat × rng.gen_normal(1.0, 0.15)
defender_strength = B.population × (B.stats.a_risk + B.world_tile.defense_bonus) × rng.gen_normal(1.0, 0.15)
```
Box-Muller: `z = sqrt(-2 ln u1) × cos(2π u2)` where u1, u2 from `rng.gen::<f32>()`.

```
ratio = attacker / defender
A_casualties = poisson(B.stats.a_combat × A.population × 0.02)
B_casualties = poisson(A.stats.a_combat × B.population × 0.02 × ratio)
```
Knuth Poisson: `L = e^(-λ); k=0, p=1; while p>L { p×=rng.gen(); k+=1 }; return k-1`.

If B.population ≤ 0: A absorbs B's territory tiles, B's `founder_tags` appended to A, B state = Imploding.  
If `ticks_in_state > 300`: both return to Peace/Settling.

---

### Task 9 — Alliance system + peace mechanic
**File:** `backend/genetic-neurosim/backend/src/simulation.rs`

Alliance proposal: tribe A `goal_drive > 0.7` + nearby tribe B `goal_drive > 0.6` + neither at war + `ticks_in_state > 100` in Settling.  
Set A→Allied(B), B→Allied(A). Allied tribes share food (5% transfer per 50 ticks from larger to smaller).  
Break alliance: one tribe enters AtWar/Desperate/Imploding, or `aggression_drive > 0.8` for either partner.

Peace: after combat ends (timer or mutual exhaustion), both tribes enter Peace for 500 ticks. Peace → Settling after timer.

---

### Task 10 — Generation boundary + stat mutation + lineage log
**File:** `backend/genetic-neurosim/backend/src/simulation.rs`

Every 1000 ticks:
1. `generation += 1` for each living tribe.
2. Genome mutation: `genome.mutate(&mut rng, mutation_rate)` — existing method.
3. Stat nudge per surviving tribe: `a_combat += rng.gen_range(-0.02..0.02)` etc. (all 5 primaries), clamped 0..1.
4. High feed_risk bias: if `feed_risk > 0.6` → `a_resource += 0.03` nudge (tribes under food pressure improve foraging).
5. Lineage log: push entry to `Vec<(u32 generation, String event)>` — "gen N: absorbed {cluster_id}", "gen N: survived".
6. Extinct lineage: tribe with population=0 → mark dead, remove from active simulation.

---

### Task 11 — River crossing evolution
**File:** `backend/genetic-neurosim/backend/src/tribes.rs` + `simulation.rs`

Track per tribe:
- `ticks_near_river`: increment when any territory tile is adjacent to River tile.
- `river_crossings`: increment when tribe successfully moves across a River tile.

Transitions:
- `None → Bridges`: `goal_drive > 0.7` AND `ticks_near_river > 50` → unlock. River `move_cost` for this tribe: 3.0 → 1.5.
- `Bridges → Boats`: `goal_drive > 0.8` AND `river_crossings > 20` → unlock. River `move_cost` → 0.8.

Boats tribes can claim River tiles as territory (food 0.6, fishing bonus).

---

### Task 12 — Update `main.rs` routes
**File:** `backend/genetic-neurosim/backend/src/main.rs`

- Rename `/ws/simulation` → `/ws/tribal-simulation` (keep old route as alias returning 410 Gone or redirect).
- Keep all other routes identical (compatible with existing infra).
- `AppState.simulation` type changes to `Arc<RwLock<TribeSimulation>>` — no route handler logic changes.
- Remove any per-agent references in comments.

---

### Task 13 — Create `neurosim-bridge.js` + wire `server.js`
**File:** `backend/neurosim-bridge.js` (new file)

Model on `backend/pathfinder/rustBridge.js`. Key differences:
- Binary `tribal-neurosim-backend` instead of `pathfinder_rust`
- Resolve binary from `backend/genetic-neurosim/backend/target/release/neurosim-backend[.exe]`
- No daemon pattern needed (HTTP proxy, not stdio JSON): forward REST calls via `http.request` to port 8000.
- WebSocket: TCP-level proxy using Node `net.createConnection`:

```js
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/api/neurosim/ws/tribal-simulation') {
    const upstream = net.createConnection(8000, 'localhost');
    upstream.write(`GET /ws/tribal-simulation HTTP/1.1\r\nHost: localhost:8000\r\nUpgrade: websocket\r\n...`);
    socket.pipe(upstream).pipe(socket);
  }
});
```

No new npm deps. Uses Node built-in `net`, `http`, `child_process`.

In `backend/server.js`:
- Import and init `neurosim-bridge.js`.
- Add route group `/api/neurosim/*` proxying to Rust backend port 8000.
- Expose `GET /api/neurosim/cluster-export` (existing function, now with extended shape).
- Expose `GET /api/neurosim/datasets/:id/cluster-export`.

---

### Task 14 — Create `TribalSimulationPage.tsx` + `App.tsx` route
**File:** `frontend/src/pages/TribalSimulationPage.tsx` (new)  
**File:** `frontend/src/App.tsx` (add route)

Canvas2D (not Three.js). 800×800px canvas, scale = 800/2000 = 0.4.

Rendering:
- Each tile: 20×20px (50 world units × 0.4 scale).
- Tile color by biome: Plains=#8BC34A, Forest=#2E7D32, Desert=#F9A825, Mountain=#607D8B, Swamp=#4CAF50+dark, River=#1565C0.
- Food overlay: alpha = tile.food × 0.4.
- Tribe territory: colored border or fill tint by tribe hue (hash cluster_id → hue).
- Tribe label: cluster_id abbreviated, centered on home tile.
- Behavior state indicator: small colored dot (Foraging=green, AtWar=red, Starving=orange, Allied=blue, etc).

WebSocket: connect to `/api/neurosim/ws/tribal-simulation`. Parse binary frame with `DataView`:
- Read header (20 bytes), then N tribes (36 bytes each), then M food tiles (6 bytes each).

Controls panel (MUI):
- Pause/Resume (POST `/api/neurosim/api/config`)
- Tick rate slider
- God Mode button (POST `/api/neurosim/api/god-mode`)
- Generation + tick counter display

Add route in `App.tsx`:
```tsx
<Route path="/tribal-simulation" element={<TribalSimulationPage />} />
```

Add nav link in `AppNavbar.tsx`.

---

## Build Order

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14

Tasks 3 and 4 can be parallelized (world.rs and tribes.rs are independent).  
Tasks 7–11 can be developed incrementally inside the simulation loop.  
Task 13 and 14 can be parallelized once Task 12 is done.

---

## Key Invariants

- `ClusterProfile` deserialization: all new fields `#[serde(default)]` in Rust; JS endpoint always provides them.
- Frame format: header always 20 bytes; tribe record always 36 bytes; food tile always 6 bytes. Frontend `DataView` offsets are fixed.
- Recording infrastructure: `save_recording` / `replay_recording` unchanged — tribal simulation emits same `pack_frame()` bytes into recordings.
- No new Cargo deps. No new npm deps.
- `HAVING c.size >= 2` (not 3) to include small clusters.
- Genome inputs: exactly 8, outputs: exactly 3.
