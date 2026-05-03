use std::{
    cmp::Ordering,
    collections::HashMap,
    sync::Arc,
};

use parking_lot::RwLock;
use rand::{prelude::IndexedRandom, rngs::SmallRng, Rng, SeedableRng};
use serde::{Deserialize, Serialize};

pub type SharedSimulation = Arc<RwLock<TribeSimulation>>;

pub const INPUT_COUNT: usize = 8;
pub const OUTPUT_COUNT: usize = 3;

// ─── ClusterProfile ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ClusterProfile {
    pub id: String,
    pub size_ratio: f32,
    pub mean_opscore: f32,
    pub opscore_stddev: f32,
    pub cohesion: f32,
    pub internal_edge_ratio: f32,
    // Primary artifacts (0.0–1.0 after /4.5 normalization)
    #[serde(default)]
    pub a_combat: f32,
    #[serde(default)]
    pub a_risk: f32,
    #[serde(default)]
    pub a_resource: f32,
    #[serde(default)]
    pub a_map_objective: f32,
    #[serde(default)]
    pub a_team: f32,
    // Sub-artifacts
    #[serde(default)]
    pub fight_conversion: f32,
    #[serde(default)]
    pub damage_pressure: f32,
    #[serde(default)]
    pub death_cost: f32,
    #[serde(default)]
    pub survival_quality: f32,
    #[serde(default)]
    pub economy: f32,
    #[serde(default)]
    pub tempo: f32,
    #[serde(default)]
    pub vision_control: f32,
    #[serde(default)]
    pub objective_conversion: f32,
    #[serde(default)]
    pub setup_control: f32,
    #[serde(default)]
    pub protection_support: f32,
    // Derived
    #[serde(default)]
    pub feed_risk: f32,
    #[serde(default)]
    pub cluster_size: u32,
    #[serde(default)]
    pub founder_puuids: Vec<String>,
}

// ─── ControlConfig ───────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
pub struct ControlConfig {
    pub clusters: Vec<ClusterProfile>,
    pub world_seed: u64,
    pub tick_rate: u32,
    pub population_size: u32,
    pub mutation_rate: f32,
    pub max_generations: u32,
    pub food_spawn_rate: f32,
    pub energy_decay: f32,
}

impl Default for ControlConfig {
    fn default() -> Self {
        Self {
            clusters: Vec::new(),
            world_seed: 42,
            tick_rate: 20,
            population_size: 100,
            mutation_rate: 0.05,
            max_generations: 1000,
            food_spawn_rate: 0.1,
            energy_decay: 0.01,
        }
    }
}

// ─── ConfigPatch ─────────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
pub struct ConfigPatch {
    pub mutation_rate: Option<f32>,
    pub population_size: Option<u32>,
    pub max_generations: Option<u32>,
    pub food_spawn_rate: Option<f32>,
    pub energy_decay: Option<f32>,
    pub tick_rate: Option<u32>,
    pub world_seed: Option<u64>,
}

// ─── Recording types ─────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
pub struct SaveRecordingRequest {
    pub name: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ReplayRecordingRequest {
    pub recording_id: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct RecordingSummary {
    pub id: String,
    pub name: String,
    pub tick_count: u64,
    pub created_at: String,
}

struct Recording {
    id: String,
    name: String,
    frames: Vec<Vec<u8>>,
    created_at: String,
}

// ─── StatusResponse / GodModeResponse ────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct StatusResponse {
    pub tick: u64,
    pub generation: u32,
    pub alive_count: usize,
    pub halted: bool,
}

#[derive(serde::Serialize)]
pub struct GodModeResponse {
    pub killed: u32,
}

// ─── Vec2 ─────────────────────────────────────────────────────────────────────

#[derive(Clone, Copy, Default)]
struct Vec2 {
    x: f32,
    y: f32,
}

impl Vec2 {
    fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }
}

impl std::ops::Add for Vec2 {
    type Output = Vec2;
    fn add(self, rhs: Self) -> Self::Output {
        Vec2::new(self.x + rhs.x, self.y + rhs.y)
    }
}

impl std::ops::Mul<f32> for Vec2 {
    type Output = Vec2;
    fn mul(self, rhs: f32) -> Self::Output {
        Vec2::new(self.x * rhs, self.y * rhs)
    }
}

// ─── SpatialHash ─────────────────────────────────────────────────────────────

#[derive(Clone)]
struct SpatialHash {
    cell_size: f32,
    cols: usize,
    rows: usize,
    buckets: Vec<Vec<usize>>,
}

const _WORLD_WIDTH: f32 = 800.0;
const _WORLD_HEIGHT: f32 = 800.0;

impl SpatialHash {
    fn new(cell_size: f32) -> Self {
        let cols = (_WORLD_WIDTH / cell_size).ceil() as usize;
        let rows = (_WORLD_HEIGHT / cell_size).ceil() as usize;
        Self {
            cell_size,
            cols,
            rows,
            buckets: vec![Vec::new(); cols * rows],
        }
    }

    fn _rebuild(&mut self, items: &[Vec2]) {
        for bucket in &mut self.buckets {
            bucket.clear();
        }
        for (index, item) in items.iter().enumerate() {
            let cell = self._cell(item);
            self.buckets[cell].push(index);
        }
    }

    fn _cell(&self, point: &Vec2) -> usize {
        let x = ((point.x / self.cell_size).floor() as isize).rem_euclid(self.cols as isize) as usize;
        let y = ((point.y / self.cell_size).floor() as isize).rem_euclid(self.rows as isize) as usize;
        y * self.cols + x
    }
}

// ─── NEAT Genome internals ────────────────────────────────────────────────────

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum NodeKind {
    Input,
    Bias,
    Hidden,
    Output,
}

#[derive(Clone, Debug)]
struct NodeGene {
    id: u32,
    kind: NodeKind,
    order: f32,
    slot: Option<usize>,
}

#[derive(Clone, Debug)]
struct ConnectionGene {
    innovation: u64,
    from: u32,
    to: u32,
    weight: f32,
    enabled: bool,
}

#[derive(Clone, Debug)]
struct CompiledEdge {
    from_idx: usize,
    weight: f32,
}

#[derive(Clone, Default, Debug)]
struct CompiledGenome {
    ordered_indices: Vec<usize>,
    incoming: Vec<Vec<CompiledEdge>>,
    output_indices: Vec<usize>,
    complexity: usize,
}

impl CompiledGenome {
    /// Forward-pass activation. Returns one f32 per output node.
    /// Input nodes are loaded from `inputs`; bias node is clamped to 1.0.
    fn activate(&self, inputs: &[f32]) -> Vec<f32> {
        let n = self.ordered_indices.len();
        let mut activations = vec![0.0f32; n];

        // Seed input slots and bias (bias is the node right after the last input)
        for (slot, &val) in inputs.iter().enumerate() {
            if slot < n { activations[slot] = val; }
        }
        let bias_idx = inputs.len(); // bias node position by construction
        if bias_idx < n { activations[bias_idx] = 1.0; }

        // Topological forward pass
        for &node_idx in &self.ordered_indices {
            let sum: f32 = self.incoming[node_idx]
                .iter()
                .map(|e| activations[e.from_idx] * e.weight)
                .sum();
            // Only accumulate if there are incoming edges (input/bias nodes have none)
            if !self.incoming[node_idx].is_empty() {
                activations[node_idx] = sum.tanh();
            }
        }

        self.output_indices.iter().map(|&i| activations[i]).collect()
    }
}

#[derive(Clone, Debug)]
pub struct Genome {
    nodes: Vec<NodeGene>,
    connections: Vec<ConnectionGene>,
    compiled: CompiledGenome,
}

impl Genome {
    fn minimal(tracker: &mut InnovationTracker, rng: &mut SmallRng) -> Self {
        let mut nodes = Vec::with_capacity(INPUT_COUNT + OUTPUT_COUNT + 1);
        for input in 0..INPUT_COUNT {
            nodes.push(NodeGene {
                id: input as u32,
                kind: NodeKind::Input,
                order: 0.0,
                slot: Some(input),
            });
        }
        nodes.push(NodeGene {
            id: INPUT_COUNT as u32,
            kind: NodeKind::Bias,
            order: 0.0,
            slot: None,
        });
        for output in 0..OUTPUT_COUNT {
            nodes.push(NodeGene {
                id: tracker.base_output_id(output),
                kind: NodeKind::Output,
                order: 1.0,
                slot: Some(output),
            });
        }

        let mut connections = Vec::new();
        for input in 0..=INPUT_COUNT {
            for output in 0..OUTPUT_COUNT {
                let from = input as u32;
                let to = tracker.base_output_id(output);
                connections.push(ConnectionGene {
                    innovation: tracker.connection_innovation(from, to),
                    from,
                    to,
                    weight: rng.random_range(-1.0..1.0),
                    enabled: true,
                });
            }
        }

        let mut genome = Self {
            nodes,
            connections,
            compiled: CompiledGenome::default(),
        };
        genome.rebuild_compiled();
        genome
    }

    /// Create a minimal genome for an arbitrary (input_count, output_count) topology.
    ///
    /// Uses a fresh local `InnovationTracker` and a deterministic RNG seed so
    /// that tribe brains are reproducible without exposing the simulation's
    /// shared tracker.
    pub fn new(input_count: usize, output_count: usize) -> Self {
        let mut rng = SmallRng::seed_from_u64(42);
        let mut tracker = InnovationTracker::new_with_counts(input_count, output_count);

        let mut nodes = Vec::with_capacity(input_count + output_count + 1);
        for i in 0..input_count {
            nodes.push(NodeGene {
                id: i as u32,
                kind: NodeKind::Input,
                order: 0.0,
                slot: Some(i),
            });
        }
        // Bias node
        nodes.push(NodeGene {
            id: input_count as u32,
            kind: NodeKind::Bias,
            order: 0.0,
            slot: None,
        });
        for o in 0..output_count {
            nodes.push(NodeGene {
                id: tracker.base_output_id_n(input_count, o),
                kind: NodeKind::Output,
                order: 1.0,
                slot: Some(o),
            });
        }

        let mut connections = Vec::new();
        for i in 0..=input_count {
            for o in 0..output_count {
                let from = i as u32;
                let to = tracker.base_output_id_n(input_count, o);
                connections.push(ConnectionGene {
                    innovation: tracker.connection_innovation(from, to),
                    from,
                    to,
                    weight: rng.random_range(-1.0..1.0),
                    enabled: true,
                });
            }
        }

        let mut genome = Self {
            nodes,
            connections,
            compiled: CompiledGenome::default(),
        };
        genome.rebuild_compiled();
        genome
    }

    pub fn add_node_mutation(&mut self, tracker: &mut InnovationTracker, rng: &mut SmallRng) {
        let enabled_indices: Vec<usize> = self
            .connections
            .iter()
            .enumerate()
            .filter_map(|(index, gene)| gene.enabled.then_some(index))
            .collect();
        let Some(&connection_index) = enabled_indices.choose(rng) else {
            return;
        };

        let original = self.connections[connection_index].clone();
        self.connections[connection_index].enabled = false;

        let Some(from_node) = self.nodes.iter().find(|node| node.id == original.from).cloned() else {
            return;
        };
        let Some(to_node) = self.nodes.iter().find(|node| node.id == original.to).cloned() else {
            return;
        };

        let (node_id, first_innovation, second_innovation) =
            tracker.split_connection(original.innovation);
        if !self.nodes.iter().any(|node| node.id == node_id) {
            let mut order = (from_node.order + to_node.order) * 0.5;
            if (to_node.order - from_node.order).abs() < 1e-4 {
                order += 0.001;
            }
            self.nodes.push(NodeGene {
                id: node_id,
                kind: NodeKind::Hidden,
                order,
                slot: None,
            });
        }

        self.connections.push(ConnectionGene {
            innovation: first_innovation,
            from: original.from,
            to: node_id,
            weight: 1.0,
            enabled: true,
        });
        self.connections.push(ConnectionGene {
            innovation: second_innovation,
            from: node_id,
            to: original.to,
            weight: original.weight,
            enabled: true,
        });
    }

    pub fn add_connection_mutation(&mut self, tracker: &mut InnovationTracker, rng: &mut SmallRng) {
        let mut candidates = Vec::new();
        for from in &self.nodes {
            if from.kind == NodeKind::Output {
                continue;
            }
            for to in &self.nodes {
                if matches!(to.kind, NodeKind::Input | NodeKind::Bias) {
                    continue;
                }
                if from.order >= to.order {
                    continue;
                }
                if self.connections.iter().any(|gene| gene.from == from.id && gene.to == to.id) {
                    continue;
                }
                candidates.push((from.id, to.id));
            }
        }

        if let Some(&(from, to)) = candidates.choose(rng) {
            self.connections.push(ConnectionGene {
                innovation: tracker.connection_innovation(from, to),
                from,
                to,
                weight: rng.random_range(-1.2..1.2),
                enabled: true,
            });
        }
    }

    /// Return a reference to the compiled genome (used by the neural activation path).
    pub fn compile(&self) -> &CompiledGenome {
        &self.compiled
    }

    /// Stub mutation — real per-weight perturbation will be wired in a later task.
    pub fn mutate(&mut self, _rng: &mut rand::rngs::SmallRng, _rate: f32) {
        // TODO: real weight/topology mutation
    }

    pub fn rebuild_compiled(&mut self) {
        self.nodes.sort_by(|a, b| {
            a.order
                .partial_cmp(&b.order)
                .unwrap_or(Ordering::Equal)
                .then_with(|| a.id.cmp(&b.id))
        });

        let node_index: HashMap<u32, usize> = self
            .nodes
            .iter()
            .enumerate()
            .map(|(index, node)| (node.id, index))
            .collect();

        let mut incoming = vec![Vec::new(); self.nodes.len()];
        let mut complexity = 0;
        for gene in self.connections.iter().filter(|gene| gene.enabled) {
            let Some(&from_idx) = node_index.get(&gene.from) else {
                continue;
            };
            let Some(&to_idx) = node_index.get(&gene.to) else {
                continue;
            };
            incoming[to_idx].push(CompiledEdge {
                from_idx,
                weight: gene.weight,
            });
            complexity += 1;
        }

        let ordered_indices: Vec<usize> = (0..self.nodes.len()).collect();
        let output_indices = self
            .nodes
            .iter()
            .enumerate()
            .filter_map(|(index, node)| (node.kind == NodeKind::Output).then_some(index))
            .collect();

        self.compiled = CompiledGenome {
            ordered_indices,
            incoming,
            output_indices,
            complexity,
        };
    }
}

// ─── InnovationTracker ───────────────────────────────────────────────────────

struct InnovationTracker {
    next_node_id: u32,
    next_innovation: u64,
    connection_map: HashMap<(u32, u32), u64>,
    split_map: HashMap<u64, (u32, u64, u64)>,
}

impl InnovationTracker {
    fn new() -> Self {
        Self {
            next_node_id: (INPUT_COUNT + 1 + OUTPUT_COUNT) as u32,
            next_innovation: 0,
            connection_map: HashMap::new(),
            split_map: HashMap::new(),
        }
    }

    /// Create a tracker for an arbitrary topology (used by `Genome::new`).
    fn new_with_counts(input_count: usize, output_count: usize) -> Self {
        Self {
            next_node_id: (input_count + 1 + output_count) as u32,
            next_innovation: 0,
            connection_map: HashMap::new(),
            split_map: HashMap::new(),
        }
    }

    fn base_output_id(&self, output_slot: usize) -> u32 {
        (INPUT_COUNT + 1 + output_slot) as u32
    }

    /// Variant of `base_output_id` for arbitrary input/output counts.
    fn base_output_id_n(&self, input_count: usize, output_slot: usize) -> u32 {
        (input_count + 1 + output_slot) as u32
    }

    fn connection_innovation(&mut self, from: u32, to: u32) -> u64 {
        if let Some(existing) = self.connection_map.get(&(from, to)) {
            *existing
        } else {
            let innovation = self.next_innovation;
            self.next_innovation += 1;
            self.connection_map.insert((from, to), innovation);
            innovation
        }
    }

    fn split_connection(&mut self, original_innovation: u64) -> (u32, u64, u64) {
        if let Some(existing) = self.split_map.get(&original_innovation) {
            *existing
        } else {
            let new_node_id = self.next_node_id;
            self.next_node_id += 1;
            let first_innovation = self.next_innovation;
            self.next_innovation += 1;
            let second_innovation = self.next_innovation;
            self.next_innovation += 1;
            let value = (new_node_id, first_innovation, second_innovation);
            self.split_map.insert(original_innovation, value);
            value
        }
    }
}

// ─── TribeSimulation ─────────────────────────────────────────────────────────

pub struct TribeSimulation {
    config: ControlConfig,
    world: crate::world::WorldGrid,
    tribes: Vec<crate::tribes::TribeState>,
    tick: u64,
    generation: u32,
    rng: rand::rngs::SmallRng,
    halted: bool,
    recordings: Vec<Recording>,
    active_replay: Option<Vec<u8>>,
    last_frame: Vec<u8>,
}

impl TribeSimulation {
    pub fn shared(config: ControlConfig) -> SharedSimulation {
        use rand::SeedableRng;
        let world = crate::world::WorldGrid::new(config.world_seed, config.clusters.len());
        let rng = rand::rngs::SmallRng::seed_from_u64(config.world_seed);
        let mut sim = TribeSimulation {
            config,
            world,
            tribes: vec![],
            tick: 0,
            generation: 0,
            rng,
            halted: false,
            recordings: vec![],
            active_replay: None,
            last_frame: vec![],
        };
        sim.initialize_tribes();
        Arc::new(RwLock::new(sim))
    }

    fn initialize_tribes(&mut self) {
        let spawn_tiles = self.world.find_spawn_tiles(self.config.clusters.len(), &mut self.rng);
        self.tribes = self.config.clusters.iter().enumerate().map(|(i, profile)| {
            let home_tile = spawn_tiles.get(i).copied().unwrap_or(i as u16);
            let mut tribe = crate::tribes::TribeState::from_cluster(i, profile, home_tile);
            tribe.genome = Some(crate::simulation::Genome::new(8, 3));
            tribe
        }).collect();
        // Build the initial cached frame (no food changes on tick 0)
        self.last_frame = self.build_frame(&[]);
    }

    pub fn is_halted(&self) -> bool {
        self.halted
    }

    pub fn config(&self) -> &ControlConfig {
        &self.config
    }

    pub fn apply_config_patch(&mut self, patch: ConfigPatch) {
        if let Some(v) = patch.mutation_rate { self.config.mutation_rate = v; }
        if let Some(v) = patch.population_size { self.config.population_size = v; }
        if let Some(v) = patch.max_generations { self.config.max_generations = v; }
        if let Some(v) = patch.food_spawn_rate { self.config.food_spawn_rate = v; }
        if let Some(v) = patch.energy_decay { self.config.energy_decay = v; }
        if let Some(v) = patch.tick_rate { self.config.tick_rate = v; }
        if let Some(v) = patch.world_seed { self.config.world_seed = v; }
    }

    pub fn status(&self) -> StatusResponse {
        StatusResponse {
            tick: self.tick,
            generation: self.generation,
            alive_count: self.tribes.iter().filter(|t| t.alive).count(),
            halted: self.halted,
        }
    }

    pub fn step(&mut self) -> Vec<u8> {
        self.tick += 1;

        // 1. Regenerate food on world tiles
        self.world.tick_food();

        // 2. Foraging: tribes in Foraging or Settling eat from their territory
        for tribe in self.tribes.iter_mut().filter(|t| t.alive) {
            use crate::tribes::BehaviorState;
            if matches!(tribe.behavior, BehaviorState::Foraging | BehaviorState::Settling) {
                let food_gathered: f32 = tribe.territory.iter().map(|&tile_idx| {
                    let tile = &self.world.tiles[tile_idx as usize];
                    tile.food * 0.1
                }).sum();
                tribe.food_stores += food_gathered;
                for &tile_idx in &tribe.territory {
                    let tile = &mut self.world.tiles[tile_idx as usize];
                    tile.food = (tile.food - tile.food * 0.1).max(0.0);
                }
            }
        }

        // 3. State machine transitions (Task 7)
        self.apply_state_machine();

        // 4. Combat resolution (Task 8)
        self.apply_combat();

        // 5. Alliance system (Task 9)
        self.apply_alliances();

        // 6. Population dynamics: food → pop growth/decline
        for tribe in self.tribes.iter_mut().filter(|t| t.alive) {
            let food_per_pop = if tribe.population > 0 {
                tribe.food_stores / tribe.population as f32
            } else {
                0.0
            };

            let delta = ((food_per_pop - 0.8) * 0.05 * tribe.population as f32) as i32;
            let new_pop = (tribe.population as i32 + delta).max(0) as u32;
            tribe.population = new_pop.min(tribe.max_population);

            tribe.food_stores = (tribe.food_stores - tribe.population as f32 * 0.5).max(0.0);

            if tribe.population == 0 {
                tribe.alive = false;
            }

            tribe.ticks_alive += 1;
        }

        // 7. Generation boundary (Task 10)
        if self.tick % 1000 == 0 && self.tick > 0 {
            self.apply_generation_boundary();
        }

        // 8. River crossing evolution (Task 11)
        self.apply_river_crossing();

        // 9. Check halted (all tribes dead)
        if self.tribes.iter().all(|t| !t.alive) {
            self.halted = true;
        }

        // 10. Pack and return current frame
        self.pack_current_frame()
    }

    // ─── Task 7: State Machine ────────────────────────────────────────────────

    fn apply_state_machine(&mut self) {
        use crate::tribes::BehaviorState;

        // Update neural net inputs for each tribe
        for tribe in self.tribes.iter_mut() {
            if !tribe.alive { continue; }
            let food_ratio = if tribe.population > 0 {
                tribe.food_stores / tribe.population as f32
            } else { 0.0 };
            tribe.last_inputs = [
                food_ratio.min(1.0),
                (tribe.population as f32 / tribe.max_population as f32).min(1.0),
                (tribe.territory.len() as f32 / 100.0).min(1.0),
                tribe.stats.feed_risk,
                tribe.stats.a_combat,
                tribe.stats.a_resource,
                0.5, // nearest enemy distance placeholder
                0.5, // nearest ally distance placeholder
            ];
        }

        // Collect drives per tribe (needs immutable borrow)
        let drives: Vec<(f32, f32, f32)> = self.tribes.iter().map(|t| {
            if !t.alive { return (0.0, 0.0, 0.0); }
            let genome = match &t.genome {
                Some(g) => g,
                None => return (0.5, 0.5, 0.5),
            };
            let compiled = genome.compile();
            let outputs = compiled.activate(&t.last_inputs);
            let aggression = (outputs[0].tanh() + 1.0) / 2.0;
            let resource   = (outputs[1].tanh() + 1.0) / 2.0;
            let goal       = (outputs[2].tanh() + 1.0) / 2.0;
            (aggression, resource, goal)
        }).collect();

        // Store last_outputs
        for (tribe, &(agg, res, goal)) in self.tribes.iter_mut().zip(drives.iter()) {
            tribe.last_outputs = [agg, res, goal];
        }

        // Transition logic
        for i in 0..self.tribes.len() {
            if !self.tribes[i].alive { continue; }
            let (aggression, _resource, goal) = drives[i];
            let food_ratio = if self.tribes[i].population > 0 {
                self.tribes[i].food_stores / self.tribes[i].population as f32
            } else { 0.0 };

            let current = self.tribes[i].behavior;
            let next = match current {
                BehaviorState::Settling => {
                    if food_ratio < 0.3 { BehaviorState::Foraging }
                    else if aggression > 0.7 && self.has_neighbor(i) { BehaviorState::AtWar }
                    else { current }
                }
                BehaviorState::Foraging => {
                    if food_ratio > 0.8 { BehaviorState::Settling }
                    else if food_ratio < 0.1 { BehaviorState::Starving }
                    else { current }
                }
                BehaviorState::AtWar => current, // resolved in combat step
                BehaviorState::Occupying => {
                    if self.tribes[i].ticks_in_state > 200 { BehaviorState::Settling }
                    else { current }
                }
                BehaviorState::Peace => {
                    if self.tribes[i].ticks_in_state > 500 { BehaviorState::Settling }
                    else { current }
                }
                BehaviorState::Allied => {
                    match self.tribes[i].ally_tribe {
                        None => BehaviorState::Settling,
                        Some(ally_id) => {
                            if ally_id >= self.tribes.len() || !self.tribes[ally_id].alive {
                                BehaviorState::Settling
                            } else { current }
                        }
                    }
                }
                BehaviorState::Starving => {
                    if food_ratio > 0.2 { BehaviorState::Foraging }
                    else if self.tribes[i].ticks_in_state > 50 { BehaviorState::Desperate }
                    else { current }
                }
                BehaviorState::Desperate => {
                    if self.tribes[i].ticks_in_state > 100 { BehaviorState::Imploding }
                    else if aggression > 0.6 && self.has_neighbor(i) { BehaviorState::AtWar }
                    else { current }
                }
                BehaviorState::Imploding => {
                    // Population shrinks rapidly each tick
                    let decay = (self.tribes[i].population / 20).max(1);
                    self.tribes[i].population = self.tribes[i].population.saturating_sub(decay);
                    if self.tribes[i].population == 0 { self.tribes[i].alive = false; }
                    current
                }
                BehaviorState::Migrating => current, // handled separately if needed
            };

            // Consider migration: goal_drive > 0.6, not at war
            let next = if !matches!(next, BehaviorState::AtWar | BehaviorState::Imploding | BehaviorState::Desperate)
                && goal > 0.6 && matches!(current, BehaviorState::Settling | BehaviorState::Foraging) {
                BehaviorState::Migrating
            } else { next };

            if next != current {
                self.tribes[i].behavior = next;
                self.tribes[i].ticks_in_state = 0;
            } else {
                self.tribes[i].ticks_in_state += 1;
            }
        }
    }

    fn has_neighbor(&self, tribe_idx: usize) -> bool {
        let my_tiles: std::collections::HashSet<u16> =
            self.tribes[tribe_idx].territory.iter().cloned().collect();
        for (i, other) in self.tribes.iter().enumerate() {
            if i == tribe_idx || !other.alive { continue; }
            for &tile in &other.territory {
                let adjacent = crate::world::WorldGrid::adjacent_tiles(tile as usize);
                if adjacent.iter().any(|&a| my_tiles.contains(&(a as u16))) {
                    return true;
                }
            }
        }
        false
    }

    // ─── Task 8: Combat Resolution ────────────────────────────────────────────

    fn apply_combat(&mut self) {
        use crate::tribes::BehaviorState;

        // War declaration: AtWar tribes pick a target if they don't have one
        for i in 0..self.tribes.len() {
            if !self.tribes[i].alive { continue; }
            if !matches!(self.tribes[i].behavior, BehaviorState::AtWar) { continue; }
            if self.tribes[i].target_tribe.is_some() { continue; }

            let target = (0..self.tribes.len())
                .filter(|&j| j != i && self.tribes[j].alive)
                .min_by_key(|&j| {
                    let my_home = self.tribes[i].home_tile as i32;
                    let their_home = self.tribes[j].home_tile as i32;
                    (my_home - their_home).unsigned_abs()
                });
            self.tribes[i].target_tribe = target;
        }

        // Combat ticks every 10 ticks
        if self.tick % 10 != 0 { return; }

        let attacker_indices: Vec<usize> = (0..self.tribes.len())
            .filter(|&i| self.tribes[i].alive && matches!(self.tribes[i].behavior, BehaviorState::AtWar))
            .collect();

        for &attacker_idx in &attacker_indices {
            let defender_idx = match self.tribes[attacker_idx].target_tribe {
                Some(d) => d,
                None => continue,
            };
            if !self.tribes[defender_idx].alive {
                self.tribes[attacker_idx].target_tribe = None;
                self.tribes[attacker_idx].behavior = BehaviorState::Settling;
                self.tribes[attacker_idx].ticks_in_state = 0;
                continue;
            }

            // Box-Muller normal sample for attacker
            let u1: f32 = self.rng.random::<f32>().max(1e-7);
            let u2: f32 = self.rng.random::<f32>();
            let z0 = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f32::consts::PI * u2).cos();

            let attacker_strength = self.tribes[attacker_idx].population as f32
                * self.tribes[attacker_idx].stats.a_combat
                * (1.0 + z0 * 0.15).max(0.1);

            // Box-Muller normal sample for defender
            let u1b: f32 = self.rng.random::<f32>().max(1e-7);
            let u2b: f32 = self.rng.random::<f32>();
            let z1 = (-2.0 * u1b.ln()).sqrt() * (2.0 * std::f32::consts::PI * u2b).cos();

            let def_tile_bonus = self.tribes[defender_idx].territory.first()
                .map(|&t| self.world.tiles[t as usize].defense_bonus)
                .unwrap_or(0.0);
            let defender_strength = self.tribes[defender_idx].population as f32
                * (self.tribes[defender_idx].stats.a_risk + def_tile_bonus)
                * (1.0 + z1 * 0.15).max(0.1);

            let ratio = (attacker_strength / defender_strength.max(0.01)).min(5.0);

            // Knuth Poisson casualties
            let a_cas_lambda = (self.tribes[defender_idx].stats.a_combat
                * self.tribes[attacker_idx].population as f32 * 0.02).max(0.1);
            let a_casualties = self.knuth_poisson(a_cas_lambda);

            let d_cas_lambda = (self.tribes[attacker_idx].stats.a_combat
                * self.tribes[defender_idx].population as f32 * 0.02 * ratio).max(0.1);
            let d_casualties = self.knuth_poisson(d_cas_lambda);

            self.tribes[attacker_idx].population =
                self.tribes[attacker_idx].population.saturating_sub(a_casualties);
            self.tribes[defender_idx].population =
                self.tribes[defender_idx].population.saturating_sub(d_casualties);

            // Check extinction
            if self.tribes[attacker_idx].population == 0 {
                self.tribes[attacker_idx].alive = false;
            }
            if self.tribes[defender_idx].population == 0 {
                self.tribes[defender_idx].alive = false;
                // Absorb territory and founders
                let absorbed_territory: Vec<u16> = self.tribes[defender_idx].territory.clone();
                let absorbed_founders: Vec<crate::tribes::FounderTag> =
                    self.tribes[defender_idx].founders.clone();
                let absorbed_cluster_id = self.tribes[defender_idx].cluster_id.clone();
                self.tribes[attacker_idx].territory.extend(absorbed_territory);
                self.tribes[attacker_idx].founders.extend(absorbed_founders);
                self.tribes[attacker_idx].lineage.push(absorbed_cluster_id);
                self.tribes[attacker_idx].target_tribe = None;
                self.tribes[attacker_idx].behavior = BehaviorState::Occupying;
                self.tribes[attacker_idx].ticks_in_state = 0;
            } else if self.tribes[attacker_idx].ticks_in_state > 300 {
                // War timeout — both go to Peace
                self.tribes[attacker_idx].behavior = BehaviorState::Peace;
                self.tribes[attacker_idx].target_tribe = None;
                self.tribes[attacker_idx].ticks_in_state = 0;
                self.tribes[defender_idx].behavior = BehaviorState::Peace;
                self.tribes[defender_idx].ticks_in_state = 0;
            }
        }
    }

    fn knuth_poisson(&mut self, lambda: f32) -> u32 {
        let l = (-lambda).exp();
        let mut k = 0u32;
        let mut p = 1.0f32;
        loop {
            p *= self.rng.random::<f32>();
            if p <= l { break; }
            k += 1;
            if k > 1000 { break; } // safety cap
        }
        k
    }

    // ─── Task 9: Alliance System ──────────────────────────────────────────────

    fn apply_alliances(&mut self) {
        use crate::tribes::BehaviorState;

        // Alliance formation every 50 ticks
        if self.tick % 50 != 0 { return; }

        for i in 0..self.tribes.len() {
            if !self.tribes[i].alive { continue; }
            if !matches!(self.tribes[i].behavior, BehaviorState::Settling) { continue; }
            if self.tribes[i].ticks_in_state < 100 { continue; }
            let goal_i = self.tribes[i].last_outputs[2];
            if goal_i <= 0.7 { continue; }

            let ally = (0..self.tribes.len()).find(|&j| {
                j != i
                && self.tribes[j].alive
                && matches!(self.tribes[j].behavior, BehaviorState::Settling)
                && self.tribes[j].last_outputs[2] > 0.6
                && self.tribes[j].ally_tribe.is_none()
                && self.tribes[j].target_tribe.is_none()
            });

            if let Some(j) = ally {
                self.tribes[i].behavior = BehaviorState::Allied;
                self.tribes[i].ally_tribe = Some(j);
                self.tribes[i].ticks_in_state = 0;
                self.tribes[j].behavior = BehaviorState::Allied;
                self.tribes[j].ally_tribe = Some(i);
                self.tribes[j].ticks_in_state = 0;
            }
        }

        // Allied food sharing every 50 ticks
        let allied_pairs: Vec<(usize, usize)> = self.tribes.iter().enumerate()
            .filter_map(|(i, t)| {
                if t.alive && matches!(t.behavior, BehaviorState::Allied) {
                    t.ally_tribe.map(|j| if i < j { (i, j) } else { (j, i) })
                } else { None }
            })
            .collect::<std::collections::HashSet<_>>()
            .into_iter().collect();

        for (i, j) in allied_pairs {
            if !self.tribes[i].alive || !self.tribes[j].alive { continue; }
            let transfer = (self.tribes[i].food_stores - self.tribes[j].food_stores).abs() * 0.05;
            if self.tribes[i].food_stores > self.tribes[j].food_stores {
                self.tribes[i].food_stores -= transfer;
                self.tribes[j].food_stores += transfer;
            } else {
                self.tribes[j].food_stores -= transfer;
                self.tribes[i].food_stores += transfer;
            }
        }
    }

    // ─── Task 10: Generation Boundary ────────────────────────────────────────

    fn apply_generation_boundary(&mut self) {
        self.generation += 1;
        let mutation_rate = self.config.mutation_rate;
        let nudge = 0.02f32;

        for i in 0..self.tribes.len() {
            if !self.tribes[i].alive { continue; }
            self.tribes[i].generation += 1;

            // Genome mutation — extract genome, mutate, put back to avoid split borrow
            if let Some(mut genome) = self.tribes[i].genome.take() {
                genome.mutate(&mut self.rng, mutation_rate);
                self.tribes[i].genome = Some(genome);
            }

            // Stat nudge: small random walk on primary artifacts
            let dc = self.rng.random_range(-nudge..nudge);
            self.tribes[i].stats.a_combat = (self.tribes[i].stats.a_combat + dc).clamp(0.0, 1.0);
            let dr = self.rng.random_range(-nudge..nudge);
            self.tribes[i].stats.a_risk = (self.tribes[i].stats.a_risk + dr).clamp(0.0, 1.0);
            let dres = self.rng.random_range(-nudge..nudge);
            self.tribes[i].stats.a_resource = (self.tribes[i].stats.a_resource + dres).clamp(0.0, 1.0);
            let dmo = self.rng.random_range(-nudge..nudge);
            self.tribes[i].stats.a_map_objective = (self.tribes[i].stats.a_map_objective + dmo).clamp(0.0, 1.0);
            let dt = self.rng.random_range(-nudge..nudge);
            self.tribes[i].stats.a_team = (self.tribes[i].stats.a_team + dt).clamp(0.0, 1.0);

            // High feed_risk bias: struggling tribes improve foraging
            if self.tribes[i].stats.feed_risk > 0.6 {
                self.tribes[i].stats.a_resource = (self.tribes[i].stats.a_resource + 0.03).min(1.0);
            }

            // Lineage log
            let gen = self.tribes[i].generation;
            self.tribes[i].lineage.push(format!("gen-{}-survived", gen));
        }
    }

    // ─── Task 11: River Crossing Evolution ───────────────────────────────────

    fn apply_river_crossing(&mut self) {
        use crate::tribes::RiverCrossing;

        for tribe in self.tribes.iter_mut().filter(|t| t.alive) {
            let goal_drive = tribe.last_outputs[2];

            // Increment ticks_near_river if territory is large enough to plausibly
            // border a river (real adjacency check would require a world borrow;
            // we use territory size > 2 as a lightweight proxy).
            let touches_river = tribe.territory.len() > 2
                && matches!(tribe.river_crossing_tech, RiverCrossing::None | RiverCrossing::Bridges);
            if touches_river { tribe.ticks_near_river += 1; }

            // None → Bridges
            if matches!(tribe.river_crossing_tech, RiverCrossing::None)
                && goal_drive > 0.7
                && tribe.ticks_near_river > 50 {
                tribe.river_crossing_tech = RiverCrossing::Bridges;
                tribe.lineage.push(format!("gen-{}-bridges-unlocked", tribe.generation));
            }

            // Bridges → Boats
            if matches!(tribe.river_crossing_tech, RiverCrossing::Bridges)
                && goal_drive > 0.8
                && tribe.river_crossings > 20 {
                tribe.river_crossing_tech = RiverCrossing::Boats;
                tribe.lineage.push(format!("gen-{}-boats-unlocked", tribe.generation));
            }
        }
    }

    /// Return the last packed frame. Can be called from a read-lock context.
    pub fn current_packet(&self) -> Vec<u8> {
        self.last_frame.clone()
    }

    /// Build, cache, and return a binary WS frame for the current simulation state.
    pub fn pack_current_frame(&mut self) -> Vec<u8> {
        let changed_food = self.world.changed_food_tiles();
        let frame = self.build_frame(&changed_food);
        self.last_frame = frame.clone();
        frame
    }

    /// Pure frame-builder (does not mutate state).
    fn build_frame(&self, changed_food: &[(u16, f32)]) -> Vec<u8> {
        let alive_tribes: Vec<&crate::tribes::TribeState> =
            self.tribes.iter().filter(|t| t.alive).collect();

        let mut buf = Vec::with_capacity(20 + alive_tribes.len() * 36 + changed_food.len() * 6);

        // Header (20 bytes)
        push_u32(&mut buf, self.tick as u32);
        push_u32(&mut buf, (self.tick >> 32) as u32);
        push_u32(&mut buf, alive_tribes.len() as u32);
        push_u32(&mut buf, changed_food.len() as u32);
        push_u32(&mut buf, self.generation);

        // Per-tribe records (36 bytes each)
        for tribe in &alive_tribes {
            push_u32(&mut buf, tribe.id as u32);          // 4
            push_u32(&mut buf, tribe.population);         // 4
            push_u16(&mut buf, tribe.home_tile);          // 2
            buf.push(tribe.behavior as u8);               // 1
            buf.push(0u8);                                // 1 padding
            push_f32(&mut buf, tribe.food_stores);        // 4
            push_f32(&mut buf, tribe.stats.a_combat);     // 4
            push_f32(&mut buf, tribe.stats.a_risk);       // 4
            push_f32(&mut buf, tribe.stats.a_resource);   // 4
            push_f32(&mut buf, tribe.stats.a_map_objective); // 4
            push_u16(&mut buf, tribe.territory.len() as u16); // 2
            push_u16(&mut buf, tribe.generation as u16);  // 2
            // total per tribe: 4+4+2+1+1+4+4+4+4+4+2+2 = 36
        }

        // Changed food tiles (6 bytes each: u16 index + f32 food)
        for &(tile_idx, food) in changed_food {
            push_u16(&mut buf, tile_idx);
            push_f32(&mut buf, food);
        }

        buf
    }

    pub fn kill_half_population(&mut self) -> GodModeResponse {
        let killed = self.tribes.len() / 2;
        for t in self.tribes.iter_mut().take(killed) {
            t.population = t.population / 2;
        }
        GodModeResponse { killed: killed as u32 }
    }

    pub fn list_recordings(&self) -> Result<Vec<RecordingSummary>, String> {
        Ok(self.recordings.iter().map(|r| RecordingSummary {
            id: r.id.clone(),
            name: r.name.clone(),
            tick_count: r.frames.len() as u64,
            created_at: r.created_at.clone(),
        }).collect())
    }

    pub fn save_recording(&mut self, name: Option<String>) -> Result<RecordingSummary, String> {
        let id = format!("rec-{}", self.tick);
        let name = name.unwrap_or_else(|| format!("Recording {}", self.tick));
        let summary = RecordingSummary {
            id: id.clone(),
            name: name.clone(),
            tick_count: 0,
            created_at: String::from("now"),
        };
        self.recordings.push(Recording {
            id,
            name,
            frames: vec![],
            created_at: String::from("now"),
        });
        Ok(summary)
    }

    pub fn replay_recording(&mut self, recording_id: &str) -> Result<RecordingSummary, String> {
        let rec = self.recordings.iter().find(|r| r.id == recording_id)
            .ok_or_else(|| format!("Recording {} not found", recording_id))?;
        Ok(RecordingSummary {
            id: rec.id.clone(),
            name: rec.name.clone(),
            tick_count: rec.frames.len() as u64,
            created_at: rec.created_at.clone(),
        })
    }
}

// ─── binary packing helpers ───────────────────────────────────────────────────

fn push_u16(buffer: &mut Vec<u8>, value: u16) {
    buffer.extend_from_slice(&value.to_le_bytes());
}

fn push_u32(buffer: &mut Vec<u8>, value: u32) {
    buffer.extend_from_slice(&value.to_le_bytes());
}

fn push_f32(buffer: &mut Vec<u8>, value: f32) {
    buffer.extend_from_slice(&value.to_le_bytes());
}
