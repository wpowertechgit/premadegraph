# Flexset Run — Seed 7777 — Narrative Record

**Dataset:** flexset (EUNE Master+ Flex Queue)  
**Seed:** 7777  
**Starting tribes:** 599  
**Final tick:** 2538  
**Winner:** Tribe 355 (Empire / Warband / Combat)  
**Run date:** 2026-06-07

---

## Overview

599 tribes seeded from EUNE Master+ flex queue player-cluster profiles competed on a 36,100-tile terrain map. The simulation ran 2,538 ticks before a single survivor remained. The winner, Tribe 355, emerged from the middle tier of the field — never the largest empire at any checkpoint — and ground through the final stages by combining high combat fitness with disciplined, opportunistic raiding rather than reckless aggression.

---

## Phase 1 — Tribal Proliferation (Ticks 0–264)

At tick 50, all 599 tribes were alive, holding 1,814 tiles total with an average population of 311 and zero active wars. The map was fragmented into small, isolated clusters mirroring the community structure of the underlying flex queue graph.

The first war erupted at tick 81. By tick 100, four tribes had already been eliminated. The pace accelerated rapidly: wars became simultaneous and reciprocal, with neighboring pairs declaring on each other in the same tick. The first SURROUNDED event fired at tick 150 (tribe_211 breaking out against tribe_161), indicating border pressure was already acute at the edges of growing polities.

At tick 150, 562 tribes remained. Polity composition: 381 Tribes, 160 Cities, 21 Duchies — Cities had emerged en masse but Kingdoms were still absent. Average population had grown to 827.

By tick 264, the first Empire appeared. The screenshot captures Tribe 372 — a Pathfinders/MapObjective entity with population 15,820, fitness 0.35, 50-tile territory, and a migration drive of 0.88. It was tiny. 516 tribes were still alive. The Empire tier was a curiosity at this point, not a dominance signal.

---

## Phase 2 — Consolidation Wars (Ticks 264–900)

The 300-tick mark marked a structural shift. Seven Empires existed alongside 54 Kingdoms and 107 Duchies. Ten wars were active simultaneously. Average population hit 2,747 per tribe — entities were now large enough that wars had real territorial stakes.

The log shows a war cadence: medium-tier tribes (Duchies, Kingdoms) repeatedly declared on neighbors, lost, and got absorbed. Defensively strong entities — those that survived being attacked — accumulated territory passively while aggressive tribes occasionally overextended and died. Notable pattern: mutual declarations (both sides declare simultaneously) were common and often ended in the defender winning, suggesting the simulation's balance slightly favored entrenched positions.

Tribe 355 appears in the log first at tick 1155, attacking Tribe 353 and winning (tick 1161). By this point it was already a Kingdom or Empire-tier entity with enough strength to press outward. Earlier in the middle phase, multiple tribes tried to knock it out: Tribe 281 declared war at tick 1458 and lost; Tribe 480 at tick 1600 and lost; Tribe 504 at tick 1859 and lost; Tribe 530 at tick 1920 (opportunity war) and lost. Tribe 355 consistently won defensive engagements.

At tick 900, 310 tribes remained. Between ticks 900 and 950, **85 tribes were eliminated in 50 ticks** — the single fastest extinction pulse in the run. Alliance counts dropped from 116 to 50 in that window, suggesting that a cascade of alliance breaks triggered a wave of simultaneous wars that swept out dozens of weakened mid-tier polities at once.

At tick 950: 225 alive, polity breakdown now 37 Tribes / 5 Cities / 13 Duchy / 54 Kingdom / 116 Empire. The simulation had reached true Empire age.

---

## Phase 3 — Empire Wars (Ticks 900–1800)

From tick 1000 onward, the map was an Empire-on-Empire contest. The 205 survivors at tick 1000 held an average population of 28,232. By tick 1500, 125 tribes remained with a max territory of 1,015 tiles and average population of 65,978.

The last raw Tribe-tier entity vanished somewhere around tick 1500 (at tick 1500: exactly 1 Tribe-tier left). From this point every entity on the map was a City or above — realistically, all meaningful actors were Empires.

Tribe 372, the first Empire seen at tick 264, continued fighting throughout this phase. It survived attacks from tribe_347 (tick 1021, defended), tribe_423 (tick 1063, defended), tribe_370 (tick 1122, defended), tribe_396 (tick 1142, defended). But at tick 1615 it overextended and declared war on Tribe 421 — and lost (tick 1662, defeated as attacker). The first Empire died as an aggressor.

---

## Phase 4 — Total War (Ticks 2040–2250)

At tick 2040, the simulation hit a critical mass threshold: **55 simultaneous opportunity war declarations fired in a single tick**. This was the Great War — every remaining Empire had enough tension with its neighbors that the opportunity check triggered across the board at once.

At tick 2043: 68 alive, 32 active wars, all Empires. The map at this point (see `fl-s7777-tick2043-totalwar.png`) shows the world painted in large territorial blobs — no more small patches — with borders under pressure everywhere.

The cascade was rapid:
- Tick 2050: 63 alive, 27 wars
- Tick 2100: 43 alive, 20 wars  
- Tick 2150: 33 alive
- Tick 2200: 20 alive
- Tick 2250: 13 alive

By tick 2250, only 13 entities remained on a near-fully-claimed 26,994-tile map. Average population per entity: 326,138. These were not tribes anymore — they were civilizations consuming the remnants of a world.

---

## Phase 5 — Final Two (Ticks 2350–2538)

At tick 2346, Tribe 355 eliminated Tribe 257 (a repeated rival). At the same tick, Tribe 470 eliminated Tribe 465. Two entities — one Warband, one Pathfinder — now stood alone.

**At tick 2497, two tribes remained** (screenshots `fl-s7777-tick2497-last2A.png` and `fl-s7777-tick2497-last2B.png`):

| | Tribe 355 | Tribe 470 |
|---|---|---|
| Behavior | Warband | Pathfinders |
| Focus | Combat | MapObjective |
| Population | 2,510,325 | 1,848,421 |
| Territory | 21,751 tiles | 7,956 tiles |
| Fitness | 0.63 | 0.55 |
| A_Combat | 0.98 | 0.85 |
| A_Resource | 0.87 | 0.67 |
| A_MapObj | 0.76 | 0.98 |
| A_Risk | 0.67 | 0.71 |
| A_Team | 0.83 | 0.69 |
| Raid drive | 0.83 | 0.21 |
| Migration drive | 0.88 | 0.81 |
| Aggression drive | 0.19 | 0.18 |

Tribe 355 held nearly 3× the territory of Tribe 470 at this point. The outcome was already determined. Tribe 470 was a Pathfinder — optimized for map coverage and objective control — but it had been outpaced territorially in the final consolidation phase.

At tick 2520, Tribe 355 registered a raid-opportunity against Tribe 470 (raid=0.84). At **tick 2538**, Tribe 355 attacked and won.

Final state of Tribe 355 at victory (tick 2538, `fl-s7777-tick2538-last.png`):
- Population: 1,187,885 (contracted from the war)
- Food reserves: 3,504,309
- Territory: **37,666 tiles** (essentially the entire map)
- Fitness: 0.61

---

## Why Tribe 355 Won

Tribe 355 was not the most aggressive entity in the simulation. Its aggression drive was 0.19 — near the floor. What distinguished it:

1. **Combat artifacts were maxed (0.98).** It accumulated the highest possible combat experience across 2,538 ticks of warfare. Every war it fought, won or survived, made it harder to kill.

2. **High raid drive (0.83–0.84) with low aggression (0.19).** It did not pick fights recklessly. It struck when the opportunity score crossed threshold — meaning it hit weakened targets, not entrenched ones. Across the log, every major tribe that declared war on Tribe 355 in the 900–2000 range lost. It was never successfully attacked.

3. **High migration (0.88).** It settled and expanded efficiently, maintaining food/population balance while spreading across the map. By tick 2497 its 21,751-tile territory was 2.7× its rival's.

4. **Warband polity behavior** matches a combat-specialized group that accumulates battlefield competence without over-committing to social diplomacy (low team=0.83) or geographic overreach (moderate map-objective score of 0.76).

The Warband behavior pattern — rooted in the flex queue cluster data — reflected the cooperative combat dynamics of high-level organized play: coordinated enough to win, but not built around peaceful negotiation.

---

## Simulation Parameters

| Parameter | Value |
|---|---|
| Seed | 7777 |
| Dataset | flexset |
| Starting tribes | 599 |
| Map tiles | 36,100 |
| Final tick | 2538 |
| Total wars logged | ~350+ (individual declarations) |
| Peak simultaneous wars | 32 (tick 2043) |
| First empire | Tribe 372, tick ~264 |
| Last tribe-tier entity | Tick ~1500 |
| Great War (mass opportunity trigger) | Tick 2040 |
| Winner | Tribe 355 |
| Winner polity | Empire / Warband / Combat |
| Winner final territory | 37,666 tiles |

---

## Screenshots Index

| File | Tick | Event |
|---|---|---|
| `fl-s7777-tick264-firstempire.png` | 264 | First Empire (Tribe 372) — 516 alive |
| `fl-s7777-tick500.png` | 501 | Mid-consolidation overview — 455 alive |
| `fl-s7777-tick1000.png` | 1000 | Empire age begins in earnest — 205 alive |
| `fl-s7777-tick2043-totalwar.png` | 2043 | Total War — 68 alive, 32 active wars |
| `fl-s7777-tick2497-last2A.png` | 2497 | Final two — Tribe 355 profile |
| `fl-s7777-tick2497-last2B.png` | 2497 | Final two — Tribe 470 profile |
| `fl-s7777-tick2538-last.png` | 2538 | Tribe 355 wins — 37,666 tiles, sole survivor |
