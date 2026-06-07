# Flexset Run — Seed 42 — Narrative Record

**Dataset:** flexset (EUNE Master+ Flex Queue)  
**Seed:** 42  
**Starting tribes:** 599  
**Final tick:** 2487  
**Winner:** Tribe 596 (Empire / Warband / Combat)  
**Run date:** 2026-06-07

---

## Overview

599 tribes seeded from EUNE Master+ flex queue player-cluster profiles competed on a 36,100-tile terrain map. The simulation ran 2,487 ticks before a single survivor remained. The endgame produced a rare trilateral standoff: three Empires, one dominant, two smaller — both underdogs declared war on the leader simultaneously at tick 2400. The stronger underdog succeeded in eliminating the dominant force, absorbed its vast territory, and then dispatched the remaining rival 63 ticks later.

Winner Tribe 596 (Warband/Combat) survived the entire simulation without ever being the largest empire at any checkpoint — it won by outlasting, not by dominating.

---

## Phase 1 — Tribal Proliferation (Ticks 0–287)

At tick 50, all 599 tribes were alive, holding 1,844 tiles with zero active wars. The map mirrored the underlying flex queue cluster structure: small, geographically isolated groups reflecting the social organization of the player graph.

First wars fired at tick 81 — three simultaneous declarations, all resolved within the same tick. By tick 100, six tribes were dead. The pace of early elimination was moderate: wars in this phase were brief, decisive, and bilateral. Entities that survived being attacked in the early rounds tended to hold their positions through the consolidation phase.

At tick 150, 565 tribes remained. Polity breakdown: 385 Tribes, 160 Cities, 20 Duchies — Cities had already formed en masse but Kingdoms were still absent.

**The first Empire appeared at tick 287.** Tribe 220 — screenshot `fl-s42-tick287-firstempire.png` — was captured in close-up: population 15,737 on 68 tiles, actively migrating toward tile 7731. Its polity behavior was **Council/Team** — the only Council-type to reach Empire status early in either run. Fitness was 0.38. Neural profile: high resource accumulation (0.88), high migration (0.87), high raid opportunism (0.83), and an elevated aggression drive (0.37) compared to most eventual survivors. It was moving, expanding, and well-fed. 513 tribes were still alive at this moment.

---

## Phase 2 — Consolidation Wars (Ticks 287–900)

By tick 300, three Empires existed alongside 212 Tribes. The consolidation rate was similar to the 7777 run but slightly slower in the early stages — seed 42's polity distribution shows more Duchies and Kingdoms at the 300–500 range, suggesting a more gradual middle tier rather than explosive early elimination.

At tick 500, the featured empire was **Tribe 244** (Warband/Combat, screenshot `fl-s42-tick500.png`): 41,042 population, 89 tiles, fitness 0.45. Its neural profile was distinctive — isolation drive 0.88 and expansion drive 0.88 were both at maximum alongside moderate resource (0.87) and raid (0.86). It was building internally and expanding aggressively from a position of self-sufficiency. 443 tribes remained.

The polity count at tick 500 (T:172 C:39 D:89 K:88 E:55) shows a world already dominated by middle-tier and Empire entities. The raw Tribe tier was collapsing.

Between ticks 500 and 900, the standard consolidation cascade proceeded: mutual declarations, defender wins, rapid absorptions. The alliance count (Al) dropped from 177 at tick 500 to 110 at tick 900, indicating steady erosion of the diplomatic fabric as entities grew too large for peaceful coexistence.

At tick 900: 320 alive. Between 900 and 950, **64 tribes were eliminated in 50 ticks** — a mass extinction burst similar in magnitude to the 7777 run. Alliance count collapsed from 110 to 56. The same pattern: a cascade of alliance breaks triggering simultaneous wars across the map.

At tick 950: 256 alive, 115 Empires. Empire age had begun in earnest.

---

## Phase 3 — Empire Age (Ticks 1000–1860)

At tick 1000, 234 tribes remained with average population 25,652 and a polity breakdown of 33 Tribes / 12 Cities / 7 Duchy / 65 Kingdom / 117 Empire. The featured entity at this checkpoint was **Tribe 453** (Warband/Combat, `fl-s42-tick1000.png`): 175,462 population, 292 tiles, fitness 0.48. Its neural profile was notable: near-zero aggression (0.12), near-zero resource (0.12), near-zero raid (0.15) — almost entirely passive. Drive was Expansion (0.82) and Migration (0.78). It was growing without fighting.

Tribe 596 was active throughout this phase but rarely featured prominently. The log shows it consistently winning defensive engagements: tribe_520 tried to take it at tick 300 and lost; tribe_521 at tick 823 and lost; tribe_571 at tick 939 and lost. It accumulated combat experience without overextending — the same pattern that characterized the 7777 winner.

The Empire-age war rhythm from tick 1000 to 1800 was a slow grind. Wars became less frequent but more consequential — each eliminated tribe represented massive territory transfer. By tick 1750, only 111 entities remained, and only 1 raw Tribe-tier entity survived.

Between tick 1800 (107 alive) and tick 1860 (the Great War tick), the final pre-collapse phase: surviving Empires were now so large that every neighbor was a rival of comparable weight.

---

## Phase 4 — Total War (Ticks 1860–1950)

At tick 1860, **72 simultaneous opportunity war declarations fired in a single tick** — the largest burst of the run, substantially larger than the 7777 run's 55-declaration trigger at tick 2040. This was the Great War for seed 42.

At tick 1872 (screenshot `fl-s42-tick1872-totalwar.png`): 67 alive, 26 active wars, all but 4 Empires. The featured entity was **Tribe 334** (Council/Team): 1,022 tiles, population 106,139, fitness 0.60. Its neural profile was dominated by goal drive (0.88), raid (0.88), and isolation (0.87) — a pragmatic, goal-oriented entity that had survived to this point through disciplined raiding. 63 of the remaining 67 entities were Empires.

The cascade was violent:
- Tick 1860: 72 opportunity wars fire simultaneously; ~30 entities eliminated in the burst
- Tick 1900: 56 alive → all Empires (plus 1 City, 1 Duchy), 11 wars active
- Tick 1950: 35 alive, 12 wars active

Between tick 1860 and 1950, approximately 55 entities were eliminated in 90 ticks — faster than the 7777 run's comparable phase. By tick 2000, only 19 Empires remained.

---

## Phase 5 — The Three-Body Problem (Ticks 2000–2424)

The consolidation continued through the 2000s:
- Tick 2040: tribe_596 eliminates tribe_517
- Tick 2043: tribe_348 eliminates tribe_187
- Tick 2049: tribe_557 eliminates tribe_239
- Tick 2052: tribe_421 eliminates tribe_489
- Tick 2082: tribe_153 eliminates tribe_279
- Tick 2088: tribe_90 eliminates tribe_118
- Tick 2100: tribe_421 eliminates tribe_9 — 11 Empires remain

Between tick 2100 and 2300, the surviving empires fought each other down to a critical threshold. By tick 2300, only **5 entities remained**.

At tick 2316, tribe_153 was eliminated by tribe_435. At tick 2352, **tribe_557 eliminated tribe_435** — absorbing its territory and jumping to approximately 23,149 tiles. Tribe_557 was now clearly dominant.

**At tick 2350, four survivors. By tick 2400, three — and what happened next was the run's defining moment.**

At tick 2400, the simulation registered the following opportunity wars:
```
tribe_90 → tribe_557  (raid=0.27 aggr=0.84)
tribe_596 → tribe_557 (raid=0.31 aggr=0.14)
```

**Both tribe_90 and tribe_596 independently identified tribe_557 — the dominant empire at ~23k tiles — as a target, and declared war simultaneously.**

This was not a formal alliance. Both acted from the same emergent logic: tribe_557 had just grown large and was momentarily vulnerable to coordinated pressure. The decision was independent — both entities' opportunity-war threshold triggered against the same target in the same tick.

At tick 2417 (screenshot `fl-s42-tick2417-trilateralwar.png`), the three-way standoff was frozen for inspection. Tribe 90 is shown: Pathfinders/MapObjective, 11,207 tiles, population 305,150, fitness 0.60. Neural profile: high aggression (0.84), high resource (0.83), high isolation (0.88), expansion (0.81). Notably, migration was only 0.13 — it had stopped expanding geographically and was now entrenched. It had strength but not territory advantage.

**At tick 2424, tribe_596 defeated tribe_557 (attacker won).** The dominant empire fell. Tribe_90's simultaneous attack had weakened tribe_557's position; tribe_596 finished it.

Tribe_596 immediately absorbed tribe_557's ~23k-tile territory, growing to over 28,000 tiles — more than 2.5× tribe_90's 11,207 tiles. The underdog that toppled the giant had become the new giant.

---

## Phase 6 — Final Duel (Ticks 2424–2487)

At tick 2450, two survivors remained (see screenshots `fl-s42-tick2486-last2A.png` and `fl-s42-tick2486-last2B.png`):

| | Tribe 90 | Tribe 596 |
|---|---|---|
| Behavior | Pathfinders | Warband |
| Focus | MapObjective | Combat |
| Population | 19,366 | 233,960 |
| Territory | 11,207 tiles | 28,162 tiles |
| Fitness | 0.60 | 0.57 |
| A_Combat | 0.90 | 0.96 |
| A_Resource | 0.66 | 0.77 |
| A_MapObj | 0.97 | 0.78 |
| A_Risk | 0.96 | 0.77 |
| A_Team | 0.85 | 0.70 |
| Aggression | 0.84 | 0.13 |
| Resource | 0.83 | 0.27 |
| Raid | 0.26 | 0.41 |
| Migration | 0.13 | 0.87 |
| Isolation | 0.88 | 0.88 |
| Expansion | 0.81 | 0.45 |

Tribe 90's population had collapsed — from 305,150 at tick 2417 to 19,366 at tick 2486. The trilateral war drained it. Despite its superior MapObjective score (0.97 vs 0.78) and Risk tolerance (0.96 vs 0.77), it had lost too much in the battle against tribe_557.

Tribe 596 had the territorial advantage — 2.5× more tiles — and a massive food surplus (2,710,231 vs 1,836,533 for tribe_90). It was resource-dominant and positioned to wait.

At tick 2460, tribe_90 attempted one last opportunity raid on tribe_596 (aggr=0.84 — its combat aggression was still high). At **tick 2487, tribe_596 defeated tribe_90 (attacker won)**.

Final state of Tribe 596 at victory (`fl-s42-tick2487-last.png`):
- Population: 329,859
- Food: 2,738,854
- Territory: **39,369 tiles** (full map)
- Fitness: 0.57
- Drive: Isolation

---

## Why Tribe 596 Won

Tribe 596 was, paradoxically, one of the most *passive* surviving entities at the endgame. Its aggression drive was 0.13 — the floor — and its resource drive was only 0.27. It did not fight for food; it did not fight for territory. What it did:

1. **Survived every defensive engagement across 2,487 ticks.** The log shows it repeatedly winning as defender (tribe_520 at tick 315, tribe_521 at tick 858, tribe_571 at tick 963, tribe_596 won against tribe_279 as defender at tick 2082). Each defensive win added combat experience to its artifact score (final A_Combat: 0.96).

2. **Accumulated territory through migration (0.87).** While aggressive tribes spent energy on offense, tribe_596 expanded by settling empty or weakly-held land. Its isolation drive (0.88) kept it from over-committing to allies or costly wars.

3. **Seized the trilateral opportunity at the right moment.** When tribe_557 became the dominant force by absorbing tribe_435 at tick 2352, tribe_596 identified it as a target and struck. The raid score (0.41) was moderate — it was not a prolific raider, but it struck when the calculation was right.

4. **Won the war against the dominant empire.** Tribe_557 was fighting on two fronts simultaneously (tribe_90 + tribe_596). Tribe_596's attack succeeded; tribe_90's did not. This asymmetry — both attacking a stronger target at the same time — is what made tribe_596's victory possible. Without tribe_90's simultaneous pressure, tribe_557 might have survived.

The Warband/Combat polity behavior — consistent across both this run and the 7777 winner — reflects an entity optimized for sustained, disciplined combat rather than opportunistic aggression. It does not start wars indiscriminately. It finishes them.

---

## Comparison with Seed 7777

| | Seed 42 | Seed 7777 |
|---|---|---|
| Winner | Tribe 596 | Tribe 355 |
| Behavior | Warband/Combat | Warband/Combat |
| Final tick | 2487 | 2538 |
| Aggression | 0.13 | 0.18–0.19 |
| Migration | 0.87 | 0.88 |
| A_Combat | 0.96 | 0.98 |
| Final territory | 39,369 tiles | 37,666 tiles |
| Total War tick | 1860 | 2040 |
| Endgame structure | Trilateral war | 1-vs-1 final |
| First Empire tick | 287 | 264 |

Both winners shared the same behavioral profile: Warband/Combat, near-minimum aggression, near-maximum migration, high combat artifacts accumulated through defensive wins. The strategy converged across different random seeds — a strong signal that this behavioral profile has structural advantages in the flexset cluster environment.

The key difference was the endgame: seed 7777 resolved as a straightforward 1-vs-1 territorial contest; seed 42 produced a three-body problem where the outcome hinged on a simultaneous dual declaration against the leading empire. In seed 42, tribe_596 did not outlast the competition by attrition alone — it required a specific event where two weaker entities created enough pressure on the dominant force for one of them to succeed.

---

## Simulation Parameters

| Parameter | Value |
|---|---|
| Seed | 42 |
| Dataset | flexset |
| Starting tribes | 599 |
| Map tiles | 36,100 |
| Final tick | 2487 |
| First Empire | Tribe 220, tick ~287 (Council/Team) |
| Total War (mass opportunity trigger) | Tick 1860 (72 simultaneous declarations) |
| Great War scale | 72 declarations vs 55 in seed 7777 |
| Trilateral war | Tick 2400 (tribe_90 + tribe_596 vs tribe_557) |
| Tribe_557 eliminated | Tick 2424 (by tribe_596, attacker won) |
| Final duel begins | Tick 2424 |
| Winner | Tribe 596 |
| Winner polity | Empire / Warband / Combat |
| Winner final territory | 39,369 tiles |

---

## Screenshots Index

| File | Tick | Event |
|---|---|---|
| `fl-s42-tick287-firstempire.png` | 287 | First Empire (Tribe 220, Council/Team) — 513 alive |
| `fl-s42-tick500.png` | 500 | Mid-consolidation, Tribe 244 profile — 443 alive |
| `fl-s42-tick1000.png` | 1000 | Empire age, Tribe 453 profile — 234 alive |
| `fl-s42-tick1872-totalwar.png` | 1872 | Total War — 67 alive, 26 active wars |
| `fl-s42-tick2417-trilateralwar.png` | 2417 | Trilateral War — 3 alive, Tribe 90 profile |
| `fl-s42-tick2486-last2A.png` | 2486 | Final two — Tribe 90 (11,207 tiles, pop 19,366) |
| `fl-s42-tick2486-last2B.png` | 2486 | Final two — Tribe 596 (28,162 tiles, pop 233,960) |
| `fl-s42-tick2487-last.png` | 2487 | Tribe 596 wins — 39,369 tiles, sole survivor |
