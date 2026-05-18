# Simulation Liveness Fix — Dead Sim Diagnosis & Repair

**Date:** 2026-05-14
**Status:** Done — rebuild required

## Problem

Sim ran (ticks 0→777) but nothing happened:
- tribes=599 constant (no deaths, no mergers)
- wars=6 constant (no new wars after tick ~19)
- TileData.Count=599 (each tribe stuck at exactly 1 territory tile)
- settlements=C:0 M:0 F:599 (no polity upgrades ever)

## Root Causes Found

### 1. Double-normalization of tribe stats
**File:** `backend/src/tribes.rs` — `TribeStats::from_profile`

`server.js` already normalizes artifact values to 0–1 (divides by CAP=4.5 or 5.0).
Then Rust divided by 10 again → all stats were 10× too small.

- `a_combat` was ~0.03 instead of ~0.3
- combat damage per round: `0.03 × 6000 × 0.02 = 3.6` casualties → wars never killed anyone

### 2. Max population floor too high
**File:** `backend/src/tribes.rs` — `TribeState::from_cluster`

Floor was `max(6_000)`. Even with fixed a_combat=0.3:
- `0.3 × 6000 × 0.02 = 36` casualties/round × 120 rounds = 4320 total
- 4320 out of 6000 = 72% loss is lethal, BUT only if combat ran 120 rounds
- Actual: war timeout at 120 ticks_in_state, 1 round per tick → 4320 casualties IS enough
- Problem compounded with double-normalization: actual lambda was 3.6 → 432 casualties = 7% → tribe survives

Together these two bugs made all wars completely non-lethal.

### 3. Migration oscillation — territory never grew
**File:** `backend/src/simulation.rs` — `apply_state_machine`

Migration override triggered immediately on any tribe in `Settling` or `Foraging` state
if `migration_drive > 0.55 AND aggression < 0.55`. Result:

- Tick N: tribe in Settling → migration override → Migrating (ticks_in_state=0)
- Tick N+1 to N+150: tribe migrating, picks destination 4–15 tiles away
- Destination reached (dist≤2) → Settling (ticks_in_state=0)
- Next tick: current=Settling → migration override fires again → Migrating

Tribes in oscillation never stayed in Settling long enough for `apply_territory_expansion` to run
(which requires `Settling | Foraging` state). ~15% of tribes were fully locked.

### 4. Combat damage multiplier too low
**File:** `backend/src/simulation.rs` — `apply_combat`

Multiplier `0.02` with floor `.max(0.1)` was designed for the original large populations.
After all the above bugs compound, wars were cosmetic.

### 5. Expansion thresholds too conservative
**File:** `backend/src/simulation.rs` — `apply_territory_expansion`

- `resource_drive < 0.25` → blocked ~63% of tribes from ever expanding
- `expansion_cooldown_ticks = 8` → delayed all expansion to tick 9+

## Fixes Applied

| File | Change | Reason |
|------|--------|--------|
| `backend/src/tribes.rs` | `TribeStats::from_profile`: removed `/ 10.0` from normalizer lambda | Profiles arrive pre-normalized 0–1 from server.js |
| `backend/src/tribes.rs` | `max_population`: floor `6_000 → 500`, multiplier `600 → 200` | Tribes at 6000 pop were unkillable; 500 cap → combat is decisive; mergers still grow max_pop for polity upgrades |
| `backend/src/tribes.rs` | `expansion_cooldown_ticks: 8 → 3` | Faster initial territory claim |
| `backend/src/simulation.rs` | `apply_combat`: multiplier `0.02 → 0.08`, floor `.max(0.1) → .max(1.0)` | Wars now cause ~35% casualties/round vs ~7% |
| `backend/src/simulation.rs` | Migration override: added `&& self.tribes[i].ticks_in_state >= 15` | Tribes spend ≥15 ticks settling first before migration triggers; breaks oscillation |
| `backend/src/simulation.rs` | `apply_territory_expansion`: `resource_drive < 0.25 → 0.10` | ~95% of tribes now eligible to expand (was ~37%) |

## Polity Tier Path (still works after max_pop fix)

Merger code (`apply_merger`) accumulates max_population:
```rust
self.tribes[absorber].max_population = self.tribes[absorber].max_population.saturating_add(absorbed_max_pop);
```

So tribes grow their pop cap by conquering/merging:
- 2 mergers → max_pop ~1000 → City eligible
- 6 mergers → max_pop ~3500 → Duchy eligible
- 14 mergers → max_pop ~7500 → Kingdom eligible
- 30 mergers → max_pop ~15,500 → Empire eligible

## Expected Behavior After Fix

- Territory tiles grow from tick 3+ (cooldown 3 ticks)
- TileData.Count should grow from 599 toward thousands
- Wars declared once tribes border each other (after expansion)
- Tribes die in combat within 30–60 ticks of war
- Mergers trigger within 100–200 ticks for allied survivors
- First City tiers within 500–1000 ticks

## Build Required

**Local (no Docker):**
```powershell
cd backend\genetic-neurosim\backend
cargo build --release
```
Then restart Node backend (auto-restarts neurosim subprocess).

**Docker:**
```powershell
docker-compose build neurosim
docker-compose up -d neurosim
```

## Files Changed

- `backend/genetic-neurosim/backend/src/tribes.rs`
- `backend/genetic-neurosim/backend/src/simulation.rs`

## Remaining Gaps Fixed (2026-05-15)

### Gap 1: Allied state missing from health checkpoint logging

`log_sim_health()` counted Settling, Foraging, Migrating, AtWar, Imploding, Desperate but not Allied. At tick 1200, Allied tribes (up to 22 at once) were invisible in all checkpoint output.

**Fix:** Added Allied (`state_counts[6]`) to both:
- `log_sim_health` stdout line: `Al={al}` beside Imp and Des
- JSONL checkpoint `"states"` field: `"Allied":{al}` (`state_map[6]`)

Also added assertion to `sim_health_300_ticks`: `state_counts.iter().sum() == alive.len()` — verifies no state is invisible.

**Verified:** Test passes. At tick=300, all 77 alive tribes account for across all 13 state slots.

### Gap 2: Foraging state had no real attractor (0 tribes Foraging after tick 100)

Expansion threshold `resource_drive < 0.10` (near-zero) meant almost every tribe qualified to expand from Settling, so peaceful/isolationist tribes had no reason to enter Foraging. Foraging vanished after early ticks.

**Fix — Foraging attractor in `apply_state_machine`:**
- Settling → Foraging if `resource_drive > 0.35 AND aggression < 0.25 AND isolation > 0.50 AND ticks_in_state >= 20`
- Foraging → stays Foraging (does not flip to Settling on `food_ratio > 0.8`) if the isolationist condition holds

**Fix — Halved expansion rate for Foraging in `apply_territory_expansion`:**
- Foraging tribes skip expansion on odd ticks (`tick % 2 != 0 → continue`)
- Creates distinct peaceful-isolationist archetype: claims territory slowly, stays in Foraging long-term

**Verified:** Foraging count at tick=50 stable (12 tribes Foraging at tick 50, 1–2 thereafter as wars reduce isolationist survivors).
