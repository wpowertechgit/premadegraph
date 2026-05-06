# Track D Run — Dynamic World Generation

**Date:** 2026-05-03  
**Tasks completed:** D1, D2, D3

---

## Files changed

- `backend/genetic-neurosim/backend/src/world.rs`
- `backend/genetic-neurosim/backend/src/simulation.rs`

## What was done

### D1 — WorldGenerationConfig struct

Added `WorldGenerationConfig` to `world.rs`:

```rust
pub struct WorldGenerationConfig {
    pub seed: u64,
    pub tribe_count: usize,
    pub total_initial_population: u32,
    pub target_tiles_per_tribe: usize,
    pub target_population_density: f32,
    pub min_tiles: usize,
}
```

Added `WorldGenerationConfig::from_clusters(seed, clusters)` which sums `cluster_size` across the cluster slice for `total_initial_population`, defaulting to 50 per tribe when zero. `min_tiles` defaults to `TOTAL_TILES` (1600) so existing 40×40 behaviour is preserved.

Added `derive_grid_dims() -> (usize, usize)` implementing the formula:

```
target = max(min_tiles, tribe_count * target_tiles_per_tribe, total_initial_population / target_population_density)
side   = ceil(sqrt(target))
h      = ceil(target / side)
```

### D2 — Dynamic grid dimensions in WorldGrid

Added `grid_w`, `grid_h`, `total_tiles` as public instance fields to `WorldGrid`.

Changed `WorldGrid::new(seed, n_tribes)` → `WorldGrid::new(config: &WorldGenerationConfig)`. Dimensions are derived from config at construction; internal generation code uses local `grid_w`, `grid_h`, `total_tiles` variables instead of the global constants.

Converted the static utility methods `tile_xy`, `xy_tile`, `adjacent_tiles`, and `find_spawn_tiles` to instance methods using `self.grid_w`, `self.grid_h`, `self.total_tiles`. The public constants `GRID_W`, `GRID_H`, `TOTAL_TILES` are kept for compatibility.

Updated `simulation.rs`:
- Both `TribeSimulation::shared` and `reinitialize` now create a `WorldGenerationConfig::from_clusters` before calling `WorldGrid::new`.
- The static call `WorldGrid::adjacent_tiles(tile)` in `has_neighbor` replaced with `self.world.adjacent_tiles(tile)`.

### D3 — World dimensions in status

Added to `StatusResponse`:

```rust
pub world_width_tiles: usize,
pub world_height_tiles: usize,
pub total_tiles: usize,
pub world_seed: u64,
```

`TribeSimulation::status()` populates these from `self.world.grid_w`, `self.world.grid_h`, `self.world.total_tiles`, and `self.config.world_seed`.

`/api/status` now returns world dimensions and seed alongside tick/generation/alive state.

## Validation

```
cargo check  -> Finished dev profile, 14 warnings (all pre-existing), 0 errors
cargo test   -> test result: ok. 3 passed; 0 failed; 0 ignored
npm --prefix frontend run build -> ✓ built in 7.57s
```

### Tests added (world::tests)

| Test | What it verifies |
|---|---|
| `derive_grid_dims_respects_min_tiles` | Config with small tribe count still produces ≥ 1600 tiles |
| `derive_grid_dims_scales_with_large_tribe_count` | 500 tribes × 4 = 2000 > 1600, so grid has ≥ 2000 tiles |
| `worldgrid_new_produces_correct_tile_count` | `tiles.len() == grid_w * grid_h == total_tiles` |

## Notes

- No frontend changes — D3 is backend-only (REST status endpoint).
- Existing default runs still produce a 40×40 grid because `min_tiles = TOTAL_TILES = 1600`.
- Larger tribe counts (e.g. 500) will now produce proportionally larger grids automatically.
- Frontend still assumes 40×40 in canvas drawing; that is a follow-up concern for E3/F tasks.
- No behavior change to the simulation loop or binary WebSocket frame.
