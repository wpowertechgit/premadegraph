# Task R11 Run — Border War System: Fractional Territory + Regional Wars

**Date:** 2026-05-20
**Status:** Done

## Problem

The 60/40 fractional tile control mechanic (v3 §4) was architecturally present in the data model (`TileControl.control_percentage`, `add_tile_occupant(..., 0.4)`, `tile_is_disputed`) but never manifested in practice. Root causes:

1. **Disputes resolved too fast** — `DISPUTE_GRACE_TICKS = 180` meant fractional borders were wiped within 3 minutes of simulation time before they could be seen
2. **Retreat was total** — the retreat path in `apply_dispute_resolution` removed the weaker tribe from *all* contested tiles, producing a clean 100%/0% boundary instead of a stable fractional one
3. **War thresholds were too low** — `aggressor_wants_war` fired at aggression > 0.40, escalating most disputes to full-scale war before the frozen border had time to exist
4. **No regional war type** — once `BehaviorState::AtWar` fired, `apply_combat` always ran the full absorption path (`set_tile_owner` → 100% conquest). There was no mechanism for a limited border skirmish that ends with tile transfer and both tribes surviving.

---

## Files changed

| File | Change |
|------|--------|
| `backend/src/war.rs` | Added `WarKind` enum (`FullScale` / `BorderDispute`); added `kind` + `contested_tiles: Vec<u32>` fields to `WarState` and `WarSummary` |
| `backend/src/simulation.rs` | Dispute resolution overhaul, combat fork on war kind, tuned constants (see below) |

---

## Changes in `simulation.rs`

### Constant changes

| Constant | Before | After | Reason |
|----------|--------|-------|--------|
| `DISPUTE_GRACE_TICKS` | 180 | 300 | More time for fractional borders to be visible before forced resolution |
| `FROZEN_BORDER_RECHECK_TICKS` | — (new) | 200 | How long a frozen stalemate persists before re-evaluation |
| `aggressor_wants_war` threshold | `> 0.40` | `> 0.55` | Fewer disputes escalate to war; more become frozen borders |
| `defender_clearly_weaker` threshold | `< 0.6×` strength | `< 0.5×` strength | Retreats require more lopsided balance; more become frozen borders |

### `apply_dispute_resolution` — four paths (was two)

| Path | Condition | Outcome |
|------|-----------|---------|
| **Alliance** | Both tribes high goal + Team, unallied | Merge into allied state, dispute closed |
| **War** | Aggressor aggression > 0.55, defender not clearly weaker, exhaustion = 0 | `BehaviorState::AtWar` declared as `WarKind::BorderDispute` with `contested_tiles` populated |
| **Partial retreat** | Defender clearly weaker (`str_def < str_atk * 0.5`) | Weaker tribe yields ~half its contested tiles, keeps the rest as stable fractional border; dispute closed; remaining co-occupied tiles re-register naturally |
| **Frozen border** | Neither war nor retreat conditions met | Dispute entry timestamp reset by `+FROZEN_BORDER_RECHECK_TICKS`; fractional claims persist unchanged; re-evaluated after 200 ticks |

The partial retreat change is the key fix for the 60/40 visibility problem: instead of yielding all contested tiles, the weaker tribe yields `(count + 1) / 2` tiles and holds the rest, creating a stable fractional border line.

### `apply_combat` — war kind fork

Border dispute wars differ from full-scale wars in every phase:

| Phase | FullScale | BorderDispute |
|-------|-----------|---------------|
| Casualty multiplier | 0.15 | 0.04 |
| Population floor | None — tribes can reach 0 | 10% of `max_population` (neither tribe dies) |
| Timeout | 120 ticks | 45 ticks |
| Timeout resolution | Stalemate peace, no territory change | Winner (higher relative casualties inflicted) takes `contested_tiles` only; loser keeps everything else |
| Post-war exhaustion | `POST_WAR_EXHAUSTION_TICKS` (150) | `POST_WAR_EXHAUSTION_TICKS / 2` (75) |

Full-scale war absorption behavior (both attacker-wins and defender-wins paths) is **unchanged**.

### `WarState` construction — all five sites updated

All five `WarState` push sites in `simulation.rs` now include `kind` and `contested_tiles`:

- Proactive opportunity war → `FullScale`, `contested_tiles: vec![]`
- Surrounded breakout war → `FullScale`, `contested_tiles: vec![]`
- `apply_combat` untargeted assignment → `FullScale`, `contested_tiles: vec![]`
- Dispute resolution war path → `BorderDispute`, `contested_tiles` populated from live disputed tile scan at war declaration time

---

## How the full flow works now

```
Tribe A expands into Tribe B's tile
  → add_tile_occupant(..., 0.4) → tile marked disputed (60/40 visible on map)
  → dispute_registry records first-seen tick

After 300 ticks of dispute:
  → apply_dispute_resolution evaluates the pair

  Path 1 — Frozen border (most common for evenly matched tribes):
    → Dispute timestamp reset +200 ticks
    → 60/40 split remains on map for another 200 ticks
    → Re-evaluated; may stay frozen indefinitely if neither side changes

  Path 2 — Partial retreat (weaker tribe, not aggressive enough for war):
    → Weaker tribe yields half the contested tiles (100% to stronger)
    → Keeps other half as stable fractional border
    → Remaining co-occupied tiles re-register as new dispute

  Path 3 — Border war (aggressive tribe, evenly matched):
    → WarKind::BorderDispute declared with specific contested_tiles list
    → Light combat (0.04×) — both tribes stay healthy
    → After 45 ticks: winner takes contested_tiles, loser keeps core territory
    → Both return to Peace, 75-tick cooldown

  Path 4 — Full-scale war (high aggression, all other paths):
    → WarKind::FullScale — existing absorption behavior unchanged
    → Winner takes all territory
```

---

## Test changes

- `dispute_resolves_after_grace_period_expires`: updated jump tick from 179 → 299 to match new `DISPUTE_GRACE_TICKS = 300`

---

## Validation

- `cargo build` — 0 errors, 0 warnings
- `cargo test` — **37 passed, 0 failed** (1 ignored, unchanged)
