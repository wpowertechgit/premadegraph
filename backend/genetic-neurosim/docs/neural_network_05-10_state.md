# Neural Network State (updated 2026-05-12)

> Last audit: 2026-05-10. Fixes applied: 2026-05-11 (B-series, C1, D-series, A-series). Additional fixes: 2026-05-12 (C2 dispute escalation, C3 opportunity war + surrounded escalation, C3 combat targeting). Verified at tick 1100, generation 1.

---

## Key Findings (Read First)

### Previously Critical — Now Fixed

| Bug | Status |
|---|---|
| `Genome::new(8, 3)` hardcoded — 2 inputs never reached network | **FIXED** → `Genome::new(INPUT_COUNT, OUTPUT_COUNT)` = (11, 7) |
| `nearest_enemy` only sensed AtWar tribes | **FIXED** → all non-allied alive tribes |
| `a_risk` stat computed but never wired as input | **FIXED** → input[10] |
| OUTPUT_COUNT=3; migration/raid drives missing | **FIXED** → 7 outputs with semantic labels |
| Migration = dead state; no mechanical action | **FIXED** → destination scoring + camp step movement |
| No fitness function; evolution = pure drift | **FIXED** → `compute_fitness_of()` with 5-component score |
| No selection pressure at generation boundary | **FIXED** → fitness-ranked mutation rate (best: 0.3× rate, worst: 2.0×) |
| No genome crossover | **FIXED** → `Genome::inherit_from()` on polity merger |
| `river_crossings` counter never incremented — Boats locked | **FIXED** → proxy increment every 50 Bridges ticks |
| Stat normalization `tanh(v/3.0)` → all stats near 0.95–0.97 | **FIXED** → linear `v / 10.0`; observed range now 0.025–0.10 |
| Alliance threshold too high; Foraging tribes excluded | **FIXED** → thresholds lowered, Foraging now eligible |
| Disputed tiles linger indefinitely | **FIXED (C2)** → 120-tick grace period; resolves to war / alliance / retreat |
| Combat target = nearest by tile index (not geographic) | **FIXED (C3)** → weakest adjacent rival first, hex-distance fallback |
| Surrounded tribes drift passively into Imploding | **FIXED (C3)** → escalation: fight / desperate ally / Desperate |
| Opportunity war had no proactive target selection | **FIXED (C3)** → `apply_opportunity_war()` every 20 ticks, targets weakest adjacent |
| C# `PlayableSimulation` had no authority disclaimer | **FIXED (A2)** → harness-only banner + authority contract doc |

### Open Gaps (not yet fixed)

- `river_crossings` field not in `TribeSnapshotResponse` — counter exists in `TribeState` but not externally observable via API
- Migration end-to-end untested in small worlds (6×6 too small; need ≥ 20×20)
- No biome-risk input (local terrain hazard not yet wired as NN input)
- No NEAT-style crossover across distinct lineages (only merger-triggered weight blending)
- Fitness-ranked mutation creates selection pressure but no tribe elimination — weakest survive, just mutate faster

---

## Section 1: Current Implementation (post-fix)

### Initialization Flow

1. `TribeSimulation::shared(config)` creates `WorldGrid`, seeds `SmallRng`, calls `initialize_tribes()`
2. Each tribe: `TribeState::from_cluster(i, profile, home_tile)`
   - `starting_pop = cluster_size * 10` (clamped 40–250)
   - `max_pop = cluster_size * 600` (clamped 6k–50k)
   - `starting_food = pop * 5.0`
   - initial behavior `Settling`
3. Genome assigned: `Genome::new(INPUT_COUNT, OUTPUT_COUNT)` = `Genome::new(11, 7)`
4. `TribeStats` loaded via `v / 10.0` (linear normalization)
5. Spawn events emitted; `world.tile_owner` updated

### Genome / Network Structure

- Each tribe holds `Option<Genome>` (never `None` after init)
- `Genome` struct:
  - `nodes: Vec<NodeGene>` (Input / Bias / Hidden / Output)
  - `connections: Vec<ConnectionGene>` (innovation, from/to, weight, enabled)
  - `compiled: CompiledGenome` (cached topological forward-pass plan)
- At init: **11** input nodes + 1 bias + **7** output nodes = **19** nodes
- All inputs connect to all outputs: `(11+1) * 7 = 84` connections, weights in `[-1, 1]`
- Activation: `tanh` on hidden/output nodes
- `genome.compile()` → `&CompiledGenome`
- `CompiledGenome::activate(&inputs[0..11])` → `Vec<f32>` of length 7

### Genome Crossover (`Genome::inherit_from`)

Called during polity merger (`try_merge_allies`):
```rust
pub fn inherit_from(
    &mut self, other: &Genome,
    self_fitness: f32, other_fitness: f32, rng: &mut SmallRng,
) {
    // other_prob = other_fitness / (self_fitness + other_fitness)
    // clamped [0.1, 0.9]
    // For each shared innovation: replace self weight with other weight at other_prob
    self.rebuild_compiled();
}
```
Fitness-weighted blending: fitter tribe donates more weight influence.

---

## Section 2: Input / Output Schema

### Inputs — `last_inputs[0..10]`

All 11 wired to `CompiledGenome::activate()`. Verified at tick 1100.

| Index | Label | Formula | Range | Notes |
|---|---|---|---|---|
| 0 | `food_ratio` | `food_stores / population` | 0–∞ (clamped) | Dynamic |
| 1 | `pop_ratio` | `population / max_population` | 0–1 | Dynamic |
| 2 | `territory` | `territory.len() / 100.0` | 0–1 | Absolute count |
| 3 | `feed_risk` | `tribe.stats.feed_risk` | 0–1 | Static stat |
| 4 | `a_combat` | `tribe.stats.a_combat` | 0–1 | Mutating stat |
| 5 | `a_resource` | `tribe.stats.a_resource` | 0–1 | Mutating stat |
| 6 | `a_map_objective` | `tribe.stats.a_map_objective` | 0–1 | Mutating stat |
| 7 | `a_team` | `tribe.stats.a_team` | 0–1 | Mutating stat |
| 8 | `nearest_enemy` | hex dist to nearest non-allied alive / max_dist | 0–1 | All non-allied (was: AtWar only) |
| 9 | `nearest_ally` | hex dist to ally / max_dist; 1.0 if none | 0–1 | Dynamic |
| 10 | `a_risk` | `tribe.stats.a_risk` | 0–1 | Was unused stat — now wired |

### Outputs — `last_outputs[0..6]`

Network output stored raw (no double-tanh). Drives are in [−1, 1] from `tanh` activation; state machine reads them directly.

| Index | Label | Primary Use | Threshold |
|---|---|---|---|
| 0 | `aggression` | `Settling/Foraging/Desperate → AtWar` | `> 0.45` (was 0.50) |
| 1 | `resource_drive` | territory expansion gate | `> 0.25` |
| 2 | `goal_drive` | alliance formation, river tech unlock | `> 0.55` initiator, `> 0.50` partner |
| 3 | `migration_drive` | `Settling → Migrating` | `> 0.55` (was goal_drive > 0.6) |
| 4 | `raid_drive` | opportunistic war vs weaker neighbor | `> 0.35` |
| 5 | `isolation` | blocks alliance formation | `> 0.75` suppresses alliance |
| 6 | `expansion_speed` | expansion cooldown modifier | continuous |

---

## Section 3: State Machine Transitions (current)

- `Settling` ← `food < 0.3` → `Foraging`
- `Settling` ← `aggression > 0.45 && has_neighbor` → `AtWar`
- `Settling` ← `raid_drive > 0.35 && food > 0.5 && weaker_neighbor` → `AtWar`
- `Settling` ← `migration_drive > 0.55` → `Migrating` (picks destination via `pick_migration_dest`)
- `Foraging` ← `food > 0.8` → `Settling`
- `Foraging` ← `food < 0.1` → `Starving`
- `Foraging` ← `aggression > 0.45 && has_neighbor` → `AtWar`  ← **new**
- `AtWar` ← resolved → `Occupying` / `Peace` / `Settling`
- `Occupying` ← `ticks > 200` → `Settling`
- `Peace` ← `ticks > 500` → `Settling`
- `Allied` ← `no_ally` → `Settling`
- `Allied` ← `ticks > 300 && both agree` → `Consolidating` (merger + crossover)
- `Starving` ← `ticks > 50` → `Desperate`
- `Desperate` ← `ticks > 100` → `Imploding`
- `Desperate` ← `aggression > 0.6 && has_neighbor` → `AtWar`
- `Imploding` ← each tick: `pop -= max(1, pop/20)` → death
- `Consolidating` ← `ticks > 100` → `Administering`
- `Administering` ← `a_team < 0.25 && ticks > 100` → `Rebellious`
- `Rebellious` ← `ticks > 50 && aggression > 0.7` → `AtWar`
- `Rebellious` ← `ticks > 200` → `Administering`
- `Migrating` ← each tick: step camp toward `migration_target_tile`; on arrival → `Settling`

**Alliance eligibility change:** was `Settling only + 100 ticks`; now `Settling | Foraging + 30 ticks`, `goal_drive > 0.55` initiator, `isolation[5] < 0.75`.

---

## Section 4: Major Subsystems

**Combat** (`apply_combat`)
- Target selection: weakest adjacent rival first (`pop × a_combat`); falls back to nearest by hex distance
- Strength = `population * a_combat * gaussian_noise`
- Casualties via Poisson: `lambda = enemy_a_combat * pop * 0.02`
- Defender: biome defense + homeland bonus (`+0.3`)
- Winner absorbs territory; `WarState` records both sides

**Dispute Escalation** (`update_dispute_registry` + `apply_dispute_resolution`) — C2
- Tracks (tribe_i, tribe_j) pairs sharing a disputed tile; records first-seen tick
- After 120-tick grace period, forces one of three outcomes:
  - **Alliance**: both `goal_drive > 0.55`, both `a_team > 0.45`, both unallied → Allied
  - **War**: aggressor `aggression > 0.40`, defender not clearly weaker → WarDeclared + AtWar
  - **Retreat**: weaker side abandons shared contested tiles → DisputeResolved flags=3
- Evicts resolved pairs from registry automatically

**Opportunity War** (`apply_opportunity_war`) — C3, every 20 ticks
- For each non-AtWar tribe: if `raid_drive > 0.58` or (`aggression > 0.48` and weaker neighbor exists)
- Declares war and immediately sets `target_tribe` to the weakest adjacent rival
- Creates WarState + WarDeclared event; not a duplicate of state machine AtWar transitions

**Surrounded Escalation** (`apply_surrounded_escalation`) — C3, every 30 ticks
- Detects tribes with no neutral expansion tiles adjacent to their territory
- `aggression > 0.42` or already Desperate → war against weakest adjacent rival
- `goal_drive > 0.52` and `isolation < 0.55` and unallied → desperate alliance with least-aggressive neighbor
- Otherwise → transitions to Desperate rather than drifting

**Alliances** (`apply_alliances`)
- Evaluated every 50 ticks
- `goal_drive > 0.55` (initiator), `> 0.50` (partner)
- `Settling | Foraging` for 30+ ticks (was: Settling + 100)
- `isolation < 0.75` required on initiator
- Food sharing: 5% of surplus per cycle

**Migration** (`pick_migration_dest` + `Migrating` branch)
- Triggered: `Settling + migration_drive > 0.55`
- Scores unowned tiles: `max_food * 0.7 + proximity * 0.3`, distance range 4–15 tiles
- Each tick in `Migrating`: camp steps one hex toward `migration_target_tile`
- On arrival: behavior → `Settling`

**Territory Expansion** (`apply_territory_expansion`)
- Eligible: `Settling | Foraging`, cooldown elapsed, pop gate, tier cap
- Gate: `resource_drive > 0.25`
- Claim cost: `base + territory_count*3 + dist*2 + terrain + pressure`
- New tiles: 25% yield → 100% over 75 ticks
- `expansion_speed[6]` output modulates cooldown

**Generation Boundary** (`apply_generation_boundary`) — every 1000 ticks
- Calls `compute_fitness_of(i)` for all alive tribes
- Ranks tribes by fitness score
- Mutation rate: `base_rate * (2.0 - 1.7 * rank)` — rank 0.0 (worst) → 2× rate; rank 1.0 (best) → 0.3×
- Stats nudged ±0.02
- Fitness score stored in `tribe.fitness_score`
- Lineage entry logged: `"gen-N-fitness-X.XX"`

**Fitness Function** (`compute_fitness_of`)
```
territory_score * 0.30
+ pop_score      * 0.25
+ survival_score * 0.20
+ merger_score   * 0.15
+ war_score      * 0.10
```

**River Crossing** (`apply_river_crossing`)
- None→Bridges: `goal_drive > 0.7 + 50 ticks near river`
- Bridges→Boats: `goal_drive > 0.8 + 20 crossings`
- **Fix:** counter increments every 50 ticks while in `Bridges` tech + territory > 3 + river proximity
- Boats tech now reachable

---

## Section 5: Gap Analysis (current)

| Aspect | Current | Remaining Gap |
|---|---|---|
| **Neural input count** | 11 (fixed) | No biome-risk input; territory saturation not yet a signal |
| **Neural outputs** | 7 semantic drives | Could expand raid/diplomacy further; 7 is workable |
| **Nearest enemy sensing** | All non-allied alive (fixed) | — |
| **Migration** | Real mechanic: destination scoring + step movement | Untested in large worlds; no terrain-cost pathfinding |
| **Selection pressure** | Fitness-ranked mutation rate (fixed) | No tribe elimination; weakest still survive |
| **Fitness function** | 5-component weighted score (fixed) | Merger score proxy; war_score is binary win/loss |
| **Genome crossover** | `inherit_from()` on merger (fixed) | Only merger-triggered; no independent lineage crossover |
| **River crossing** | Counter increments (fixed) | Field not in `TribeSnapshotResponse`; not API-observable |
| **Stat normalization** | Linear `v/10.0` (fixed) | — |
| **Alliance frequency** | Thresholds lowered; Foraging allowed (fixed) | — |
| **a_risk input** | Wired as input[10] (fixed) | No mechanism for a_risk to actually gate risk behavior yet |
| **Dispute resolution** | Grace period + 3 resolution paths (C2 fixed) | — |
| **Combat targeting** | Weakest adjacent first, hex-distance fallback (C3 fixed) | Was tile-index distance |
| **Opportunity war** | Proactive raid/aggression-driven targeting (C3 fixed) | — |
| **Surrounded escalation** | Boxed tribes fight, ally, or go Desperate (C3 fixed) | — |
| **Territory sensing** | `territory.len() / 100.0` (absolute) | Saturation / border pressure still not represented |
| **Genome topology** | NEAT-like add-node/add-connection | No speciation; no population crossover |
| **Event log** | Ring buffer with drive values | No full snapshot (inputs+outputs) per behavior transition |
| **FrameV1 / MonoGame sync** | Basic tribe state visible | Brain/migration/fitness not yet exposed (E1/E2 pending) |
| **Lineage/tombstone wiring** | Infrastructure exists | Not yet connected to dispute/war/merger events (D4 pending) |

---

## Section 6: Decision Narrative (current)

### How a tribe decides what to do in one tick:

1. **Sensing (Pass 1):** Hex-scan for nearest non-allied alive enemy and nearest ally; compute distances
2. **Input wiring (Pass 2):** Fill `last_inputs[0..10]` — food, pop, territory, 4 stats, enemy dist, ally dist, a_risk
3. **Neural activation (Pass 3):** `CompiledGenome::activate(&last_inputs)` → 7 drives
4. **Output storage (Pass 4):** Store drives in `last_outputs[0..6]`
5. **State transitions (Pass 5):** State machine checks drives against thresholds; selects next state
6. **Action subsystems:** Territory claims, combat, alliances, migration step execute
7. **Population dynamics:** Food consumption, reproduction
8. **Long-term evolution (every 1000 ticks):** Fitness evaluated, mutation rates differentiated by rank

### Key Takeaway

The network is a **personality/drive generator**, not a controller. Seven drives bias a deterministic state machine. High-aggression genome makes war thresholds easier to cross; high migration_drive makes tribes relocate when Settling. Fitness-ranked mutation creates directional evolutionary pressure — poorly-performing tribes mutate faster, creating behavioral experimentation; successful tribes preserve their genome more conservatively.

---

## Section 7: Evolutionary Aspects (current status)

**Implemented:**
- Topology mutation (add-node, add-connection, weight perturbation, toggle)
- Per-tribe mutation at generation boundary (every 1000 ticks)
- Fitness evaluation (`compute_fitness_of` — territory, pop, survival, mergers, wars)
- Fitness-ranked mutation rate (rank-based differential pressure)
- Genome crossover on merger (`inherit_from` — fitness-weighted weight blending)
- Fitness score stored and logged in lineage

**Still missing:**
- Population-level NEAT crossover (independent of merger events)
- Speciation (genome distance metric, species membership)
- Tribe elimination based on fitness threshold
- Lineage-aware offspring trait inheritance

### Concise Summary

> Each tribe runs a NEAT-style neural network (11 inputs, 7 outputs) seeded from its cluster profile. The network produces seven drives that bias a deterministic state machine. Tribes mutate every 1000 ticks with fitness-ranked rates — worst performers mutate aggressively, best performers preserve their genome. On polity mergers, fitness-weighted genome crossover blends successful connection weights. The result is directional behavioral evolution under survival pressure, not pure random drift.
