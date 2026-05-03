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
}

impl TribeSimulation {
    pub fn shared(config: ControlConfig) -> SharedSimulation {
        let world = crate::world::WorldGrid::new(config.world_seed, config.clusters.len());
        let rng = rand::rngs::SmallRng::seed_from_u64(config.world_seed);
        Arc::new(RwLock::new(TribeSimulation {
            config,
            world,
            tribes: vec![],
            tick: 0,
            generation: 0,
            rng,
            halted: false,
            recordings: vec![],
            active_replay: None,
        }))
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
        // stub — real impl in Task 6
        self.tick += 1;
        self.pack_current_frame()
    }

    pub fn current_packet(&self) -> Vec<u8> {
        self.pack_current_frame()
    }

    pub fn pack_current_frame(&self) -> Vec<u8> {
        // stub binary frame — real impl in Task 6
        let mut buf = Vec::new();
        push_u32(&mut buf, self.tick as u32);
        push_u32(&mut buf, (self.tick >> 32) as u32);
        push_u32(&mut buf, self.tribes.len() as u32);
        push_u32(&mut buf, 0u32); // changed food tiles = 0
        push_u32(&mut buf, self.generation);
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

fn push_u32(buffer: &mut Vec<u8>, value: u32) {
    buffer.extend_from_slice(&value.to_le_bytes());
}

fn push_f32(buffer: &mut Vec<u8>, value: f32) {
    buffer.extend_from_slice(&value.to_le_bytes());
}
