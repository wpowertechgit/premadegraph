use rand::{rngs::SmallRng, Rng, SeedableRng};

pub const WORLD_W: u32 = 2000;
pub const WORLD_H: u32 = 2000;
pub const TILE_SIZE: u32 = 50;
pub const GRID_W: usize = 40;
pub const GRID_H: usize = 40;
pub const TOTAL_TILES: usize = GRID_W * GRID_H; // 1600

// ─── WorldGenerationConfig ────────────────────────────────────────────────────

/// Drives dynamic map sizing. `min_tiles` defaults to TOTAL_TILES so the
/// current 40x40 behaviour is preserved unless a larger world is needed.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WorldGenerationConfig {
    pub seed: u64,
    pub tribe_count: usize,
    pub total_initial_population: u32,
    pub target_tiles_per_tribe: usize,
    pub target_population_density: f32,
    pub min_tiles: usize,
}

impl WorldGenerationConfig {
    /// Derive a config from a cluster slice. Sums cluster_size for population;
    /// falls back to 50 members per tribe when cluster_size is zero.
    pub fn from_clusters(seed: u64, clusters: &[crate::simulation::ClusterProfile]) -> Self {
        let tribe_count = clusters.len();
        let total_initial_population = clusters
            .iter()
            .map(|c| c.cluster_size)
            .sum::<u32>()
            .max(tribe_count as u32 * 50);
        Self {
            seed,
            tribe_count,
            total_initial_population,
            target_tiles_per_tribe: 4,
            target_population_density: 10.0,
            min_tiles: TOTAL_TILES,
        }
    }

    /// Compute (grid_w, grid_h) so the map is large enough for all tribes.
    /// Formula: target = max(min_tiles, tribe_count * target_tiles_per_tribe,
    ///                       total_initial_population / target_population_density)
    pub fn derive_grid_dims(&self) -> (usize, usize) {
        let by_tribes = (self.tribe_count * self.target_tiles_per_tribe).max(1);
        let by_pop =
            (self.total_initial_population as f32 / self.target_population_density).ceil() as usize;
        let target = self.min_tiles.max(by_tribes).max(by_pop);
        let side = (target as f32).sqrt().ceil() as usize;
        let h = (target + side - 1) / side;
        (side, h)
    }
}

// ─── Biome ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[repr(u8)]
pub enum Biome {
    Plains = 0,
    Forest = 1,
    Desert = 2,
    Mountain = 3,
    Swamp = 4,
    River = 5,
}

pub struct BiomeStats {
    pub food_density: f32,
    pub move_cost: f32,
    pub defense_bonus: f32,
    pub disease_rate: f32,
}

impl Biome {
    pub fn stats(self) -> BiomeStats {
        match self {
            Biome::Plains => BiomeStats {
                food_density: 0.7,
                move_cost: 1.0,
                defense_bonus: 0.0,
                disease_rate: 0.01,
            },
            Biome::Forest => BiomeStats {
                food_density: 0.9,
                move_cost: 1.4,
                defense_bonus: 0.3,
                disease_rate: 0.03,
            },
            Biome::Desert => BiomeStats {
                food_density: 0.2,
                move_cost: 1.2,
                defense_bonus: 0.1,
                disease_rate: 0.02,
            },
            Biome::Mountain => BiomeStats {
                food_density: 0.3,
                move_cost: 2.0,
                defense_bonus: 0.5,
                disease_rate: 0.01,
            },
            Biome::Swamp => BiomeStats {
                food_density: 0.5,
                move_cost: 1.8,
                defense_bonus: 0.1,
                disease_rate: 0.08,
            },
            Biome::River => BiomeStats {
                food_density: 0.6,
                move_cost: 3.0,
                defense_bonus: 0.0,
                disease_rate: 0.02,
            },
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct BiomeTile {
    pub biome: Biome,
    pub food: f32,
    pub max_food: f32,
    pub food_regen: f32,
    pub move_cost: f32,
    pub defense_bonus: f32,
    pub disease_rate: f32,
}

// ─── WorldGrid ────────────────────────────────────────────────────────────────

pub struct WorldGrid {
    pub grid_w: usize,
    pub grid_h: usize,
    pub total_tiles: usize,
    pub tiles: Vec<BiomeTile>,
    last_sent_food: Vec<f32>,
}

impl WorldGrid {
    pub fn new(config: &WorldGenerationConfig) -> WorldGrid {
        let (grid_w, grid_h) = config.derive_grid_dims();
        let total_tiles = grid_w * grid_h;

        let mut rng = SmallRng::seed_from_u64(config.seed);
        let n_centroids = config.tribe_count.max(6).min(30);

        let mut centroid_coords: Vec<(usize, usize)> = Vec::with_capacity(n_centroids);
        for _ in 0..n_centroids {
            let cx = rng.random_range(0..grid_w);
            let cy = rng.random_range(0..grid_h);
            centroid_coords.push((cx, cy));
        }

        let centroid_biomes: Vec<Biome> = (0..n_centroids)
            .map(|_| {
                let b: u8 = rng.random_range(0u8..5u8);
                match b {
                    0 => Biome::Plains,
                    1 => Biome::Forest,
                    2 => Biome::Desert,
                    3 => Biome::Mountain,
                    _ => Biome::Swamp,
                }
            })
            .collect();

        // Voronoi: assign each tile to nearest centroid by Manhattan distance
        let mut biome_map: Vec<Biome> = Vec::with_capacity(total_tiles);
        for i in 0..total_tiles {
            let tx = i % grid_w;
            let ty = i / grid_w;
            let nearest = centroid_coords
                .iter()
                .enumerate()
                .min_by_key(|(_, &(cx, cy))| {
                    let dx = if tx > cx { tx - cx } else { cx - tx };
                    let dy = if ty > cy { ty - cy } else { cy - ty };
                    dx + dy
                })
                .map(|(idx, _)| idx)
                .unwrap_or(0);
            biome_map.push(centroid_biomes[nearest]);
        }

        // River pass: 2 random-walk river paths from top row downward
        for _ in 0..2 {
            let mut rx: usize = rng.random_range(0..grid_w);
            for ry in 0..grid_h {
                let idx = ry * grid_w + rx;
                biome_map[idx] = Biome::River;

                if ry < grid_h - 1 {
                    let roll: f32 = rng.random();
                    if roll < 0.70 {
                        // move down — handled by loop increment
                    } else if roll < 0.85 {
                        if rx > 0 {
                            rx -= 1;
                        }
                    } else if rx < grid_w - 1 {
                        rx += 1;
                    }
                }
            }
        }

        // Build tiles
        let mut tiles: Vec<BiomeTile> = Vec::with_capacity(total_tiles);
        for i in 0..total_tiles {
            let biome = biome_map[i];
            let stats = biome.stats();
            if biome == Biome::River {
                tiles.push(BiomeTile {
                    biome,
                    food: 0.6,
                    max_food: stats.food_density,
                    food_regen: stats.food_density * 0.002,
                    move_cost: 3.0,
                    defense_bonus: stats.defense_bonus,
                    disease_rate: stats.disease_rate,
                });
            } else {
                let noise: f32 = rng.random_range(0.8f32..1.0f32);
                tiles.push(BiomeTile {
                    biome,
                    food: stats.food_density * noise,
                    max_food: stats.food_density,
                    food_regen: stats.food_density * 0.002,
                    move_cost: stats.move_cost,
                    defense_bonus: stats.defense_bonus,
                    disease_rate: stats.disease_rate,
                });
            }
        }

        let last_sent_food = vec![0.0f32; total_tiles];

        WorldGrid {
            grid_w,
            grid_h,
            total_tiles,
            tiles,
            last_sent_food,
        }
    }

    /// Regenerate food on all non-river tiles.
    pub fn tick_food(&mut self) {
        for tile in &mut self.tiles {
            if tile.biome == Biome::River {
                continue;
            }
            tile.food = (tile.food + tile.food_regen).min(tile.max_food);
        }
    }

    /// Return tiles whose food changed by more than 0.05 since last call.
    pub fn changed_food_tiles(&mut self) -> Vec<(u16, f32)> {
        let mut result = Vec::new();
        for (i, tile) in self.tiles.iter().enumerate() {
            if (tile.food - self.last_sent_food[i]).abs() > 0.05 {
                result.push((i as u16, tile.food));
                self.last_sent_food[i] = tile.food;
            }
        }
        result
    }

    /// Convert a flat tile index to (x, y) coordinates.
    pub fn tile_xy(&self, index: usize) -> (usize, usize) {
        (index % self.grid_w, index / self.grid_w)
    }

    /// Convert (x, y) coordinates to a flat tile index.
    pub fn xy_tile(&self, x: usize, y: usize) -> usize {
        y * self.grid_w + x
    }

    /// Return `n` distinct spawn tile indices spread across the grid.
    pub fn find_spawn_tiles(&self, n: usize, rng: &mut SmallRng) -> Vec<u16> {
        if n == 0 {
            return Vec::new();
        }

        let cols = (n as f32).sqrt().ceil() as usize;
        let rows = (n + cols - 1) / cols;
        let col_size = (self.grid_w + cols - 1) / cols;
        let row_size = (self.grid_h + rows - 1) / rows;

        let mut result: Vec<u16> = Vec::with_capacity(n);
        let mut used: std::collections::HashSet<u16> = std::collections::HashSet::new();

        'zones: for zone_idx in 0..n {
            let col = zone_idx % cols;
            let row = zone_idx / cols;

            let x_start = col * col_size;
            let x_end = ((col + 1) * col_size).min(self.grid_w);
            let y_start = row * row_size;
            let y_end = ((row + 1) * row_size).min(self.grid_h);

            let mut candidates: Vec<u16> = Vec::new();
            for ty in y_start..y_end {
                for tx in x_start..x_end {
                    let idx = self.xy_tile(tx, ty) as u16;
                    if self.tiles[idx as usize].biome != Biome::River && !used.contains(&idx) {
                        candidates.push(idx);
                    }
                }
            }

            if !candidates.is_empty() {
                let pick = candidates[rng.random_range(0..candidates.len())];
                used.insert(pick);
                result.push(pick);
                continue 'zones;
            }

            // Fallback: any unused tile
            for i in 0..self.total_tiles {
                let idx = i as u16;
                if !used.contains(&idx) {
                    used.insert(idx);
                    result.push(idx);
                    continue 'zones;
                }
            }
        }

        result
    }

    /// Add `amount` food to every non-river tile, capped at `max_food`.
    /// Returns the number of tiles modified.
    pub fn spawn_food_global(&mut self, amount: f32) -> usize {
        let mut changed = 0;
        for tile in &mut self.tiles {
            if tile.biome != Biome::River {
                tile.food = (tile.food + amount).min(tile.max_food);
                changed += 1;
            }
        }
        changed
    }

    /// Return up to 4 adjacent tile indices (N/S/E/W), clamped to grid bounds.
    pub fn adjacent_tiles(&self, index: usize) -> Vec<usize> {
        let (x, y) = self.tile_xy(index);
        let mut neighbors = Vec::with_capacity(4);

        if y > 0 {
            neighbors.push(self.xy_tile(x, y - 1));
        }
        if y + 1 < self.grid_h {
            neighbors.push(self.xy_tile(x, y + 1));
        }
        if x > 0 {
            neighbors.push(self.xy_tile(x - 1, y));
        }
        if x + 1 < self.grid_w {
            neighbors.push(self.xy_tile(x + 1, y));
        }

        neighbors
    }

    /// Return up to 6 hex-adjacent tile indices using odd-r offset (pointy-top).
    /// Matches the frontend `neurosimHex.ts` coordinate convention.
    pub fn hex_adjacent_tiles(&self, index: usize) -> Vec<usize> {
        let (col, row) = self.tile_xy(index);
        let mut neighbors = Vec::with_capacity(6);

        // Candidate (col, row) offsets depend on whether the row is even or odd.
        let candidates: &[(i64, i64)] = if row % 2 == 0 {
            // even row
            &[(-1, 0), (1, 0), (-1, -1), (0, -1), (-1, 1), (0, 1)]
        } else {
            // odd row
            &[(-1, 0), (1, 0), (0, -1), (1, -1), (0, 1), (1, 1)]
        };

        for &(dc, dr) in candidates {
            let nc = col as i64 + dc;
            let nr = row as i64 + dr;
            if nc >= 0 && nr >= 0 && nc < self.grid_w as i64 && nr < self.grid_h as i64 {
                neighbors.push(self.xy_tile(nc as usize, nr as usize));
            }
        }

        neighbors
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_grid_dims_respects_min_tiles() {
        let config = WorldGenerationConfig {
            seed: 42,
            tribe_count: 5,
            total_initial_population: 100,
            target_tiles_per_tribe: 4,
            target_population_density: 10.0,
            min_tiles: TOTAL_TILES,
        };
        let (w, h) = config.derive_grid_dims();
        assert!(w * h >= TOTAL_TILES, "grid must be at least {TOTAL_TILES} tiles");
    }

    #[test]
    fn derive_grid_dims_scales_with_large_tribe_count() {
        let config = WorldGenerationConfig {
            seed: 42,
            tribe_count: 500,
            total_initial_population: 0,
            target_tiles_per_tribe: 4,
            target_population_density: 10.0,
            min_tiles: TOTAL_TILES,
        };
        let (w, h) = config.derive_grid_dims();
        // 500 * 4 = 2000 > 1600 min — must have at least 2000 tiles
        assert!(w * h >= 2000, "grid must scale with tribe count");
    }

    #[test]
    fn hex_adjacent_center_has_six_neighbors() {
        let config = WorldGenerationConfig {
            seed: 1,
            tribe_count: 4,
            total_initial_population: 0,
            target_tiles_per_tribe: 4,
            target_population_density: 10.0,
            min_tiles: TOTAL_TILES,
        };
        let grid = WorldGrid::new(&config);
        // Center tile should have exactly 6 neighbors
        let center = (grid.grid_h / 2) * grid.grid_w + (grid.grid_w / 2);
        assert_eq!(grid.hex_adjacent_tiles(center).len(), 6);
    }

    #[test]
    fn hex_adjacent_corner_has_fewer_than_six() {
        let config = WorldGenerationConfig {
            seed: 1,
            tribe_count: 4,
            total_initial_population: 0,
            target_tiles_per_tribe: 4,
            target_population_density: 10.0,
            min_tiles: TOTAL_TILES,
        };
        let grid = WorldGrid::new(&config);
        // Top-left corner tile (index 0) has fewer than 6 neighbors
        assert!(grid.hex_adjacent_tiles(0).len() < 6);
        // All returned indices must be in-bounds
        for &n in &grid.hex_adjacent_tiles(0) {
            assert!(n < grid.total_tiles);
        }
    }

    #[test]
    fn hex_adjacent_edge_has_three_or_four_neighbors() {
        let config = WorldGenerationConfig {
            seed: 1,
            tribe_count: 4,
            total_initial_population: 0,
            target_tiles_per_tribe: 4,
            target_population_density: 10.0,
            min_tiles: TOTAL_TILES,
        };
        let grid = WorldGrid::new(&config);
        // Top edge, middle column (row=0, col=grid_w/2)
        let edge = grid.grid_w / 2;
        let n = grid.hex_adjacent_tiles(edge).len();
        assert!(n >= 3 && n <= 4, "edge tile should have 3-4 neighbors, got {n}");
        for &idx in &grid.hex_adjacent_tiles(edge) {
            assert!(idx < grid.total_tiles);
        }
    }

    #[test]
    fn worldgrid_new_produces_correct_tile_count() {
        let config = WorldGenerationConfig {
            seed: 1,
            tribe_count: 10,
            total_initial_population: 500,
            target_tiles_per_tribe: 4,
            target_population_density: 10.0,
            min_tiles: TOTAL_TILES,
        };
        let grid = WorldGrid::new(&config);
        assert_eq!(grid.tiles.len(), grid.total_tiles);
        assert_eq!(grid.grid_w * grid.grid_h, grid.total_tiles);
    }
}
