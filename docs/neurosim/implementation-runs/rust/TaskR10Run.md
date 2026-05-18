# Task R10 Run — Border Pressure System, War Exhaustion, Expansion Pacing, Endgame Tuning

**Completed:** 2026-05-18
**Branch:** main
**Status:** Done

## Motivation

After the first full 599-cluster run (Task R8/R9 era), the simulation was producing wars at tick=1 and chaotic churn with dozens of war declarations per tick. The simulation was "more chaos than civilization" — territory was contested without strategic buildup, and the behavior lacked the multi-phase arc required by the thesis.

Thesis requirement: the simulation must support 9 academic subchapters. Subchapter 3 (Game Theory) requires observable strategic trade-offs — war must be a consequential decision, not a reflexive one. Subchapter 1 (ABM) references "one tribe achieved dominance" after 1,707 ticks, implying clean convergence.

## What Was Done

### Constant Tuning (Part A)

**`backend/src/simulation.rs`**
- `DISPUTE_GRACE_TICKS`: 60 → 180 (3× longer tolerance before dispute forces resolution)
- Opportunity war interval: `tick % 20` → `tick % 60` (3× slower proactive war scan)

**`backend/src/tribes.rs`**
- `expansion_cooldown_ticks`: 3 → 20 in `TribeState::from_cluster` (7× slower tile claiming)

### Border Pressure System (Part B)

New mechanic: tribes must share a border for ≥80 ticks before war declarations are valid.

**`backend/src/simulation.rs` — new constants:**
```rust
const PRESSURE_WAR_THRESHOLD: u32 = 80;
const PRESSURE_DECAY_PER_TICK: u32 = 2;
const PRESSURE_CAP: u32 = 200;
const POST_WAR_EXHAUSTION_TICKS: u64 = 150;
```

**New fields on `TribeSimulation`:**
```rust
border_pressure: BTreeMap<(usize, usize), u32>,
border_tension_announced: BTreeSet<(usize, usize)>,
```

**`update_border_pressure()`** — called every tick:
- Scans tile_tribe_idx cache for adjacent tribe pairs (O(total_tiles × 6))
- Increments pressure for adjacent pairs (+1/tick, capped at 200)
- Decays pressure for separated pairs (-2/tick, removes at 0)
- Emits `BorderTensionFormed` event exactly once per pair crossing threshold
- Resets `border_tension_announced` entry if pressure drops below threshold (allows re-firing)

**`has_pressured_neighbor(tribe_idx)`**:
- Returns true if any adjacent rival pair has pressure ≥ PRESSURE_WAR_THRESHOLD
- Returns true unconditionally in endgame (alive_count ≤ endgame_threshold) to prevent deadlock

**New field on `TribeState`:**
```rust
pub war_exhaustion_ticks: u64,
```
Decremented each tick; tribe cannot declare war while > 0 (unless endgame).

**Gates applied to war declaration paths:**
1. State machine `Settling → AtWar` transition
2. `apply_combat()` target assignment
3. `apply_opportunity_war()`
4. `dispute_resolution()` war escalation

**War exhaustion set at combat resolution:**
- DefenderWon: `defender.war_exhaustion_ticks = POST_WAR_EXHAUSTION_TICKS`
- AttackerWon: `attacker.war_exhaustion_ticks = POST_WAR_EXHAUSTION_TICKS`
- WarTimeout: both sides set to POST_WAR_EXHAUSTION_TICKS

**Revert-to-Peace logic:** AtWar tribes that can't find a valid pressure-gated target are reverted to Peace state to prevent infinite spin.

**`backend/src/events.rs`:**
```rust
BorderTensionFormed = 27,
// tribe_id = tribe A, other_tribe_id = tribe B, value_a = pressure at event time
```

**`ValidationMetrics`:** added `border_pressure_pair_count: usize`.

### Endgame Tuning (Part C)

After adding BP, the simulation required two rounds of endgame threshold iteration before achieving clean convergence.

**Root cause round 1:** `endgame_threshold = 20` in `apply_opportunity_war` and `has_pressured_neighbor` was too low for 49+ survivors. `apply_stagnation_war_sweep` only fired at `alive_count <= 6`.

**Fix round 1:** Raised threshold 20 → 50 everywhere. This produced a new stagnation at alive=138 because isolated empires still couldn't find adjacent targets in non-endgame mode on the 36K-tile map.

**Fix round 2 (final):** Replaced hardcoded 50 with the proportional formula already used in the original pre-BP optimization run:

```rust
let endgame_threshold = (self.tribes.len() / 6).max(4);
// For 599 tribes: 599/6 = 99. For 80 tribes: 80/6 = 13.
```

Applied in four locations: `apply_opportunity_war`, `has_pressured_neighbor`, `apply_combat`, and `apply_stagnation_war_sweep`.

The stagnation sweep threshold was also raised: `alive_count > 6` → `alive_count > endgame_threshold`, with timeout kept at 600 ticks.

Result: endgame fires at alive≤99, bypassing all BP and exhaustion gates. The stagnation sweep acts as nuclear backup after 600 ticks of no deaths with alive≤99.

## Simulation Arc (seed 7777, 599 clusters)

**Before BP patch:** wars started at tick=1, chaotic elimination, no strategic arc.

**After BP patch (final threshold = tribes.len()/6 ≈ 99):**
```
tick=50    alive=599  wars=0    (BP gate building border pressure)
tick=100   alive=595  wars=0    (expansion, no war yet)
tick=150   alive=579  wars=11   (first strategic wars — pressure threshold crossed ~tick=81)
tick=300   alive=537  wars=10   4 Empires forming
tick=600   alive=466  wars=9    100 Empires
tick=900   alive=331  wars=6    first cascade wave (-76 deaths in 50 ticks)
tick=950   alive=230  wars=7    second cascade (-101 deaths in 50 ticks)
tick=1000  alive=211  wars=10
tick=1650  alive=138  wars=7    all Tribe-tier polities gone (Tribe:0); slow phase begins
tick=1900  alive=130  wars=4    endgame not yet fired (130 > 99)
tick=2350  alive=100  wars=4    endgame threshold imminent
tick=2400  alive=81   wars=56   🔥 ENDGAME FIRES: cascade begins
tick=2500  alive=50   wars=18
tick=2600  alive=28   wars=12
tick=2800  alive=13   wars=5
tick=3000  alive=8    wars=7
tick=3200  alive=3    wars=1
tick=3309  alive=1    winner=tribe_285 (rust_pathfinding:286)
```

## Test Results

- `cargo test --release` — 37/37 pass (1 ignored harness-only test)
- `sim_last_empire_deterministic` — passes: 8 high-aggression tribes converge to 1 winner
- `dispute_resolves_after_grace_period_expires` — updated: `sim.tick = 59` → `sim.tick = 179` to match DISPUTE_GRACE_TICKS=180
- `sim_flexset_empire` (#[ignore]) — **PASSED**: convergence + determinism confirmed

**Run 1 result:**
```
ticks:   3309
alive:   1
winner:  tribe_285 (rust_pathfinding:286)
tier:    4  (Empire)
tiles:   93937
pop:     1898282
wars:    634
```

**Run 2:** identical fingerprint — ✓ DETERMINISM CONFIRMED

## Files Changed

| File | Change |
|---|---|
| `backend/src/simulation.rs` | BP system, war exhaustion, endgame tuning, constant changes |
| `backend/src/tribes.rs` | `war_exhaustion_ticks` field, `expansion_cooldown_ticks: 20` |
| `backend/src/events.rs` | `BorderTensionFormed = 27` event type |
| `backend/src/tombstone.rs` | Test fixture `make_tribe()`: `war_exhaustion_ticks: 0` |
| `docs/neurosim/mechanics/v4-border-pressure-and-dispute-mechanics.md` | Mechanics documentation |
| `docs/DOCUMENT_MAP.md` | Entry for v4 mechanics doc |
