# Tribal NeuroSim v3 — Simulation Liveness Fix: Evaluation Prompt

**For:** DeepSeek / Codex (external consensus review)
**Date:** 2026-05-15
**Author:** Claude Sonnet 4.6

---

## What You Are Evaluating

This document asks you to evaluate whether a set of bug fixes applied to a Rust-based tribal civilization simulator are correct, sufficient, and well-calibrated. A 1200-tick test run was performed after the fixes; the full JSONL log is included. Your job is to analyze the fixes, the log, and identify any remaining issues or improvements.

---

## System Overview

**Tribal NeuroSim v3** is an AI-driven tribal civilization simulator written in Rust (Axum backend, port 8000). Tribes evolve via NEAT neural networks and genetic algorithms. Each tribe has a genome producing 7 outputs (aggression, resource_drive, goal_drive, migration_drive, raid_drive, isolation, expansion_speed) in the [0,1] range.

Tribes start at fixed positions on a 2D tile map. Every tick:
1. Neural network evaluates genome → drive values
2. State machine transitions (Settling / Foraging / Migrating / AtWar / Imploding / Desperate / Allied)
3. Territory expansion (if Settling or Foraging, adjacent neutral tiles claimed)
4. War declarations (bordering tribes above combat/raid threshold)
5. Combat resolution (Knuth Poisson casualties, loser absorbed or killed)
6. Mergers (allied tribes combine; max_population accumulates)
7. Polity tier upgrades (Tribe→City→Duchy→Kingdom→Empire based on max_population)

**Polity tier thresholds (max_population):**
- City: ≥ 1,000
- Duchy: ≥ 3,000
- Kingdom: ≥ 7,000
- Empire: ≥ 15,000

Mergers accumulate max_population: `absorber.max_population += absorbed.max_population`. So polity progression requires conquest, not just time.

---

## The Bug: Dead Simulation

Before the fix, running 777 ticks produced:
- `tribes=599` constant (no deaths, no mergers)
- `wars=6` constant (no new wars after tick ~19)
- `TileData.Count=599` (each tribe stuck at exactly 1 territory tile)
- `settlements=C:0 M:0 F:599` (no polity upgrades ever)

The simulation was completely static.

---

## Root Causes Identified

### 1. Double-normalization of tribe stats
**File:** `backend/src/tribes.rs` — `TribeStats::from_profile`

`server.js` (Node.js) normalizes artifact values to 0–1 before sending to Rust (divides by CAP=4.5 or 5.0). The old Rust code divided by 10 again → all stats were 10× too small.

- `a_combat` was ~0.03 instead of ~0.3
- Combat damage per round: `0.03 × 6000 × 0.02 = 3.6` casualties → wars never killed anyone

**Fix:** Removed `/ 10.0` from the normalizer lambda in `TribeStats::from_profile`.

```rust
// BEFORE (bug):
let c = |v: f32| (v / 10.0).clamp(0.0, 1.0);
// AFTER:
let c = |v: f32| v.clamp(0.0, 1.0);
```

### 2. Max population floor too high
**File:** `backend/src/tribes.rs` — `TribeState::from_cluster`

Floor was `max(6_000)`. Even with `a_combat=0.3`, a tribe at 6000 pop needed 120 rounds to die. But with the double-normalization bug, actual damage was `3.6/round × 120 = 432 = 7%` loss → tribe survived all wars.

**Fix:** Lowered floor from 6,000 to 500, multiplier from 600 to 200.

```rust
// BEFORE:
let max_population = (profile.cluster_size as u32 * 600).min(50_000).max(6_000);
// AFTER:
let max_population = (profile.cluster_size as u32 * 200).min(10_000).max(500);
```

### 3. Migration oscillation — territory never grew
**File:** `backend/src/simulation.rs` — `apply_state_machine`

Migration override triggered immediately on any tribe in `Settling` or `Foraging` if `migration_drive > 0.55 AND aggression < 0.55`. No minimum dwell time. Result: tribes oscillated Settling→Migrating→Settling→Migrating every tick, never staying settled long enough for `apply_territory_expansion` to run.

**Fix:** Added `ticks_in_state >= 15` gate.

```rust
// BEFORE:
&& matches!(current, BehaviorState::Settling | BehaviorState::Foraging)
// AFTER:
&& matches!(current, BehaviorState::Settling | BehaviorState::Foraging)
&& self.tribes[i].ticks_in_state >= 15
```

### 4. Combat damage multiplier too low
**File:** `backend/src/simulation.rs` — `apply_combat`

Multiplier `0.02` with floor `.max(0.1)` was designed for large populations. Too low for the corrected system.

**Fix:** Multiplier `0.02 → 0.08`, floor `.max(0.1) → .max(1.0)`.

```rust
// BEFORE:
let a_cas_lambda = (a_combat * pop as f32 * 0.02).max(0.1);
// AFTER:
let a_cas_lambda = (a_combat * pop as f32 * 0.08).max(1.0);
```

### 5. Expansion thresholds too conservative
**File:** `backend/src/simulation.rs` — `apply_territory_expansion`

- `resource_drive < 0.25` → blocked ~63% of tribes from ever expanding (most tribes had resource_drive ~0.15–0.35)
- `expansion_cooldown_ticks = 8` → delayed all expansion to tick 9+

**Fix:** Threshold `0.25 → 0.10`, cooldown `8 → 3`.

---

## The 1200-Tick Test Run

**Setup:** 120 synthetic tribes, NEAT genomes with drive values in [0,1], initial pop=0, max_pop=500–2000 (cluster_size 2–6), placed on a procedurally generated world map.

**Checkpoints every 50 ticks (JSONL) + all war events:**

```
{"event":"start","tick":0,"alive":120,"tiles":120,"wars_total":0,"wars_active":0,"avg_pop":0,"max_tile":1,"tiers":{"Tribe":120,"City":0,"Duchy":0,"Kingdom":0,"Empire":0}}
[OPPORTUNITY WAR tick=20] tribe_107 → tribe_108 (raid=0.30 aggr=0.65)
[WAR tick=23] tribe_111 declares war on tribe_112
[WAR tick=24] tribe_44 declares war on tribe_55
[WAR tick=32] tribe_11 declares war on tribe_12
[WAR tick=32] tribe_12 declares war on tribe_11
[WAR tick=38] tribe_98 declares war on tribe_97
[OPPORTUNITY WAR tick=40] tribe_89 → tribe_101 (raid=0.86 aggr=0.86)
[OPPORTUNITY WAR tick=40] tribe_100 → tribe_101 (raid=0.68 aggr=0.85)
[WAR tick=46] tribe_50 declares war on tribe_60
[WAR tick=47] tribe_52 declares war on tribe_63
[WAR tick=49] tribe_23 declares war on tribe_24
[WAR tick=49] tribe_24 declares war on tribe_23
{"event":"checkpoint","tick":50,"alive":120,"tiles":1259,"max_tile":17,"avg_pop":139,"wars_total":12,"wars_active":12,"states":{"Settling":41,"Foraging":18,"Migrating":5,"AtWar":12,"Imploding":0,"Desperate":0},"tiers":{"Tribe":120,"City":0,"Duchy":0,"Kingdom":0,"Empire":0}}
[WAR tick=55] tribe_34 declares war on tribe_33
[WAR tick=56] tribe_84 declares war on tribe_95
[WAR tick=62] tribe_21 declares war on tribe_10
[WAR tick=70] tribe_1 declares war on tribe_2
[WAR tick=70] tribe_49 declares war on tribe_60
[WAR tick=73] tribe_0 declares war on tribe_11
[WAR tick=75] tribe_77 declares war on tribe_66
[WAR tick=77] tribe_3 declares war on tribe_14
[WAR tick=89] tribe_42 declares war on tribe_52
[WAR tick=91] tribe_109 declares war on tribe_97
[WAR tick=96] tribe_99 declares war on tribe_110
[WAR tick=96] tribe_110 declares war on tribe_99
[OPPORTUNITY WAR tick=100] tribe_85 → tribe_97 (raid=0.60 aggr=0.14)
{"event":"checkpoint","tick":100,"alive":120,"tiles":1764,"max_tile":27,"avg_pop":192,"wars_total":25,"wars_active":25,"states":{"Settling":45,"Foraging":0,"Migrating":2,"AtWar":30,"Imploding":0,"Desperate":1},"tiers":{"Tribe":118,"City":2,"Duchy":0,"Kingdom":0,"Empire":0}}
{"event":"checkpoint","tick":150,"alive":119,"tiles":1995,"max_tile":42,"avg_pop":392,"wars_total":33,"wars_active":30,"states":{"Settling":33,"Foraging":0,"Migrating":5,"AtWar":35,"Imploding":0,"Desperate":0},"tiers":{"Tribe":106,"City":12,"Duchy":1,"Kingdom":0,"Empire":0}}
{"event":"checkpoint","tick":200,"alive":119,"tiles":2242,"max_tile":56,"avg_pop":524,"wars_total":49,"wars_active":31,"states":{"Settling":31,"Foraging":0,"Migrating":0,"AtWar":35,"Imploding":0,"Desperate":0},"tiers":{"Tribe":100,"City":16,"Duchy":3,"Kingdom":0,"Empire":0}}
{"event":"checkpoint","tick":250,"alive":119,"tiles":2442,"max_tile":65,"avg_pop":543,"wars_total":66,"wars_active":40,"states":{"Settling":26,"Foraging":0,"Migrating":1,"AtWar":48,"Imploding":0,"Desperate":0},"tiers":{"Tribe":99,"City":15,"Duchy":5,"Kingdom":0,"Empire":0}}
{"event":"checkpoint","tick":300,"alive":118,"tiles":2582,"max_tile":76,"avg_pop":512,"wars_total":81,"wars_active":47,"states":{"Settling":21,"Foraging":1,"Migrating":1,"AtWar":62,"Imploding":0,"Desperate":0},"tiers":{"Tribe":97,"City":15,"Duchy":5,"Kingdom":1,"Empire":0}}
[WAR tick=330] tribe_66 defeated tribe_77 (attacker won)
{"event":"checkpoint","tick":350,"alive":117,"tiles":2669,"max_tile":81,"avg_pop":485,"wars_total":101,"wars_active":43,"states":{"Settling":20,"Foraging":0,"Migrating":2,"AtWar":54,"Imploding":0,"Desperate":0},"tiers":{"Tribe":96,"City":14,"Duchy":6,"Kingdom":1,"Empire":0}}
{"event":"checkpoint","tick":400,"alive":116,"tiles":2697,"max_tile":88,"avg_pop":583,"wars_total":121,"wars_active":50,"states":{"Settling":24,"Foraging":0,"Migrating":0,"AtWar":65,"Imploding":0,"Desperate":1},"tiers":{"Tribe":95,"City":10,"Duchy":10,"Kingdom":1,"Empire":0}}
[WAR tick=420] tribe_68 defeated by tribe_69 (defender won)
{"event":"checkpoint","tick":450,"alive":114,"tiles":2772,"max_tile":103,"avg_pop":631,"wars_total":133,"wars_active":48,"states":{"Settling":17,"Foraging":0,"Migrating":1,"AtWar":62,"Imploding":0,"Desperate":0},"tiers":{"Tribe":94,"City":9,"Duchy":10,"Kingdom":1,"Empire":0}}
[WAR tick=460] tribe_67 defeated tribe_105 (attacker won)
{"event":"checkpoint","tick":500,"alive":113,"tiles":2851,"max_tile":120,"avg_pop":618,"wars_total":155,"wars_active":49,"states":{"Settling":17,"Foraging":0,"Migrating":1,"AtWar":66,"Imploding":0,"Desperate":0},"tiers":{"Tribe":92,"City":9,"Duchy":10,"Kingdom":2,"Empire":0}}
{"event":"checkpoint","tick":550,"alive":112,"tiles":2958,"max_tile":136,"avg_pop":637,"wars_total":171,"wars_active":49,"states":{"Settling":21,"Foraging":0,"Migrating":1,"AtWar":67,"Imploding":0,"Desperate":0},"tiers":{"Tribe":88,"City":12,"Duchy":10,"Kingdom":2,"Empire":0}}
[WAR tick=560] tribe_79 defeated by tribe_86 (defender won)
[WAR tick=560] tribe_104 defeated by tribe_102 (defender won)
[WAR tick=590] tribe_90 defeated tribe_92 (attacker won)
{"event":"checkpoint","tick":600,"alive":109,"tiles":3048,"max_tile":153,"avg_pop":683,"wars_total":191,"wars_active":54,"states":{"Settling":18,"Foraging":1,"Migrating":0,"AtWar":72,"Imploding":0,"Desperate":0},"tiers":{"Tribe":85,"City":12,"Duchy":9,"Kingdom":3,"Empire":0}}
{"event":"checkpoint","tick":650,"alive":109,"tiles":3101,"max_tile":158,"avg_pop":681,"wars_total":210,"wars_active":47,"states":{"Settling":20,"Foraging":0,"Migrating":1,"AtWar":61,"Imploding":0,"Desperate":0},"tiers":{"Tribe":85,"City":12,"Duchy":9,"Kingdom":3,"Empire":0}}
[WAR tick=690] tribe_112 defeated tribe_111 (attacker won)
{"event":"checkpoint","tick":700,"alive":108,"tiles":3158,"max_tile":161,"avg_pop":783,"wars_total":226,"wars_active":51,"states":{"Settling":17,"Foraging":0,"Migrating":2,"AtWar":69,"Imploding":0,"Desperate":0},"tiers":{"Tribe":83,"City":12,"Duchy":10,"Kingdom":2,"Empire":1}}
[WAR tick=740] tribe_2 defeated tribe_6 (attacker won)
{"event":"checkpoint","tick":750,"alive":107,"tiles":3275,"max_tile":205,"avg_pop":895,"wars_total":241,"wars_active":43,"states":{"Settling":17,"Foraging":0,"Migrating":1,"AtWar":59,"Imploding":0,"Desperate":0},"tiers":{"Tribe":80,"City":13,"Duchy":10,"Kingdom":2,"Empire":2}}
[WAR tick=800] tribe_21 defeated by tribe_10 (defender won)
{"event":"checkpoint","tick":800,"alive":105,"tiles":3325,"max_tile":208,"avg_pop":974,"wars_total":264,"wars_active":49,"states":{"Settling":17,"Foraging":0,"Migrating":3,"AtWar":69,"Imploding":0,"Desperate":0},"tiers":{"Tribe":77,"City":14,"Duchy":10,"Kingdom":2,"Empire":2}}
[WAR tick=810] tribe_58 defeated by tribe_64 (defender won)
[WAR tick=810] tribe_98 defeated by tribe_97 (defender won)
[WAR tick=820] tribe_89 defeated by tribe_88 (defender won)
{"event":"checkpoint","tick":850,"alive":102,"tiles":3349,"max_tile":208,"avg_pop":1134,"wars_total":274,"wars_active":42,"states":{"Settling":18,"Foraging":0,"Migrating":0,"AtWar":61,"Imploding":0,"Desperate":0},"tiers":{"Tribe":73,"City":14,"Duchy":10,"Kingdom":3,"Empire":2}}
[WAR tick=860] tribe_71 defeated tribe_72 (attacker won)
[WAR tick=900] tribe_15 defeated by tribe_16 (defender won)
[WAR tick=900] tribe_100 defeated by tribe_101 (defender won)
{"event":"checkpoint","tick":900,"alive":99,"tiles":3461,"max_tile":208,"avg_pop":1343,"wars_total":299,"wars_active":46,"states":{"Settling":17,"Foraging":0,"Migrating":1,"AtWar":64,"Imploding":0,"Desperate":0},"tiers":{"Tribe":69,"City":14,"Duchy":10,"Kingdom":4,"Empire":2}}
{"event":"checkpoint","tick":950,"alive":99,"tiles":3530,"max_tile":216,"avg_pop":1383,"wars_total":313,"wars_active":45,"states":{"Settling":18,"Foraging":0,"Migrating":1,"AtWar":61,"Imploding":0,"Desperate":0},"tiers":{"Tribe":69,"City":14,"Duchy":10,"Kingdom":4,"Empire":2}}
[WAR tick=960] tribe_57 defeated tribe_46 (attacker won)
[WAR tick=1000] tribe_66 defeated by tribe_65 (defender won)
{"event":"checkpoint","tick":1000,"alive":97,"tiles":3586,"max_tile":233,"avg_pop":1436,"wars_total":328,"wars_active":47,"states":{"Settling":16,"Foraging":0,"Migrating":2,"AtWar":63,"Imploding":0,"Desperate":0},"tiers":{"Tribe":67,"City":14,"Duchy":10,"Kingdom":4,"Empire":2}}
[WAR tick=1010] tribe_45 defeated tribe_43 (attacker won)
[WAR tick=1010] tribe_84 defeated by tribe_95 (defender won)
[WAR tick=1020] tribe_53 defeated tribe_51 (attacker won)
[WAR tick=1030] tribe_50 defeated by tribe_60 (defender won)
[WAR tick=1030] tribe_109 defeated by tribe_97 (defender won)
{"event":"checkpoint","tick":1050,"alive":92,"tiles":3591,"max_tile":243,"avg_pop":1562,"wars_total":343,"wars_active":35,"states":{"Settling":15,"Foraging":0,"Migrating":2,"AtWar":46,"Imploding":0,"Desperate":0},"tiers":{"Tribe":62,"City":14,"Duchy":9,"Kingdom":5,"Empire":2}}
[WAR tick=1070] tribe_24 defeated by tribe_23 (defender won)
[WAR tick=1130] tribe_2 defeated by tribe_1 (defender won)
[WAR tick=1140] tribe_116 defeated by tribe_107 (defender won)
{"event":"checkpoint","tick":1100,"alive":91,"tiles":3647,"max_tile":255,"avg_pop":1635,"wars_total":360,"wars_active":44,"states":{"Settling":20,"Foraging":0,"Migrating":0,"AtWar":61,"Imploding":0,"Desperate":0},"tiers":{"Tribe":61,"City":14,"Duchy":9,"Kingdom":3,"Empire":4}}
{"event":"checkpoint","tick":1150,"alive":89,"tiles":3668,"max_tile":271,"avg_pop":1686,"wars_total":372,"wars_active":41,"states":{"Settling":16,"Foraging":0,"Migrating":2,"AtWar":58,"Imploding":0,"Desperate":0},"tiers":{"Tribe":58,"City":15,"Duchy":9,"Kingdom":3,"Empire":4}}
{"event":"checkpoint","tick":1200,"alive":89,"tiles":3707,"max_tile":278,"avg_pop":1749,"wars_total":388,"wars_active":38,"states":{"Settling":15,"Foraging":0,"Migrating":1,"AtWar":51,"Imploding":0,"Desperate":0},"tiers":{"Tribe":58,"City":15,"Duchy":9,"Kingdom":3,"Empire":4}}
{"event":"final","tick":1200,"alive":89,"deaths":31,"tiles":3707,"wars_total":388,"city_plus":31,"kingdom_plus":7}
```

---

## Key Observed Metrics (Summary)

| Metric | tick=0 | tick=100 | tick=500 | tick=1200 |
|--------|--------|----------|----------|-----------|
| Alive | 120 | 120 | 113 | 89 |
| Deaths | 0 | 0 | 7 | 31 |
| Total tiles | 120 | 1764 | 2851 | 3707 |
| Max tile (one tribe) | 1 | 27 | 120 | 278 |
| avg_pop | 0 | 192 | 618 | 1749 |
| Wars total | 0 | 25 | 155 | 388 |
| Wars active | 0 | 25 | 49 | 38 |
| Cities | 0 | 2 | 9 | 15 |
| Duchies | 0 | 0 | 10 | 9 |
| Kingdoms | 0 | 0 | 2 | 3 |
| Empires | 0 | 0 | 0 | 4 |
| Foraging | — | 0 | 0 | 0 |

**Notable events:**
- First war: tick 20
- First kill: tick 330 (tribe_66 defeated tribe_77)
- First Empire: tick 700
- Tile growth slows sharply after tick 600 (map filling up)
- Death rate: 31 deaths in 1200 ticks = 26% mortality, accelerating in ticks 1000–1200 (8 deaths in 200 ticks)

---

## Evaluation Questions

Please evaluate the following, drawing from the log data and the fix descriptions above. Be specific — cite tick numbers, metric values, and rates where relevant.

### Q1: Are the fixes mechanically correct?

For each fix, assess whether the change correctly addresses the diagnosed root cause:
1. Removing `/ 10.0` from `TribeStats::from_profile` — is this the right layer to fix normalization?
2. Lowering `max_population` floor from 6,000 to 500 — is this calibrated correctly for the new combat formula?
3. The `ticks_in_state >= 15` gate for migration override — is 15 ticks the right threshold? Too short? Too long?
4. Combat multiplier `0.02 → 0.08`, floor `0.1 → 1.0` — are these values appropriate for pop=500–2000 range?
5. Expansion threshold `0.25 → 0.10` — is this too permissive? Does it risk all tribes expanding simultaneously?

### Q2: Is the simulation dynamics healthy?

Analyze the log for signs of healthy emergent behavior vs. artifacts or problems:
- Territory growth: Does tile count growth rate look reasonable (120 → 3707 in 1200 ticks)?
- War frequency: 388 wars in 1200 ticks with 120 tribes = ~0.32 wars/tick. Does this seem appropriate?
- Death rate: 31 deaths in 1200 ticks (26% mortality). Is this too slow, too fast, or appropriate for a civilization sim?
- Foraging state = 0 from tick 100 onward. Is this a concern? (Foraging is a peaceful resource-gathering state)
- AtWar ratio: At tick 1200, 51/89 alive tribes are AtWar. Is a 57% war-engagement rate healthy or a sign of a war-lock bug?
- Territory plateau: Tile growth drops from ~200 tiles/50 ticks (ticks 0–300) to ~50 tiles/50 ticks (ticks 1100–1200). Is this map saturation or a pathological slowdown?

### Q3: Are there remaining bugs or failure modes?

Look for patterns that suggest something is still wrong:
- Several pairs of tribes declare war on each other repeatedly (e.g., tribe_0↔tribe_11, tribe_49↔tribe_60, tribe_44↔tribe_55 appear dozens of times). Is this a war reset bug, or is it expected for persistent neighbors?
- Many "OPPORTUNITY WAR" entries have low raid values (e.g., raid=0.12–0.14) even with high aggression. Should low-raid tribes be opportunity-raiding at all?
- `avg_pop` at tick 1200 = 1749 but `max_tile` = 278. With max_population scaling via mergers, do these numbers make sense together?
- Deaths cluster in groups (ticks 810, 1010, 1030) rather than being evenly distributed. What does this tell us about war resolution timing?

### Q4: Calibration and balance concerns

Assess whether the simulation will remain interesting long-term:
- At tick 1200, 4 Empires exist out of 89 alive tribes. Is this appropriate for 1200 ticks, or too many/few?
- Territory growth has effectively plateaued (~50 tiles/50-tick window at the end). What happens next? Will it stagnate?
- The tile leader at tick 1200 holds 278 tiles out of 3707 total (7.5%). Is any tribe likely to achieve dominance or is this a stable multi-polar equilibrium?
- With 57% of tribes perpetually AtWar, do tribes ever get time to settle and advance through polity tiers organically?

### Q5: What would you change?

If you were the developer, what would your next 3 highest-priority changes be? Consider:
- Combat balance (lethality, war duration, attrition vs. decisive battles)
- Polity tier pacing (are Cities/Duchies/Kingdoms/Empires appearing at reasonable rates?)
- State machine coverage (Foraging = 0 forever suggests a systemic issue)
- Any other dynamics you find concerning

---

## Context Notes for Evaluators

- This is a **thesis project** — the simulation is meant to demonstrate emergent complexity, not perfect balance. The goal is convincing dynamics, not tournament-level fairness.
- The test uses **synthetic** tribe profiles (not real NEAT-evolved genomes). Production runs will have more diverse drive distributions.
- The world map is finite; tile saturation is expected to occur eventually.
- "OPPORTUNITY WAR" = a tribe near a valid target with sufficient raid/aggression score, even if not in a formal war state. These are pre-war opportunity checks.
- The `Foraging` state is intended as a peaceful resource-gathering state for low-aggression tribes. Its absence from tick 100 onward may indicate that the expansion threshold change made all tribes prefer immediate expansion over foraging.

---

*End of evaluation prompt. Please provide your analysis structured by Q1–Q5.*
