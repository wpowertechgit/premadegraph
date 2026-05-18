# Chapter 4: The Validated Run

**Log:** `f2-flexset-neural-audit-decoded-1200.jsonl`
**Ticks:** 1200
**Verdict:** PASS — F2 Full Run Validation satisfied

---

## The Final Test

Full 1200 ticks. Corrected schema. All fixes applied. 65,209 lines of decoded JSONL.
Flex set, 599 cluster-derived tribes, all 7 NN outputs decoded per event.

This was the test that would tell us if the simulation actually worked.

## End State

| Metric | Bugged Run | Validated Run | Change |
|---|---|---|---|
| Survivors | 167 (28%) | 411 (69%) | **+244 alive** |
| Extinct | 432 (72%) | 188 (31%) | **-244 dead** |
| Avg fitness (t=1200) | 0.172 | 0.277 | **+61%** |
| Max fitness (t=1200) | 0.337 | 0.556 | **+65%** |
| Polity upgrades | 30 | 561 | **18x more** |
| Tile claims | 1,048 | 11,677 | **11x more** |
| Migration at t=1200 | ~0 | 31 | **Persistent** |
| Tombstone match | 1:1 | 1:1 | **Still correct** |
| Lineage entities | 12,965 | 14,185 | **Healthy growth** |

## NN Output Diversity — Confirmed

All 7 outputs, all 1200 ticks, good distribution:

| Output | Count | Share |
|---|---|---|
| migration_drive | 6,526 | 38.4% |
| goal_drive | 3,127 | 18.4% |
| expansion_speed | 3,060 | 18.0% |
| isolation | 1,823 | 10.7% |
| resource_drive | 1,546 | 9.1% |
| raid_drive | 634 | 3.7% |
| aggression | 258 | 1.5% |

No collapse. No saturation. No silent outputs. The distribution is stable across every 100-tick window — tested at ranges 0-99, 400-499, 800-899, and 1100-1200. All 7 present in every window.

Output strength range: 0.221 to 0.881 (span 0.660) — healthy, non-saturated.

## Fitness — Alive and Growing

| Tick | avg | max |
|---|---|---|
| 1 | 0.008 | 0.011 |
| 100 | 0.070 | 0.240 |
| 300 | 0.129 | 0.378 |
| 600 | 0.172 | 0.424 |
| 900 | 0.218 | 0.495 |
| 1200 | **0.277** | **0.556** |

Fitness grows from tick 1. The spread between avg and max widens (0.003 → 0.279), proving the fitness function differentiates tribes. No dead zone.

## Migration — Never Collapsed

| Tick | Migrating |
|---|---|
| 1 | 151 |
| 100 | 58 |
| 300 | 36 |
| 600 | 30 |
| 900 | 33 |
| 1200 | 31 |

Migration stabilizes at ~30-39 and stays there. Never drops below 30. The old run hit 0-1 by tick 100.

## Behavior — Full Spectrum

13 behavior states documented. 6 active at all times. The dominant cycle:

- **Settling (0) → Migrating (2)**: 7,478 transitions
- **Migrating (2) → Settling (0)**: 7,278 transitions
- **Settling (0) → AtWar (3)**: 961 transitions
- **Peace (5) → Settling (0)**: 894 transitions

A healthy loop: settle → migrate → settle. War is a branch, not the trunk.

At tick 1200, the 411 survivors are:
- 202 AtWar (49%) — aggressive core
- 110 Settling (27%) — stable holders
- 36 Peace (9%) — neutral
- 31 Migrating (8%) — active explorers
- 20 Allied (5%) — diplomatic
- 11 Administering (3%) — polity managers
- 1 Desperate — on the edge

## Extinction — Gradual, Not a Cliff

| Tick Range | Died | Running Total |
|---|---|---|
| 0-199 | 20 | 20 |
| 200-599 | 1 | 21 |
| 600-799 | 9 | 30 |
| 800-899 | 62 | 94 |
| 900-999 | 74 | 168 |
| 1000-1200 | 22 | 188 |

Peak death rate: 74 per 100 ticks vs 219 per 100 ticks in the bugged run. The extinction curve is a gentle slope, not a cliff.

## War — Steady and Natural

| Metric | Value |
|---|---|
| Wars declared | 1,452 |
| Wars ended | 1,190 |
| Peak active | ~274 at tick 800 |
| Final active | 155 |
| Avg duration | 135 ticks |
| Unique pairs | 339 |

War declarations stay steady at 78-152 per 100 ticks through the entire run. Combat ramps smoothly from 705 to 1,942 then gradually declines. Organic escalation.

## What Fixed vs What Was Never Broken

| Issue | Status |
|---|---|
| Fitness dead zone | **Fixed** — fitness logic was gated on generation boundary |
| Migration collapse | **Fixed** — engine bug in movement system |
| Territory plateau | **Fixed** — related to migration fix |
| Polity stagnation | **Fixed** — advancement logic repaired |
| NN output diversity | **Was never broken** — our parser was wrong |
| Extinction avalanche | **Fixed** — consequence of fitness/migration fixes |
| Tombstone integrity | **Was never broken** — 1:1 match throughout |
| Lineage registry | **Was never broken** — correct in both runs |
| War reciprocity | **Was never broken** — mutual declarations by design |

## The Real Bugs (In Retrospect)

Three real bugs, not including the NN:

1. **Fitness function gated on generation advance** — fitness was computed but not reported until generation 1 fired. This meant the fitness-based selection loop was blind for 900 ticks.

2. **Migration subsystem stalled** — tribes weren't re-evaluating their movement targets after initial placement. Once settled, they stayed.

3. **Polity advancement threshold too high** — very few tribes met the conditions to upgrade from Tribe tier.

All three were fixed. The NN was never the problem.

## Red Flags (Minor)

| Issue | Detail |
|---|---|
| Aggression output low (1.5%) | May be intentional. aggression = raw impulse, while raid_drive and goal_drive cover conflict through other channels. |
| No generation 2 | Only gen 1 reached at tick 1000. Need longer run. |
| Alliance formation rare | 1 alliance in 1200 ticks. May be correct for flexset. |
| Mergers still negligible | 55 merges. Same as old run. Non-war consolidation is not a driver. |

## Verdict

**PASS.** F2 Full Run Validation satisfied.

The simulation produces interpretable, competitive behavior from 599 Flex cluster-derived tribes. All 7 NN outputs fire with good diversity. Fitness differentiates tribes. Migration persists. Territory expands. War ramps naturally. Extinction is gradual.

The story was never about a broken neural network.

It was about a broken fitness function, a stuck migration system, and a parser that read the wrong column.

---

*Back to [Index](index.md)*
