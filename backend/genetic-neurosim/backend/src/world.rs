use rand::{rngs::SmallRng, Rng, SeedableRng};

pub const WORLD_W: u32 = 2000;
pub const WORLD_H: u32 = 2000;
pub const TILE_SIZE: u32 = 50;
pub const GRID_W: usize = 40;
pub const GRID_H: usize = 40;
pub const TOTAL_TILES: usize = GRID_W * GRID_H; // 1600

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

pub struct WorldGrid {
    pub tiles: Vec<BiomeTile>, // length TOTAL_TILES, row-major [y * GRID_W + x]
    last_sent_food: Vec<f32>,
}

impl WorldGrid {
    pub fn new(seed: u64, n_tribes: usize) -> WorldGrid {
        let mut rng = SmallRng::seed_from_u64(seed);

        let n_centroids = n_tribes.max(6).min(30);

        // Pick random centroid tile positions
        let mut centroid_coords: Vec<(usize, usize)> = Vec::with_capacity(n_centroids);
        for _ in 0..n_centroids {
            let cx = rng.random_range(0..GRID_W);
            let cy = rng.random_range(0..GRID_H);
            centroid_coords.push((cx, cy));
        }

        // Assign centroid biomes (0..5 excludes River=5)
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
        let mut biome_map: Vec<Biome> = Vec::with_capacity(TOTAL_TILES);
        for i in 0..TOTAL_TILES {
            let (tx, ty) = WorldGrid::tile_xy(i);
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
            let mut rx: usize = rng.random_range(0..GRID_W);
            for ry in 0..GRID_H {
                let idx = WorldGrid::xy_tile(rx, ry);
                biome_map[idx] = Biome::River;

                if ry < GRID_H - 1 {
                    let roll: f32 = rng.random();
                    if roll < 0.70 {
                        // move down — handled by loop increment
                    } else if roll < 0.85 {
                        // move left
                        if rx > 0 {
                            rx -= 1;
                        }
                    } else {
                        // move right
                        if rx < GRID_W - 1 {
                            rx += 1;
                        }
                    }
                }
            }
        }

        // Build tiles
        let mut tiles: Vec<BiomeTile> = Vec::with_capacity(TOTAL_TILES);
        for i in 0..TOTAL_TILES {
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

        let last_sent_food = vec![0.0f32; TOTAL_TILES];

        WorldGrid {
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
    /// Updates the internal snapshot for returned tiles.
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
    pub fn tile_xy(index: usize) -> (usize, usize) {
        (index % GRID_W, index / GRID_W)
    }

    /// Convert (x, y) coordinates to a flat tile index.
    pub fn xy_tile(x: usize, y: usize) -> usize {
        y * GRID_W + x
    }

    /// Return `n` distinct spawn tile indices spread across the grid.
    pub fn find_spawn_tiles(&self, n: usize, rng: &mut SmallRng) -> Vec<u16> {
        if n == 0 {
            return Vec::new();
        }

        // Divide grid into n zones; pick a random non-river tile from each.
        let zone_w = GRID_W;
        let zone_h = GRID_H;
        let cols = (n as f32).sqrt().ceil() as usize;
        let rows = (n + cols - 1) / cols;

        let col_size = (zone_w + cols - 1) / cols;
        let row_size = (zone_h + rows - 1) / rows;

        let mut result: Vec<u16> = Vec::with_capacity(n);
        let mut used: std::collections::HashSet<u16> = std::collections::HashSet::new();

        'zones: for zone_idx in 0..n {
            let col = zone_idx % cols;
            let row = zone_idx / cols;

            let x_start = col * col_size;
            let x_end = ((col + 1) * col_size).min(GRID_W);
            let y_start = row * row_size;
            let y_end = ((row + 1) * row_size).min(GRID_H);

            // Collect non-river candidates in this zone
            let mut candidates: Vec<u16> = Vec::new();
            for ty in y_start..y_end {
                for tx in x_start..x_end {
                    let idx = WorldGrid::xy_tile(tx, ty) as u16;
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
            for i in 0..TOTAL_TILES {
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

    /// Return up to 4 adjacent tile indices (N/S/E/W), clamped to grid bounds.
    pub fn adjacent_tiles(index: usize) -> Vec<usize> {
        let (x, y) = WorldGrid::tile_xy(index);
        let mut neighbors = Vec::with_capacity(4);

        if y > 0 {
            neighbors.push(WorldGrid::xy_tile(x, y - 1)); // North
        }
        if y + 1 < GRID_H {
            neighbors.push(WorldGrid::xy_tile(x, y + 1)); // South
        }
        if x > 0 {
            neighbors.push(WorldGrid::xy_tile(x - 1, y)); // West
        }
        if x + 1 < GRID_W {
            neighbors.push(WorldGrid::xy_tile(x + 1, y)); // East
        }

        neighbors
    }
}
