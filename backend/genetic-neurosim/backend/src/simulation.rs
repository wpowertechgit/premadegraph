use std::{
    cmp::Ordering,
    collections::{HashMap, VecDeque},
    sync::Arc,
};

use parking_lot::RwLock;
use rand::{prelude::IndexedRandom, rngs::SmallRng, Rng, SeedableRng};
use serde::{Deserialize, Serialize};

pub type SharedSimulation = Arc<RwLock<TribeSimulation>>;

pub const INPUT_COUNT: usize = 8;
pub const OUTPUT_COUNT: usize = 3;

pub const INPUT_LABELS: [&str; INPUT_COUNT] = [
    "food_ratio",
    "pop_ratio",
    "territory",
    "feed_risk",
    "combat",
    "resource",
    "nearest_enemy",
    "nearest_ally",
];

pub const OUTPUT_LABELS: [&str; OUTPUT_COUNT] = [
    "aggression",
    "resource_drive",
    "goal_drive",
];

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
    // Accepted from legacy exports for internal lineage only; never expose raw
    // player identifiers through NeuroSim's own config/status APIs.
    #[serde(default, skip_serializing)]
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
    pub paused: bool,
    pub world_width_tiles: usize,
    pub world_height_tiles: usize,
    pub total_tiles: usize,
    pub world_seed: u64,
}

#[derive(serde::Serialize)]
pub struct ControlResponse {
    pub ok: bool,
    pub status: StatusResponse,
}

#[derive(serde::Deserialize)]
pub struct RestartSeedRequest {
    pub world_seed: u64,
}

#[derive(serde::Serialize)]
pub struct GodModeResponse {
    pub killed: u32,
}

// ─── Intervention types ───────────────────────────────────────────────────────

/// Target scope for an intervention — global or a single tribe.
#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InterventionScope {
    Global,
    Tribe { tribe_id: usize },
}

/// Typed intervention request dispatched through POST /api/interventions.
/// Variants `Drought` and `MutationPulse` exist as documented shapes but
/// return HTTP 501 until implemented.
#[derive(serde::Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum InterventionRequest {
    CullPopulation { scope: InterventionScope, percent: f32 },
    SpawnFood { scope: InterventionScope, amount: f32 },
    Drought,
    MutationPulse { severity: f32 },
}

#[derive(serde::Serialize)]
pub struct InterventionResponse {
    pub ok: bool,
    pub message: String,
}

// ─── WorldSnapshotResponse ────────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct TileSnapshot {
    pub biome: u8,
    pub food: f32,
    pub max_food: f32,
    pub move_cost: f32,
    pub defense_bonus: f32,
    pub disease_rate: f32,
}

#[derive(serde::Serialize)]
pub struct WorldSnapshotResponse {
    pub width: usize,
    pub height: usize,
    pub seed: u64,
    pub tiles: Vec<TileSnapshot>,
}

// ─── TribeSnapshotResponse ───────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct TribeSnapshotResponse {
    pub id: usize,
    pub cluster_id: String,
    pub population: u32,
    pub max_population: u32,
    pub food_stores: f32,
    pub behavior: crate::tribes::BehaviorState,
    pub territory_count: usize,
    pub target_tribe: Option<usize>,
    pub ally_tribe: Option<usize>,
    pub stats: crate::tribes::TribeStats,
    pub last_inputs: [f32; INPUT_COUNT],
    pub last_outputs: [f32; OUTPUT_COUNT],
    pub input_labels: &'static [&'static str],
    pub output_labels: &'static [&'static str],
    pub generation: u32,
    pub ticks_alive: u64,
    pub alive: bool,
}

// ─── TileOwnershipResponse ────────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct TileOwnerRecord {
    pub tile_id: u32,
    /// None means unowned neutral tile.
    pub owner_tribe_id: Option<u32>,
    /// Reserved for contested-tile logic; always false until that mechanic exists.
    pub contested: bool,
}

#[derive(serde::Serialize)]
pub struct TileOwnershipResponse {
    pub width: usize,
    pub height: usize,
    pub owners: Vec<TileOwnerRecord>,
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

    /// Mutate genome weights/topology. Always ends with `rebuild_compiled` so the
    /// cached activation plan stays valid regardless of what this method does.
    pub fn mutate(&mut self, _rng: &mut rand::rngs::SmallRng, _rate: f32) {
        // TODO: real weight/topology mutation
        // rebuild_compiled is called below so inference never uses a stale plan
        self.rebuild_compiled();
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

/// Max events retained in the global ring buffer.
pub const MAX_GLOBAL_EVENTS: usize = 1000;
/// Max events retained per-tribe journal.
pub const MAX_TRIBE_EVENTS: usize = 200;

pub struct TribeSimulation {
    config: ControlConfig,
    world: crate::world::WorldGrid,
    tribes: Vec<crate::tribes::TribeState>,
    tick: u64,
    generation: u32,
    rng: rand::rngs::SmallRng,
    halted: bool,
    paused: bool,
    recordings: Vec<Recording>,
    active_replay: Option<Vec<u8>>,
    last_frame: Vec<u8>,
    /// Monotonic event id counter.
    next_event_id: u64,
    /// Global bounded ring buffer of recent events.
    global_events: VecDeque<crate::events::SimulationEvent>,
    /// Per-tribe bounded event journals (indexed by tribe id). Persists after
    /// tribe extinction so logs remain queryable.
    tribe_events: HashMap<usize, VecDeque<crate::events::SimulationEvent>>,
}

impl TribeSimulation {
    pub fn shared(config: ControlConfig) -> SharedSimulation {
        use rand::SeedableRng;
        let wgen = crate::world::WorldGenerationConfig::from_clusters(config.world_seed, &config.clusters);
        let world = crate::world::WorldGrid::new(&wgen);
        let rng = rand::rngs::SmallRng::seed_from_u64(config.world_seed);
        let mut sim = TribeSimulation {
            config,
            world,
            tribes: vec![],
            tick: 0,
            generation: 0,
            rng,
            halted: false,
            paused: false,
            recordings: vec![],
            active_replay: None,
            last_frame: vec![],
            next_event_id: 0,
            global_events: VecDeque::new(),
            tribe_events: HashMap::new(),
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

        // Emit spawn events for every tribe
        let tick = self.tick;
        let gen = self.generation;
        let ids: Vec<u32> = (0..self.tribes.len()).map(|i| i as u32).collect();
        for tribe_id in ids {
            let ev = crate::events::SimulationEvent::new(
                0, tick, gen,
                crate::events::EventType::TribeSpawned,
                crate::events::EventSeverity::Info,
                tribe_id,
            );
            self.push_event(ev);
        }
    }

    pub fn is_halted(&self) -> bool {
        self.halted
    }

    pub fn is_paused(&self) -> bool {
        self.paused
    }

    pub fn pause(&mut self) {
        self.paused = true;
    }

    pub fn resume(&mut self) {
        self.paused = false;
    }

    pub fn step_once_when_paused(&mut self) -> Option<Vec<u8>> {
        if !self.paused || self.halted {
            return None;
        }
        Some(self.step())
    }

    pub fn reset_same_seed(&mut self) {
        self.paused = false;
        self.reinitialize();
    }

    pub fn restart_with_seed(&mut self, seed: u64) {
        self.config.world_seed = seed;
        self.paused = false;
        self.reinitialize();
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

    pub fn set_clusters(&mut self, clusters: Vec<ClusterProfile>) {
        self.config.clusters = clusters;
    }

    pub fn reinitialize(&mut self) {
        use rand::SeedableRng;
        self.tick = 0;
        self.generation = 0;
        self.halted = false;
        let wgen = crate::world::WorldGenerationConfig::from_clusters(self.config.world_seed, &self.config.clusters);
        self.world = crate::world::WorldGrid::new(&wgen);
        self.rng = rand::rngs::SmallRng::seed_from_u64(self.config.world_seed);
        self.tribes = vec![];
        // Clear global buffer; keep per-tribe journals so extinct runs stay queryable
        self.global_events.clear();

        // Emit reset event before spawn events
        let reset_ev = crate::events::SimulationEvent::new(
            0, 0, 0,
            crate::events::EventType::SimulationReset,
            crate::events::EventSeverity::Important,
            crate::events::NO_TRIBE,
        );
        self.push_event(reset_ev);

        self.initialize_tribes();
    }

    pub fn status(&self) -> StatusResponse {
        StatusResponse {
            tick: self.tick,
            generation: self.generation,
            alive_count: self.tribes.iter().filter(|t| t.alive).count(),
            halted: self.halted,
            paused: self.paused,
            world_width_tiles: self.world.grid_w,
            world_height_tiles: self.world.grid_h,
            total_tiles: self.world.total_tiles,
            world_seed: self.config.world_seed,
        }
    }

    /// Push an event into the global ring buffer and both tribe journals
    /// (tribe_id and other_tribe_id if set).
    pub fn push_event(&mut self, mut event: crate::events::SimulationEvent) {
        event.event_id = self.next_event_id;
        self.next_event_id += 1;

        // Both-tribe indexing
        let a = event.tribe_id;
        let b = event.other_tribe_id;

        if a != crate::events::NO_TRIBE {
            let journal = self.tribe_events.entry(a as usize).or_default();
            if journal.len() >= MAX_TRIBE_EVENTS {
                journal.pop_front();
            }
            journal.push_back(event.clone());
        }
        if b != crate::events::NO_TRIBE && b != a {
            let journal = self.tribe_events.entry(b as usize).or_default();
            if journal.len() >= MAX_TRIBE_EVENTS {
                journal.pop_front();
            }
            journal.push_back(event.clone());
        }

        if self.global_events.len() >= MAX_GLOBAL_EVENTS {
            self.global_events.pop_front();
        }
        self.global_events.push_back(event);
    }

    /// Return the most recent global events (up to `limit`).
    pub fn recent_events(&self, limit: usize) -> Vec<&crate::events::SimulationEvent> {
        self.global_events.iter().rev().take(limit).collect()
    }

    /// Return events for a specific tribe (most recent first).
    pub fn tribe_event_log(&self, tribe_id: usize) -> Vec<&crate::events::SimulationEvent> {
        match self.tribe_events.get(&tribe_id) {
            Some(journal) => journal.iter().rev().collect(),
            None => vec![],
        }
    }

    pub fn world_snapshot(&self) -> WorldSnapshotResponse {
        WorldSnapshotResponse {
            width: self.world.grid_w,
            height: self.world.grid_h,
            seed: self.config.world_seed,
            tiles: self.world.tiles.iter().map(|t| TileSnapshot {
                biome: t.biome as u8,
                food: t.food,
                max_food: t.max_food,
                move_cost: t.move_cost,
                defense_bonus: t.defense_bonus,
                disease_rate: t.disease_rate,
            }).collect(),
        }
    }

    pub fn tribe_snapshot(&self, id: usize) -> Option<TribeSnapshotResponse> {
        let t = self.tribes.get(id)?;
        Some(TribeSnapshotResponse {
            id: t.id,
            cluster_id: t.cluster_id.clone(),
            population: t.population,
            max_population: t.max_population,
            food_stores: t.food_stores,
            behavior: t.behavior,
            territory_count: t.territory.len(),
            target_tribe: t.target_tribe,
            ally_tribe: t.ally_tribe,
            stats: t.stats.clone(),
            last_inputs: t.last_inputs,
            last_outputs: t.last_outputs,
            input_labels: &INPUT_LABELS,
            output_labels: &OUTPUT_LABELS,
            generation: t.generation,
            ticks_alive: t.ticks_alive,
            alive: t.alive,
        })
    }

    pub fn tile_ownership_snapshot(&self) -> TileOwnershipResponse {
        let total = self.world.total_tiles;
        let mut owners: Vec<Option<u32>> = vec![None; total];

        for tribe in &self.tribes {
            if !tribe.alive { continue; }
            for &tile_idx in &tribe.territory {
                let idx = tile_idx as usize;
                if idx < total {
                    owners[idx] = Some(tribe.id as u32);
                }
            }
        }

        TileOwnershipResponse {
            width: self.world.grid_w,
            height: self.world.grid_h,
            owners: owners.into_iter().enumerate().map(|(i, owner)| TileOwnerRecord {
                tile_id: i as u32,
                owner_tribe_id: owner,
                contested: false,
            }).collect(),
        }
    }

    pub fn step(&mut self) -> Vec<u8> {
        self.tick += 1;

        // Snapshot for extinction detection (alive before this tick)
        let was_alive: Vec<bool> = self.tribes.iter().map(|t| t.alive).collect();

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

        // Emit TribeExtinct for any tribe that died this tick
        let tick = self.tick;
        let gen = self.generation;
        let extinct_ids: Vec<u32> = was_alive.iter().zip(self.tribes.iter())
            .filter_map(|(&was, t)| if was && !t.alive { Some(t.id as u32) } else { None })
            .collect();
        for tribe_id in extinct_ids {
            let ev = crate::events::SimulationEvent::new(
                0, tick, gen,
                crate::events::EventType::TribeExtinct,
                crate::events::EventSeverity::Important,
                tribe_id,
            );
            self.push_event(ev);
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

        // Transition logic — collect behavior changes for event emission after loop
        // (tribe_id, old_behavior as u8, new_behavior as u8, dominant output drive)
        let mut behavior_changes: Vec<(u32, u8, u8, f32)> = Vec::new();

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
                let max_drive = self.tribes[i].last_outputs
                    .iter()
                    .cloned()
                    .fold(f32::NEG_INFINITY, f32::max);
                behavior_changes.push((self.tribes[i].id as u32, current as u8, next as u8, max_drive));
                self.tribes[i].behavior = next;
                self.tribes[i].ticks_in_state = 0;
            } else {
                self.tribes[i].ticks_in_state += 1;
            }
        }

        // Emit BehaviorChanged events (outside the loop to avoid borrow conflict)
        let tick = self.tick;
        let gen = self.generation;
        for (tribe_id, old_b, new_b, max_drive) in behavior_changes {
            let mut ev = crate::events::SimulationEvent::new(
                0, tick, gen,
                crate::events::EventType::BehaviorChanged,
                crate::events::EventSeverity::Info,
                tribe_id,
            );
            ev.value_a = old_b as f32; // previous behavior state id
            ev.value_b = max_drive;    // dominant output drive that triggered transition
            ev.flags = new_b as u32;   // new behavior state id
            self.push_event(ev);
        }
    }

    fn has_neighbor(&self, tribe_idx: usize) -> bool {
        let my_tiles: std::collections::HashSet<u16> =
            self.tribes[tribe_idx].territory.iter().cloned().collect();
        for (i, other) in self.tribes.iter().enumerate() {
            if i == tribe_idx || !other.alive { continue; }
            for &tile in &other.territory {
                let adjacent = self.world.adjacent_tiles(tile as usize);
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

        // Collect (tribe_id, new_a_combat) for mutation events after the loop
        let mut gen_advanced: Vec<u32> = Vec::new();
        let mut mutation_records: Vec<(u32, f32)> = Vec::new(); // (tribe_id, new_a_combat)

        for i in 0..self.tribes.len() {
            if !self.tribes[i].alive { continue; }
            gen_advanced.push(i as u32);
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

            // Collect mutation summary (new a_combat after nudge)
            mutation_records.push((self.tribes[i].id as u32, self.tribes[i].stats.a_combat));

            // Lineage log
            let gen = self.tribes[i].generation;
            self.tribes[i].lineage.push(format!("gen-{}-survived", gen));
        }

        // Emit GenerationAdvanced and GenomeMutated events
        let tick = self.tick;
        let gen = self.generation;
        for tribe_id in gen_advanced {
            let ev = crate::events::SimulationEvent::new(
                0, tick, gen,
                crate::events::EventType::GenerationAdvanced,
                crate::events::EventSeverity::Info,
                tribe_id,
            );
            self.push_event(ev);
        }
        // I5: mutation event — value_a = mutation_rate, value_b = new a_combat summary stat
        for (tribe_id, new_a_combat) in mutation_records {
            let mut ev = crate::events::SimulationEvent::new(
                0, tick, gen,
                crate::events::EventType::GenomeMutated,
                crate::events::EventSeverity::Info,
                tribe_id,
            );
            ev.value_a = mutation_rate;
            ev.value_b = new_a_combat;
            self.push_event(ev);
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

    // ─── J1/J2/J3: Typed intervention dispatch ────────────────────────────────

    pub fn apply_intervention(&mut self, req: InterventionRequest) -> Result<InterventionResponse, String> {
        match req {
            InterventionRequest::CullPopulation { scope, percent } => {
                Ok(self.cull_population(scope, percent))
            }
            InterventionRequest::SpawnFood { scope, amount } => {
                Ok(self.spawn_food(scope, amount))
            }
            InterventionRequest::Drought => {
                Err("drought intervention not yet implemented".to_string())
            }
            InterventionRequest::MutationPulse { .. } => {
                Err("mutation_pulse intervention not yet implemented".to_string())
            }
        }
    }

    // ─── J2: Cull Population ─────────────────────────────────────────────────

    fn cull_population(&mut self, scope: InterventionScope, percent: f32) -> InterventionResponse {
        let percent = percent.clamp(0.0, 1.0);
        let mut casualties = 0u32;

        for tribe in self.tribes.iter_mut() {
            let apply = match &scope {
                InterventionScope::Global => tribe.alive,
                InterventionScope::Tribe { tribe_id } => tribe.alive && tribe.id == *tribe_id,
            };
            if apply {
                let kill = (tribe.population as f32 * percent) as u32;
                tribe.population = tribe.population.saturating_sub(kill);
                casualties += kill;
                if tribe.population == 0 {
                    tribe.alive = false;
                }
            }
        }

        let mut ev = crate::events::SimulationEvent::new(
            0, self.tick, self.generation,
            crate::events::EventType::InterventionApplied,
            crate::events::EventSeverity::Important,
            crate::events::NO_TRIBE,
        );
        ev.value_a = percent;
        ev.value_b = casualties as f32;
        ev.flags = 0; // variant id: cull_population
        self.push_event(ev);

        InterventionResponse {
            ok: true,
            message: format!("Culled {:.0}% — {} casualties", percent * 100.0, casualties),
        }
    }

    // ─── J3: Spawn Food ───────────────────────────────────────────────────────

    fn spawn_food(&mut self, scope: InterventionScope, amount: f32) -> InterventionResponse {
        let amount = amount.max(0.0);
        let changed = match &scope {
            InterventionScope::Global => self.world.spawn_food_global(amount),
            InterventionScope::Tribe { tribe_id } => {
                let territory: Vec<u16> = self.tribes
                    .get(*tribe_id)
                    .map(|t| t.territory.clone())
                    .unwrap_or_default();
                let mut count = 0;
                for tile_idx in territory {
                    let idx = tile_idx as usize;
                    if idx < self.world.tiles.len() {
                        let tile = &mut self.world.tiles[idx];
                        tile.food = (tile.food + amount).min(tile.max_food);
                        count += 1;
                    }
                }
                count
            }
        };

        let mut ev = crate::events::SimulationEvent::new(
            0, self.tick, self.generation,
            crate::events::EventType::InterventionApplied,
            crate::events::EventSeverity::Important,
            crate::events::NO_TRIBE,
        );
        ev.value_a = amount;
        ev.value_b = changed as f32;
        ev.flags = 1; // variant id: spawn_food
        self.push_event(ev);

        InterventionResponse {
            ok: true,
            message: format!("Spawned food (+{:.2}) on {} tiles", amount, changed),
        }
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
