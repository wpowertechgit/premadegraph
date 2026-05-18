# Task K Run — Territory Actions

**Date:** 2026-05-04
**Tasks:** K1, K2, K3
**Constraint:** Rust backend only. No frontend changes. No Node.js backend changes.

---

## Task completed: K1 / K2 / K3 — Territory Actions

### Files changed

- `backend/genetic-neurosim/backend/src/world.rs`
- `backend/genetic-neurosim/backend/src/simulation.rs`

---

## What was implemented

### K2 — Tile Owner Authority in WorldGrid

Added `pub tile_owner: Vec<u32>` to `WorldGrid` struct.
- Sentinel value `u32::MAX` = neutral/unowned.
- Initialized to `vec![u32::MAX; total_tiles]` in `WorldGrid::new()`.

Added three new methods to `WorldGrid`:

| Method | Purpose |
|---|---|
| `set_tile_owner(tile_idx, owner)` | Write owner; bounds-checked |
| `get_tile_owner_opt(tile_idx)` | Returns `Some(id)` if owned, `None` if neutral |
| `neutral_adjacent_tiles(territory)` | Returns deduped list of hex-adjacent neutral tiles across the whole territory slice |

Ownership is synchronized:
- On simulation init (`initialize_tribes`): each tribe's home tile is registered.
- On combat absorption: absorbed territory tiles are transferred to the attacker's id.

### K1 — Claim Adjacent Neutral Tile

Added `apply_territory_expansion(&mut self)` method to `TribeSimulation`.

Behaviour:
- Called every 20 ticks from `step()`, after `apply_state_machine()`.
- Eligible tribes: alive, in `Settling` or `Foraging` state.
- Condition: `resource_drive` (output index 1) ≥ 0.4.
- Finds neutral hex-adjacent tiles via `world.neutral_adjacent_tiles`.
- Each eligible tribe claims at most one neutral tile per call.
- A tile cannot be claimed by two tribes in the same round (deduplication via `newly_claimed` HashSet).
- Updates both `tribe.territory` (Vec<u16>) and `world.tile_owner`.
- Emits `EventType::TileClaimed` (severity Debug) with `tile_id` set.

### K3 — Biome Composition per Tribe

Added `biome_composition_for_tribe(tribe_id) -> HashMap<String, usize>` method.
- Iterates tribe's territory tiles.
- Maps biome variant to lowercase name string ("plains", "forest", "desert", "mountain", "swamp", "river").
- Returns counts per biome type.

Added `biome_composition: HashMap<String, usize>` field to `TribeSnapshotResponse`.
- Populated in `tribe_snapshot()`.
- Included in JSON response from `GET /api/tribes/:id`.
- Example output: `{"plains": 3, "forest": 1, "desert": 2}`.

---

## Validation

```
cargo check -> Finished `dev` profile [unoptimized + debuginfo] target(s) in 14.84s
              14 warnings (all pre-existing, no new warnings introduced)
              0 errors
```

```
npm --prefix frontend run build -> ✓ built in 6.46s
                                   0 errors
```

---

## Notes

- `tile_ownership_snapshot()` still builds from `tribe.territory` for compatibility with live tribe state
  (dead tribes' tiles return as neutral, which matches existing frontend expectation).
- `world.tile_owner` is the new authoritative world-side index; tribe.territory remains for backward compat.
- Territory claims are deterministic: first neutral hex-adjacent tile in `hex_adjacent_tiles` order.
- No frontend controls added. No Node.js backend touched.
- Deferred: contested tiles, tile loss on extinction, fortify/abandon mechanics (out of K1-K3 scope).
