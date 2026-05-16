# First Complete Simulation Run — 2026-05-16

## Overview

The first ever complete Tribal NeuroSim v3 simulation finished on 2026-05-16 after approximately three weeks of development. A 599-tribe simulation ran for **1,707 ticks** before a single tribe achieved planetary dominance.

**Winner:** Tribe 270 — `Empire` tier — 6,396 tiles — population 1,116,667

---

## Run Parameters

| Parameter | Value |
|---|---|
| Tribe count | 599 |
| Map size | 190 × 190 tiles |
| Seed clusters | Real flexset League of Legends player clusters |
| World seed | 42 |
| Architecture | Rust backend (E1 88-byte tribe records) + C# MonoGame client |
| Backend mode | Docker container (neurosim service) |

---

## Timeline

### Tick 430 — Early Consolidation

- **121 tribes** alive (from 599 start — 478 already eliminated)
- Polity spread: T:58 C:2 D:11 K:9 E:41
- **365 active wars** — intense multi-front conflict
- Tribe 270 position: 110 tiles, fitness 0.38, dominant drive: **Isolation**

At this stage the map showed a mosaic of colored territories. 41 Empire-tier polities had already formed, contesting large swaths of land. The Isolation drive of Tribe 270 kept it from early wars while it grew its base.

### Tick 853 — Late Consolidation

- **36 tribes** alive
- Polity spread: T:2 D:1 K:2 E:31
- **440 active wars** — peak war intensity
- Tribe 270 position: 215 tiles, fitness 0.49, still Isolation-dominant

85% of tribes eliminated. The map showed a small number of massive empires. The neutral (unclaimed) territory grew as empires collapsed from starvation without territory transfer to conquerors — a known bug at time of run.

### Tick 1707 — Victory

- **1 tribe** alive: Tribe 270
- **6,396 tiles** (17.7% of total 36,100 tile map; remainder was neutral at end)
- Population: **1,116,667**
- Food stores: **1,023,087**
- Fitness score: **0.60**
- Final polity: **Empire**
- Dominant neural drives: **Isolation (0.87)**, Resource (0.86), Raid (0.63)

---

## Winner Profile — Tribe 270

| Metric | Value |
|---|---|
| Polity tier | Empire |
| Final territory | 6,396 tiles |
| Final population | 1,116,667 |
| Final food stores | 1,023,087 |
| Fitness score | 0.60 |
| Ticks alive | 1,707 |

**Neural drive signature:** High Isolation + Resource combination suggests a defensive-expansionist strategy: secure food before initiating wars, resist alliance formation, expand methodically rather than through early aggression.

---

## Total Wars Declared

489+ wars were declared across the full run (365 at tick 430, 440 at tick 853, likely declining to zero by tick 1707).

---

## Bugs Observed During Run

The following bugs were identified and fixed after this run:

| Bug | Status |
|---|---|
| Territory not inherited at conquest/extinction — tiles went neutral instead of to conqueror | Fixed (territory inheritance in `cleanup_tribe`) |
| Empires randomly disappearing despite food surplus — starvation cascade at war (no food gathering while AtWar) | Fixed (AtWar tribes now gather food at 50% rate) |
| Artifacts starting maxed at 0.99–1.00 — real DB cluster profiles have high scores, no diversity | Fixed (per-stat random scaling at initialization) |
| All tribes showing "Warband" — uniform high a_combat from cluster profiles | Fixed by artifact diversity fix above |
| Terrain textures requiring camera distance ≤ 900f — too conservative | Fixed (threshold raised to 2300f) |
| Tombstone ledger showing no founder players — founder PUUIDs not propagated to display | Fixed (Rust TombstoneRecord now includes founder PUUIDs, proxied to C# panel) |
| Diagnostic logging in FrameDecoder.cs and GameRoot.cs (added during E1 investigation) | Removed |

---

## Significance

This run is the proof of concept for the thesis claim that genetic-neural simulation seeded from real League of Legends player cluster profiles (the Premade Graph / flexset dataset) produces emergent tribal civilizations that reflect player behavioral signatures. The winning tribe's neural drive profile (high Isolation + Resource) corresponds to a cluster strategy that prioritizes self-sufficiency over team coordination — directly mapping back to the graph-analytics interpretation of that player cluster in the Premade Graph dataset.

The connection between a real flexset player cluster and the victorious simulated civilization is the central thesis-facing artifact of the Genetic NeuroSim component.
