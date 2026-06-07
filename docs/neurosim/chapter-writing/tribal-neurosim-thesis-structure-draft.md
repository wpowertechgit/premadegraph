# Tribal NeuroSim — Final Thesis Structure Draft

## Purpose

This is the authoritative chapter skeleton for the Tribal NeuroSim section of the thesis. It is written for consolidation, not expansion. Every subchapter maps to existing documentation, existing screenshots, and defensible claims.

**Three chapters. No repetition. No speculative content. No unclaimed features.**

Graph theory and computational geometry are NOT repeated here — those are already established in the pathfinder lab chapter (assortativity, betweenness centrality, community structure). NeuroSim only references back and adds what is new: hex-grid spatial substrate and lineage DAG.

---

## Chapter Structure at a Glance

```
Chapter N+0: System, Architecture, and Foundations
  N+0.1  Purpose, Scope, and Research Connection
  N+0.2  Agent-Based and Multi-Agent Model
  N+0.3  Event-Driven Observability
  N+0.4  Systems Architecture and Performance
  N+0.5  Build Process and Deployment

Chapter N+1: Game Logic and Neural Intelligence
  N+1.1  Neuroevolution Framework and Cluster-Derived Priors
  N+1.2  Neural Inputs, Drives, and Behavioral Outputs
  N+1.3  Fitness, Mutation, and Lineage Inheritance
  N+1.4  Strategic Interaction and Conflict Structure

Chapter N+2: Simulation Runs, Validation, and Interpretation
  N+2.1  World Mechanics and Spatial Substrate
  N+2.2  Iterative Redesign and Failure History
  N+2.3  Validation Philosophy and Determinism Proof
  N+2.4  Experimental Run Narratives
  N+2.5  Cross-Dataset Comparison and Interpretation Limits
```

---

## Chapter N+0 — System, Architecture, and Foundations

### N+0.1 — Purpose, Scope, and Research Connection

**Core question:** Why does Tribal NeuroSim exist and what connects it to the earlier thesis chapters?

**What to write:**
- NeuroSim as downstream of the PremadeGraph graph-analysis pipeline — not a standalone game
- Flex Queue and SoloQ player-cluster profiles as the upstream derivation layer that feeds tribe initialization
- The research question: if cluster-derived profiles compete under identical environmental rules, do structurally different clusters produce different survival strategies?
- Thesis-safe scope: exploratory transfer experiment, reproducible and inspectable, not a proof of real player psychology
- Explicit claim boundary: results are model behavior under chosen rules, not predictions of real-world outcomes

**Documentation:**
- `docs/neurosim/chapter-writing/premadegraph-x-genetic-neurosim-integration-plan.md` — core framing and research question
- `docs/neurosim/chapter-writing/tribal-neurosim-subchapter-fit-draft.md` — safest thesis framing language
- `docs/neurosim/architecture/neurosim-tribal-simulation-implementation-plan-2026-05-03.md` — initial project scope

**Screenshots:** None required for this subchapter.

**Citations:** Bonabeau (2002) ABM framing entry point.

**Thesis-safe claims:**
- "Tribal NeuroSim transfers graph-derived cluster profiles into an evolutionary multi-agent simulation"
- "The simulation studies how cluster priors behave under common environmental rules"
- "Results are interpreted as simulation behavior, not proof of real player psychology"

---

### N+0.2 — Agent-Based and Multi-Agent Model

**Core question:** What kind of computational model is this, academically?

**What to write:**
- ABM framing: local decisions → emergent macro-level patterns (expansion, war, empire formation, extinction, consolidation)
- MAS framing: decentralized entities, no global optimizer, each tribe has local state, local perception, local decisions
- Tribes as population-level agents — not individual players
- Observable emergent phases in practice: scattered tribal competition → polity consolidation → empire wars → single winner
- Alliance count erosion, war cascade mechanics, total-war events as emergent dynamics from local interaction rules

**Documentation:**
- `docs/neurosim/architecture/v3-architecture-and-mechanics-redesign.md` — MAS and agent design
- `docs/neurosim/validation/f2-validation-story/chapter-4-validated-run.md` — evidence of emergent population dynamics in validated run
- `docs/neurosim/validation/first-complete-simulation-run-2026-05-16.md` — first full-run macro patterns

**Screenshots:**
- `run67fl7777/fl-s7777-tick500.png` — mid-consolidation overview showing fragmented but organizing territory
- `run67fl42/fl-s42-tick500.png` — same checkpoint, different seed, comparable pattern
- `run67fl7777/fl-s7777-tick1000.png` — empire age, macro consolidation visible

**Citations:** Bonabeau (2002), Wooldridge & Jennings (1995).

**Thesis-safe claims:**
- "Macro patterns emerge from repeated local tribe decisions without a central planner"
- "Global consolidation and empire formation are emergent outputs, not scripted events"
- "Alliance erosion and war cascade timing vary across seeds and datasets"

---

### N+0.3 — Event-Driven Observability

**Core question:** How is the simulation auditable and inspectable as a research object?

**What to write:**
- Why observability matters: a final map is not enough evidence — the thesis needs to explain why a tribe survived, expanded, allied, starved, or collapsed
- Event bus design: append-only, global + per-tribe journals
- Tombstone records: extinction reasons, ancestry, last known state preserved post-death
- War events: declaration, combat rounds, resolution, retreat
- Run-summary endpoint: winner record, final alive count, polity breakdown, tick count
- JSONL log format for CLI runs: every 50-tick checkpoint + every war event + final summary
- Why this was retrofitted: v2 first-run post-mortem identified lack of event bus as a major failure — extinctions, wars, and starvation happened without explanation

**Documentation:**
- `docs/neurosim/validation/tribes-v2-first-run-takeaways.md` — event bus absence as failure mode
- `docs/neurosim/architecture/critical-redesign.md` — mandatory event redesign decision
- `docs/neurosim/implementation-runs/web-prototype/TaskG4RunSummaryRun.md` — first event/summary endpoints
- `docs/neurosim/implementation-runs/web-prototype/TaskLRun.md` — WarState records and active-war snapshot
- `docs/neurosim/implementation-runs/rust/TaskR2Run.md` — tombstone ledger, ghost-war fix

**Screenshots:** None required (architecture concept, not visual output).

**Citations:** Fowler (2005) Event Sourcing.

**Thesis-safe claims:**
- "Event logs make simulation outcomes auditable — war, starvation, mutation, and extinction are traceable"
- "Tombstone records preserve extinct tribe state for post-run interpretation"
- "The event architecture was mandated by observed failure in earlier prototype runs"

---

### N+0.4 — Systems Architecture and Performance

**Core question:** Why is the system built the way it is, and does it perform at research scale?

**What to write:**

**Authority split:**
- Rust owns: tick loop, world state, neural decisions, war/alliance/merger resolution, lineage, tombstones, event logging
- C# MonoGame owns: rendering, camera, HUD, inspection panels — visualization only, not truth source
- Node owns: bridge, dataset export, key management, batch orchestration
- This separation was designed to prevent the browser prototype failure mode: UI-coupled simulation created ghost wars, memory leaks, and non-deterministic behavior

**Binary protocol:**
- FrameV1: versioned binary envelope (TNS3), sections for tribes, tiles, wars, event deltas
- Little-endian layout, compact records, payload kinds — decouples simulation throughput from UI concerns
- Node mediates desktop paths; C# decoder consumes FrameV1 directly

**Performance work (concrete):**
- Neighbor scan problem: early O(n) all-pairs scans across 599 tribes × all tiles were the bottleneck
- Fix: `tile_tribe_idx` cache and `tribe_id_to_idx` lookup — deterministic 599-cluster run confirmed after this
- Hot-path logging suppressed (no per-tick JSONL writes during tick loop — only checkpoint and event writes)
- 599-tribe flexset runs: confirmed deterministic, CLI and MonoGame produce identical outputs

**Determinism:**
- Root cause of non-determinism identified: SQLite queries without ORDER BY return rows in arbitrary order → cluster placement order varied → simulation diverged from tick 0
- Fix: `clusters.sort_by(|a, b| a.id.cmp(&b.id))` before simulation init — one-line fix
- Verification: CLI tick=100 output matched Docker MonoGame tick=100 output exactly

**Headless CLI mode:**
- `--cli-run` flag: no HTTP server, no WebSocket, synchronous simulation to completion
- Output: JSONL log to `logs/neurosim-{seed}-{dataset}-{nonce}.jsonl`
- `final_summary` JSON line includes winner record, tick count, polity breakdown

**Documentation:**
- `docs/neurosim/architecture/desktop-contract-v1.md` — FrameV1 protocol definition
- `docs/neurosim/architecture/monogame-migration-plan.md` — authority redesign rationale
- `docs/neurosim/architecture/neural-authority-contract-2026-05-11.md` — Rust/C# authority split
- `docs/neurosim/validation/flexset-empire-599-optimization.md` — cache optimization and determinism confirmation
- `docs/neurosim/implementation-runs/rust/TaskR7Run.md` — FrameV1 sections implementation
- `docs/neurosim/implementation-runs/monogame/TaskM1Run.md` — C# FrameV1 decoder
- `docs/neurosim/implementation-runs/monogame/TaskM9Run.md` — final MonoGame integration
- `backend/genetic-neurosim/run-batch.ps1` — batch runner for parallel headless runs

**Screenshots:**
- `run67fl7777/fl-s7777-tick2497-last2A.png` and `fl-s7777-tick2497-last2B.png` — MonoGame rendering of final two empires (shows rendering quality and inspection panels)
- `run67sq42/sq-s42-tick2046-last.png` — winner state in MonoGame at run completion

**Citations:** Jung et al. (2020) Rust safety, Brandes (2001) — referenced back from pathfinder chapter for graph-analytics cost context.

**Thesis-safe claims:**
- "Rust provides the authoritative, deterministic simulation core"
- "Non-determinism was caused by unsorted cluster input and fixed with a single sort operation"
- "599-tribe runs were confirmed deterministic across CLI and MonoGame execution paths"
- "Performance was improved through data-oriented caches; O(n) scans replaced with O(1) lookups"

---

### N+0.5 — Build Process and Deployment

**Core question:** How is the system built and run?

**What to write (big lines):**

```
1. Dataset preparation
   - Backend Node server running: npm run dev (localhost:3001)
   - Active dataset set to flexset or soloq
   - Cluster export endpoint: GET /api/neurosim/clusters?dataset=flexset

2. Rust binary build
   cd backend/genetic-neurosim/backend
   cargo build --release
   Output: target/release/neurosim-backend.exe

3. CLI headless run (single seed)
   $env:PREMADEGRAPH_URL = "http://localhost:3001"
   $env:PREMADEGRAPH_DATASET_ID = "flexset"
   ./neurosim-backend.exe --cli-run --seed 7777 --use-dataset-export --checkpoint-interval 500
   Output: logs/neurosim-7777-flexset-{nonce}.jsonl

4. Batch runner (parallel headless runs)
   .\run-batch.ps1 -Runs 5 -Seed 42 -DatasetId flexset
   Output: winner table + distribution summary from all runs

5. MonoGame visualization (live mode)
   - Rust backend started in serve mode (or via Docker)
   - C# MonoGame client built and launched
   - Connects to Rust via FrameV1 binary stream through Node bridge
   - NEUROSIM_WORLD_SEED=42 environment variable controls deterministic seed

6. Docker (container mode)
   docker-compose up neurosim
   Environment: NEUROSIM_WORLD_SEED=42, PREMADEGRAPH_URL=http://backend:3001
```

**Documentation:**
- `backend/genetic-neurosim/run-batch.ps1`
- `docker-compose.yml` (neurosim service section)
- `docs/neurosim/architecture/desktop-contract-v1.md`

**Screenshots:** None required.

---

## Chapter N+1 — Game Logic and Neural Intelligence

### N+1.1 — Neuroevolution Framework and Cluster-Derived Priors

**Core question:** What makes this "NeuroSim" rather than a rules engine?

**What to write:**
- NEAT-style genome: mutable weights, mutation at generation boundaries, no backpropagation
- Cluster-derived artifact priors as initial genome seeds — these come from the earlier PremadeGraph pipeline, not invented values:
  - `A_combat`: combat performance score from match history
  - `A_resource`: resource/economy score
  - `A_map_objective`: objective control score
  - `A_risk`: risk tolerance score
  - `A_team`: team coordination score
- These five artifacts are the direct bridge between graph analytics and simulation — cluster means become tribe genome starting points
- Each tribe starts differently because it was seeded from a different real cluster profile
- This is the thesis connection: static graph analysis → dynamic evolutionary simulation

**Documentation:**
- `docs/neurosim/chapter-writing/premadegraph-x-genetic-neurosim-integration-plan.md` — seeding rationale
- `docs/neurosim/mechanics/neural-network-state-2026-05-12.md` — genome specification
- `docs/neurosim/architecture/neural-authority-contract-2026-05-11.md` — authority and mutation contract

**Screenshots:**
- `run67fl7777/fl-s7777-tick264-firstempire.png` — first Empire: Tribe 372 (Pathfinders/MapObjective), fitness=0.35, showing artifact bars (Combat 0.72, Resource 0.92, MapObj 0.97, Risk 0.70, Team 0.82)
- `run67sq42/sq-s42-tick286-firstempire.png` — first Empire in SoloQ 42: Tribe 88 (Council/Team), showing different artifact profile from same seed in different dataset

**Citations:** Stanley & Miikkulainen (2002) NEAT, Holland (1992).

**Thesis-safe claims:**
- "Cluster-derived artifact priors seed tribe genomes rather than random initialization"
- "Different datasets (flexset vs soloq) produce tribes with statistically different starting profiles"
- "The genome is mutable — priors are starting points, not fixed values"

---

### N+1.2 — Neural Inputs, Drives, and Behavioral Outputs

**Core question:** What does the neural controller actually do each tick?

**What to write:**

**11 inputs:**
- Food ratio (current / capacity)
- Population ratio (current / capacity)
- Territory size (tile count)
- Feed risk (starvation proximity)
- `A_combat`, `A_resource`, `A_map_objective`, `A_team`, `A_risk` (the five cluster-derived artifact values)
- Nearest enemy distance (hex units)
- Nearest ally distance (hex units)

**7 behavioral drive outputs:**
- Aggression drive → war initiation weight
- Resource drive → food-seeking priority
- Goal drive → map-objective and polity-tier pursuit
- Migration drive → movement priority
- Raid drive → opportunity war threshold
- Isolation drive → independence vs alliance preference
- Expansion speed → tile claim rate

**How outputs become behavior:**
- Drives are not binary switches — they are weights that modulate decision probabilities
- War declarations: raid drive × opportunity score must cross threshold
- Migration: migration drive × spatial pressure determines movement frequency
- Alliance: isolation drive inversely weights alliance acceptance
- Polity advancement: goal drive contributes to settlement and tier-upgrade decisions

**F2 validated run evidence:** all 7 outputs active across 1,200 ticks, non-saturated (no all-zero or all-one collapse), fitness differentiation visible across tribes

**Documentation:**
- `docs/neurosim/mechanics/neural-network-state-2026-05-12.md` — full input/output schema
- `docs/neurosim/validation/f2-validation-story/chapter-4-validated-run.md` — output activity evidence
- `docs/neurosim/validation/simulation-liveness-fix-2026-05-14.md` — drive calibration and liveness fixes

**Screenshots:**
- `run67fl7777/fl-s7777-tick264-firstempire.png` — Tribe 372 right panel: Neural Drives bars (Migration=0.88, Expansion=0.82 dominant, Aggression=0.15 minimal)
- `run67fl42/fl-s42-tick2417-trilateralwar.png` — Tribe 90 right panel: high Aggression=0.84 and Resource=0.83, showing Pathfinders/MapObjective neural profile at endgame
- `run67sq42/sq-s42-tick1987-last2B.png` — Tribe 10 at endgame: Aggression=0.67, Goal=0.76 (Vanguard profile)

**Citations:** Stanley & Miikkulainen (2002).

**Thesis-safe claims:**
- "Neural outputs influence tribe decision-making without deterministic scripting"
- "Drive values differentiate tribe behavior even under identical environmental conditions"
- "The F2 validation run confirmed all seven outputs were active and non-saturated"

---

### N+1.3 — Fitness, Mutation, and Lineage Inheritance

**Core question:** How does adaptation happen and how is it traceable?

**What to write:**

**Fitness components:**
- Survival (ticks alive)
- Territory (tile count at evaluation)
- Population (current population)
- Polity tier (Tribe < City < Duchy < Kingdom < Empire — discrete advancement)
- War record (wars won vs lost contributes to combat artifact accumulation)

**Mutation mechanics:**
- Generation boundaries: fitness evaluated at intervals
- Ranked mutation: lower-fitness tribes mutate more aggressively
- Weight drift: genome weights perturbed within mutation rate bounds
- No backpropagation — this is neuroevolution, not gradient descent

**Lineage inheritance (merger case):**
- When two tribes merge, genome is blended weighted by fitness
- Higher-fitness parent contributes more to the inherited genome
- Parent IDs preserved in lineage DAG — ancestry is traceable post-run
- Lineage registry: `entity_id → [parent_ids]` — implemented as backend data structure with query endpoint
- Information-theory lineage: compact parent-link storage rather than expanding full ancestry strings

**Tombstone records:**
- On extinction: tribe's last state, genome, fitness, ancestry, war record preserved
- Available for post-run inspection via tombstone ledger endpoint
- Allows thesis to explain why a tribe died (starvation vs combat vs surrounded)

**Documentation:**
- `docs/neurosim/mechanics/v3-offspring-mechanics-and-evolutionary-lineage.md` — lineage and merger mechanics
- `docs/neurosim/mechanics/v3-information-theory-lineage-compression.md` — compact lineage storage
- `docs/neurosim/implementation-runs/rust/TaskR1Run.md` — LineageRegistry implementation
- `docs/neurosim/architecture/neural-authority-contract-2026-05-11.md` — fitness evaluation authority

**Screenshots:**
- `run67fl7777/fl-s7777-tick2538-last.png` — final winner state: Tribe 355, fitness=0.61, showing artifact accumulation (Combat=0.98 maxed from thousands of wars)
- `run67sq7777/sq-s7777-tick2541-last.png` — SoloQ winner: Tribe 70, fitness=0.61, different artifact profile

**Citations:** Stanley & Miikkulainen (2002), Holland (1992).

**Thesis-safe claims:**
- "Fitness evaluates survival, territory, population, and polity progression — not a single metric"
- "Merger produces fitness-weighted genome inheritance — the stronger tribe dominates the combined genome"
- "Lineage is stored as a DAG enabling ancestry reconstruction for any surviving or extinct tribe"

---

### N+1.4 — Strategic Interaction and Conflict Structure

**Core question:** What are the strategic dynamics tribes navigate?

**What to write:**
- War, alliance, retreat, disputed territory, merger: choices where outcome depends on the neighbor's state
- Resource scarcity + territorial pressure create payoff-like trade-offs — not scripted events
- Diplomacy in v3 is binary: total war or full alliance/merger (no partial states)
- Disputed tiles: both tribes claim the tile → resource penalty applied to both → pressure to resolve
- Opportunity war: raid drive × opportunity score must cross threshold → selective rather than indiscriminate aggression
- Stagnation war: if no war fires for N ticks, pressure builds → late-game deadlock prevented mechanically
- Endgame dynamics: peaceful genome deadlock was observed in early runs — opportunity-war and stagnation-war mechanics were added specifically to fix this

**Hawk-Dove as interpretive lens (one paragraph, not a chapter):**
Tribes exhibiting high raid drive and high aggression behave like "Hawk" postures — they escalate conflict and seek territorial gain. Tribes exhibiting high isolation and high goal drive behave like "Dove" postures — they avoid conflict when profitable and conserve resources. This mapping is behavioral observation from run data, not an analytically solved equilibrium. The Hawk-Dove literature (Maynard Smith & Price 1973) provides the vocabulary; the simulation does not claim to solve the classical game.

**Concrete evidence from runs:**
- Flexset 7777: Great War at tick 2040 — 55 simultaneous opportunity wars. Alive 205 → 13 in 500 ticks. Classic Hawk-Hawk cascade: mass simultaneous aggression producing destructive elimination.
- Flexset 42: Trilateral war at tick 2400 — tribe_90 and tribe_596 independently both declared war on dominant tribe_557. tribe_596 won; tribe_90 was weakened and lost the final duel. Strategic interaction without coordination.
- SoloQ 42: tribe_89 survived three simultaneous defensive attacks (tick 1926–1935) — three entities tried to eliminate it back-to-back and all died attacking it. Defensive strength as emergent advantage.

**Documentation:**
- `docs/neurosim/mechanics/v3-territory-and-expansion-mechanics.md` — war, dispute, retreat mechanics
- `docs/neurosim/validation/flexset-empire-599-optimization.md` — stagnation-war and opportunity-war addition
- `docs/neurosim/media/run67fl42/run-narrative.md` — trilateral war
- `docs/neurosim/media/run67fl7777/run-narrative.md` — Great War cascade
- `docs/neurosim/media/run67sq42/run-narrative.md` — defensive rampage sequence

**Screenshots:**
- `run67fl7777/fl-s7777-tick2043-totalwar.png` — Great War: 68 alive, 32 active wars, all Empires, total map in conflict
- `run67fl42/fl-s42-tick1872-totalwar.png` — Total War: 67 alive, 26 wars, opportunity-war cascade visible
- `run67sq42/sq-s42-tick1752-totalwar.png` — SoloQ 42 Total War: proportionally largest wipeout (39% field in one burst)
- `run67sq7777/sq-s7777-tick2100-totalwar.png` — SoloQ 7777 Total War: smaller dataset, fewer concurrent declarations

**Citations:** Maynard Smith & Price (1973), Maynard Smith (1982).

**Thesis-safe claims:**
- "War and alliance are modeled as strategic alternatives under territorial pressure, not random events"
- "Opportunity-war and stagnation-war mechanics prevent peaceful deadlock without scripting specific outcomes"
- "The Hawk-Dove framework provides a descriptive vocabulary for observed conflict postures, not a solved equilibrium"

---

## Chapter N+2 — Simulation Runs, Validation, and Interpretation

### N+2.1 — World Mechanics and Spatial Substrate

**Core question:** What are the actual rules of the world?

**Note:** Graph vocabulary (adjacency, connectivity) is already established in the pathfinder lab chapter. This subchapter only defines what is new: hex-grid territory mechanics, biomes, resource model, polity tiers.

**What to write:**

**Spatial model:**
- Hex-grid world — each tile has up to 6 neighbors
- Biomes with food production rates (DenseForest, DrySteppe, Riverland, Mountains, Marsh, Cold)
- Tile ownership: fractional control → full claim → disputed zone
- Expansion: tribes claim adjacent tiles at expansion speed; claimed tiles generate food for the owner
- Overextension penalty: territory beyond sustainable threshold reduces efficiency
- Lineage note: hex adjacency is a spatial graph — references back to pathfinder chapter's graph vocabulary, no repeat

**Population and resources:**
- Food stores consumed per tick by population
- Starvation: food < consumption → population decline
- Resource drive modulates gathering rate
- Sustainable equilibrium: population, territory, and food must balance or tribe weakens

**War mechanics:**
- War declaration: attacker probability weighted by aggression + raid drive
- Combat resolution: Poisson-distributed rounds, combat multipliers, `A_combat` vs `A_combat`
- Retreat: superior force can push weaker tribe off contested tiles
- Disputed zone: both tribes on same tile border → resource penalty to both → pressure to resolve
- War ends: one side destroyed, retreats to core tiles, or ceases to be adjacent

**Polity tiers:**
- Tribe → City → Duchy → Kingdom → Empire
- Advancement: population + territory thresholds, goal drive weighting
- Settlement model: tier determines settlement count (C1 M0 F12 visible in MonoGame HUD)

**Alliance and merger:**
- Alliance: mutual non-aggression, shared ally distance signal
- Merger: full absorption, fitness-weighted genome blend, all territory transferred
- Rebellion: high independence preference (isolation drive) can break alliance

**Extinction:**
- Tribe eliminated: all tiles stripped, population zeroed
- Tombstone recorded: last state, genome, ancestry, kill cause

**Documentation:**
- `docs/neurosim/mechanics/v3-territory-and-expansion-mechanics.md`
- `docs/neurosim/mechanics/v3-offspring-mechanics-and-evolutionary-lineage.md`
- `docs/neurosim/architecture/v3-architecture-and-mechanics-redesign.md`
- `docs/neurosim/implementation-runs/rust/TaskR4Run.md` — fractional tile control and disputed zones
- `docs/neurosim/implementation-runs/rust/TaskR8Run.md` — hex distance, terrain cost, expansion cooldowns

**Screenshots:**
- `run67fl7777/fl-s7777-tick264-firstempire.png` — close-up showing tile detail, biome labels (Riverland), dispute indicator, settlement visibility
- `run67sq7777/sq-s7777-tick301-firstempire.png` — SoloQ world at close zoom: smaller map, visible hex structure, Tribe 19 showing territory panel (47 tiles)

**Citations:** None new — mechanics documentation.

---

### N+2.2 — Iterative Redesign and Failure History

**Core question:** How did the simulation get from broken prototype to validated system?

**What to write:**

**Web prototype failures (v1/v2):**
- Ghost-war: wars declared but never resolved — tribes locked in permanent conflict state
- Peaceful deadlock: high-isolation genomes converged on non-aggression equilibrium, simulation froze
- Migration state without spatial movement: tribe reported migrating but territory didn't change
- No event bus: extinction, starvation, and war happened without explanation — unauditable
- Browser prototype: memory leaks, UI freezes, non-deterministic behavior under load

**Critical redesign decisions:**
- Move simulation authority entirely to Rust — no more JS-side logic
- Mandatory event bus: all transitions emit structured events
- Tombstone ledger: every extinction preserved
- Territorial model overhaul: fractional ownership → disputed zones → full claim
- Opportunity-war and stagnation-war: prevent peaceful equilibrium deadlock
- MonoGame desktop client replacing browser prototype

**Liveness fix (key specific fix):**
- Problem: simulation appeared alive (tribes moving, wars firing) but behavior was behaviorally dead (no fitness differentiation, no real expansion)
- Root causes: double-normalized stats, oversized population floors, migration oscillation, weak combat multipliers, conservative expansion thresholds
- Fix: model constant correction and state-machine dynamics repair
- Evidence: post-fix F2 validation run showed all 7 drives active, fitness differentiation present

**Determinism fix (the final major fix):**
- Problem: same seed produced different winners between MonoGame runs
- Root cause: `set_clusters()` called without sorting → SQLite returns rows in arbitrary order → tribe placement order varied → simulation diverged from tick 0
- Fix: `clusters.sort_by(|a, b| a.id.cmp(&b.id))` applied before sim init
- Verification: CLI tick=100 and Docker MonoGame tick=100 produced identical `{alive=593, City:41, Tribe:552}`

**Task run progression (summary only — not full dump):**

| Task | What Changed |
|------|-------------|
| TaskR1 | LineageRegistry, seed-entity registration |
| TaskR2 | Tombstone ledger, ghost-war fix via war cleanup |
| TaskR4 | Fractional tile control, disputed zones |
| TaskR7 | FrameV1 binary protocol, event delta sections |
| TaskR8 | Hex distance, terrain cost, expansion cooldowns, overextension |
| TaskM1 | C# FrameV1 decoder |
| TaskM3 | Six-edge pointy-hex geometry for territory borders |
| TaskM4 | Semantic zoom, camera bounds, Civ6-style camera |
| TaskM9 | Final MonoGame integration, HUD panels |
| TaskG4 | Event and summary endpoints (web prototype) |
| TaskL | WarState records, active-war snapshot (web prototype) |

**Documentation:**
- `docs/neurosim/validation/tribes-v2-first-run-takeaways.md` — v2 failure post-mortem
- `docs/neurosim/architecture/critical-redesign.md` — redesign decision record
- `docs/neurosim/validation/simulation-liveness-fix-2026-05-14.md` — liveness fix specifics
- `docs/neurosim/validation/post-first-run-fixes-2026-05-16.md` — post-first-run repairs
- `docs/neurosim/implementation-runs/rust/TaskR1Run.md` through `TaskR8Run.md`
- `docs/neurosim/implementation-runs/monogame/TaskM1Run.md`, `TaskM3Run.md`, `TaskM4Run.md`, `TaskM6Run.md`, `TaskM9Run.md`
- `docs/neurosim/implementation-runs/web-prototype/TaskG4RunSummaryRun.md`
- `docs/neurosim/implementation-runs/web-prototype/TaskLRun.md`

**Screenshots:** None required — this is a narrative of failures and fixes, not visual output.

---

### N+2.3 — Validation Philosophy and Determinism Proof

**Core question:** How is the simulation validated as a research artifact?

**What to write:**
- Deterministic seeds: same seed = same simulation every time — this is the foundation of reproducibility
- Validation through controlled reruns: not just "it ran" but "it ran identically five times"
- Event-backed interpretation: every claim about tribe behavior cites event log entries, not visual inspection alone
- CLI batch runner: 5 parallel headless runs, all produce identical `final_summary` winner records
- F2 validation story: 1,200-tick run with all drives active, fitness differentiation, migration, war, territory visible — documented in full
- What the validation does NOT prove: that the model is correct, that results transfer to real behavior, that convergence implies optimality

**Documentation:**
- `docs/neurosim/validation/f2-validation-story/index.md`
- `docs/neurosim/validation/f2-validation-story/chapter-4-validated-run.md`
- `docs/neurosim/validation/flexset-empire-599-optimization.md` — determinism confirmation
- `backend/genetic-neurosim/run-batch.ps1` — batch validation tool

**Screenshots:**
- `run67fl7777/fl-s7777-tick1000.png` — mid-run world state, 205 alive, all polity tiers visible
- `run67sq7777/sq-s7777-tick1000.png` — same checkpoint, SoloQ dataset, 61 alive, smaller world

---

### N+2.4 — Experimental Run Narratives

**Core question:** What happened in each run, and is the behavior interpretable?

**Structure:** Four runs presented with consistent schema — dataset, seed, starting tribes, final tick, winner profile, key event, run narrative reference.

---

#### Run 1 — Flexset, Seed 7777

| Field | Value |
|-------|-------|
| Dataset | Flexset (EUNE Master+ Flex Queue) |
| Seed | 7777 |
| Starting tribes | 599 |
| Map tiles | ~36,100 |
| Final tick | 2538 |
| Winner | Tribe 355, Warband/Combat |
| Winner aggression | 0.18–0.19 |
| Winner migration | 0.88 |
| Winner A_combat | 0.98 (maxed) |
| Key event | Great War tick 2040: 55 simultaneous declarations |

**Narrative:** 599 cluster-derived tribes start from Flex Queue profiles. Consolidation proceeds through polity advancement. At tick 2040 the Great War fires — 55 simultaneous opportunity wars triggered by combined threshold crossings. Alive count drops from ~205 to ~19 in 200 ticks. Final two: Tribe 355 (Warband/Combat, 21,751 tiles) vs Tribe 470 (Pathfinders/MapObjective, 7,956 tiles). Tribe 355 wins at tick 2538. Its A_combat artifact is maxed (0.98) from thousands of defensive wins across 2,538 ticks.

**Documentation:** `docs/neurosim/media/run67fl7777/run-narrative.md`

**Screenshots (in order):**
1. `fl-s7777-tick264-firstempire.png` — first Empire (Tribe 372, tick 264)
2. `fl-s7777-tick500.png` — mid-consolidation overview
3. `fl-s7777-tick1000.png` — empire age overview
4. `fl-s7777-tick2043-totalwar.png` — Great War: 68 alive, 32 wars
5. `fl-s7777-tick2497-last2A.png` — Tribe 355 final profile
6. `fl-s7777-tick2497-last2B.png` — Tribe 470 final profile
7. `fl-s7777-tick2538-last.png` — Tribe 355 sole survivor

---

#### Run 2 — Flexset, Seed 42

| Field | Value |
|-------|-------|
| Dataset | Flexset (EUNE Master+ Flex Queue) |
| Seed | 42 |
| Starting tribes | 599 |
| Map tiles | ~36,100 |
| Final tick | 2487 |
| Winner | Tribe 596, Warband/Combat |
| Winner aggression | 0.13 |
| Winner migration | 0.87 |
| Winner A_combat | 0.96 |
| Key event | Trilateral war tick 2400: two underdogs simultaneously declared war on dominant tribe_557 |

**Narrative:** Same dataset, different seed. Tribe 220 (Council/Team) is first Empire at tick 287. The run's defining moment: at tick 2400, three survivors remain — tribe_557 dominant (~23k tiles), tribe_90 (~11k tiles), tribe_596 (~?k tiles). Both tribe_90 and tribe_596 independently identify tribe_557 as a target and declare war simultaneously. Tribe_596 wins that war at tick 2424, absorbs tribe_557's territory (now 28k tiles), and dispatches the weakened tribe_90 at tick 2487. Winner behavior profile is identical to seed 7777: Warband/Combat, low aggression, high migration.

**Documentation:** `docs/neurosim/media/run67fl42/run-narrative.md`

**Screenshots (in order):**
1. `fl-s42-tick287-firstempire.png` — first Empire (Tribe 220, tick 287, Council/Team)
2. `fl-s42-tick500.png` — mid-consolidation overview
3. `fl-s42-tick1000.png` — empire age overview
4. `fl-s42-tick1872-totalwar.png` — Total War: 67 alive, 26 wars
5. `fl-s42-tick2417-trilateralwar.png` — Trilateral War: 3 alive, Tribe 90 profile
6. `fl-s42-tick2486-last2A.png` — Tribe 355 profile (wait — it's Tribe 596 in fl42)
7. `fl-s42-tick2486-last2B.png` — Tribe 470's equivalent final profile
8. `fl-s42-tick2487-last.png` — Tribe 596 sole survivor

---

#### Run 3 — SoloQ, Seed 42

| Field | Value |
|-------|-------|
| Dataset | SoloQ (EUNE Master+ Solo Queue) |
| Seed | 42 |
| Starting tribes | 140 |
| Map tiles | ~7,000 |
| Final tick | 2046 (fastest of all four) |
| Winner | Tribe 89, Vanguard/Raid |
| Winner aggression | 0.11 |
| Winner isolation | 0.68 |
| Winner raid | 0.68 (final) |
| Key event | Tribe 89 survived 3 simultaneous defensive attacks (ticks 1926–1935) |

**Narrative:** Smallest world, fastest run. First Empire at tick 286 (Tribe 88, Council/Team). Total War fires at tick 1740 — 15 simultaneous declarations, 39% of field eliminated in one burst. Between ticks 1860–1935, Tribe 89 fought five consecutive wars: two as attacker, three as defender, zero losses. Tribe_132, tribe_36, and tribe_130 each attacked it in succession and all died. Final duel: Tribe 89 (5,865 tiles) vs Tribe 10 (487 tiles, cornered). Tribe 89 wins at tick 2046. **Different behavior archetype from flexset winners** (Vanguard/Raid, not Warband/Combat).

**Documentation:** `docs/neurosim/media/run67sq42/run-narrative.md`

**Screenshots (in order):**
1. `sq-s42-tick286-firstempire.png` — first Empire (Tribe 88, tick 286, Council/Team)
2. `sq-s42-tick500.png` — mid-consolidation overview
3. `sq-s42-tick1000.png` — empire age overview
4. `sq-s42-tick1752-totalwar.png` — Total War aftermath, 13 alive
5. `sq-s42-tick1987-last2A.png` — Tribe 89 dominant (5,865 tiles)
6. `sq-s42-tick1987-last2B.png` — Tribe 10 cornered (487 tiles)
7. `sq-s42-tick2046-last.png` — Tribe 89 sole survivor

---

#### Run 4 — SoloQ, Seed 7777

| Field | Value |
|-------|-------|
| Dataset | SoloQ (EUNE Master+ Solo Queue) |
| Seed | 7777 |
| Starting tribes | 140 |
| Map tiles | ~15,000 |
| Final tick | 2541 |
| Winner | Tribe 70, Supply/Resource |
| Winner aggression | 0.68 |
| Winner isolation | 0.68 |
| Winner raid | 0.66 |
| Key event | Tribe 99 dominated for 1,500 ticks (7 consecutive war wins) then was eliminated by tribe_45 at tick 2340 |

**Narrative:** Same dataset as Run 3, different seed, slightly larger map. First Empire at tick 300 (Tribe 19, Warband/Combat). Tribe 99 becomes the dominant mid-game actor — winning wars at ticks 387, 1239, 1392, 1692, 1935, and 2091 — appearing unstoppable. At tick 2340, tribe_45 eliminates it. The winning tribe (70) had been quietly accumulating territory and surviving attacks throughout, emerging to win the final duel at tick 2541. **Winner behavior completely different from soloq 42** (Supply/Resource vs Vanguard/Raid) and completely different from flexset (Supply/Resource vs Warband/Combat).

**Documentation:** `docs/neurosim/media/run67sq7777/run-narrative.md`

**Screenshots (in order):**
1. `sq-s7777-tick301-firstempire.png` — first Empire (Tribe 19, tick 301, Warband/Combat)
2. `sq-s7777-tick500.png` — mid-consolidation overview
3. `sq-s7777-tick1000.png` — empire age overview
4. `sq-s7777-tick2100-totalwar.png` — Total War: 18 alive, 7 wars
5. `sq-s7777-tick2510-last2A.png` — Tribe 45 profile
6. `sq-s7777-tick2510-last2B.png` — Tribe 70 profile
7. `sq-s7777-tick2541-last.png` — Tribe 70 sole survivor

---

### N+2.5 — Cross-Dataset Comparison and Interpretation Limits

**Core question:** What do the four runs actually support as a conclusion?

**What to write:**

**Summary table:**

| Run | Dataset | Seed | Winner | Behavior | Aggression | Migration | Final tick |
|-----|---------|------|--------|----------|------------|-----------|------------|
| 1 | Flexset | 7777 | Tribe 355 | Warband/Combat | 0.18 | 0.88 | 2538 |
| 2 | Flexset | 42 | Tribe 596 | Warband/Combat | 0.13 | 0.87 | 2487 |
| 3 | SoloQ | 42 | Tribe 89 | Vanguard/Raid | 0.11 | 0.68 | 2046 |
| 4 | SoloQ | 7777 | Tribe 70 | Supply/Resource | 0.68 | 0.61 | 2541 |

**The key finding:**

Flexset runs converged on the same behavioral archetype across both seeds: Warband/Combat, low aggression (~0.13–0.18), high migration (~0.87–0.88), high isolation (~0.88), high combat artifact. SoloQ runs produced different archetypes across seeds: Vanguard/Raid (seed 42) and Supply/Resource (seed 7777).

This pattern is interpretable in terms of the underlying graph structure:

- Flex Queue clusters encode coordinated team play — players who consistently co-queue, build persistent alliance patterns, and develop complementary roles. These cluster profiles, when seeded into simulation, produce entities that behave like organized groups: they don't over-commit, they hold territory, they survive attacks rather than initiating indiscriminate aggression.
- Solo Queue clusters encode individual player performance — metrics from ranked solo play without persistent social structure. These profiles produce entities with more variable strategies that depend on the specific seeding configuration.

**Additional observations:**
- Both soloq runs had a "dominant mid-game actor" pattern — one tribe winning many wars in sequence before being upset. Neither flexset run showed this; consolidation was distributed.
- Fastest run: SoloQ 42 (2046 ticks) on smallest map (~7k tiles). Slowest: SoloQ 7777 (2541 ticks).
- Total War scale scales with population: SoloQ 16 declarations, Flexset 55–72 declarations.
- First Empire timing consistent: ticks 264–301 across all four runs.

**What this supports:**
- Cluster-derived priors produce measurably different simulated behavior
- Flexset (coordinated graph) → behavioral convergence across seeds
- SoloQ (individual graph) → behavioral variability across seeds
- Simulation is reproducible, inspectable, event-backed
- Total war cascade emerges from local opportunity-war thresholds, not scripted events

**What this does NOT support:**
- Real player psychology or actual social behavior
- Predictions of real League of Legends outcomes
- Proof that Warband/Combat is objectively superior — it won under these rules in these environments
- Any causal claim about why real players behave the way they do

**The thesis-ready conclusion sentence:**

> Tribal NeuroSim demonstrates that graph-derived cluster profiles from different social network structures — organized flex queue teams versus individual solo players — produce measurably different emergent survival strategies when transferred into an evolutionary multi-agent simulation under identical rules. The flexset dataset converges on a consistent low-aggression, high-migration archetype across seeds; the soloq dataset produces variable archetypes. This behavioral divergence is interpretable as a reflection of the underlying graph structure, not as a proof of real-world superiority.

**Documentation:**
- `docs/neurosim/media/run67fl42/run-narrative.md`
- `docs/neurosim/media/run67fl7777/run-narrative.md`
- `docs/neurosim/media/run67sq42/run-narrative.md`
- `docs/neurosim/media/run67sq7777/run-narrative.md`
- `docs/neurosim/chapter-writing/neurosim-3chapter-plan.md`

**Screenshots:** All four final-state screenshots for comparison:
- `fl-s7777-tick2538-last.png` — Warband/Combat winner, full flexset map
- `fl-s42-tick2487-last.png` — Warband/Combat winner, same behavior different seed
- `sq-s42-tick2046-last.png` — Vanguard/Raid winner, small soloq map
- `sq-s7777-tick2541-last.png` — Supply/Resource winner, medium soloq map

---

## Bibliography (Final — No Duplicates)

Sources used in these chapters only. Graph theory sources (Newman, Girvan, Brandes) are in the pathfinder lab chapter — referenced back, not repeated here.

| Citation key | Source | Used in |
|---|---|---|
| bonabeau2002 | Bonabeau, E. (2002). Agent-based modeling. *PNAS* 99(suppl. 3). | N+0.2, N+0.1 |
| wooldridgejennings1995 | Wooldridge & Jennings (1995). Intelligent Agents. *Knowledge Engineering Review* | N+0.2 |
| fowler2005 | Fowler, M. (2005). Event Sourcing. martinfowler.com | N+0.3 |
| jung2020 | Jung et al. (2020). Safe Systems Programming in Rust. *CACM* | N+0.4 |
| stanleymiikkulainen2002 | Stanley & Miikkulainen (2002). Evolving Neural Networks (NEAT). *Evolutionary Computation* | N+1.1, N+1.2, N+1.3 |
| holland1992 | Holland, J. H. (1992). Adaptation in Natural and Artificial Systems. MIT Press | N+1.1, N+1.3 |
| maynardsmithprice1973 | Maynard Smith & Price (1973). The Logic of Animal Conflict. *Nature* | N+1.4 |
| maynardsmith1982 | Maynard Smith (1982). Evolution and the Theory of Games. Cambridge | N+1.4 |

**Dropped from earlier drafts:**
- Epstein (2006) — source does not exist
- Macy & Willer (2002) — redundant with Bonabeau
- Gintis (2000) — overkill for one-paragraph Hawk-Dove mention
- Stanley & Miikkulainen (2004) — one NEAT paper is enough
- de Berg et al. computational geometry — spatial mechanics too brief to need a textbook
- Munzner visualization — MonoGame UI described without visualization-theory chapter
- Crooks et al. geo-spatial ABM — too niche
- Buneman provenance — lineage DAG doesn't require a data provenance paper
- Fowler (2017) "What do you mean by Event-Driven" — one Fowler citation enough
- Klabnik & Nichols Rust book — Jung et al. is the stronger research citation
- McKenney parallel programming — not cited in actual claims made
