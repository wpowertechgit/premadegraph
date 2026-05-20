# Territory & Dispute Mechanics

*Updated 2026-05-20. Covers expansion pacing (R8), border pressure (BP), war exhaustion, fractional border fixes, and regional border wars (R11).*

---

## Problem Statement

The original mechanics produced chaotic, fast-paced collapse rather than strategic play:

- `expansion_cooldown_ticks = 3` — tribes claimed new tiles every 3 ticks, filling the map and colliding with neighbors almost immediately
- `DISPUTE_GRACE_TICKS = 60` — disputes forced resolution (war or retreat) within 60 ticks, leaving no time for diplomacy
- `apply_opportunity_war` fired every 20 ticks — aggressive tribes declared war constantly with no recovery period
- No war exhaustion — a tribe could chain war after war indefinitely

The result: 599-tribe runs became elimination tournaments within hundreds of ticks rather than strategic civilization arcs.

---

## Changes (BP patch, 2026-05-18)

### A — Constant Retuning

| Constant | Before | After | File |
|---|---|---|---|
| `expansion_cooldown_ticks` | 3 | **20** | `tribes.rs` `from_cluster` |
| `DISPUTE_GRACE_TICKS` | 60 | **180** | `simulation.rs` |
| Opportunity war interval | every 20 ticks | **every 60 ticks** | `simulation.rs` `step()` |

### B — Border Pressure System

**New field on `TribeSimulation`:**
```rust
border_pressure: BTreeMap<(usize, usize), u32>
```
Key is `(min_idx, max_idx)` of alive tribe array indices. Value is accumulated pressure in ticks.

**New field on `TribeState`:**
```rust
pub war_exhaustion_ticks: u64
```
Initialized to 0. Decremented by 1 each tick (saturating). Set to `POST_WAR_EXHAUSTION_TICKS = 150` when a war ends.

---

## Mechanics Detail

### Border Pressure Accumulation

`update_border_pressure()` runs every tick after `update_dispute_registry()`.

It scans `tile_tribe_idx` (the per-tick O(1) tile→tribe cache) and finds all pairs of alive tribes that share at least one adjacent hex edge. For each such pair:

- pressure increments by 1 (capped at `PRESSURE_CAP = 200`)

For pairs no longer sharing any adjacent edge:

- pressure decays by `PRESSURE_DECAY_PER_TICK = 2`
- entry removed when pressure reaches 0

This means tribes need ~80 ticks of sustained border contact before war declarations are valid.

### War Declaration Gates

Two points in the sim check border pressure before allowing war:

**`apply_opportunity_war` (every 60 ticks):**
- Non-endgame: skip war declaration if `border_pressure[(atk, def)] < PRESSURE_WAR_THRESHOLD (80)`
- Non-endgame: skip war declaration if `attacker.war_exhaustion_ticks > 0`
- Endgame (`alive_count <= tribes.len()/6`, ≈99 for 599 runs): both gates bypassed — stalemates must break

**`apply_dispute_resolution` (every 30 ticks):**
- War path: skip if `aggressor.war_exhaustion_ticks > 0` (dispute stays open until cooldown expires)

### War Exhaustion

After any war ends, exhaustion is assigned:

| Outcome | Who gets exhaustion |
|---|---|
| DefenderWon (attacker killed) | Defender (winner) |
| AttackerWon (defender absorbed) | Attacker (winner) |
| Timeout peace (`ticks_in_state > 120`) | Both sides |

Exhaustion = `POST_WAR_EXHAUSTION_TICKS = 150`.

During exhaustion, the tribe cannot initiate new wars through opportunity-war or dispute-resolution paths. Endgame force-wars bypass exhaustion.

---

## Expected Simulation Arc

1. **Ticks 0–20:** Tribes expand neutral territory (every 20 ticks minimum vs. old every-3-ticks)
2. **Ticks 20–80:** Borders form between neighbors; pressure builds
3. **Ticks 80+:** First opportunity wars become valid for high-aggression pairs
4. **Post-war:** 150-tick cooldown before another war declaration — tribes must rebuild and re-establish border pressure against a new target
5. **Endgame (~20 survivors):** All gates lifted; final wars forced to resolution

---

## Constants Reference

| Constant | Value | Location | Purpose |
|---|---|---|---|
| `expansion_cooldown_ticks` | 20 | `tribes.rs` | Min ticks between tile claims |
| `DISPUTE_GRACE_TICKS` | 180 | `simulation.rs` | Ticks before dispute forces resolution |
| `PRESSURE_WAR_THRESHOLD` | 80 | `simulation.rs` | Min pressure for war declaration |
| `PRESSURE_DECAY_PER_TICK` | 2 | `simulation.rs` | Pressure lost per tick when no border |
| `PRESSURE_CAP` | 200 | `simulation.rs` | Max pressure accumulation |
| `POST_WAR_EXHAUSTION_TICKS` | 150 | `simulation.rs` | Post-war cooldown duration |
| Opportunity war interval | 60 | `simulation.rs` `step()` | How often opportunity war fires |

---

## R11 — Fractional Border Fix + Regional Wars (2026-05-20)

The 60/40 fractional tile control mechanic (v3 §4) was architecturally present but never manifested. Three root causes identified and fixed.

### Constant changes (R11)

| Constant | Before | After | Reason |
|---|---|---|---|
| `DISPUTE_GRACE_TICKS` | 180 | **300** | More time for fractional splits to be visible before forced resolution |
| `FROZEN_BORDER_RECHECK_TICKS` | — | **200** (new) | How long a frozen stalemate persists before re-evaluation |
| `aggressor_wants_war` threshold | `> 0.40` | `> 0.55` | Fewer disputes escalate to war immediately |
| `defender_clearly_weaker` threshold | `< 0.6×` | `< 0.5×` | More lopsided ratio required before forcing retreat |

### Four dispute resolution paths (was two)

| Path | Condition | Outcome |
|------|-----------|---------|
| Alliance | Both tribes high goal + Team, unallied | Allied state |
| Frozen border | Neither war nor retreat conditions met | Claims persist; recheck in 200 ticks |
| Partial retreat | Weaker tribe (`str < 0.5×`), low aggression | Yields ~half contested tiles; rest stabilises as fractional border |
| Border war | Aggressor aggression > 0.55, evenly matched | `WarKind::BorderDispute` declared |

**Key fix:** Partial retreat now yields `(count+1)/2` tiles instead of all tiles, leaving the remaining co-occupied tiles as a stable visible fractional border. They re-register as a new dispute entry naturally.

**Frozen border:** Dispute timestamp is bumped by `+FROZEN_BORDER_RECHECK_TICKS` rather than the entry being removed. The 60/40 split stays on the map for hundreds of ticks for evenly matched neighbors.

### `WarKind` — regional vs full-scale wars

New enum in `war.rs`:

```rust
pub enum WarKind { FullScale, BorderDispute }
```

`WarState` now carries `kind: WarKind` and `contested_tiles: Vec<u32>`.

| Phase | FullScale | BorderDispute |
|-------|-----------|---------------|
| Casualty multiplier | 0.15 | 0.04 |
| Population floor | None (tribes can die) | 10% of `max_population` |
| Timeout | 120 ticks | 45 ticks |
| Timeout outcome | Stalemate peace, no territory | Winner takes `contested_tiles` only; loser keeps everything else |
| Post-war exhaustion | 150 ticks | 75 ticks |

Full-scale absorption behavior is **unchanged**.

### Updated constants reference

| Constant | Value | Notes |
|---|---|---|
| `DISPUTE_GRACE_TICKS` | 300 | Raised from 180 |
| `FROZEN_BORDER_RECHECK_TICKS` | 200 | New (R11) |
| `PRESSURE_WAR_THRESHOLD` | 80 | Unchanged |
| `PRESSURE_DECAY_PER_TICK` | 2 | Unchanged |
| `PRESSURE_CAP` | 200 | Unchanged |
| `POST_WAR_EXHAUSTION_TICKS` | 150 (full) / 75 (border) | Border wars use half |

---

## Validation

`border_pressure_pair_count` added to `ValidationMetrics` (serialized in `/api/metrics` response). Watch it during runs: a healthy sim should show many pressure pairs early, declining as wars and retreats resolve borders.

All 37 simulation tests pass after R11 changes (test `dispute_resolves_after_grace_period_expires` updated to jump to tick 299).
