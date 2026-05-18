# Chapter 1: The Bugged Run

**Log:** `f2-flexset-run.jsonl`
**Ticks:** 1200
**Verdict:** FAIL — 4 critical bugs found

---

## What We Saw

The first full F2 validation run looked bad. Really bad. 599 Flex cluster-derived tribes, 1200 ticks, 35,234 lines of JSONL. On paper it ran. In practice, the simulation was broken in ways that made the output nearly useless.

## The Numbers

| Metric | Value |
|---|---|
| Lines | 35,234 |
| Events | 35,219 |
| Tribes | 599 |
| Ticks | 1200 |
| Survived | 167 (28%) |
| Extinct | 432 (72%) |

The event log was lopsided: combat (46%), offspring (33%). Almost nothing else.

## Bug #1: The Dead Fitness Zone

For 900 ticks — three quarters of the entire run — fitness was 0.0. Flat zero. Not just low. Zero.

| Tick | avg_fitness | max_fitness |
|---|---|---|
| 1 | 0.0 | 0.0 |
| 100 | 0.0 | 0.0 |
| 500 | 0.0 | 0.0 |
| 900 | 0.0 | 0.0 |
| 1000 | 0.170 | 0.337 |
| 1200 | 0.172 | 0.337 (flat) |

The fitness function didn't compute anything until generation 1 fired at tick ~1000. Then it was basically flat — 0.170 to 0.172 in 200 ticks. No tribal differentiation.

## Bug #2: The Migration Collapse

At tick 1, 295 tribes were migrating. At tick 100, exactly 1. The `migration_drive` NN output apparently never fired, meaning tribes settled once and never moved again. The map froze.

Combined with this:

| Tick range | Tile claims |
|---|---|
| 0-199 | 818 |
| 200-399 | 25 |
| 400-599 | 6 |
| 600-799 | 1 |

Territory expansion died after tick 200. Tribes claimed their starting tile and sat.

## Bug #3: The Extinction Avalanche

Nothing happened for 700 ticks. Zero deaths. Then in 100 ticks (800-899), 219 tribes died. Another 138 in the next 100. A cliff edge, not a gradual winnowing.

The checkpoint timeline tells the story:

| Tick | Alive | Extinct | Notes |
|---|---|---|---|
| 1 | 599 | 0 | Everything fine |
| 700 | 575 | 24 | First deaths, drip rate |
| 800 | 569 | 30 | Still fine |
| 900 | 365 | 234 | **219 died in 100 ticks** |
| 1000 | 230 | 369 | Another 138 gone |
| 1200 | 167 | 432 | Survivors only 28% |

## Bug #4: Polity Stagnation

Only 30 polity upgrades across 599 tribes and 1200 ticks. Almost no one advanced past "Tribe" tier. 56 mergers total — negligible consolidation.

## The Wrong Conclusion

We also made a parsing error that gave a false alarm. We read `event.value_a` as the NN output index and concluded that 4 of 7 outputs never fired. The actual distribution we saw:

| value_a | Label (wrongly assumed) | Count | % |
|---|---|---|---|
| 0 | aggression | 1271 | 55.5% |
| 2 | goal_drive | 942 | 41.2% |
| 6 | expansion_speed | 61 | 2.7% |
| 5 | isolation | 11 | 0.5% |
| 1 | resource_drive | 3 | 0.1% |
| 4 | raid_drive | 1 | 0.04% |
| 3 | migration_drive | 0 | **0%** |

Four outputs at zero or near-zero. Migration drive = 0. This seemed like a catastrophic NN initialization bug.

Except it wasn't. `value_a` is the **old behavior state ID**, not the NN output. We didn't know that yet.

## Verdict

F2 Full Run Validation: **FAIL**

Four real bugs:
1. Fitness function not computing before generation boundary
2. Migration/movement subsystem stuck
3. Territory expansion halting
4. Polity advancement broken

Plus one false alarm that would cost us time chasing the wrong fix.

## What We Recommended

1. Fix NN output diversity (wrong target — but we didn't know that yet)
2. Fix fitness function (correct target)
3. Fix territory/migration loop (correct target)
4. Change checkpoint metrics to include behavioral diversity

---

*Next: [Chapter 2 — The Smoke Test and the Parsing Error](chapter-2-smoke-wrong-schema.md)*
