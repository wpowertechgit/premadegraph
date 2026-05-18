# Tribe Behavior Diff — Intended vs. Implemented

**Date:** 2026-05-08  
**Design sources:** `Architecture & Mechanics Redesign.md`, `Territory & Expansion Mechanics.md`, `Offspring Mechanics & Evolutionary Lineage.md`, `Information Theory Lineage Compression.md`, `MASTER-TASK-LIST-v3-neurosim-simulation.md`, `2026-05-03-neurosim-tribal-simulation.md`  
**Implementation sources:** `TaskR3Run.md` – `TaskR8Run.md`, `TaskM18BRun.md`, `TaskM18CRun.md`  
**Reviewer:** [owner — mark each DIFF row below]

---

## How to use this document

Owner marks each DIFF row with one of:

- `✅ correct` — implementation matches design intent
- `❌ wrong — needs code` — intent defined, never implemented
- `🔧 code exists but broken at runtime` — code is there, something prevents it firing
- `🤔 design ambiguous` — the intent itself needs owner clarification before anything can be fixed

---

## 1. Wars

### INTENDED (Architecture Redesign §3, Territory Mechanics §3 + §5, owner-confirmed 2026-05-08)

- Diplomacy is strictly binary: **Total War OR Full Alliance + Merger.** No middle ground.
- A tribe in Settling or Foraging whose neural aggression output exceeds 0.7 AND has a neighbor within 5 tiles → declares war.
- A tribe in Desperate state whose aggression exceeds 0.6 → can also declare war.
- Disputes generate a **Casus Belli** — all disputes must eventually resolve (see §5).
- Victor absorbs all loser territory; loser enters Imploding.
- Stalemate after 300 combat ticks → both enter Peace.

**Combat resolution formula (owner-confirmed 2026-05-08):**

Two factors determine combat outcome:
1. **A_combat artifact** — fighter skill, tactics, discipline (same for attacker and defender)
2. **Raw population (army size)** — numbers are decisive. 10× soldiers beats superior skill.
3. **Terrain/homeland bonus** — if the defending tribe is contesting a tile that is part of their **own territory**, they receive a defense bonus on top of the tile's static biome bonus. Attackers have no equivalent home-ground bonus.

```
attacker_strength = population_A × A_combat_A × noise × biome_attacker_modifier
defender_strength = population_B × A_combat_B × noise × biome_defense_bonus × homeland_bonus_if_own_tile
```

Neither factor alone is decisive — quantity beats quality at extreme ratios, and skill matters when numbers are close.

### IMPLEMENTED (TaskR5Run, TaskR2Run, TaskR4Run)

Current combat formula in `simulation.rs`:
```rust
attacker_strength = A.population × A.stats.a_combat × rng.gen_normal(1.0, 0.15)
defender_strength = B.population × (B.stats.a_risk + B.world_tile.defense_bonus) × rng.gen_normal(1.0, 0.15)
```

- ✅ Population as multiplier on both sides
- ✅ Box-Muller noise (±15%)
- ✅ BiomeTile `defense_bonus` applied to defender
- ❌ Defender uses **A_risk** as skill proxy — wrong. A_risk is endurance/logistics, not combat ability. Both sides should use A_combat.
- ❌ No homeland bonus — defender gets the same biome bonus whether the tile is their core territory or neutral ground
- ❌ No attacker penalty for pushing into an enemy's home tile

State machine transitions (AtWar declaration, territory absorption, ghost war cleanup) — present.  
Peace timeout: 300 ticks → Peace; Peace → Settling after 500 more ticks.

### DIFF

| # | Item | Owner |
|---|------|-------|
| 1a | **Defender uses A_risk instead of A_combat.** Both attacker and defender fight with their A_combat. A_risk should not be a combat multiplier — it's the logistics/endurance artifact. Fix: replace `B.stats.a_risk` with `B.stats.a_combat` in the defender strength formula. | ❌ wrong — needs code |
| 1b | **No homeland/territory defense bonus.** Defender gets a static biome bonus but no extra advantage for defending their own territory. If tribe B owns the contested tile, their `defender_strength` should have an additional multiplier (e.g., ×1.3–1.5) on top of the biome bonus. | ❌ wrong — needs code |
| 1c | **Neural input[6] (nearest enemy distance) may be a hardcoded placeholder.** If so, tribes cannot evolve aggression in response to proximity — the most natural trigger for war. Verify in `simulation.rs`. | [ ] |
| 1d | **Casus Belli → war declaration missing** (detailed in §5). Dispute starvation does not trigger AtWar. | ❌ wrong — needs code |
| 1e | **Surrounded tribe has no escalation path.** `apply_territory_expansion()` returns silently when 0 neutral tiles exist. A survival fallback (trapped + Desperate for N ticks → force AtWar regardless of genome) is missing. | ❌ wrong — needs code |
| 1f | Desperate → AtWar requires `aggression > 0.6` genome evolution. A pacifist-genome tribe that is surrounded and starving dies via Imploding without ever fighting back. A hard survival-calculus trigger after enough Desperate ticks is missing. | ❌ wrong — needs code |
| 1g | Territory absorption on victory, casualty model, ghost war cleanup — structurally correct. | [ ] |
| 1h | Peace state lasts 500 ticks (~42s at 12 TPS). Multiple Peace-stalled tribes reduce active participants significantly. | [ ] |

---

## 2. Absorption / Merger

### INTENDED (Architecture Redesign §3, Territory Mechanics §3)

- **Option B: Full Alliance → Merger.** Two allied tribes merge into a higher-tier polity.
- The absorber gains all territory, population, food, citizens, founders, and lineage from the absorbed tribe.
- Specialization roles are assigned at merge time based on dominant artifact of each constituent.
- Absorbed tribe becomes an Administering sub-unit with its parent_polity_id set.
- Tier is recalculated from total constituent count after every merge.

### IMPLEMENTED (TaskR5Run)

- `apply_alliances()` every 50 ticks: Settling tribe with `goal_drive > 0.7` AND `ticks_in_state ≥ 100` proposes alliance to nearby tribe with `goal_drive > 0.6`.
- `apply_merger()` every 100 ticks: Allied pairs where both have `ticks_in_state ≥ 300` → `try_merge_allies()`.
- `try_merge_allies()`: territory/population/food/citizens/founders transferred; absorbed → Administering with `parent_polity_id`; tier recalculated; roles assigned.
- Events: AllianceProposed, MergeInitiated, MergeCompleted, PolityUpgraded.

### DIFF

| # | Item | Owner |
|---|------|-------|
| 2a | Same neural input problem as wars: `goal_drive` (output[2]) is shaped by all 8 neural inputs including **input[7] (nearest ally distance)**. If input[7] is a placeholder instead of a real computed distance, tribes cannot evolve alliance-seeking behavior in response to actual neighbors. Verify input[7] in `simulation.rs`. | [ ] |
| 2b | Alliance requires both tribes independently hitting threshold: proposer `goal_drive > 0.7`, responder `goal_drive > 0.6`, both Settling for ≥ 100 ticks, then both Allied for ≥ 300 more ticks before any merger. Minimum door-to-merger is 400 ticks. If the food economy in Rust is also broken (see §6), tribes won't survive long enough in Settling state to accumulate these ticks. | [ ] |
| 2c | There is **no second merger path**: the design doc says Option B is "Full Alliance → Merger," so mergers requiring prior alliance is correct per spec. But if alliances never form (due to blind neural inputs), mergers are permanently blocked. | [ ] |
| 2d | After absorption the absorbed tribe's `ally_tribe` and `target` are cleared. If the absorber dies later the Administering tribe has **no recovery path** — stuck in Administering state with a dead parent and no transition out. | [ ] |
| 2e | The `try_merge_allies()` transfer logic (territory, pop, food, citizens, lineage) looks correct on paper per TaskR5Run. | [ ] |

---

## 3. Polity Tier Upgrades

### INTENDED (Architecture Redesign §3)

The design document defines **one** promotion path based on constituent count from mergers:

| Tier | Constituent count |
|------|-----------------|
| Tribe | 1 |
| City | 3+ |
| County | 10+ |
| Kingdom | 50+ |
| Empire | massive unification of kingdoms |

No Duchy tier appears in the architecture design doc. The spec progression is: **Tribe → City → County → Kingdom → Empire** (5 tiers).

The owner's stated intent also includes a **second promotion path**: a single tribe with enough population and territorial control can upgrade without absorbing anyone (like a chess promotion). This is **not written in any design doc** — it is oral/informal intent only.

### IMPLEMENTED (TaskR5Run, TaskM18BRun)

- `polity_tier_for_count()` maps constituent count → tier. Constituent count only — population plays no role.
- C# local demo uses the same threshold logic.
- Tier naming in code: Tribe=0, City=1, County=2, **Duchy=3**, Kingdom=4, Empire=5 — **6 tiers, Duchy added that is not in design doc**.

### DIFF

| # | Item | Owner |
|---|------|-------|
| 3a | **Population-based promotion path is entirely missing from code.** A tribe with 500 population and 40 tiles but zero mergers stays at Tribe tier forever. If this is intended behavior, mark correct. If population-based promotion is a real requirement, it needs to be formally specified and then implemented. | [ ] |
| 3b | **Duchy (tier 3) is not in the architecture design doc.** The design says Tribe → City → County → Kingdom → Empire. Code has 6 tiers including Duchy. Owner needs to confirm: should Duchy be removed, or is it a deliberate addition between County and Kingdom? Settlement visual assets cover 5 families (Tribe/City/Duchy/Kingdom/Empire), which omits County. | [ ] |
| 3c | Tier upgrade on merger and tier downgrade on rebellion are both implemented and look correct. | [ ] |

---

## 4. The Five Artifacts

### INTENDED (Architecture Redesign §4)

Five primary artifacts with explicit behavioral roles:

| Artifact | Role in society | Design intent |
|----------|----------------|---------------|
| A_combat | Military & Defense | War declarations, border defense |
| A_resource | Economy & Treasury | Foraging speed, resource distribution |
| A_map_objective | Governance & Expansion | Migration targets, tile claiming, overarching goal |
| A_risk | Endurance & Logistics | Starvation resistance, supply chain |
| A_team | Internal Stability & Law | Civil war prevention, public order |

Neural inputs per 2026-05-03 implementation plan (Task 4 — exact spec):
```
input[0]: food_stores / max_population
input[1]: population / max_population
input[2]: territory.len() / 100.0
input[3]: stats.feed_risk
input[4]: stats.a_combat
input[5]: stats.a_resource
input[6]: nearest enemy distance (tile distance / 40.0)   ← must be computed
input[7]: nearest ally distance (tile distance / 40.0)    ← must be computed
```

`a_map_objective` and `a_team` are **intentionally not in the neural input list** per the original spec — they drive role assignment and rebellion threshold, not neural behavior.

### IMPLEMENTED

- All 5 artifacts stored in TribeStats ✅
- Neural inputs [0–5] match spec ✅
- `a_combat` → Military role + war combat strength ✅
- `a_resource` → Economy role + expansion/foraging ✅
- `a_map_objective` → Governance role + XP when territory > 20 tiles ✅
- `a_risk` → Logistics role + dispute passive acceptance threshold (> 0.7) + military threat threshold (> 0.8) ✅
- `a_team` → InternalAffairs role + rebellion threshold (< 0.25) ✅
- Artifact blending on reproduction ✅
- Artifact mutation at generation boundary (±0.02 per artifact) ✅

### DIFF

| # | Item | Owner |
|---|------|-------|
| 4a | Neural inputs[6] and [7] (nearest enemy / nearest ally distance) are **unconfirmed by any task run**. No TaskR run report says "implemented real distance computation for neural inputs." These may be hardcoded 0.5 or 0.0. If they are, `a_map_objective` and `a_team` being excluded from neural inputs is correct per spec, but the spatial awareness that would let tribes evolve war/alliance behavior is missing entirely. | [ ] |
| 4b | `a_map_objective` and `a_team` being excluded from neural inputs is **correct per original spec**. This is not a bug unless the owner wants to add them. | [ ] |
| 4c | Veterancy XP accumulates per tick when a tribe fulfills its role condition, but it has **no documented downstream effect** — nothing in the simulation consumes `veterancy_xp`. The design says "the longer a sub-unit operates in its designated role, the more 'veterancy' (XP) it gains, naturally increasing its efficiency over time" (Architecture §3). Efficiency increase is not implemented. | [ ] |

---

## 5. Territory — Casus Belli & Dispute Escalation

### INTENDED (Territory Mechanics §4 + §5, owner-confirmed 2026-05-08)

Every dispute **must resolve**. A disputed tile cannot linger forever. Three and only three outcomes are valid:

1. **War** — one tribe attacks the other to eject them from the tile entirely
2. **Alliance → Merger** — tribes with compatible high A_team recognize the dispute and form an alliance, erasing the border
3. **Forced retreat** — one side backs down because the military calculus is clearly against them (vastly outnumbered or low A_combat relative to opponent)

There is no "passive acceptance indefinitely." Even a tribe tolerating a dispute for now must eventually be forced to a decision by the accumulating penalty. The dispute system is the engine of conflict in the simulation.

### IMPLEMENTED (TaskR4Run)

- Dispute penalty (-40%) applied to food yield ✅
- `apply_dispute_resolution()` every 30 ticks:
  - Passive acceptance: A_risk > 0.7 → tolerate **indefinitely** ← wrong
  - Military threat: A_combat > 0.8 AND higher than opponent → force retreat
- No path from dispute → war declaration
- No path from dispute → alliance proposal
- Disputed tiles persist indefinitely if A_combat < 0.8 AND A_risk > 0.7 — violates the "must resolve" rule

### DIFF

| # | Item | Owner |
|---|------|-------|
| 5a | **Passive acceptance must not be indefinite.** A_risk tolerance should apply a grace period (e.g., 100–200 ticks), after which the tribe is forced to choose war or alliance regardless of A_risk. Currently there is no timeout on passive acceptance. | ❌ wrong — needs code |
| 5b | **Dispute → war declaration path is missing.** After the grace period (or immediately if A_risk is low), dispute starvation should directly set the tribe's state to AtWar targeting the tile's other occupant. | ❌ wrong — needs code |
| 5c | **Dispute → alliance proposal path is missing.** If both disputing tribes have high A_team (e.g., both > 0.5), the dispute should trigger an alliance proposal rather than war — the high-A_team path to merger. | ❌ wrong — needs code |
| 5d | Forced retreat (military threat) exists but the 0.8 threshold is too high. A_combat > opponent's A_combat by any meaningful margin should be sufficient to force retreat, not an absolute 0.8 gate. The threshold should be **relative**, not absolute. | ❌ wrong — needs code |

---

## 6. Surrounding / Trapped Tribes

### INTENDED (Territory Mechanics §1 + §5, user-stated intent)

A tribe cannot endlessly claim territory without population and resources to maintain it — but equally, a tribe that is completely hemmed in should not just passively starve. The design's "no middle ground" rule implies trapped tribes must either fight (war) or negotiate (alliance), never stagnate indefinitely.

### IMPLEMENTED

- `neutral_adjacent_tiles()` returns zero tiles if fully surrounded → expansion silently fails
- No "surrounded" detection flag exists
- No escalation triggered by having zero expansion options
- No behavior change when a tribe is boxed in

### DIFF

| # | Item | Owner |
|---|------|-------|
| 6a | **No surrounded-tribe detection.** A tribe with 0 expandable neutral tiles simply gets silently rejected by the expansion check every tick, with no escalation. This is one of the main user-reported issues ("even if tribes are completely surrounded, they don't attempt to invade"). | [ ] |
| 6b | Combining 6a + 1c + 1d: a surrounded, low-aggression genome tribe can just slowly Implode with no aggressive response ever. The design intent ("no passive land-grabbing" and "no middle ground diplomacy") implies this situation should force a choice. No such force exists. | [ ] |

---

## 7. C# Local Demo vs. Rust Backend — Divergence

Two separate simulation implementations exist and have drifted significantly:

| Aspect | Rust `simulation.rs` | C# `PlayableSimulation.cs` |
|--------|---------------------|--------------------------|
| Food economy | **Unknown — likely broken** (no fix confirmed in any TaskR run) | Fixed in M18C: regrowth 0.012→0.030, upkeep 0.028→0.016, claim cost 40→28 |
| Expansion pacing | R8: 25-tick cooldown, cost model | R8 mirrored in M18C fix |
| War triggers | Neural net outputs (aggression > 0.7) | Simplified artifact thresholds |
| Merger triggers | `apply_merger()`: Allied ≥ 300 ticks | `TryMergeTribes`: **4+ disputes AND avg Team ≥ 0.78** — completely different |
| Polity tier logic | Constituent count | Constituent count (same) |

### DIFF

| # | Item | Owner |
|---|------|-------|
| 7a | **Rust food economy is likely still broken.** M18C explicitly documented the fix for C# only. If Rust still has the old food math (harvest < upkeep), all tribes in the Rust backend run net-negative food from tick 1 — they spend their entire existence in Foraging/Starving/Desperate and never reach the Settling state required to form alliances or trigger wars. This is the most probable reason for "nothing happening" in the Rust simulation. | [ ] |
| 7b | **C# merger trigger ("4+ disputes AND avg Team ≥ 0.78") vs. Rust merger trigger ("Allied ≥ 300 ticks") are completely different mechanics.** One of these needs to be canonical. The C# version is more interesting (dispute-driven mergers) and closer to the design intent from Territory Mechanics §5 ("diplomatic merger resolves dispute"). Which one is correct? | [ ] |
| 7c | TaskR8Run already flagged this: "Rust/C# parity: any future tunings must be applied to both." This maintenance risk remains unresolved. | [ ] |

---

## 8. Lineage & Tombstone

### INTENDED (Offspring Mechanics §1–3, Information Theory §3)

- Seed population weighted by match count; every player gets ≥ 1 entity ("No One Left Behind")
- Unisex breeding, minimum 2 entities, same-gene breeding allowed
- LineageRegistry: `HashMap<u32, (u32, u32)>` — flat O(1) per birth, no string concat
- Tombstone Ledger: records extinction cause, territory, population, lineage summary

### IMPLEMENTED (TaskR1Run, TaskR2Run, TaskR6Run)

- LineageRegistry with DAG structure: implemented ✅
- TombstoneLedger with cause/generation/territory/artifact snapshot: implemented ✅
- Reproduction every 50 ticks (min 2 citizens): implemented ✅
- Seed weighting: `seed_count = 3 if size_ratio > 0.8, else 2` — simplified (not full match-count weighting) ⚠️
- REST endpoints for lineage queries and tombstone list: implemented ✅

### DIFF

| # | Item | Owner |
|---|------|-------|
| 8a | Seed weighting is simplified (3 or 2 entities based on size ratio) rather than the full match-count proportional formula from the design. The "No One Left Behind" rule is satisfied. The match-count weighting is not. Whether this matters depends on whether the thesis requires accurate match-count representation in the seed population. | [ ] |
| 8b | Cross-tribe breeding after merger (citizens from both tribes can breed) — implemented per spec. ✅ | [ ] |

---

## 9. Tier Naming

### INTENDED (Architecture Redesign §3)

Design doc progression: **Tribe → City → County → Kingdom → Empire** (5 tiers, no Duchy)

### IMPLEMENTED

Code enum: **Tribe=0, City=1, County=2, Duchy=3, Kingdom=4, Empire=5** (6 tiers, Duchy added)

Settlement visual assets cover: Tribe, City, Duchy, Kingdom, Empire (5 families — County has no asset)

### DIFF

| # | Item | Owner |
|---|------|-------|
| 9a | Design says 5 tiers with no Duchy. Code has 6 tiers with Duchy and no visual asset for County. Either: (A) remove Duchy and use the 5-tier design doc sequence, or (B) keep Duchy as a deliberate addition between County and Kingdom and add County visuals. Owner needs to decide. | [ ] |

---

## 10. Veterancy XP Downstream

### INTENDED (Architecture Redesign §3)

> "the longer a sub-unit operates in its designated role, the more 'veterancy' (XP) it gains, **naturally increasing its efficiency over time**"

This implies XP should feed back into something — combat power, mutation rate, reproduction rate, expansion cost reduction, etc.

### IMPLEMENTED

`veterancy_xp: u32` accumulates via `apply_veterancy_xp()`. Nothing consumes it. No efficiency improvement exists.

### DIFF

| # | Item | Owner |
|---|------|-------|
| 10a | Veterancy XP is an accumulator with no consumer. The design says it should "increase efficiency over time." What specifically should it affect? This needs to be defined before it can be implemented. | [ ] |

---

## 11. Food Economy — Tile Starvation (Confirmed Bug)

### OBSERVED

Tiles sitting at 0/capacity even though tribes are present and alive. Tribes appear to do nothing productive.

### ROOT CAUSE (from `world.rs` and `simulation.rs`)

Three constants interact and are completely mismatched in scale:

**Tile regeneration** (`world.rs:250`):
```rust
food_regen: stats.food_density * 0.002
```
Plains tile (food_density = 0.7): regen = **0.0014 per tick**

**Harvest** (`simulation.rs:1371`):
```rust
tile.food * 0.1 * mult   // 10% of current tile food removed per tick
```

**Population upkeep** (`simulation.rs:1418`):
```rust
tribe.food_stores -= tribe.population as f32 * 0.5
```
50 pop tribe: consumes **25 food per tick**

### The math

At equilibrium (regen == harvest rate), a farmed tile stabilises at:

```
food_density * 0.002 = tile.food * 0.1
tile.food = food_density * 0.02
```

| Biome | max_food | Equilibrium food | % of capacity |
|-------|----------|-----------------|---------------|
| Plains | 0.70 | 0.014 | **2%** |
| Forest | 0.90 | 0.018 | **2%** |
| Desert | 0.20 | 0.004 | **2%** |

A Plains tile at equilibrium yields `0.014 * 0.1 = **0.0014 food/tick**`.

A tribe with 50 population consumes **25 food/tick** and harvests **0.0014 food/tick** from one tile.  
To break even on food it would need **25 / 0.0014 ≈ 17,857 tiles**.

Even with 10 tiles (already heavily overextended for an early tribe): `0.014 food/tick` vs `25 food/tick` upkeep. The tribe is in permanent deficit from tick 2 onward regardless of behavior.

**Starting food stores** = `(max_pop/2) * 0.5`. A tribe with max_pop=100 starts with 25 food and a 50-pop upkeep of 25/tick — their entire starting reserve lasts **one tick**.

This is why tiles are at 0: tribes DO harvest, but at 10%/tick they drain each tile exponentially to near-zero within ~20 ticks, and the regen rate (`food_density * 0.002`) is ~70× too slow to keep up.

### The C# fix (M18C, for reference)

The same imbalance existed in the C# local demo and was fixed:

| Constant | C# old | C# fixed (M18C) | Rust current |
|----------|--------|----------------|--------------|
| Food regrowth rate | 0.012 | 0.030 | 0.0014–0.0018 (food_density * 0.002) |
| Population upkeep/tick | 0.028 | 0.016 | **0.5** (31× higher than C# fixed) |
| Harvest base | 0.012 | 0.018 | — (different system) |

The Rust upkeep per-pop per-tick (0.5) is **31× higher** than the fixed C# value (0.016). The Rust regen rate is **~20× lower** than the C# fixed value.

### DIFF

| # | Item | Owner |
|---|------|-------|
| 11a | **`food_regen = food_density * 0.002` is ~70× too low.** Tiles drain to 2% of capacity and stay there. This is not a design question — it's a wrong constant. Suggested fix: `food_density * 0.15` brings equilibrium to ~60% of max when farmed once per tick. | [ ] |
| 11b | **`population * 0.5` upkeep/tick is 31× too high vs. the tuned C# value (0.016).** A tribe with 50 pop burns 25 food/tick — no tile regen can keep up. Suggested fix: `population * 0.005` or align with whatever value makes a single home tile sustain ~80 pop at steady state per the Territory design doc. | [ ] |
| 11c | The behavior-state guard is correct: foraging only fires for `Settling` or `Foraging` tribes (`simulation.rs:1356`). The issue is not the guard — it's the constants above. | [ ] |
| 11d | Because of 11a + 11b: virtually every tribe is starving from tick 1, spending all ticks in Foraging → Starving → Desperate → Imploding. They never reach Settling long enough to trigger alliance/war thresholds. **This is the upstream cause of wars and alliances never firing.** Fixing the food economy unlocks the entire behavior chain. | [ ] |

---

## 12. Summary Table

| Behavior | Design doc says | Code has it | Actually fires |
|----------|----------------|-------------|----------------|
| War from aggression threshold | ✅ | ✅ | 🔧 depends on neural inputs[6] being real |
| War from Desperate + aggression | ✅ | ✅ | 🔧 depends on genome evolving aggression |
| Casus Belli from dispute starvation | ✅ | ❌ missing | ❌ |
| Dispute → war declaration | ✅ | ❌ missing | ❌ |
| Dispute → alliance offer | ✅ | ❌ missing | ❌ |
| Dispute passive acceptance (with timeout) | ✅ | ❌ no timeout, indefinite | ❌ |
| Dispute military threat (relative A_combat) | ✅ | ❌ absolute 0.8 gate | ❌ |
| Combat: A_combat for both sides | ✅ | ❌ defender uses A_risk | ❌ |
| Combat: homeland/territory defense bonus | ✅ | ❌ missing | ❌ |
| Combat: population as strength multiplier | ✅ | ✅ | ✅ |
| Surrounded tribe → escalation / forced war | ✅ (implied) | ❌ missing | ❌ |
| Alliance → merger | ✅ | ✅ | 🔧 depends on neural inputs[7] + food economy |
| Population-based tier upgrade | owner says yes | ❌ missing | ❌ |
| Absorption-based tier upgrade | ✅ | ✅ | 🔧 depends on merger firing |
| 5-tier Tribe→City→County→Kingdom→Empire | ✅ | ❌ 6 tiers with Duchy | — |
| 5 artifacts stored and blended | ✅ | ✅ | ✅ |
| Neural inputs[0–5] correct | ✅ | ✅ | ✅ |
| Neural inputs[6–7] as real distances | ✅ | 🔧 unconfirmed | ❓ verify |
| Veterancy XP accumulates | ✅ | ✅ | ✅ |
| Veterancy XP → efficiency boost | ✅ | ❌ not consumed | ❌ |
| Lineage DAG (R1) | ✅ | ✅ | ✅ |
| Tombstone ledger (R2) | ✅ | ✅ | ✅ |
| Rebellion (Administering → A_team < 0.25) | ✅ | ✅ | 🔧 depends on merger firing first |
| Rust food economy healthy | required | ❌ confirmed broken | 🔴 tile regen 70× too low, upkeep 31× too high |
| C# food economy healthy | required | ✅ fixed in M18C | ✅ |

---

## 12. First Verification Steps (Before Any Fixes)

These two checks answer most open questions:

**Step 1 — Open `backend/src/simulation.rs`, find neural input construction.** Search for `last_inputs` or the neural input array assembly. Check inputs[6] and [7]:
- If they are hardcoded values (0.5, 0.0, etc.) → this is the root cause for no wars and no alliances
- If they call a real distance function → the issue is the food economy (Step 2)

**Step 2 — Compare Rust food constants to M18C C# fix.**

| Constant | C# fix (M18CRun) | Rust current | Match? |
|----------|-----------------|--------------|--------|
| Food regrowth rate | 0.030 | ? | |
| Population upkeep | 0.016 | ? | |
| Claim base cost | 28 | ? | |
| Claim food floor | 30 | ? | |
| Claim pop base | 72 | ? | |

If Rust constants are the old untuned values, the Rust simulation has the same AFK-tribes problem that C# had before M18C.

---

## Owner Review Notes

*(Fill in below after reading each section)*

### On neural inputs[6] and [7] — computed or placeholder?

### On Rust food economy — same broken state as C# pre-M18C?

### On population-based tier upgrade (the chess analogy):

### On Casus Belli from disputes not triggering war:

### On surrounded-tribe escalation:

### On the tier naming — 5-tier or 6-tier, keep Duchy?

### On veterancy XP — what should it actually affect?

### On C# merger trigger (4+ disputes + Team ≥ 0.78) vs Rust (Allied ≥ 300 ticks):

### On seed population match-count weighting:

### Anything else:
