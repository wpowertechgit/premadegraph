# SoloQ Run — Seed 42 — Narrative Record

**Dataset:** soloq (EUNE Master+ Solo Queue)  
**Seed:** 42  
**Starting tribes:** 140  
**Final tick:** 2046  
**Winner:** Tribe 89 (Empire / Vanguard / Raid)  
**Run date:** 2026-06-07

---

## Overview

140 tribes seeded from EUNE Master+ solo queue player-cluster profiles competed on a ~7,000-tile terrain map. The simulation ended at tick 2046 — the fastest completion of all four runs by a significant margin. The nearest is soloq 7777 at tick 2541, nearly 500 ticks longer; both flexset runs finished around 2487–2538.

The run produced a single defining event: the Total War at tick 1740, which eliminated 9 of 23 surviving entities in a single burst — the highest proportional wipeout across all four runs. Tribe 89 emerged from that chaos and went on a five-war defensive rampage between ticks 1860 and 1935, turning back every attacker before sweeping the remaining opponents.

Winner profile: Vanguard behavior, Raid-focused drive, low aggression, high isolation, high raid capability. Different from both flexset winners (Warband/Combat) and the soloq 7777 winner (Supply/Resource). The soloq dataset is producing variable behavioral winners; the flexset dataset is converging on a consistent archetype.

---

## Dataset and Map Context

The soloq 42 map is approximately **6,800–7,000 tiles** total — confirmed by the winner's final territory of 6,365 tiles at tick 2046, which essentially covers the entire playable surface. This is the smallest world of the four runs:

| Run | Starting tribes | Map size |
|-----|----------------|----------|
| Flexset 7777 | 599 | ~36,100 tiles |
| Flexset 42 | 599 | ~36,100 tiles |
| SoloQ 7777 | 140 | ~15,000 tiles |
| SoloQ 42 | 140 | ~7,000 tiles |

The smaller world produces denser contact earlier, faster consolidation, and earlier endgames. The 140-tribe starting density on 7,000 tiles is actually comparable to flexset's 599 tribes on 36,100 tiles (~1 tribe per 50 tiles in both cases). The behavioral differences in outcomes therefore cannot be attributed to density alone — they reflect the underlying graph structure of the seeding data.

---

## Phase 1 — Opening and First Empire (Ticks 0–300)

At tick 50 and tick 100, no tribes had been eliminated — zero wars had resolved. This is the only run across the four where the first 100 ticks produced no deaths. The soloq 42 cluster profiles apparently had low initial border pressure — entities were placed with enough spatial separation to avoid immediate conflict.

Wars picked up rapidly from tick 120 onward. Tribe_83 eliminated tribe_71 in the first opportunity war (raid=0.59, aggr=0.17). Tick 150 showed 135 alive with 7 active wars — the fastest war-start in the early phase. By tick 200, 126 alive with 7 simultaneous wars — more aggressive than soloq 7777's early phase.

**First Empire at tick 286** — the earliest of all four runs. Screenshot `sq-s42-tick286-firstempire.png` shows **Tribe 88** — Empire tier, **Council/Team** behavior, population 5,337, 97 tiles, fitness 0.38. Polity breakdown at this moment: T:42 C:21 D:23 K:19 E:1. The Council/Team profile is the cooperative behavior type — high team artifact (0.98), moderate aggression (0.24). It was the first entity in the dataset to reach Empire tier, but it would not be the winner.

At tick 300: 110 alive, 3 Empires. The small world was filling up quickly.

---

## Phase 2 — Rapid Consolidation (Ticks 300–900)

Consolidation in this run was faster per tick than soloq 7777 but slower in total because the endgame arrived sooner. Empire count grew quickly:

| Tick | Alive | Empires |
|------|-------|---------|
| 300 | 110 | 3 |
| 350 | 109 | 10 |
| 400 | 105 | 13 |
| 450 | 102 | 16 |
| 500 | 101 | 20 |
| 600 | 94 | 28 |
| 650 | 91 | 29 |
| 700 | 91 | 29 ← stagnant |

The tick 500 map overview (`sq-s42-tick500.png`) shows 101 alive, densely packed on a small terrain — very little unclaimed space visible compared to soloq 7777 at the same checkpoint. The terrain is 6,884 tiles and entities are already pressing against each other.

At tick 650–700, the alive count stagnated at 91 for 50 ticks despite the Empire count remaining stable at 29. Both checkpoints showed zero active wars and low migration. This is the small-map equivalent of the trench stagnation seen in soloq 7777's 1550–1850 phase — entities had established borders but no trigger condition yet existed for renewed aggression.

The 900→950 transition produced the run's first cascade: **75→61 alive** (14 eliminated in 50 ticks). Alliance count dropped from 14 to 14 (already at floor) while Empire count held at 33. These eliminations came from individual wars rather than a mass trigger event.

At tick 1000 (`sq-s42-tick1000.png`): 59 alive, POLITY T:10 C:7 D:1 K:8 E:33. The map shows large Empire blobs with only scattered small entities remaining. The last raw Tribe-tier entity would vanish by tick 1600.

---

## Phase 3 — Empire Grind (Ticks 1000–1700)

This phase was the slowest relative to its starting population. From 59 alive at tick 1000 to 23 alive at tick 1700 — only 36 eliminations across 700 ticks. Wars were sparse and individually decisive: tribe_43 eliminated tribe_101 at tick 1539, tribe_10 eliminated tribe_69 at tick 1557, tribe_87 eliminated tribe_98 at tick 1668 (then tribe_43 eliminated tribe_98's killer at tick 1698).

The alliance count reached its absolute floor — 4 remaining alliances at tick 1450–1500, then 2 by tick 1650. The diplomatic fabric was fully dissolved. All surviving entities were either in direct conflict or in temporary standoff.

Tribe 89 appears in this phase quietly: it survives being targeted by tribe_132 and others. It was accumulating combat experience and territorial position without over-committing.

At tick 1700: 23 alive, max territory for any single entity jumped to 1,226 tiles — one Empire had broken away from the pack. Average population per entity: 77,241.

---

## Phase 4 — Total War (Tick 1740)

At tick 1740, **15 simultaneous opportunity wars fired in a single tick** — the Total War event for this run. The wave was proportionally the most destructive of all four runs:

- Before: 23 alive
- After tick 1750: 14 alive
- **9 entities eliminated in one burst** = 39% of the surviving field

For comparison:
- SoloQ 7777: 16 declarations, ~25→19 (24% eliminated)
- Flexset 42: 72 declarations, ~99→56 (43% eliminated — larger absolute but flexset had far more entities)
- Flexset 7777: 55 declarations, ~25→19 equivalent proportion

The snapshot at tick 1752 (`sq-s42-tick1752-totalwar.png`) shows the aftermath. Tribe 32 is selected — Empire, Council/Team, 22 tiles, allied with tribe_123. It survived the burst but barely. Only 13 entities remained at this checkpoint. Wars=5 still active. The map shows large colored blobs — the small world left no room to hide.

The cascade continued immediately after:

| Tick | Alive |
|------|-------|
| 1750 | 14 |
| 1800 | 11 |
| 1850 | 9 |
| 1900 | 7 |
| 1950 | 3 |

From 23 alive at tick 1700 to 3 alive at tick 1950 — 20 entities eliminated in 250 ticks. This is the fastest compression rate in any of the four runs.

---

## Phase 5 — The Tribe 89 Rampage (Ticks 1860–1983)

Between ticks 1860 and 1935, Tribe 89 fought off four separate attackers in sequence and won every engagement:

| Tick | War | Result |
|------|-----|--------|
| 1860 | Tribe 89 attacks tribe_123 | Tribe 89 wins (attacker) |
| 1920 | Tribe 89 attacks tribe_32 | Tribe 89 wins (attacker) |
| 1926 | Tribe_132 attacks tribe_89 | Tribe 89 wins (defender) |
| 1935 | Tribe_36 attacks tribe_89 | Tribe 89 wins (defender) |
| 1935 | Tribe_130 attacks tribe_89 | Tribe 89 wins (defender) |
| 1983 | Tribe 89 attacks tribe_46 | Tribe 89 wins (attacker) |

The tick 1926–1935 defensive sequence is particularly notable: three entities simultaneously tried to eliminate tribe_89 across 9 ticks, and all three failed. Tribe_132, tribe_36, and tribe_130 each attacked independently, presumably because tribe_89 was the largest remaining threat. None succeeded. By tick 1935, all three were dead — not from tribe_89 attacking them, but from failing to defeat it as defenders.

After tick 1935, only tribe_89, tribe_46, and tribe_10 remained.

At tick 1950: **3 alive.** Tribe 89, tribe 46, tribe 10.

At tick 1983: tribe_89 eliminated tribe_46. Two remained.

---

## Phase 6 — Final Duel (Ticks 1983–2046)

At tick 1987 (screenshots `sq-s42-tick1987-last2A.png` and `sq-s42-tick1987-last2B.png`):

| | Tribe 89 | Tribe 10 |
|---|---|---|
| Behavior | Vanguard | Vanguard |
| Focus | Raid | War (Goal) |
| Population | 788,274 | 790,451 |
| Territory | 5,865 tiles | 487 tiles |
| Fitness | 0.49 | 0.54 |
| Drive | Raid | Goal |
| A_Combat | 0.45 | 0.63 |
| A_Resource | 0.79 | 0.63 |
| A_MapObj | 0.70 | 0.75 |
| Aggression | 0.11 | 0.67 |
| Migration | 0.68 | 0.28 |
| Raid | 0.84 | 0.30 |
| Isolation | 0.68 | 0.12 |

The visual asymmetry was extreme: tribe_89 (red) covered roughly 85% of the map; tribe_10 (yellow) held a small isolated corner with 487 tiles. Population was nearly identical — 788k vs 790k — but territory told the real story. Tribe_10 was cornered and resource-constrained (food: 28,049 vs tribe_89's 919,258).

Tribe_10 had higher fitness (0.54 vs 0.49) and more combat artifacts, but no room to maneuver. It tried one last opportunity raid at tick 2040 (raid=0.55, aggr=0.76 — the highest aggression drive in the final two). At **tick 2046, tribe_89 defeated tribe_10 (attacker won)**.

Final state of Tribe 89 at victory (`sq-s42-tick2046-last.png`):
- Population: 979,625
- Food: 1,173,617
- Territory: **6,365 tiles** (entire map)
- Fitness: 0.63
- Drive: Raid

---

## Why Tribe 89 Won

Tribe 89's win profile shares one trait with the flexset winners — **low aggression (0.11–0.12)** — but diverges on behavior type (Vanguard not Warband) and the mechanism of victory.

Where flexset winners accumulated territory through migration and held off attackers passively, tribe_89 won through **raid drive**. It attacked when its raid score crossed threshold (high raid=0.84) but did not aggress randomly (aggression=0.11). The distinction matters: raid is target-selective opportunity behavior; aggression is indiscriminate. Tribe_89 struck precisely when conditions were favorable, not constantly.

The tick 1926–1935 sequence demonstrates this: it didn't preemptively attack tribe_132, tribe_36, or tribe_130 — they came to it, and its isolation drive (0.68) combined with raid capability made it lethal on defense. Three entities tried to eliminate it in 9 ticks. All died.

Its resource artifact (0.79) was the highest among the final two, and its isolation drive (0.68) kept it from over-extending into alliance entanglements. By tick 1987 it held 12× tribe_10's territory on a 7,000-tile map. The math was settled before the final war.

---

## Cross-Run Comparison: SoloQ Seeds and Flexset Seeds

| Run | Seed | Winner behavior | Aggression | Migration | Final tick |
|-----|------|----------------|------------|-----------|------------|
| SoloQ 42 | 42 | Vanguard/Raid | 0.11 | 0.68 | **2046** |
| SoloQ 7777 | 7777 | Supply/Resource | 0.68 | 0.61 | 2541 |
| Flexset 42 | 42 | Warband/Combat | 0.13 | 0.87 | 2487 |
| Flexset 7777 | 7777 | Warband/Combat | 0.18 | 0.88 | 2538 |

**Flexset produces a consistent winner archetype across seeds.** Both flexset runs at different seeds produced Warband/Combat winners with near-identical neural profiles. This behavioral convergence is structurally meaningful: the flex queue graph encodes coordinated team play, and entities seeded from those clusters reliably develop the same winning strategy — disciplined, territorial, migration-dominant.

**SoloQ produces variable winner archetypes across seeds.** Seed 42 produced Vanguard/Raid; seed 7777 produced Supply/Resource. The neural profiles are dissimilar (aggression 0.11 vs 0.68). The soloq graph encodes individual performance without persistent social structure, and different random starting conditions lead to different optimal strategies emerging.

This is a thesis-worthy observation: **social graph structure influences both what wins and how consistently it wins**. Coordinated graphs (flex) → convergent outcomes. Individual graphs (soloq) → variable outcomes.

---

## Notable Records Across All Four Runs

- **Fastest run:** SoloQ 42 at tick 2046 (nearest competitor: SoloQ 7777 at 2541)
- **Earliest first Empire:** SoloQ 42 at tick 286 (SoloQ 7777: tick 300; Flexset 42: tick 287; Flexset 7777: tick 264)
- **Highest proportional Total War wipeout:** SoloQ 42 (39% field eliminated in one burst)
- **Longest single-entity winning streak:** Tribe 89 — 5 wars won in 76 ticks (ticks 1860–1935), including 3 defensive wins simultaneously
- **Smallest final-2 territorial gap:** SoloQ 42 (5,865 vs 487 tiles = 12:1 ratio)
- **Most variable winner behavior:** SoloQ dataset (Vanguard vs Supply across seeds)
- **Most consistent winner behavior:** Flexset dataset (Warband/Combat both seeds)

---

## Simulation Parameters

| Parameter | Value |
|---|---|
| Seed | 42 |
| Dataset | soloq |
| Starting tribes | 140 |
| Map tiles | ~6,800–7,000 |
| Final tick | **2046** (fastest run) |
| First Empire | Tribe 88, tick 286 (Council/Team) |
| Total War | Tick 1740 (15 declarations, 39% field eliminated) |
| Tribe 89 rampage | Ticks 1860–1935 (5 wars, 0 losses) |
| Winner | Tribe 89 |
| Winner polity | Empire / Vanguard / Raid |
| Winner final territory | 6,365 tiles |

---

## Screenshots Index

| File | Tick | Event |
|---|---|---|
| `sq-s42-tick286-firstempire.png` | 286 | First Empire (Tribe 88, Council/Team) — ~110 alive |
| `sq-s42-tick500.png` | 502 | Mid-consolidation overview — 101 alive |
| `sq-s42-tick1000.png` | 1001 | Empire age snapshot — 59 alive |
| `sq-s42-tick1752-totalwar.png` | 1752 | Total War aftermath — 13 alive, 5 active wars |
| `sq-s42-tick1987-last2A.png` | 1987 | Final two — Tribe 89 (5,865 tiles, dominant) |
| `sq-s42-tick1987-last2B.png` | 1987 | Final two — Tribe 10 (487 tiles, cornered) |
| `sq-s42-tick2046-last.png` | 2046 | Tribe 89 wins — 6,365 tiles, sole survivor |
