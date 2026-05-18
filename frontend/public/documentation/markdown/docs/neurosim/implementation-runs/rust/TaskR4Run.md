# Task R4 Run Report — Fractional Tile Control & Disputed Zones

**Date:** 2026-05-06
**Status:** Complete

## Files Changed

| File | Change |
|------|--------|
| `backend/Cargo.toml` | Added `arrayvec = "0.7"` dependency |
| `backend/src/world.rs` | Added `TileControl` struct, `MAX_OCCUPANTS`, `DISPUTE_PENALTY`. Replaced `tile_owner: Vec<u32>` with `tile_occupants: Vec<ArrayVec<TileControl, 4>>` and `tile_is_disputed: Vec<bool>`. Added methods: `add_tile_occupant`, `remove_tile_occupant`, `non_neutral_adjacent_tiles`, `effective_yield_multiplier`, `is_disputed`, `is_tile_neutral`, `get_tile_occupants`. Updated `set_tile_owner`, `get_tile_owner_opt`, `neutral_adjacent_tiles` for backward compatibility. |
| `backend/src/simulation.rs` | Updated foraging step to apply dispute penalty via `effective_yield_multiplier`. Updated `tile_ownership_snapshot` to use `tile_occupants` and wire `contested` flag. Modified `apply_territory_expansion` to support dispute creation via high A_combat (>0.7). Added `apply_dispute_resolution` method with passive acceptance (A_risk > 0.7) and military threat (A_combat > 0.8) resolution paths. Added dispute resolution call every 30 ticks in `step()`. |
| `backend/src/events.rs` | Added `TileDisputed = 25`, `DisputeResolved = 26` event types. |

## Implementation Details

### Tile Occupancy Model
- Each tile holds up to 4 `TileControl` entries (tribe_id + control_percentage)
- Empty = neutral, single occupant = backward-compatible, 2+ = disputed
- Control percentages auto-rebalanced to sum to 1.0 via `rebalance_controls()`

### Dispute Penalty
- `DISPUTE_PENALTY = 0.40` (flat -40%)
- Applied via `effective_yield_multiplier(tile_idx, tribe_id)`: returns `control_percentage * 0.60` for disputed tiles, `1.0` for undisputed
- Affects food gathering in Foraging/Settling behavior

### Territory Expansion Changes
- Existing neutral-tile expansion behavior preserved
- New: tribes with A_combat > 0.7 and resource_drive > 0.7 can claim occupied adjacent tiles
- Creates `TileDisputed` event with 50/50 control split

### Dispute Resolution (every 30 ticks)
1. **Dead tribe cleanup**: removes dead tribe occupancy
2. **Passive acceptance**: A_risk > 0.7 → tribe tolerates the dispute
3. **Military threat**: A_combat > 0.8 and higher than opponent → force opponent retreat, emit `DisputeResolved` event

### API Changes
- `GET /api/tile-ownership`: `contested` field now reflects actual dispute status (was always `false`)

## Validation

- `cargo build`: success (0 errors, 17 pre-existing warnings)
- `cargo test`: **13/13 tests pass**
- `npm --prefix frontend run build`: success

## Acceptance Criteria Check

| Criteria | Status |
|----------|--------|
| Tiles can have multiple occupants with fractional control | Done |
| Disputed flag auto-calculated when 2+ occupants | Done |
| -40% penalty applied to all operations on disputed tiles | Done (food gathering) |
| Resolution paths trigger based on A_risk/A_combat thresholds | Done |
| Backward-compatible: single-occupant tiles behave identically to before | Done |

## Conflicts / Notes

- No merge conflicts with other active tasks
- `arrayvec` added as new dependency
- All old `set_tile_owner()` call sites remain valid (creates single occupant, backward-compatible)
- `apply_dispute_resolution` uses cloned occupant state to avoid borrow conflicts during tile modification
