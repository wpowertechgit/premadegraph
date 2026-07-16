# NeuroSim — 3-Chapter Plan

## Overview

The NeuroSim section collapses into 3 chapters. Everything that is an interpretation or already covered in the pathfinder lab chapter gets a brief mention only — not a full treatment. The three chapters follow: what it is → how it thinks and fights → what happened and what it means.

---

## What Changes vs the Old Plan

**Removed from active coverage:**
- Epstein (2006) *Generative Social Science* — this source does not exist. Drop it.
- Full graph theory + computational geometry subchapters — pathfinder lab already covers graph foundations (assortativity, betweenness, graph construction). NeuroSim just references back and adds the hex-grid / lineage-DAG angle briefly.
- Hawk-Dove as a main framing — keep it as a one-paragraph interpretive lens, not a chapter section. The simulation does not solve equilibria. Mention Maynard Smith, note it, move on.

**Merged into Chapter 1 (Foundations):**
- Agent-Based Modeling (#1)
- Multi-Agent Systems (#2)
- Event-Driven Architecture (#7)
- Systems architecture / Rust authority

**Merged into Chapter 2 (Game Logic and Intelligence):**
- Neuroevolution (#4)
- Strategic Interaction / Game Theory (#3, compact)

**Merged into Chapter 3 (Runs and Interpretation):**
- Simulation mechanics and world rules
- Spatial/hex geometry (brief — not a full chapter)
- All 4 experimental run narratives
- Validation and redesign history
- Interpretation limits

---

## Chapter 1 — System and Foundations

**Core question answered:** What is Tribal NeuroSim, why does it exist, and how is it built?

### 1.1 — Purpose and Origin

- NeuroSim as downstream of the PremadeGraph graph-analysis pipeline
- Not a standalone game: tribes are cluster-derived from real Flex Queue and SoloQ LoL data
- Thesis-safe framing: exploratory transfer experiment, not real-psychology proof
- Why simulation after static graph analysis: to study how cluster profiles behave under environmental rules

### 1.2 — Agent-Based and Multi-Agent Model

- ABM framing: local decisions → emergent macro patterns (expansion, war, empire, extinction)
- MAS framing: decentralized entities, no global optimizer, local state + local perception
- Tribes as population-level agents, not individual players
- Alliance count, alive count, war cascades — observable population dynamics

**Citations:** Bonabeau (2002), Wooldridge & Jennings (1995)

### 1.3 — Architecture and Observability

- Rust as authoritative simulation core (tick loop, world state, neural decisions, war/lineage)
- MonoGame as visualization / inspection layer (not a second simulation)
- Node as bridge
- FrameV1 binary protocol between layers
- Event-driven observability: append-only logs, per-tribe journals, tombstones — why this matters scientifically (simulation is auditable, not a black box)
- Deterministic seeded runs: same seed = identical tick-for-tick result

**Citations:** Fowler (2005) Event Sourcing, Jung et al. (2020) Rust safety

---

## Chapter 2 — Game Logic and Intelligence

**Core question answered:** How do tribes decide, adapt, and compete?

### 2.1 — Neuroevolution Framework

- NEAT-style genome: mutable weights, topology evolution
- Cluster-derived artifact priors as initial gene seeds: `A_combat`, `A_resource`, `A_map_objective`, `A_risk`, `A_team`
- 11 inputs → 7 behavioral drive outputs: aggression, resource, goal, migration, raid, isolation, expansion
- Fitness: survival + territory + population + polity tier
- Mutation, generation boundaries, fitness-weighted genome inheritance on merger
- F2 validated run as evidence: all 7 outputs active, non-saturated, fitness differentiation visible across 1,200 ticks

**Citations:** Stanley & Miikkulainen (2002) NEAT, Holland (1992) evolutionary computation

### 2.2 — Strategic Interaction

- War, alliance, retreat, disputed territory, merger: these are strategic choices where outcome depends on what the neighbor does
- Resource scarcity + territorial pressure = payoff-like trade-offs
- Why opportunity-war and stagnation-war mechanics were needed: peaceful genome deadlock in early runs is a game-theoretic failure mode
- Hawk-Dove as interpretive lens (one paragraph): high raid + high aggression ≈ Hawk posture; high isolation + high goal ≈ Dove posture. Not analytically solved — behavioral observation only.
- Concrete endgame evidence: all 4 runs show total-war cascade as the mechanism that breaks late-game deadlock

**Citations:** Maynard Smith & Price (1973), Maynard Smith (1982)

---

## Chapter 3 — Simulation Runs and Interpretation

**Core question answered:** What actually happened, and what can be defensibly concluded?

### 3.1 — World Mechanics (brief)

- Hex-grid world, tile ownership, biomes, resource gradients
- Population, food stores, starvation and collapse
- War initiation, combat, retreat, disputed penalty
- Alliance, merger, polity tier progression
- Lineage DAG and tombstones
- Spatial note: hex adjacency connects to the earlier graph chapter (pathfinder lab established the graph vocabulary — no need to repeat it here)

**No new major citations — this is mechanics documentation, not new theory.**

### 3.2 — Redesign and Validation History

- Early prototype failures: ghost-war, peaceful deadlock, migration state without spatial movement
- Authority redesign: move from browser prototype to Rust+MonoGame
- Key fixes: `tile_tribe_idx` cache, determinism via cluster sort, liveness tuning (population floors, combat multipliers)
- Determinism fix: clusters sorted by ID before sim init → same order every time → reproducible results
- Validation philosophy: seeded runs, event-backed interpretation, inspectable outputs

### 3.3 — Experimental Run Narratives

Four runs across 2 datasets and 2 seeds. Key data from each:

**Flexset seed 42** (599 tribes, 36k tiles, 2487 ticks):
- Winner: Tribe 596, Warband/Combat, aggression=0.13, migration=0.87
- Distinctive event: trilateral war at tick 2400 — two underdogs simultaneously declared war on dominant tribe_557; tribe_596 won the war, absorbed the territory, won the simulation
- Cross-run: same behavior archetype as flexset 7777

**Flexset seed 7777** (599 tribes, 36k tiles, 2538 ticks):
- Winner: Tribe 355, Warband/Combat, aggression=0.18, migration=0.88
- Distinctive event: Great War at tick 2040 — 55 simultaneous declarations; 205 Empires → 13 in 500 ticks
- Cross-run: Warband/Combat winner matches seed 42

**SoloQ seed 42** (140 tribes, 7k tiles, 2046 ticks — fastest):
- Winner: Tribe 89, Vanguard/Raid, aggression=0.11, isolation=0.68
- Distinctive event: tick 1740 Total War eliminated 39% of field in one burst; tribe_89 subsequently survived 3 simultaneous defensive attacks (ticks 1926–1935) from tribe_132, tribe_36, tribe_130 — all three died attacking it
- Cross-run: different behavior archetype from soloq 7777

**SoloQ seed 7777** (140 tribes, 15k tiles, 2541 ticks):
- Winner: Tribe 70, Supply/Resource, aggression=0.68, isolation=0.68
- Distinctive event: tribe_99 dominated for 1,500 ticks, won 7 consecutive wars, then was eliminated by tribe_45 at tick 2340
- Cross-run: different behavior archetype from soloq 42

### 3.4 — Interpretation: What the Results Support

**The key finding — convergence vs variability:**

Flexset runs (Warband/Combat, low aggression, high migration) converged on the same winner profile across both seeds. SoloQ runs produced different profiles across seeds (Vanguard/Raid vs Supply/Resource). This is the main cross-dataset observation:

> Flex Queue cluster graphs — which encode organized, team-coordinated play — seed entities that converge on a consistent survival strategy: disciplined, territorial, low-aggression. Solo Queue cluster graphs — which encode individual player performance without persistent social structure — seed entities with more variable winning strategies.

**Safe claims:**
- Cluster-derived priors produce measurably different simulated outcomes
- Flexset dataset → behavioral convergence across seeds
- SoloQ dataset → behavioral variability across seeds
- The simulation is reproducible, inspectable, and seeded from real player-graph data
- Total war cascades emerge from local opportunity-war thresholds — not scripted

**Claims that are NOT made:**
- Real player psychology is proven
- Exact LoL outcomes are predicted
- NEAT discovers objectively optimal behavior
- Equilibria are solved
- SoloQ players are more aggressive in real life

---

## Bibliography (trimmed)

Keep only what earns its place:

| Key | Use |
|-----|-----|
| Bonabeau (2002) | ABM framing, Chapter 1 |
| Wooldridge & Jennings (1995) | MAS framing, Chapter 1 |
| Fowler (2005) Event Sourcing | Event-driven observability, Chapter 1 |
| Jung et al. (2020) Rust | Systems language justification, Chapter 1 |
| Stanley & Miikkulainen (2002) NEAT | Neuroevolution core, Chapter 2 |
| Holland (1992) | Evolutionary computation foundation, Chapter 2 |
| Maynard Smith & Price (1973) | Hawk-Dove original, Chapter 2 |
| Maynard Smith (1982) | Broader game theory framing, Chapter 2 |
| Newman (2003) | Assortativity — referenced back to pathfinder lab chapter |
| Girvan & Newman (2002) | Community structure — referenced back to pathfinder lab chapter |
| Brandes (2001) | Betweenness centrality — referenced back to pathfinder lab chapter |

**Dropped:**
- Epstein (2006) — does not exist, removed
- Macy & Willer (2002) — redundant with Bonabeau for this context
- Gintis (2000) — overkill for a one-paragraph Hawk-Dove mention
- Stanley & Miikkulainen (2004) coevolution paper — one NEAT citation is enough
- de Berg et al. computational geometry — spatial mechanics are brief here, hex grid doesn't need a textbook citation
- Munzner visualization — the MonoGame UI is described but visualization theory is not a chapter
- Crooks et al. geo-spatial ABM — too niche for what's actually claimed
- Buneman provenance — lineage DAG doesn't need a data provenance paper

---

## Cross-Chapter Connection to Earlier Thesis Chapters

The pathfinder lab chapter (already written) covers:
- graph construction from LoL match data
- assortativity (Newman 2003)
- betweenness centrality (Brandes 2001)
- community structure (Girvan & Newman 2002)

The NeuroSim chapters reference back to this, not repeat it. The only new graph concept introduced in Chapter 3 is the lineage DAG — and that needs one sentence, not a subchapter.
