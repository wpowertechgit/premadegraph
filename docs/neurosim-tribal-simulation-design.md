# NeuroSim Tribal Simulation — Design Document

## 1. What We Are Building

A dataset-driven tribal evolutionary simulation where every graph cluster from the current premadegraph dataset becomes a living tribe competing inside a procedurally structured sandbox world.

The simulation answers one research question:

> Given clusters derived from real match data, which cluster structures — and which performance profiles — prove the most robust, dominant, or persistent under competitive evolutionary pressure?

This is an exploratory model. Results are interpreted as model behaviour, not proof of real-world skill ranking.

The frontend page loads this simulation on demand. It is its own subsystem, powered by the premadegraph dataset pipeline and rendered via WebSocket frames. It is unrelated to the pathfinder lab or other graph analytics features.

---

## 2. Fitness Function

### Weighted Opscore (Tribe Baseline Power)

Each tribe's core strength is not a simple cluster average. Players with more matches carry more weight because they represent more stable evidence.

```
tribe_opscore =
  SUM(player.opscore × player.match_count)
  / SUM(player.match_count)
  for all players in the cluster
```

This means:
- A high-opscore player with 10 matches has less pull than a solid 7-opscore player with 200 matches.
- Tribes built on consistent performers are more stable than tribes built on one outlier with few matches.

`tribe_opscore` is normalized to 0–1 (raw value divided by 10).

### Feed Constraint (Chaos Factor)

Feedscore in v2 is derived from Risk Discipline:

```
feed_risk = clamp(0, 10, 10 − 5 × A_risk)
```

High `feed_risk` means the tribe performs recklessly — dies too often, spends too much time dead. Same weighted-match logic applied:

```
tribe_feed_risk =
  SUM(player.feed_risk × player.match_count)
  / SUM(player.match_count)
```

`tribe_feed_risk` normalized to 0–1 (raw value divided by 10).

This acts as a **natural chaos multiplier**:
- Tribes with high feed_risk are volatile. Even with elite combat stats they will sometimes self-destruct.
- Perfect tribes are intentionally impossible. Feed_risk ensures variance.
- Apex clusters still emerge because some clusters genuinely have low feed_risk AND high opscore.

### The Five Artifacts + Ten Sub-Artifacts

Every tribe gets five primary stats and ten sub-stats, all derived by weighted-match averaging of the corresponding artifact and sub-artifact columns from the players table.

**Primary artifacts:**

| Artifact | Tribe stat | Simulation role |
|---|---|---|
| A_combat (Combat Impact) | `combat_power` | Fight resolution multiplier |
| A_risk (Risk Discipline) | `risk_threshold` + `feed_risk` | When to fight/flee, desperation onset |
| A_resource (Resource Tempo) | `food_rate` | Food harvest speed, farm build efficiency, alliance affinity |
| A_map_objective (Map & Objective Control) | `scout_range` + `goal_drive` | Fog-of-war radius, objective completion rate |
| A_team (Team Enablement) | `unity` | Coordination bonus in combat and foraging, morale stability |

**Sub-artifacts (ten total, two per primary):**

| Sub-artifact | Parent | Tribe modifier |
|---|---|---|
| fight_conversion | A_combat | Bonus on offensive kill raids |
| damage_pressure | A_combat | Sustained attrition damage in prolonged combat |
| death_cost | A_risk | Penalty reduction when losing soldiers |
| survival_quality | A_risk | Clutch endurance, delay before DESPERATE transition |
| economy | A_resource | Gold/resource generation rate |
| tempo | A_resource | Early-game speed advantage, first-mover foraging |
| vision_control | A_map_objective | Fog-of-war clarity, detecting ambushes |
| objective_conversion | A_map_objective | Success rate on multi-step goals (build farm, cross river, fort) |
| setup_control | A_team | Crowd-control equivalent: ability to disrupt enemy tribe actions |
| protection_support | A_team | Defensive formation bonus, saving endangered population units |

**Storage:** All 15 values (5 primary + 10 sub) computed at cluster-export time and stored in the extended `ClusterProfile` struct. They persist in the neurosim config and are logged per-tribe per-generation in simulation history.

> Artifact → DB column mapping needs one verification pass against `scoring_config.js` before implementation. Conceptual mapping is locked; column names may differ.

---

## 3. World Design

### Grid

2000×2000 world with 50-unit biome tiles (1,600 tiles total). Seeded procedural noise — same dataset run always produces the same map unless a new seed is chosen, enabling reproducible research comparisons.

### Biome Attributes

| Attribute | Effect |
|---|---|
| `food_density` | Base food spawn rate per tick |
| `move_cost` | Speed multiplier (lower = slower) |
| `defense_bonus` | Defender combat roll multiplier |
| `disease_rate` | Passive population drain per tick |

### Biomes

| Biome | food | move | defense | disease | Strategic notes |
|---|---|---|---|---|---|
| **Plains** | 0.5 | 1.0 | 0.0 | 0.0 | Neutral, contested, high migration throughput |
| **Forest** | 1.0 | 0.6 | 0.3 | 0.05 | Food-rich but slow — strong for high-resource tribes |
| **Desert** | 0.1 | 1.4 | 0.1 | 0.0 | Hostile but fast — only desperate or scout-heavy tribes cross |
| **Mountain** | 0.2 | 0.4 | 0.8 | 0.0 | Defensible chokepoints, poor farming — good for militaristic apex tribes |
| **Swamp** | 0.4 | 0.3 | 0.2 | 0.15 | Disease drains population — only high-risk-discipline tribes survive here |
| **River** | 0.7 | 0.5 | 0.1 | 0.0 | Good fishing, alliance meeting point, crossable at cost |

### River Crossing

Rivers are **not hard barriers** — any tribe can cross them. The cost is high unless the tribe has evolved crossing infrastructure.

```
crossing_cost_multiplier = 3.0
if tribe has evolved BRIDGES: crossing_cost_multiplier = 1.2
if tribe has evolved BOATS:   crossing_cost_multiplier = 0.8  (fast but capacity-limited)
```

Bridge and boat evolution are unlockable capabilities earned by tribes with high `goal_drive` (from A_map_objective) after sufficient generations settled near rivers. A tribe with a good reason to cross (rich biome on the other side, enemy to raid) will accept the cost.

---

## 4. Tribe Architecture

### Cluster → Tribe Mapping

Every cluster with `size >= 2` in the active dataset becomes one tribe. These are the same clusters shown on the associative graph (graph-v2). No new clustering step is performed.

Small clusters (size 2–5) are fully valid — they are expected to be absorbed or eliminated early, and that is intended behaviour. Their fate is logged.

Each tribe is initialized with:
- A seeded random starting position on the world map
- Its fifteen weighted-artifact stats computed from the database
- Its starting population
- Its founder member registry (see below)

### Population Sizing

```
tribe_population = min(2000, cluster_size × 25)
```

`POPULATION_MULTIPLIER = 25` is configurable. The per-tribe cap is **2000**. Expected total world population across all tribes: **50,000–100,000** citizens, matching the simulation engine's tested capacity.

### Founder Member Registry

Each citizen in a tribe is tagged with the PUUID of the original cluster member they descend from. This enables:

**Lineage tracking:** After a simulation run, we can answer — which original players' descendants survived? Which founder members contributed to the final dominant tribe?

**Genetic mixing log:** When tribes are absorbed (their population joins a conquering tribe), the absorbed tribe's citizens carry their original founder tags. The winning tribe's final population therefore encodes the full lineage of every absorbed tribe.

**Leaderboard:** End-of-simulation ranking by founder-member representation in the surviving population — e.g. `Player A (60 matches, opscore 7.3) — 14.2% of winning tribe at generation 12`.

**Extinction log:** `Tribe X (cluster rust_pathfinding:47) died in generation 3 — no descendants surviving`.

### Tribe as Unit with Citizen Scatter

The primary simulation unit is the **tribe**, not the individual citizen. Rationale:
- Cluster sizes range from 2 to 3887 — per-agent NEAT at ×25 is not workable.
- Tribal behaviour is inherently collective.
- The fitness function is cluster-level.

Each tribe has:
- A **centroid position** that moves according to tribe decisions
- **Citizens** scattered around the centroid with positional noise (visual only, not individually simulated)
- A **single shared NEAT neural net** per tribe that drives the tribe-level state machine outputs

Visual: the centroid is a large colour-coded circle. Citizens render as smaller dots in the same colour with a scatter radius proportional to `unity` (tight unity = tight cluster, low unity = dispersed scatter). Tribe outline/border visible on the canvas.

---

## 5. Tribe Behaviour System

### State Machine

```
SETTLING ──► FORAGING ──► MIGRATING
    ▲             │             │
    │         encounter     scarcity
    │             ▼             ▼
 PEACE ◄──── AT WAR ◄──── STARVING ──► DESPERATE
    │             │                         │
 alliance     territory                 feed_risk
  forms        claimed                  threshold
    ▼             ▼                         ▼
 ALLIED       OCCUPYING               IMPLODING
```

| State | Trigger | Tribe action |
|---|---|---|
| `SETTLING` | Good food density, population growing | Build farms, grow population, reinforce defense |
| `FORAGING` | Default — moving toward nearest food | Centroid drifts toward food gradient |
| `MIGRATING` | Region depleted or overcrowded | Fast movement toward distant high-density zone |
| `AT WAR` | War declared (see Wage War) | Active combat, territorial pressure |
| `OCCUPYING` | Tribe captured enemy territory | Hold and exploit the captured zone |
| `PEACE` | War ended without annihilation | Non-aggression period, possible alliance window |
| `ALLIED` | Alliance formed | Shared vision, coordinated foraging, joint raids |
| `STARVING` | Food reserves below 30% | Accelerated foraging, reduced upkeep |
| `DESPERATE` | Food below 10% AND high feed_risk | Exile low-performers, suicidal raids |
| `IMPLODING` | `feed_risk > 0.7` AND `STARVING` 3+ generations | Population halved, possible split or extinction |

### Wage War Mechanics

War is **declared explicitly**, not triggered by accidental contact. This is a deliberate state transition.

**War declaration triggers:**
- Tribe A is `FORAGING` or `SETTLING` and tribe B is occupying a food-rich zone within scout range
- Tribe A's `combat_power × unity` exceeds tribe B's by a threshold (tribe A believes it can win)
- Tribe A is `STARVING` and tribe B is nearby with visible food surplus (desperation war)
- Two allied tribes can jointly declare war on a third (gang-up mechanic)

**War mechanics:**
- War has a formal **casus belli** (reason): territorial, food, or dominance
- Combat rounds happen each tick while both tribes are in `AT WAR`
- Tribes can sue for peace: the losing tribe (lower population or combat roll streak) may transition to `PEACE` if its `risk_threshold` is high enough (disciplined retreat)
- A tribe that refuses peace and continues losing enters `DESPERATE`
- **Annihilation**: if tribe B's population drops to zero, tribe B is extinct. Its citizens' founder tags transfer to tribe A's population (absorption). Extinction is logged.
- **Territory claim**: after annihilation or peace surrender, tribe A may `OCCUPY` the defeated tribe's last known territory

**Tribes do not get massacred instantly.** Natural attrition over multiple ticks. A tribe that loses a war may limp on for generations in a reduced state.

### How Artifacts Drive State Transitions

| Stat | Effect |
|---|---|
| `combat_power` | Primary combat roll multiplier |
| `fight_conversion` | Bonus damage on offensive kills |
| `damage_pressure` | Attrition damage in prolonged war (wearing opponent down over ticks) |
| `risk_threshold` | Delay before entering DESPERATE; high = longer endurance |
| `survival_quality` | Clutch defence — bonus population retention when losing combat |
| `food_rate` | Food harvest per tick; farm efficiency |
| `tempo` | First-mover advantage — tribe that settles a zone first gets a bonus food cycle |
| `scout_range` | Fog-of-war radius; enemy detection before being detected |
| `goal_drive` | Multi-step objective completion (build farm, cross river, build fort, declare war strategically) |
| `objective_conversion` | Success rate on declared goals |
| `unity` | Morale multiplier in combat, scatter radius of citizen cloud, speed of internal consensus |
| `setup_control` | Disruption of enemy actions (interrupt enemy foraging, delay enemy SETTLING) |
| `protection_support` | Population loss reduction under attack |

### Combat Resolution

```
attacker_roll =
  Normal(tribe_A.combat_power + tribe_A.fight_conversion, 0.15)
  × biome_modifier_A

defender_roll =
  Normal(tribe_B.combat_power, 0.15)
  × biome_modifier_B
  × (1 + biome.defense_bonus)

if attacker_roll > defender_roll:
    defender_loss = Poisson(base_loss × attacker_advantage × (2 − tribe_B.unity))
    attacker_loss = Poisson(base_loss × 0.4 × (2 − tribe_A.unity))
else:
    attacker_loss = Poisson(base_loss × defender_advantage × (2 − tribe_A.unity))
    defender_loss = Poisson(base_loss × 0.4 × (2 − tribe_B.unity))

damage_pressure_bonus applied each tick if tribe is AT WAR for > 5 consecutive ticks:
    extra_defender_loss += tribe_A.damage_pressure × 0.1 per tick
```

`survival_quality` and `protection_support` reduce final loss counts before applying:
```
actual_loss = computed_loss × max(0.3, 1 − tribe.survival_quality × 0.3 − tribe.protection_support × 0.2)
```

### Alliance Formation

Two tribes may form an alliance if:
- Both are in `FORAGING`, `SETTLING`, or `PEACE` state
- `|tribe_A.food_rate − tribe_B.food_rate| < 0.15` (similar resource strategy)
- Neither is currently `AT WAR` with the other
- Both tribes' `setup_control` values are above 0.4 (able to coordinate)

Alliance effects:
- Shared vision (union of both scout ranges)
- Non-aggression pact
- Coordinated raids against a jointly identified enemy
- Joint war declaration mechanic

Alliances dissolve if either tribe enters `DESPERATE` or if resource competition becomes direct (both tribes converge on the same food-scarce zone).

---

## 6. Evolution Mechanics

### Natural Life Cycle

A generation is **not** a total-wipeout event. Generations represent time periods (seasons, years). At each generation boundary (every 1000 ticks by default):

- Surviving tribes carry all accumulated stats into the next generation
- Tribes that died during the generation are logged with their death generation and cause
- Dead tribes **are not respawned** — extinction is permanent within a simulation run
- Surviving tribes' artifact stats mutate: `stat = clamp(0,1, stat + Normal(0, mutation_rate))`
- Tribes that grew population → lower mutation_rate on their strongest stats (specialisation stabilises)
- Tribes that lost population → higher mutation_rate (forced adaptation)

### Feedscore as Generational Constraint

`feed_risk` mutates each generation with selection bias:
- Tribe survived with population growth: feed_risk trends downward (discipline selected for)
- Tribe survived but shrank: feed_risk neutral mutation
- Tribe collapsed via IMPLODING: feed_risk resets to database baseline (chaos cannot be unlearned by a collapsing tribe)

Persistent apex-cluster dynamic: disciplined high-opscore clusters stay dangerous across many generations. Volatile clusters cycle between chaos and partial recovery.

### Lineage and Genetic Mixing

The founder tag per citizen persists across generations and through absorption events. After any number of generations:

```
tribe_lineage_report = {
  tribe_id: "rust_pathfinding:1",
  generation: 12,
  population: 1847,
  founder_contributions: [
    { puuid: "...", original_cluster: "rust_pathfinding:1", share: 0.62 },
    { puuid: "...", original_cluster: "rust_pathfinding:7", share: 0.21 },  // absorbed generation 4
    { puuid: "...", original_cluster: "rust_pathfinding:23", share: 0.17 }, // absorbed generation 8
  ]
}
```

---

## 7. Architecture Integration

### Backend Integration

Neurosim runs as a process managed by the premadegraph Express backend — same pattern as pathfinder-rust.

```
backend/
  neurosim-bridge.js          ← manages neurosim process lifecycle (spawn, kill, health check)
  genetic-neurosim/
    backend/                  ← Rust simulation binary (axum, WebSocket, NEAT, world engine)
```

Express:
- Spawns the neurosim binary on demand when the tribal simulation page loads
- Proxies WebSocket frames from neurosim port 8000 through main port 3001
- Injects cluster profiles at startup via `PREMADEGRAPH_URL` (already wired)
- Exposes `/api/neurosim/*` REST routes (already wired)
- Shuts down neurosim binary when page unloads (no zombie processes)

### Frontend Integration

New page: `frontend/src/pages/TribalSimulationPage.tsx`

- WebSocket consumer: connects through proxied `/ws/simulation`
- Renders 2000×2000 world canvas (biome tile grid + tribe centroids + citizen scatter)
- Each tribe: unique colour, visible outline boundary, state badge (FORAGING / AT WAR / ALLIED etc.)
- Stats panel: live generation counter, tribe population bars, top tribes leaderboard
- Founder leaderboard: top original players by descendant share in surviving tribes
- Event log: tribe deaths, war declarations, alliances formed, notable combat outcomes
- Uses Three.js or Canvas2D — decision deferred to implementation

### Commits

All commits go into the main premadegraph repository. The original `genetic-neurosim` clone at `backend/genetic-neurosim/` is now part of the project. The upstream GitHub clone will be archived by the project owner.

---

## 8. Design Decisions — Locked

| # | Decision | Value |
|---|---|---|
| 1 | Population multiplier | ×25, per-tribe cap 2000 |
| 2 | World grid | 2000×2000, 50-unit biome tiles |
| 3 | Generation length | 1000 ticks (configurable). No total-wipeout required. |
| 4 | Tribe filter | All clusters with size ≥ 2 |
| 5 | Alliance mechanic | Yes — shared vision, joint war, non-aggression |
| 6 | Citizen visuals | Centroid + scatter cloud; each tribe unique colour + outline |
| 7 | Artifact storage | 5 primary + 10 sub-artifacts stored in extended `ClusterProfile` and per-generation history |
| 8 | River crossing | Crossable at 3× cost. Evolve bridges (1.2×) or boats (0.8×, limited capacity) |
| 9 | Restartable | Yes — recording/replay system, same pattern as existing neurosim sessions |
| 10 | Founder tracking | Yes — PUUID tags per citizen, lineage report, extinction log, leaderboard |
| 11 | Wage war | Explicit declaration, territorial/food/dominance casus belli, peace mechanic, absorption on annihilation |

---

## 9. What This Contributes to the Thesis

- Extends premadegraph from static graph analysis into dynamic evolutionary simulation
- Dataset-grounded: every tribe comes from real match data, no synthetic input
- Five League of Legends performance dimensions become five distinct evolutionary pressures
- Controlled comparison: same world, same rules, different tribe profiles, reproducible seeds
- Apex-cluster question: do high-opscore low-feedrisk clusters dominate long-term, or do resilient large clusters outlast them?
- Founder leaderboard: ties simulated outcomes back to individual real players from the dataset
- Clean academic framing: model behaviour, not real-world ranking

---

## 10. Implementation Sequence

1. Verify artifact DB column → opscore v2 formula mapping (cross-reference `scoring_config.js`)
2. Extend `ClusterProfile` struct with 5 primary + 10 sub-artifact fields
3. Update cluster-export endpoint to compute and return all 15 values
4. Redesign neurosim Rust simulation core: tribe-NEAT, world grid, biome tiles
5. Implement tribe state machine + wage-war mechanics
6. Implement combat resolution + alliance system
7. Implement founder tag propagation + lineage logging
8. Implement river crossing + bridge/boat evolution
9. Update WebSocket frame format: world tile data, tribe states, lineage snapshot
10. Build `neurosim-bridge.js` (process lifecycle)
11. Build `TribalSimulationPage.tsx`
