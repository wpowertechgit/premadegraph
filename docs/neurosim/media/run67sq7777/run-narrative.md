# SoloQ Run — Seed 7777 — Narrative Record

**Dataset:** soloq (EUNE Master+ Solo Queue)  
**Seed:** 7777  
**Starting tribes:** 140  
**Final tick:** 2541  
**Winner:** Tribe 70 (Empire / Supply / Resource)  
**Run date:** 2026-06-07

---

## Overview

140 tribes seeded from EUNE Master+ solo queue player-cluster profiles competed on a ~15,000-tile terrain map. The simulation ran 2,541 ticks before a single survivor remained. The run produced a strikingly different character than both flexset runs at the same seed: fewer tribes, a smaller world, slower consolidation, and a winner with a completely different behavioral profile — Supply/Resource with high aggression rather than Warband/Combat with near-zero aggression.

Tribe 99 dominated the middle 1,500 ticks of the run through relentless offensive campaigns, winning fights against tribe_100, tribe_76, tribe_61, tribe_101, tribe_92, tribe_85, and tribe_124. It looked like the clear front-runner. It was eliminated by tribe_45 at tick 2340. Tribe 70 won the simulation 201 ticks later.

---

## Dataset Context

The soloq dataset seeds from solo-ranked players rather than flex-queue organized teams. Its cluster graph reflects individual player performance profiles — not coordinated co-play patterns. The simulation starting count reflects this: 140 tribes (soloq) vs 599 (flexset), on a proportionally smaller map (~15,000 tiles vs ~36,100 tiles). Wars are slower, less cascading, and more decisive in individual outcomes. The diplomatic fabric is thinner — alliance counts start lower and erode faster.

This is the same seed (7777) used for the flexset run in `run67fl7777/`, enabling direct behavioral comparison.

---

## Phase 1 — Tribal Proliferation (Ticks 0–301)

At tick 50, all 140 tribes were alive on 393 tiles with zero active wars. The polity breakdown was almost entirely Tribe-tier (139 Tribe, 1 City). Compared to flexset, this opening phase was quieter — fewer entities, less crowding, more room to grow before pressure mounted.

First war fired at tick 81 — tribe_34 defeated tribe_46 in a single uncontested strike. By tick 100, only one tribe had been eliminated. Wars through tick 200 were sparse and unilateral; few simultaneous declarations. The pace reflects the underlying graph structure: soloq players cluster less densely, producing more isolated starting positions with fewer adjacency conflicts.

At tick 150, 135 alive with 76 Tribes, 54 Cities, 7 Duchies — a faster polity advancement rate per surviving entity than flexset, because each entity had more room to develop without immediate military pressure.

At tick 200, 130 alive. At tick 250, 127. The early consolidation was gradual.

**The first Empire appeared at tick 300** — one of the earliest possible moments in the tick cycle. At tick 301 (screenshot `sq-s7777-tick301-firstempire.png`), Tribe 19 is captured: Warband/Combat, population 10,844, 47 tiles, fitness 0.33. Drive: Resource. Neural profile: aggression 0.24, resource 0.40, migration 0.47, raid 0.43, expansion 0.85. 122 tribes were still alive, and the polity breakdown (T:52 C:16 D:41 K:12 E:1) shows a world still dominated by small and mid-tier entities.

---

## Phase 2 — Consolidation (Ticks 300–900)

This phase proceeded far more slowly than flexset equivalents. Flexset lost 80+ tribes between 900–950 in a single cascade; soloq dropped at roughly 5–15 per checkpoint period. The smaller world and sparser adjacency meant there was no mechanism for mass simultaneous war triggering.

At tick 350, two Empires existed. At tick 400, five. At tick 500 (map overview, `sq-s7777-tick500.png`): 111 alive, POLITY T:49 C:3 D:11 K:36 E:12. The map shows clearly distinct territorial blobs with substantial unclaimed terrain between them — evidence of the sparser initial placement.

The Empire tier grew quickly in proportional terms: by tick 600, 35 of 104 surviving entities were Empires. By tick 650, 35 of 101. The middle tier (Duchy/Kingdom) was already collapsing — entities either grew into Empires or were absorbed.

Tribe 99 emerged as the dominant offensive actor during this phase:
- Defeated tribe_76 at tick 387
- Defeated tribe_61 at tick 1239
- Defeated tribe_101 at tick 1392
- Defeated tribe_92 at tick 1692
- Defeated tribe_85 at tick 1935
- Defeated tribe_124 at tick 2091

Each win extended its territory and combat artifact score. It won every war it initiated in this phase.

At tick 900, **75 alive** — a meaningful drop from 92 at tick 800. The pattern shows two consecutive large drops: 88→75 (tick 850→900) and 75→62 (tick 900→950), the closest this run came to a cascade event. Alliance count was down to 13 by tick 900, signaling the near-complete breakdown of non-aggression dynamics.

At tick 1000 (map overview, `sq-s7777-tick1000.png`): 61 alive, POLITY T:13 C:3 D:2 K:10 E:33. The map shows large territorial blobs dominating most of the playable area. The small world meant full coverage was approaching.

---

## Phase 3 — Long Stagnation (Ticks 1000–2000)

The most distinctive feature of this run relative to flexset: an extended stagnation period through ticks 1000–1800. The alive count barely moved:

| Tick | Alive |
|------|-------|
| 1000 | 61 |
| 1100 | 54 |
| 1200 | 50 |
| 1300 | 47 |
| 1350 | 45 |
| 1400 | 44 |
| 1450 | 43 |
| 1500 | 40 |
| 1550 | 36 |
| 1600 | 35 |
| 1650 | 35 ← no change |
| 1700 | 33 |
| 1750 | 33 ← no change |
| 1800 | 32 |
| 1850 | 32 ← no change |

For 300 ticks (1550–1850), the alive count barely moved. Wars were sparse and individually decisive — one or two per cycle, not cascades. The smaller world had already been divided; established Empires were large enough to be defensive, reducing the frequency of profitable raids.

Tribe 99 continued winning selectively. Tribe 45 appears in the record winning defensive engagements: tribe_30 attacked it at tick 1473 and lost; tribe_94 attacked at tick 1917 and lost. Tribe 45 was being tested and surviving.

Tribe 70 was active but quiet — winning small engagements, accumulating territory without making the log's prominent positions.

---

## Phase 4 — Total War (Ticks 2100–2150)

At tick 2100, **16 simultaneous opportunity wars fired in a single tick** — the Great War for this run. In absolute terms this is smaller than flexset (55–72 declarations), but proportionally it was comparable given that only 25 entities remained alive at tick 2050.

At tick 2110 (screenshot `sq-s7777-tick2100-totalwar.png`): 18 alive, all Empires (T:0 C:0 D:0 K:0 E:18), 7 active wars, disparity 112. The map shows large patches of color — no small entities remain, just Empire-scale blobs fighting over the remaining unclaimed or weakly-held borders.

The cascade from tick 2100:
- 2100: 16 opportunity wars fire; 6 entities eliminated
- 2150: 13 alive
- 2200: 11 alive
- 2250: 8 alive
- 2300: 6 alive

In 200 ticks (2100→2300), 19 entities were eliminated — two-thirds of the remaining field.

---

## Phase 5 — Endgame (Ticks 2300–2541)

At tick 2300, 6 Empires remained. The map was nearly full coverage. Wars stopped being about expansion and became about elimination.

**Tick 2340 — The Big Upset:**

Tribe 99, which had won every war it initiated across 1,500 ticks, was simultaneously targeted by both tribe_45 (attacker) and tribe_97 (defender position) at tick 2340:
```
tribe_45 defeated tribe_99 (attacker won)
tribe_99 defeated by tribe_97 (defender won)
```
Tribe 99 — the run's dominant offensive actor — was eliminated. The front-runner fell.

**Tick 2409 — tribe_70 eliminates tribe_97:**
tribe_70 had declared war on tribe_97 at tick 2400 (opportunity, aggr=0.45). At tick 2409, it won.

**Tick 2460 — tribe_45 eliminates tribe_119:**
```
tribe_45 defeated tribe_119 (attacker won)
tribe_119 defeated by tribe_70 (defender won)
```
tribe_119 fought on two fronts simultaneously, attacking tribe_70 while tribe_45 attacked it. Both lost. Three entities remained: tribe_19, tribe_45, tribe_70.

**Tick 2505 — tribe_19 falls:**
tribe_19 (the first Empire from tick 300 — the run's longest-surviving entity by polity tier) attacked tribe_70 and lost. `tribe_19 defeated by tribe_70 (defender won)`.

Two remained.

---

## Phase 6 — Final Duel (Ticks 2505–2541)

At tick 2510 (screenshots `sq-s7777-tick2510-last2A.png` and `sq-s7777-tick2510-last2B.png`):

| | Tribe 45 | Tribe 70 |
|---|---|---|
| Behavior | Vanguard | Supply |
| Focus | Expansion | Resource |
| Population | 500,628 | 849,134 |
| Territory | 4,954 tiles | 5,583 tiles |
| Fitness | 0.62 | 0.43 |
| Drive | Expn | Aggr |
| Aggression | 0.12 | 0.68 |
| Resource | 0.63 | 0.40 |
| Migration | 0.52 | 0.61 |
| Raid | 0.52 | 0.66 |
| Isolation | 0.12 | 0.68 |
| Expansion | high | 0.64 |

Tribe 45 had higher fitness (0.62 vs 0.43) and larger population (500k vs 849k... wait, tribe 70 had larger population at 849k). Tribe 70 had more territory and more food reserves. The food advantage matters in prolonged standoffs — it sustains population through war attrition.

At tick 2520, tribe_45 declared an opportunity raid on tribe_70 (raid=0.12, aggr=0.12 — near minimum thresholds, suggesting desperation rather than strength). At **tick 2541, tribe_70 defeated tribe_45 (attacker won)**.

Final state of Tribe 70 at victory (`sq-s7777-tick2541-last.png`):
- Population: 244,172 (contracted from war)
- Food: 943,488
- Territory: **9,748 tiles** (essentially the full map)
- Fitness: 0.61
- Drive: Aggr (Aggression)

---

## Why Tribe 70 Won — And Why It Matters

Tribe 70's winning profile is the inverse of both flexset winners:

| Trait | Flexset 42 winner | Flexset 7777 winner | SoloQ 7777 winner |
|-------|------------------|---------------------|-------------------|
| Behavior | Warband | Warband | Supply |
| Focus | Combat | Combat | Resource |
| Aggression | 0.13 | 0.18 | 0.68 |
| Migration | 0.87 | 0.88 | 0.61 |
| Isolation | 0.88 | 0.88 | 0.68 |
| Raid | 0.41 | 0.83 | 0.66 |

Flexset winners: low aggression, high migration, high isolation — disciplined, territorial, defensive.

SoloQ winner: high aggression, moderate migration, moderate isolation — active, opportunistic, resource-focused.

The underlying graph structure matters. Flexset clusters encode coordinated team play: players who consistently co-queue, build persistent alliances, and develop complementary roles. These cluster profiles, when seeded into the simulation, produce entities that behave like organized groups — they don't over-commit, they hold territory, they let others exhaust themselves.

SoloQ clusters encode individual player profiles: performance metrics from ranked solo play without persistent social relationships. These profiles produce entities that behave more aggressively and resource-opportunistically — they strike when the opportunity metric crosses threshold rather than waiting for positional advantage.

Both datasets are from the same game and the same skill tier. The behavioral divergence in simulation winners reflects a real structural difference in the underlying social graph.

---

## Comparison: SoloQ 7777 vs Flexset 7777

Both runs used seed 7777. The world is different, the scale is different, the winner is different.

| Parameter | Flexset 7777 | SoloQ 7777 |
|---|---|---|
| Starting tribes | 599 | 140 |
| Map tiles | ~36,100 | ~15,000 |
| First Empire tick | 264 | 300 |
| Total War tick | 2040 | 2100 |
| Total War scale | 55 declarations | 16 declarations |
| Final tick | 2538 | 2541 |
| Winner | Tribe 355 | Tribe 70 |
| Winner behavior | Warband/Combat | Supply/Resource |
| Winner aggression | 0.18 | 0.68 |
| Winner territory (final) | 37,666 tiles | 9,748 tiles |
| Dominant mid-game actor | None (distributed) | Tribe 99 (then eliminated) |

The dominant mid-game actor contrast is notable: flexset 7777 had no single dominant actor — consolidation was distributed across many concurrent wars. SoloQ 7777 had tribe_99 winning repeatedly for 1,500 ticks before being upset by tribe_45, which was then eliminated by tribe_70. The soloq run produced a cleaner narrative arc: dominant actor, upset, upset winner.

This pattern may reflect the soloq graph's more individualized structure — fewer alliance connections, more zero-sum competition between adjacent entities, less distributed pressure.

---

## Simulation Parameters

| Parameter | Value |
|---|---|
| Seed | 7777 |
| Dataset | soloq |
| Starting tribes | 140 |
| Map tiles | ~15,000 |
| Final tick | 2541 |
| First Empire | Tribe 19, tick 300 (Warband/Combat) |
| Total War | Tick 2100 (16 simultaneous declarations) |
| Dominant mid-game actor | Tribe 99 (eliminated tick 2340 by tribe_45) |
| Winner | Tribe 70 |
| Winner polity | Empire / Supply / Resource |
| Winner final territory | 9,748 tiles |

---

## Screenshots Index

| File | Tick | Event |
|---|---|---|
| `sq-s7777-tick301-firstempire.png` | 301 | First Empire (Tribe 19, Warband/Combat) — 122 alive |
| `sq-s7777-tick500.png` | 504 | Mid-consolidation overview — 111 alive |
| `sq-s7777-tick1000.png` | 1001 | Empire age snapshot — 61 alive |
| `sq-s7777-tick2100-totalwar.png` | 2110 | Total War — 18 alive, 7 active wars |
| `sq-s7777-tick2510-last2A.png` | 2510 | Final two — Tribe 45 profile (4,954 tiles) |
| `sq-s7777-tick2510-last2B.png` | 2510 | Final two — Tribe 70 profile (5,583 tiles) |
| `sq-s7777-tick2541-last.png` | 2541 | Tribe 70 wins — 9,748 tiles, sole survivor |
