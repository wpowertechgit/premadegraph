use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet, VecDeque};
use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

const UNKNOWN_LABEL: &str = "Unknown#Unknown";
const CACHE_DIR_NAME: &str = "cache/graph-v2";
const GRAPH_BUILDER_VERSION: &str = "graph-builder-v2.2";
const CLUSTERING_ALGORITHM_VERSION: &str = "bounded-ally-groups-v2";
const LAYOUT_VERSION: &str = "bridge-orbit-layout-v1";
const DATASET_ID_FALLBACK: &str = "legacy";
const MIN_SUPPORT_THRESHOLD: u32 = 2;
const ALLY_CLUSTER_SUPPORT_THRESHOLD: u32 = 2;
const MAX_VISUAL_CLUSTER_SIZE: usize = 20;
const NODE_POSITION_STRIDE: u32 = 2;
const NODE_METRIC_STRIDE: u32 = 6;
const EDGE_PAIR_STRIDE: u32 = 2;
const HIGHLIGHT_BEST_OP: u32 = 1;
const HIGHLIGHT_WORST_FEED: u32 = 2;

#[derive(Debug, Clone)]
struct PlayerRecord {
    id: String,
    label: String,
    opscore: Option<f64>,
    feedscore: Option<f64>,
    match_count: u32,
}

#[derive(Debug, Default, Clone, Copy)]
struct PairAccumulator {
    ally_weight: u32,
    enemy_weight: u32,
}

impl PairAccumulator {
    fn total_matches(self) -> u32 {
        self.ally_weight + self.enemy_weight
    }

    fn dominant_relation(self) -> Relation {
        if self.ally_weight >= self.enemy_weight {
            Relation::Ally
        } else {
            Relation::Enemy
        }
    }
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
enum Relation {
    Ally,
    Enemy,
}

#[derive(Debug, Clone, Copy)]
struct AllyNeighbor {
    index: usize,
    weight: u32,
}

impl Relation {
    fn bit(self) -> u32 {
        match self {
            Self::Ally => 0,
            Self::Enemy => 1,
        }
    }
}

#[derive(Debug, Clone)]
struct ExportEdge {
    source_index: u32,
    target_index: u32,
    weight: u32,
    ally_weight: u32,
    relation: Relation,
}

#[derive(Debug, Clone)]
struct ClusterBuildRecord {
    cluster_id: String,
    members: Vec<usize>,
    anchor: [f32; 2],
    internal_ally_edge_count: u32,
    enemy_cross_cluster_edge_count: u32,
    cross_ally_support: u32,
    connected_ally_cluster_count: u32,
    orbit_score: f64,
    orbit_radius: f32,
    best_op_member: Option<usize>,
    worst_feed_member: Option<usize>,
}

#[derive(Debug, Clone)]
struct NodeArtifact {
    id: String,
    label: String,
    cluster_id: String,
    position: [f32; 2],
    total_degree: u32,
    ally_degree: u32,
    enemy_degree: u32,
    total_support: u32,
    highlight_flags: u32,
    match_count: u32,
    opscore: Option<f64>,
    feedscore: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GraphV2Manifest {
    dataset_id: String,
    summary_file: String,
    summary_archive_file: String,
    match_count: usize,
    player_count: usize,
    node_count: usize,
    edge_count: usize,
    ally_edge_count: usize,
    enemy_edge_count: usize,
    cluster_count: usize,
    min_support_threshold: u32,
    ally_cluster_support_threshold: u32,
    graph_builder_version: String,
    clustering_algorithm_version: String,
    layout_version: String,
    generated_at: String,
    generation_ms: f64,
    node_position_stride: u32,
    node_metric_stride: u32,
    edge_pair_stride: u32,
    edge_prop_encoding: String,
    node_metric_encoding: Vec<String>,
    graph_construction_rule: String,
    clustering_rule: String,
    file_sizes: ArtifactFileSizes,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ArtifactFileSizes {
    manifest_json: u64,
    summary_md: u64,
    node_meta_json: u64,
    node_positions_f32: u64,
    node_metrics_u32: u64,
    edge_pairs_u32: u64,
    edge_props_u32: u64,
    cluster_meta_json: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NodeMetaArtifact {
    ids: Vec<String>,
    labels: Vec<String>,
    cluster_ids: Vec<String>,
    opscores: Vec<Option<f64>>,
    feedscores: Vec<Option<f64>>,
    highlight_flags: Vec<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClusterMetaArtifact {
    clusters: Vec<ClusterMetaRecord>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClusterMetaRecord {
    cluster_id: String,
    member_count: usize,
    representative_players: Vec<PlayerSummary>,
    best_opscore_member: Option<PlayerSummary>,
    worst_feedscore_member: Option<PlayerSummary>,
    highlighted_players: Vec<HighlightedPlayerSummary>,
    internal_ally_edge_count: u32,
    enemy_cross_cluster_edge_count: u32,
    cross_ally_support: u32,
    connected_ally_cluster_count: u32,
    orbit_score: f64,
    orbit_radius: f32,
    anchor: [f32; 2],
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlayerSummary {
    id: String,
    label: String,
    opscore: Option<f64>,
    feedscore: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HighlightedPlayerSummary {
    id: String,
    label: String,
    is_best_opscore: bool,
    is_worst_feedscore: bool,
}

#[derive(Debug)]
struct ArtifactBundle {
    nodes: Vec<NodeArtifact>,
    edges: Vec<ExportEdge>,
    clusters: Vec<ClusterBuildRecord>,
    match_count: usize,
    eligible_player_count: usize,
    generation_ms: f64,
    ally_edge_count: usize,
    enemy_edge_count: usize,
}

pub fn export_graph_v2_artifacts() -> PathBuf {
    let started_at = Instant::now();
    let db_path = resolve_db_path();
    let match_dir = resolve_match_dir();
    let cache_dir = resolve_cache_dir();

    let players = load_players(&db_path);
    let player_ids: HashSet<&str> = players.keys().map(String::as_str).collect();
    let scan = load_signed_pairs(&match_dir, &player_ids);
    let mut bundle = build_artifacts(&players, &scan.pairs, scan.match_count);
    bundle.generation_ms = started_at.elapsed().as_secs_f64() * 1000.0;
    write_artifacts(&cache_dir, bundle);
    cache_dir
}

struct MatchScan {
    match_count: usize,
    pairs: HashMap<(String, String), PairAccumulator>,
}

fn build_artifacts(
    players: &HashMap<String, PlayerRecord>,
    pair_map: &HashMap<(String, String), PairAccumulator>,
    match_count: usize,
) -> ArtifactBundle {
    let visible_ids = visible_node_ids(pair_map);
    let mut sorted_players: Vec<PlayerRecord> = visible_ids
        .iter()
        .filter_map(|id| players.get(id).cloned())
        .collect();
    sorted_players.sort_by(|left, right| {
        left.label
            .cmp(&right.label)
            .then_with(|| left.id.cmp(&right.id))
    });

    let node_indices: HashMap<String, usize> = sorted_players
        .iter()
        .enumerate()
        .map(|(index, player)| (player.id.clone(), index))
        .collect();

    let mut metrics = vec![(0u32, 0u32, 0u32, 0u32); sorted_players.len()];
    let mut edges = Vec::new();
    let mut ally_cluster_adjacency: HashMap<usize, Vec<AllyNeighbor>> = HashMap::new();
    let mut sorted_pairs: Vec<(&(String, String), &PairAccumulator)> = pair_map
        .iter()
        .filter(|(_, pair)| pair.total_matches() >= MIN_SUPPORT_THRESHOLD)
        .collect();
    sorted_pairs.sort_by(|left, right| {
        left.0
             .0
            .cmp(&right.0 .0)
            .then_with(|| left.0 .1.cmp(&right.0 .1))
    });

    let mut ally_edge_count = 0usize;
    let mut enemy_edge_count = 0usize;

    for ((left_id, right_id), relation) in sorted_pairs {
        let Some(&left_index) = node_indices.get(left_id) else {
            continue;
        };
        let Some(&right_index) = node_indices.get(right_id) else {
            continue;
        };

        let total_matches = relation.total_matches();
        let dominant_relation = relation.dominant_relation();
        if dominant_relation == Relation::Ally {
            ally_edge_count += 1;
        } else {
            enemy_edge_count += 1;
        }

        edges.push(ExportEdge {
            source_index: left_index as u32,
            target_index: right_index as u32,
            weight: total_matches,
            ally_weight: relation.ally_weight,
            relation: dominant_relation,
        });

        metrics[left_index].0 += 1;
        metrics[right_index].0 += 1;
        metrics[left_index].3 += total_matches;
        metrics[right_index].3 += total_matches;
        if dominant_relation == Relation::Ally {
            metrics[left_index].1 += 1;
            metrics[right_index].1 += 1;
        } else {
            metrics[left_index].2 += 1;
            metrics[right_index].2 += 1;
        }

        if relation.ally_weight >= ALLY_CLUSTER_SUPPORT_THRESHOLD {
            ally_cluster_adjacency
                .entry(left_index)
                .or_default()
                .push(AllyNeighbor {
                    index: right_index,
                    weight: relation.ally_weight,
                });
            ally_cluster_adjacency
                .entry(right_index)
                .or_default()
                .push(AllyNeighbor {
                    index: left_index,
                    weight: relation.ally_weight,
                });
        }
    }

    let mut clusters = build_clusters(&sorted_players, &ally_cluster_adjacency);
    annotate_cluster_edges(&mut clusters, &edges);
    apply_orbit_layout(&mut clusters, &edges);
    annotate_cluster_highlights(&mut clusters, &sorted_players);

    let mut node_cluster_ids = vec![String::new(); sorted_players.len()];
    let mut node_positions = vec![[0.0_f32; 2]; sorted_players.len()];
    let mut highlight_flags = vec![0u32; sorted_players.len()];
    for cluster in &clusters {
        for (member_offset, &node_index) in cluster.members.iter().enumerate() {
            node_cluster_ids[node_index] = cluster.cluster_id.clone();
            node_positions[node_index] = position_for_cluster_member(
                cluster.anchor,
                member_offset,
                cluster.members.len(),
                &sorted_players[node_index].id,
            );
        }
        if let Some(best) = cluster.best_op_member {
            highlight_flags[best] |= HIGHLIGHT_BEST_OP;
        }
        if let Some(worst) = cluster.worst_feed_member {
            highlight_flags[worst] |= HIGHLIGHT_WORST_FEED;
        }
    }

    let nodes = sorted_players
        .into_iter()
        .enumerate()
        .map(|(index, player)| NodeArtifact {
            id: player.id,
            label: player.label,
            cluster_id: node_cluster_ids[index].clone(),
            position: node_positions[index],
            total_degree: metrics[index].0,
            ally_degree: metrics[index].1,
            enemy_degree: metrics[index].2,
            total_support: metrics[index].3,
            highlight_flags: highlight_flags[index],
            match_count: player.match_count,
            opscore: player.opscore,
            feedscore: player.feedscore,
        })
        .collect();

    ArtifactBundle {
        nodes,
        edges,
        clusters,
        match_count,
        eligible_player_count: players.len(),
        generation_ms: 0.0,
        ally_edge_count,
        enemy_edge_count,
    }
}

fn visible_node_ids(pair_map: &HashMap<(String, String), PairAccumulator>) -> HashSet<String> {
    let mut visible = HashSet::new();
    for ((left, right), pair) in pair_map {
        if pair.total_matches() < MIN_SUPPORT_THRESHOLD {
            continue;
        }
        visible.insert(left.clone());
        visible.insert(right.clone());
    }
    visible
}

fn build_clusters(
    players: &[PlayerRecord],
    adjacency: &HashMap<usize, Vec<AllyNeighbor>>,
) -> Vec<ClusterBuildRecord> {
    let mut visited = vec![false; players.len()];
    let mut components = Vec::new();

    for start_index in 0..players.len() {
        if visited[start_index] || !adjacency.contains_key(&start_index) {
            continue;
        }

        let mut queue = VecDeque::from([start_index]);
        let mut members = Vec::new();
        visited[start_index] = true;

        while let Some(current_index) = queue.pop_front() {
            members.push(current_index);
            for neighbor in adjacency.get(&current_index).into_iter().flatten() {
                if !visited[neighbor.index] {
                    visited[neighbor.index] = true;
                    queue.push_back(neighbor.index);
                }
            }
        }

        members.sort_by(|left, right| players[*left].id.cmp(&players[*right].id));
        if members.len() > MAX_VISUAL_CLUSTER_SIZE {
            components.extend(split_oversized_component(players, adjacency, &members));
        } else {
            components.push(members);
        }
    }

    for index in 0..players.len() {
        if !visited[index] {
            components.push(vec![index]);
        }
    }

    components.sort_by(|left, right| {
        right
            .len()
            .cmp(&left.len())
            .then_with(|| players[left[0]].id.cmp(&players[right[0]].id))
    });

    let anchors = grid_anchors(components.len());
    components
        .into_iter()
        .enumerate()
        .map(|(index, members)| ClusterBuildRecord {
            cluster_id: format!("graph-v2:ally-group:{}", index + 1),
            members,
            anchor: anchors[index],
            internal_ally_edge_count: 0,
            enemy_cross_cluster_edge_count: 0,
            cross_ally_support: 0,
            connected_ally_cluster_count: 0,
            orbit_score: 0.0,
            orbit_radius: 0.0,
            best_op_member: None,
            worst_feed_member: None,
        })
        .collect()
}

fn split_oversized_component(
    players: &[PlayerRecord],
    adjacency: &HashMap<usize, Vec<AllyNeighbor>>,
    component: &[usize],
) -> Vec<Vec<usize>> {
    let component_set: HashSet<usize> = component.iter().copied().collect();
    let mut unassigned: HashSet<usize> = component_set.clone();
    let mut groups = Vec::new();

    while !unassigned.is_empty() {
        let seed = select_group_seed(players, adjacency, &unassigned, &component_set);
        let mut members = vec![seed];
        unassigned.remove(&seed);

        while members.len() < MAX_VISUAL_CLUSTER_SIZE {
            let Some(candidate) =
                select_group_candidate(players, adjacency, &members, &unassigned, &component_set)
            else {
                break;
            };
            members.push(candidate);
            unassigned.remove(&candidate);
        }

        members.sort_by(|left, right| players[*left].id.cmp(&players[*right].id));
        groups.push(members);
    }

    groups
}

fn select_group_seed(
    players: &[PlayerRecord],
    adjacency: &HashMap<usize, Vec<AllyNeighbor>>,
    unassigned: &HashSet<usize>,
    component_set: &HashSet<usize>,
) -> usize {
    let mut candidates: Vec<usize> = unassigned.iter().copied().collect();
    candidates.sort_by(|left, right| {
        let left_stats = unassigned_neighbor_stats(*left, adjacency, unassigned, component_set);
        let right_stats = unassigned_neighbor_stats(*right, adjacency, unassigned, component_set);
        right_stats
            .0
            .cmp(&left_stats.0)
            .then_with(|| right_stats.1.cmp(&left_stats.1))
            .then_with(|| players[*right].match_count.cmp(&players[*left].match_count))
            .then_with(|| players[*left].id.cmp(&players[*right].id))
    });
    candidates[0]
}

fn select_group_candidate(
    players: &[PlayerRecord],
    adjacency: &HashMap<usize, Vec<AllyNeighbor>>,
    members: &[usize],
    unassigned: &HashSet<usize>,
    component_set: &HashSet<usize>,
) -> Option<usize> {
    let mut candidates = Vec::new();
    for &candidate in unassigned {
        let support_to_group = members
            .iter()
            .map(|&member| ally_support_between(candidate, member, adjacency))
            .sum::<u32>();
        if support_to_group == 0 {
            continue;
        }
        let support_to_seed = ally_support_between(candidate, members[0], adjacency);
        let candidate_stats =
            unassigned_neighbor_stats(candidate, adjacency, unassigned, component_set);
        candidates.push((
            candidate,
            support_to_group,
            support_to_seed,
            candidate_stats.0,
            candidate_stats.1,
        ));
    }

    candidates.sort_by(|left, right| {
        right
            .1
            .cmp(&left.1)
            .then_with(|| right.2.cmp(&left.2))
            .then_with(|| right.3.cmp(&left.3))
            .then_with(|| right.4.cmp(&left.4))
            .then_with(|| players[left.0].id.cmp(&players[right.0].id))
    });
    candidates.first().map(|candidate| candidate.0)
}

fn unassigned_neighbor_stats(
    node: usize,
    adjacency: &HashMap<usize, Vec<AllyNeighbor>>,
    unassigned: &HashSet<usize>,
    component_set: &HashSet<usize>,
) -> (usize, u32) {
    let mut neighbor_count = 0usize;
    let mut support_sum = 0u32;
    for neighbor in adjacency.get(&node).into_iter().flatten() {
        if neighbor.index != node
            && component_set.contains(&neighbor.index)
            && unassigned.contains(&neighbor.index)
        {
            neighbor_count += 1;
            support_sum += neighbor.weight;
        }
    }
    (neighbor_count, support_sum)
}

fn ally_support_between(
    left: usize,
    right: usize,
    adjacency: &HashMap<usize, Vec<AllyNeighbor>>,
) -> u32 {
    adjacency
        .get(&left)
        .into_iter()
        .flatten()
        .find(|neighbor| neighbor.index == right)
        .map(|neighbor| neighbor.weight)
        .unwrap_or(0)
}

fn annotate_cluster_edges(clusters: &mut [ClusterBuildRecord], edges: &[ExportEdge]) {
    let mut membership = HashMap::new();
    for (cluster_index, cluster) in clusters.iter().enumerate() {
        for &member in &cluster.members {
            membership.insert(member, cluster_index);
        }
    }

    for edge in edges {
        let left = edge.source_index as usize;
        let right = edge.target_index as usize;
        let Some(&left_cluster) = membership.get(&left) else {
            continue;
        };
        let Some(&right_cluster) = membership.get(&right) else {
            continue;
        };
        if left_cluster == right_cluster && edge.relation == Relation::Ally {
            clusters[left_cluster].internal_ally_edge_count += 1;
        }
        if edge.relation == Relation::Enemy || left_cluster != right_cluster {
            clusters[left_cluster].enemy_cross_cluster_edge_count += 1;
            if left_cluster != right_cluster {
                clusters[right_cluster].enemy_cross_cluster_edge_count += 1;
            }
        }
    }
}

fn apply_orbit_layout(clusters: &mut [ClusterBuildRecord], edges: &[ExportEdge]) {
    if clusters.is_empty() {
        return;
    }

    let membership = cluster_membership(clusters);
    let mut cross_neighbors: Vec<HashMap<usize, u32>> = vec![HashMap::new(); clusters.len()];

    for edge in edges {
        if edge.relation != Relation::Ally {
            continue;
        }

        let Some(&left_cluster) = membership.get(&(edge.source_index as usize)) else {
            continue;
        };
        let Some(&right_cluster) = membership.get(&(edge.target_index as usize)) else {
            continue;
        };
        if left_cluster == right_cluster {
            continue;
        }

        *cross_neighbors[left_cluster]
            .entry(right_cluster)
            .or_insert(0) += edge.ally_weight;
        *cross_neighbors[right_cluster]
            .entry(left_cluster)
            .or_insert(0) += edge.ally_weight;
    }

    let mut max_score = 0.0_f64;
    for (index, cluster) in clusters.iter_mut().enumerate() {
        cluster.cross_ally_support = cross_neighbors[index].values().sum();
        cluster.connected_ally_cluster_count = cross_neighbors[index].len() as u32;
        cluster.orbit_score = (1.0 + cluster.cross_ally_support as f64).ln()
            + 0.6 * (1.0 + cluster.connected_ally_cluster_count as f64).ln()
            + 0.25 * (1.0 + cluster.members.len() as f64).ln();
        max_score = max_score.max(cluster.orbit_score);
    }

    let outer_radius = ((clusters.len() as f32).sqrt() * 240.0).max(2_400.0);
    let inner_radius = 360.0_f32;
    let orbit_span = (outer_radius - inner_radius).max(1.0);
    for cluster in clusters.iter_mut() {
        let normalized_score = if max_score > 0.0 {
            (cluster.orbit_score / max_score).clamp(0.0, 1.0) as f32
        } else {
            0.0
        };

        cluster.orbit_radius = if cluster.connected_ally_cluster_count == 0 {
            outer_radius + 360.0 + ((stable_hash(&cluster.cluster_id) % 7) as f32 * 34.0)
        } else {
            inner_radius + (1.0 - normalized_score.powf(0.72)) * orbit_span
        };
    }

    let mut order: Vec<usize> = (0..clusters.len()).collect();
    order.sort_by(|left, right| {
        clusters[*right]
            .orbit_score
            .total_cmp(&clusters[*left].orbit_score)
            .then_with(|| {
                clusters[*right]
                    .members
                    .len()
                    .cmp(&clusters[*left].members.len())
            })
            .then_with(|| clusters[*left].cluster_id.cmp(&clusters[*right].cluster_id))
    });

    let mut placed_angles = vec![None::<f32>; clusters.len()];
    let mut placed_positions = vec![None::<[f32; 2]>; clusters.len()];

    for (placement_index, &cluster_index) in order.iter().enumerate() {
        let radius = clusters[cluster_index].orbit_radius;
        let preferred_angle = preferred_orbit_angle(
            cluster_index,
            placement_index,
            &cross_neighbors,
            &placed_angles,
            &clusters[cluster_index].cluster_id,
        );
        let angle = choose_orbit_angle(
            cluster_index,
            radius,
            preferred_angle,
            clusters,
            &placed_positions,
        );
        let position = [angle.cos() * radius, angle.sin() * radius];

        clusters[cluster_index].anchor = position;
        placed_angles[cluster_index] = Some(angle);
        placed_positions[cluster_index] = Some(position);
    }
}

fn cluster_membership(clusters: &[ClusterBuildRecord]) -> HashMap<usize, usize> {
    let mut membership = HashMap::new();
    for (cluster_index, cluster) in clusters.iter().enumerate() {
        for &member in &cluster.members {
            membership.insert(member, cluster_index);
        }
    }
    membership
}

fn preferred_orbit_angle(
    cluster_index: usize,
    placement_index: usize,
    cross_neighbors: &[HashMap<usize, u32>],
    placed_angles: &[Option<f32>],
    cluster_id: &str,
) -> f32 {
    let mut vector_x = 0.0_f32;
    let mut vector_y = 0.0_f32;
    let mut neighbors: Vec<(usize, u32)> = cross_neighbors[cluster_index]
        .iter()
        .map(|(&neighbor_index, &support)| (neighbor_index, support))
        .collect();
    neighbors.sort_by_key(|(neighbor_index, _)| *neighbor_index);

    for (neighbor_index, support) in neighbors {
        let Some(angle) = placed_angles[neighbor_index] else {
            continue;
        };
        let weight = support.max(1) as f32;
        vector_x += angle.cos() * weight;
        vector_y += angle.sin() * weight;
    }

    if vector_x.abs() > f32::EPSILON || vector_y.abs() > f32::EPSILON {
        return vector_y.atan2(vector_x) + stable_angle_offset(cluster_id, 0.28);
    }

    const GOLDEN_ANGLE: f32 = 2.399_963_1;
    placement_index as f32 * GOLDEN_ANGLE + stable_angle_offset(cluster_id, 0.16)
}

fn choose_orbit_angle(
    cluster_index: usize,
    radius: f32,
    preferred_angle: f32,
    clusters: &[ClusterBuildRecord],
    placed_positions: &[Option<[f32; 2]>],
) -> f32 {
    let mut best_angle = preferred_angle;
    let mut best_penalty = f32::INFINITY;
    let step = 0.155_f32;

    for offset_index in 0..56 {
        let offset_multiplier = if offset_index == 0 {
            0.0
        } else {
            let magnitude = ((offset_index + 1) / 2) as f32;
            if offset_index % 2 == 0 {
                -magnitude
            } else {
                magnitude
            }
        };
        let candidate_angle = preferred_angle + offset_multiplier * step;
        let candidate_position = [
            candidate_angle.cos() * radius,
            candidate_angle.sin() * radius,
        ];
        let mut penalty = offset_multiplier.abs() * 0.03;

        for (other_index, other_position) in placed_positions.iter().enumerate() {
            let Some(other_position) = other_position else {
                continue;
            };
            let dx = candidate_position[0] - other_position[0];
            let dy = candidate_position[1] - other_position[1];
            let distance = (dx * dx + dy * dy).sqrt();
            let desired = visual_cluster_radius(&clusters[cluster_index])
                + visual_cluster_radius(&clusters[other_index])
                + 96.0;
            if distance < desired {
                let overlap = desired - distance;
                penalty += overlap * overlap;
            } else {
                penalty += 1.0 / (1.0 + distance);
            }
        }

        if penalty < best_penalty {
            best_penalty = penalty;
            best_angle = candidate_angle;
        }
    }

    best_angle
}

fn visual_cluster_radius(cluster: &ClusterBuildRecord) -> f32 {
    (cluster.members.len() as f32).sqrt() * 10.5 + 30.0
}

fn stable_angle_offset(value: &str, amplitude: f32) -> f32 {
    let centered = (stable_hash(value) % 10_000) as f32 / 10_000.0 - 0.5;
    centered * amplitude
}

fn annotate_cluster_highlights(clusters: &mut [ClusterBuildRecord], players: &[PlayerRecord]) {
    for cluster in clusters {
        cluster.best_op_member = cluster
            .members
            .iter()
            .copied()
            .filter_map(|index| players[index].opscore.map(|score| (index, score)))
            .max_by(|left, right| left.1.total_cmp(&right.1))
            .map(|(index, _)| index);

        cluster.worst_feed_member = cluster
            .members
            .iter()
            .copied()
            .filter_map(|index| players[index].feedscore.map(|score| (index, score)))
            .max_by(|left, right| left.1.total_cmp(&right.1))
            .map(|(index, _)| index);
    }
}

fn grid_anchors(count: usize) -> Vec<[f32; 2]> {
    if count == 0 {
        return Vec::new();
    }
    let columns = (count as f32).sqrt().ceil().max(1.0) as usize;
    let rows = (count + columns - 1) / columns;
    let gap = 520.0_f32;
    let x_offset = (columns.saturating_sub(1) as f32) * gap * 0.5;
    let y_offset = (rows.saturating_sub(1) as f32) * gap * 0.5;

    (0..count)
        .map(|index| {
            let column = index % columns;
            let row = index / columns;
            [column as f32 * gap - x_offset, row as f32 * gap - y_offset]
        })
        .collect()
}

fn position_for_cluster_member(
    anchor: [f32; 2],
    member_offset: usize,
    cluster_size: usize,
    player_id: &str,
) -> [f32; 2] {
    if cluster_size <= 1 {
        return anchor;
    }

    let theta = member_offset as f32 * 2.399_963_1;
    let cluster_radius = (cluster_size as f32).sqrt() * 10.5 + 18.0;
    let radius = cluster_radius * (((member_offset + 1) as f32) / cluster_size as f32).sqrt();
    let jitter = ((stable_hash(player_id) % 17) as f32 - 8.0) * 0.7;
    [
        anchor[0] + theta.cos() * (radius + jitter),
        anchor[1] + theta.sin() * (radius - jitter),
    ]
}

fn write_artifacts(cache_dir: &Path, artifacts: ArtifactBundle) {
    fs::create_dir_all(cache_dir).expect("failed to create graph v2 cache directory");

    let manifest_path = cache_dir.join("manifest.json");
    let node_meta_path = cache_dir.join("node_meta.json");
    let node_positions_path = cache_dir.join("node_positions.f32");
    let node_metrics_path = cache_dir.join("node_metrics.u32");
    let edge_pairs_path = cache_dir.join("edge_pairs.u32");
    let edge_props_path = cache_dir.join("edge_props.u32");
    let cluster_meta_path = cache_dir.join("cluster_meta.json");
    let summary_path = cache_dir.join("summary.md");
    let dataset_id = env::var("DATASET_ID").unwrap_or_else(|_| DATASET_ID_FALLBACK.to_string());
    let generated_at = unix_timestamp_string();
    let summary_archive_file = format!(
        "summary_{}_{}.md",
        safe_artifact_name(&dataset_id),
        safe_artifact_name(&generated_at)
    );
    let summary_archive_path = cache_dir.join(&summary_archive_file);

    let node_positions: Vec<f32> = artifacts
        .nodes
        .iter()
        .flat_map(|node| node.position)
        .collect();
    let node_metrics: Vec<u32> = artifacts
        .nodes
        .iter()
        .flat_map(|node| {
            [
                node.total_degree,
                node.ally_degree,
                node.enemy_degree,
                node.total_support,
                node.highlight_flags,
                node.match_count,
            ]
        })
        .collect();
    let edge_pairs: Vec<u32> = artifacts
        .edges
        .iter()
        .flat_map(|edge| [edge.source_index, edge.target_index])
        .collect();
    let edge_props: Vec<u32> = artifacts
        .edges
        .iter()
        .map(|edge| pack_edge_prop(edge.weight, edge.relation.bit()))
        .collect();
    let node_meta = NodeMetaArtifact {
        ids: artifacts.nodes.iter().map(|node| node.id.clone()).collect(),
        labels: artifacts
            .nodes
            .iter()
            .map(|node| node.label.clone())
            .collect(),
        cluster_ids: artifacts
            .nodes
            .iter()
            .map(|node| node.cluster_id.clone())
            .collect(),
        opscores: artifacts.nodes.iter().map(|node| node.opscore).collect(),
        feedscores: artifacts.nodes.iter().map(|node| node.feedscore).collect(),
        highlight_flags: artifacts
            .nodes
            .iter()
            .map(|node| node.highlight_flags)
            .collect(),
    };
    let cluster_meta = ClusterMetaArtifact {
        clusters: artifacts
            .clusters
            .iter()
            .map(|cluster| cluster_meta_record(cluster, &artifacts.nodes))
            .collect(),
    };

    write_f32_array(&node_positions_path, &node_positions);
    write_u32_array(&node_metrics_path, &node_metrics);
    write_u32_array(&edge_pairs_path, &edge_pairs);
    write_u32_array(&edge_props_path, &edge_props);
    fs::write(
        &node_meta_path,
        serde_json::to_vec(&node_meta).expect("failed to serialize graph v2 node metadata"),
    )
    .expect("failed to write graph v2 node metadata");
    fs::write(
        &cluster_meta_path,
        serde_json::to_vec(&cluster_meta).expect("failed to serialize graph v2 cluster metadata"),
    )
    .expect("failed to write graph v2 cluster metadata");

    let summary_markdown = graph_v2_summary_markdown(&dataset_id, &generated_at, &artifacts);
    fs::write(&summary_path, &summary_markdown).expect("failed to write graph v2 analysis summary");
    fs::write(&summary_archive_path, &summary_markdown)
        .expect("failed to write graph v2 archived analysis summary");

    let manifest = GraphV2Manifest {
        dataset_id,
        summary_file: "summary.md".to_string(),
        summary_archive_file,
        match_count: artifacts.match_count,
        player_count: artifacts.eligible_player_count,
        node_count: artifacts.nodes.len(),
        edge_count: artifacts.edges.len(),
        ally_edge_count: artifacts.ally_edge_count,
        enemy_edge_count: artifacts.enemy_edge_count,
        cluster_count: artifacts.clusters.len(),
        min_support_threshold: MIN_SUPPORT_THRESHOLD,
        ally_cluster_support_threshold: ALLY_CLUSTER_SUPPORT_THRESHOLD,
        graph_builder_version: GRAPH_BUILDER_VERSION.to_string(),
        clustering_algorithm_version: CLUSTERING_ALGORITHM_VERSION.to_string(),
        layout_version: LAYOUT_VERSION.to_string(),
        generated_at,
        generation_ms: artifacts.generation_ms,
        node_position_stride: NODE_POSITION_STRIDE,
        node_metric_stride: NODE_METRIC_STRIDE,
        edge_pair_stride: EDGE_PAIR_STRIDE,
        edge_prop_encoding: "bit0=relation(0 ally,1 enemy); remaining bits store support weight"
            .to_string(),
        node_metric_encoding: vec![
            "totalDegree".to_string(),
            "allyDegree".to_string(),
            "enemyDegree".to_string(),
            "totalSupport".to_string(),
            "highlightFlags(bit0 best opscore, bit1 worst feedscore)".to_string(),
            "matchCount".to_string(),
        ],
        graph_construction_rule: "signed pair projection from match participants; ally_weight counts same-team matches; enemy_weight counts opposite-team matches; dominant relation is ally when ally_weight >= enemy_weight, enemy otherwise; visible edges require total_matches >= 2".to_string(),
        clustering_rule: format!(
            "deterministic ally groups over ally_weight >= {}; oversized ally components are split into local groups capped at {} players; enemy-only edges do not merge clusters",
            ALLY_CLUSTER_SUPPORT_THRESHOLD, MAX_VISUAL_CLUSTER_SIZE,
        ),
        file_sizes: ArtifactFileSizes {
            manifest_json: 0,
            summary_md: file_size(&summary_path),
            node_meta_json: file_size(&node_meta_path),
            node_positions_f32: file_size(&node_positions_path),
            node_metrics_u32: file_size(&node_metrics_path),
            edge_pairs_u32: file_size(&edge_pairs_path),
            edge_props_u32: file_size(&edge_props_path),
            cluster_meta_json: file_size(&cluster_meta_path),
        },
    };

    fs::write(
        &manifest_path,
        serde_json::to_vec(&manifest).expect("failed to serialize graph v2 manifest"),
    )
    .expect("failed to write graph v2 manifest");

    let mut manifest_with_size = manifest;
    manifest_with_size.file_sizes.manifest_json = file_size(&manifest_path);
    fs::write(
        &manifest_path,
        serde_json::to_vec(&manifest_with_size).expect("failed to serialize graph v2 manifest"),
    )
    .expect("failed to write graph v2 manifest");
}

fn graph_v2_summary_markdown(
    dataset_id: &str,
    generated_at: &str,
    artifacts: &ArtifactBundle,
) -> String {
    let mut summary = String::new();
    let node_count = artifacts.nodes.len();
    let edge_count = artifacts.edges.len();
    let cluster_count = artifacts.clusters.len();
    let ally_ratio = ratio(artifacts.ally_edge_count, edge_count);
    let enemy_ratio = ratio(artifacts.enemy_edge_count, edge_count);
    let total_edge_support: u32 = artifacts.edges.iter().map(|edge| edge.weight).sum();
    let average_edge_support = if edge_count > 0 {
        total_edge_support as f64 / edge_count as f64
    } else {
        0.0
    };
    let cluster_sizes: Vec<usize> = artifacts
        .clusters
        .iter()
        .map(|cluster| cluster.members.len())
        .collect();
    let largest_cluster = cluster_sizes.iter().copied().max().unwrap_or(0);
    let average_cluster_size = if cluster_count > 0 {
        cluster_sizes.iter().sum::<usize>() as f64 / cluster_count as f64
    } else {
        0.0
    };
    let outer_orbit_clusters = artifacts
        .clusters
        .iter()
        .filter(|cluster| cluster.connected_ally_cluster_count == 0)
        .count();
    let bridge_candidate_clusters = artifacts
        .clusters
        .iter()
        .filter(|cluster| cluster.connected_ally_cluster_count > 0)
        .count();
    let opscore_summary = numeric_summary(
        artifacts
            .nodes
            .iter()
            .filter_map(|node| node.opscore)
            .collect::<Vec<_>>()
            .as_slice(),
    );
    let feedscore_summary = numeric_summary(
        artifacts
            .nodes
            .iter()
            .filter_map(|node| node.feedscore)
            .collect::<Vec<_>>()
            .as_slice(),
    );

    let _ = writeln!(summary, "# Graph V2 Analysis Summary");
    let _ = writeln!(summary);
    let _ = writeln!(
        summary,
        "This file is generated with the Graph Builder V2 artifacts. It is intended as a compact context file for later AI-assisted analysis, machine-learning feature planning, assortativity checks, signed-graph experiments, and thesis notes."
    );
    let _ = writeln!(summary);
    let _ = writeln!(summary, "## Artifact Identity");
    let _ = writeln!(summary);
    let _ = writeln!(summary, "- datasetId: `{}`", md_escape(dataset_id));
    let _ = writeln!(
        summary,
        "- generatedAtUnixMs: `{}`",
        md_escape(generated_at)
    );
    let _ = writeln!(
        summary,
        "- graphBuilderVersion: `{}`",
        GRAPH_BUILDER_VERSION
    );
    let _ = writeln!(
        summary,
        "- clusteringAlgorithmVersion: `{}`",
        CLUSTERING_ALGORITHM_VERSION
    );
    let _ = writeln!(summary, "- layoutVersion: `{}`", LAYOUT_VERSION);
    let _ = writeln!(summary, "- generationMs: `{:.2}`", artifacts.generation_ms);
    let _ = writeln!(summary);
    let _ = writeln!(summary, "## Dataset And Graph Scale");
    let _ = writeln!(summary);
    let _ = writeln!(summary, "- matchCount: `{}`", artifacts.match_count);
    let _ = writeln!(
        summary,
        "- eligiblePlayerCountFromDatabase: `{}`",
        artifacts.eligible_player_count
    );
    let _ = writeln!(summary, "- visibleNodeCount: `{}`", node_count);
    let _ = writeln!(summary, "- visibleEdgeCount: `{}`", edge_count);
    let _ = writeln!(
        summary,
        "- allyEdgeCount: `{}` ({:.2}%)",
        artifacts.ally_edge_count,
        ally_ratio * 100.0
    );
    let _ = writeln!(
        summary,
        "- enemyEdgeCount: `{}` ({:.2}%)",
        artifacts.enemy_edge_count,
        enemy_ratio * 100.0
    );
    let _ = writeln!(
        summary,
        "- averageEdgeSupport: `{:.3}`",
        average_edge_support
    );
    let _ = writeln!(summary, "- clusterCount: `{}`", cluster_count);
    let _ = writeln!(summary, "- largestClusterSize: `{}`", largest_cluster);
    let _ = writeln!(
        summary,
        "- averageClusterSize: `{:.3}`",
        average_cluster_size
    );
    let _ = writeln!(
        summary,
        "- bridgeCandidateClusters: `{}`",
        bridge_candidate_clusters
    );
    let _ = writeln!(
        summary,
        "- outerOrbitClustersWithoutAllyBridges: `{}`",
        outer_orbit_clusters
    );
    let _ = writeln!(summary);
    let _ = writeln!(summary, "## Construction Semantics");
    let _ = writeln!(summary);
    let _ = writeln!(
        summary,
        "- Edges are a signed pair projection from match participants."
    );
    let _ = writeln!(
        summary,
        "- `ally_weight` counts same-team co-occurrence; `enemy_weight` counts opposite-team exposure."
    );
    let _ = writeln!(
        summary,
        "- The visible relation is `ally` when `ally_weight >= enemy_weight`; otherwise it is `enemy`."
    );
    let _ = writeln!(
        summary,
        "- Visible edges require `total_matches >= {}`.",
        MIN_SUPPORT_THRESHOLD
    );
    let _ = writeln!(
        summary,
        "- Cluster membership uses ally evidence only: `ally_weight >= {}`.",
        ALLY_CLUSTER_SUPPORT_THRESHOLD
    );
    let _ = writeln!(
        summary,
        "- Visual ally groups are capped at `{}` players; oversized connected components are split deterministically.",
        MAX_VISUAL_CLUSTER_SIZE
    );
    let _ = writeln!(
        summary,
        "- Orbit distance is a visualization heuristic based on cross-cluster ally support, connected ally-cluster count, and member count. It is not a learned label and should not be treated as a research conclusion by itself."
    );
    let _ = writeln!(summary);
    let _ = writeln!(summary, "## Metric Coverage");
    let _ = writeln!(summary);
    let _ = writeln!(
        summary,
        "- opscoreCoverage: `{}/{} nodes`",
        opscore_summary.count, node_count
    );
    let _ = writeln!(
        summary,
        "- opscoreMeanMinMax: `{:.4}` / `{:.4}` / `{:.4}`",
        opscore_summary.mean, opscore_summary.min, opscore_summary.max
    );
    let _ = writeln!(
        summary,
        "- feedscoreCoverage: `{}/{} nodes`",
        feedscore_summary.count, node_count
    );
    let _ = writeln!(
        summary,
        "- feedscoreMeanMinMax: `{:.4}` / `{:.4}` / `{:.4}`",
        feedscore_summary.mean, feedscore_summary.min, feedscore_summary.max
    );
    let _ = writeln!(summary);
    let _ = writeln!(summary, "## ML-Oriented Feature Map");
    let _ = writeln!(summary);
    let _ = writeln!(
        summary,
        "| Level | Candidate features | Suggested use | Caution |"
    );
    let _ = writeln!(summary, "| --- | --- | --- | --- |");
    let _ = writeln!(
        summary,
        "| Node | totalDegree, allyDegree, enemyDegree, totalSupport, matchCount, opscore, feedscore, highlightFlags | player profile clustering, performance assortativity, bridge candidate prefiltering | Do not train on player identity as a generalizable feature. |"
    );
    let _ = writeln!(
        summary,
        "| Edge | relation, support weight, ally/enemy dominance, same-cluster flag | signed balance, link prediction, relationship strength modeling | Low-support edges should be thresholded or confidence-weighted. |"
    );
    let _ = writeln!(
        summary,
        "| Cluster | memberCount, internalAllyEdgeCount, crossAllySupport, connectedAllyClusterCount, enemyCrossClusterEdgeCount, orbitScore, orbitRadius | cluster embeddings, bridge-group detection, sample stratification | Orbit fields are visual heuristics, not ground-truth community labels. |"
    );
    let _ = writeln!(summary);
    let _ = writeln!(summary, "## Instructions For AI/ML Analysis");
    let _ = writeln!(summary);
    let _ = writeln!(
        summary,
        "Use this summary as the analysis guide and use the artifact files as the source data. The summary explains what the columns mean, what graph projection created them, and which questions are defensible."
    );
    let _ = writeln!(summary);
    let _ = writeln!(summary, "When analyzing this graph:");
    let _ = writeln!(
        summary,
        "1. Check `datasetId`, match count, visible node count, edge count, and largest cluster size before drawing conclusions."
    );
    let _ = writeln!(
        summary,
        "2. Treat `node_meta.json`, `node_metrics.u32`, `edge_pairs.u32`, `edge_props.u32`, and `cluster_meta.json` as the canonical data files."
    );
    let _ = writeln!(
        summary,
        "3. Use `cluster_meta.json` for cluster-level features and `node_metrics.u32` plus `node_meta.json` for player-level features."
    );
    let _ = writeln!(
        summary,
        "4. Prefer analysis questions about measurable graph structure: assortativity, signed balance, bridge centrality, edge support, metric coverage, and cluster-level feature distributions."
    );
    let _ = writeln!(
        summary,
        "5. Compare graph projections explicitly: ally-only, enemy-only, battle-path, internal-cluster edges, and cross-cluster bridge edges."
    );
    let _ = writeln!(
        summary,
        "6. Use `orbitScore` and `orbitRadius` only as bridge-orbit visualization features unless they are validated against independent graph metrics such as Brandes betweenness."
    );
    let _ = writeln!(
        summary,
        "7. Report missing metric coverage before using `opscore` or `feedscore` in any model."
    );
    let _ = writeln!(
        summary,
        "8. Avoid identity leakage: player ids and names are identifiers, not predictive features for generalizable ML experiments."
    );
    let _ = writeln!(
        summary,
        "9. Output hypotheses, validation checks, and feature schemas separately from conclusions."
    );
    let _ = writeln!(
        summary,
        "10. Keep causal language out unless a later experiment explicitly supports it."
    );
    let _ = writeln!(summary);
    let _ = writeln!(
        summary,
        "Good follow-up outputs from an AI assistant include:"
    );
    let _ = writeln!(
        summary,
        "- a feature matrix design for node-level, edge-level, and cluster-level ML rows"
    );
    let _ = writeln!(
        summary,
        "- an assortativity experiment plan for `opscore` and `feedscore`"
    );
    let _ = writeln!(
        summary,
        "- a signed-balance triad analysis plan with threshold rules"
    );
    let _ = writeln!(
        summary,
        "- a centrality comparison plan that tests whether bridge-orbit clusters are also high-betweenness regions"
    );
    let _ = writeln!(
        summary,
        "- anomaly checks for oversized groups, extreme edge support, missing metrics, and unexpected enemy/ally ratios"
    );
    let _ = writeln!(summary);
    let _ = writeln!(summary, "## Top Bridge-Orbit Clusters");
    let _ = writeln!(summary);
    let _ = writeln!(
        summary,
        "| Cluster | Members | Cross ally support | Connected ally clusters | Internal ally edges | Enemy/cross exposure | Orbit score | Orbit radius | Representative |"
    );
    let _ = writeln!(
        summary,
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |"
    );

    let mut top_clusters: Vec<&ClusterBuildRecord> = artifacts.clusters.iter().collect();
    top_clusters.sort_by(|left, right| {
        right
            .orbit_score
            .total_cmp(&left.orbit_score)
            .then_with(|| right.cross_ally_support.cmp(&left.cross_ally_support))
            .then_with(|| right.members.len().cmp(&left.members.len()))
            .then_with(|| left.cluster_id.cmp(&right.cluster_id))
    });
    for cluster in top_clusters.into_iter().take(12) {
        let representative = cluster
            .best_op_member
            .or_else(|| cluster.members.first().copied())
            .map(|index| artifacts.nodes[index].label.as_str())
            .unwrap_or(UNKNOWN_LABEL);
        let _ = writeln!(
            summary,
            "| `{}` | {} | {} | {} | {} | {} | {:.4} | {:.2} | {} |",
            md_escape(&cluster.cluster_id),
            cluster.members.len(),
            cluster.cross_ally_support,
            cluster.connected_ally_cluster_count,
            cluster.internal_ally_edge_count,
            cluster.enemy_cross_cluster_edge_count,
            cluster.orbit_score,
            cluster.orbit_radius,
            md_escape(representative)
        );
    }

    let _ = writeln!(summary);
    let _ = writeln!(summary, "## Suggested Analysis Questions");
    let _ = writeln!(summary);
    let _ = writeln!(
        summary,
        "1. Numeric assortativity: compare `opscore` and `feedscore` across ally-only, enemy-only, battle-path, and bridge-only edge projections."
    );
    let _ = writeln!(
        summary,
        "2. Signed structural balance: classify fully connected signed triads using ally as positive and enemy as negative, with a minimum edge-support threshold."
    );
    let _ = writeln!(
        summary,
        "3. Bridge analysis: compare `crossAllySupport` and `connectedAllyClusterCount` against true Brandes betweenness once centrality is computed."
    );
    let _ = writeln!(
        summary,
        "4. Cluster embedding: use bounded group metadata to create cluster-level rows, then test whether high bridge exposure correlates with wider performance variance."
    );
    let _ = writeln!(
        summary,
        "5. Dataset validation: monitor largestClusterSize, edge support distribution, and outer-orbit cluster count after each Flex Queue expansion."
    );
    let _ = writeln!(summary);
    let _ = writeln!(summary, "## Interpretation Guardrails");
    let _ = writeln!(summary);
    let _ = writeln!(
        summary,
        "- Treat this summary as metadata for analysis planning, not as a label file."
    );
    let _ = writeln!(
        summary,
        "- Avoid causal or psychological claims. Prefer correlation language such as `similar measured performance profiles appear assortatively connected under this graph projection`."
    );
    let _ = writeln!(
        summary,
        "- Keep Flex Queue signed-network conclusions separate from SoloQ individual-performance conclusions."
    );
    let _ = writeln!(
        summary,
        "- Recompute this file whenever the dataset, thresholds, graph construction rule, or layout version changes."
    );

    summary
}

#[derive(Debug, Clone, Copy)]
struct NumericSummary {
    count: usize,
    mean: f64,
    min: f64,
    max: f64,
}

fn numeric_summary(values: &[f64]) -> NumericSummary {
    if values.is_empty() {
        return NumericSummary {
            count: 0,
            mean: 0.0,
            min: 0.0,
            max: 0.0,
        };
    }

    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    let mut total = 0.0;
    for value in values {
        min = min.min(*value);
        max = max.max(*value);
        total += *value;
    }

    NumericSummary {
        count: values.len(),
        mean: total / values.len() as f64,
        min,
        max,
    }
}

fn ratio(numerator: usize, denominator: usize) -> f64 {
    if denominator == 0 {
        0.0
    } else {
        numerator as f64 / denominator as f64
    }
}

fn md_escape(value: &str) -> String {
    value.replace('|', "\\|")
}

fn safe_artifact_name(value: &str) -> String {
    let mut output = String::new();
    for character in value.chars() {
        if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
            output.push(character);
        } else {
            output.push('_');
        }
    }

    if output.is_empty() {
        "unknown".to_string()
    } else {
        output
    }
}

fn cluster_meta_record(cluster: &ClusterBuildRecord, nodes: &[NodeArtifact]) -> ClusterMetaRecord {
    let representative_players = cluster
        .members
        .iter()
        .take(8)
        .map(|&index| player_summary(&nodes[index]))
        .collect();
    let best_opscore_member = cluster
        .best_op_member
        .map(|index| player_summary(&nodes[index]));
    let worst_feedscore_member = cluster
        .worst_feed_member
        .map(|index| player_summary(&nodes[index]));
    let mut highlighted_players = Vec::new();
    for &index in [cluster.best_op_member, cluster.worst_feed_member]
        .iter()
        .flatten()
    {
        if highlighted_players
            .iter()
            .any(|player: &HighlightedPlayerSummary| player.id == nodes[index].id)
        {
            continue;
        }
        highlighted_players.push(HighlightedPlayerSummary {
            id: nodes[index].id.clone(),
            label: nodes[index].label.clone(),
            is_best_opscore: nodes[index].highlight_flags & HIGHLIGHT_BEST_OP != 0,
            is_worst_feedscore: nodes[index].highlight_flags & HIGHLIGHT_WORST_FEED != 0,
        });
    }

    ClusterMetaRecord {
        cluster_id: cluster.cluster_id.clone(),
        member_count: cluster.members.len(),
        representative_players,
        best_opscore_member,
        worst_feedscore_member,
        highlighted_players,
        internal_ally_edge_count: cluster.internal_ally_edge_count,
        enemy_cross_cluster_edge_count: cluster.enemy_cross_cluster_edge_count,
        cross_ally_support: cluster.cross_ally_support,
        connected_ally_cluster_count: cluster.connected_ally_cluster_count,
        orbit_score: round_f64(cluster.orbit_score, 4),
        orbit_radius: cluster.orbit_radius,
        anchor: cluster.anchor,
    }
}

fn player_summary(node: &NodeArtifact) -> PlayerSummary {
    PlayerSummary {
        id: node.id.clone(),
        label: node.label.clone(),
        opscore: node.opscore,
        feedscore: node.feedscore,
    }
}

fn load_players(db_path: &Path) -> HashMap<String, PlayerRecord> {
    let Ok(conn) = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    ) else {
        return HashMap::new();
    };
    let _ = conn.busy_timeout(std::time::Duration::from_millis(5_000));
    let _ = conn.pragma_update(None, "busy_timeout", 5_000);
    let _ = conn.pragma_update(None, "query_only", true);
    let Ok(mut stmt) =
        conn.prepare("SELECT puuid, names, opscore, feedscore, match_count FROM players")
    else {
        return HashMap::new();
    };
    let Ok(rows) = stmt.query_map([], |row| {
        let id: Option<String> = row.get(0)?;
        let names: Option<String> = row.get(1)?;
        let opscore: Option<f64> = row.get(2)?;
        let feedscore: Option<f64> = row.get(3)?;
        let match_count: Option<u32> = row.get(4)?;
        let id = id.unwrap_or_default();
        Ok(PlayerRecord {
            id,
            label: latest_name(names.as_deref().unwrap_or("")),
            opscore,
            feedscore,
            match_count: match_count.unwrap_or(0),
        })
    }) else {
        return HashMap::new();
    };

    rows.filter_map(Result::ok)
        .filter(|player| is_eligible_player(&player.id, &player.label))
        .map(|player| (player.id.clone(), player))
        .collect()
}

fn load_signed_pairs(match_dir: &Path, eligible_player_ids: &HashSet<&str>) -> MatchScan {
    let mut pair_map = HashMap::new();
    let mut match_count = 0usize;
    let entries = fs::read_dir(match_dir).expect("failed to read graph v2 match directory");
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
            continue;
        }

        let Ok(contents) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(parsed) = serde_json::from_str::<Value>(&contents) else {
            continue;
        };

        let participants = parsed["info"]["participants"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let rows: Vec<(String, i64)> = participants
            .into_iter()
            .filter_map(|participant| {
                let puuid = participant["puuid"].as_str()?.to_string();
                if !eligible_player_ids.contains(puuid.as_str()) {
                    return None;
                }
                let team_id = participant["teamId"].as_i64().unwrap_or(0);
                Some((puuid, team_id))
            })
            .collect();

        if rows.len() < 2 {
            continue;
        }
        match_count += 1;

        for left_index in 0..rows.len() {
            for right_index in (left_index + 1)..rows.len() {
                let (left_id, left_team) = &rows[left_index];
                let (right_id, right_team) = &rows[right_index];
                let entry = pair_map
                    .entry(ordered_pair(left_id, right_id))
                    .or_insert_with(PairAccumulator::default);
                if left_team == right_team {
                    entry.ally_weight += 1;
                } else {
                    entry.enemy_weight += 1;
                }
            }
        }
    }

    MatchScan {
        match_count,
        pairs: pair_map,
    }
}

fn latest_name(raw_names: &str) -> String {
    serde_json::from_str::<Vec<String>>(raw_names)
        .ok()
        .and_then(|names| names.last().cloned())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| UNKNOWN_LABEL.to_string())
}

fn is_eligible_player(player_id: &str, label: &str) -> bool {
    !player_id.trim().is_empty() && !label.trim().is_empty() && label != UNKNOWN_LABEL
}

fn ordered_pair(left: &str, right: &str) -> (String, String) {
    if left <= right {
        (left.to_string(), right.to_string())
    } else {
        (right.to_string(), left.to_string())
    }
}

fn stable_hash(value: &str) -> u32 {
    let mut hash = 2_166_136_261u32;
    for byte in value.as_bytes() {
        hash ^= *byte as u32;
        hash = hash.wrapping_mul(16_777_619);
    }
    hash
}

fn write_f32_array(path: &Path, values: &[f32]) {
    let mut bytes = Vec::with_capacity(values.len() * 4);
    for value in values {
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    fs::write(path, bytes).expect("failed to write graph v2 f32 artifact");
}

fn write_u32_array(path: &Path, values: &[u32]) {
    let mut bytes = Vec::with_capacity(values.len() * 4);
    for value in values {
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    fs::write(path, bytes).expect("failed to write graph v2 u32 artifact");
}

fn file_size(path: &Path) -> u64 {
    fs::metadata(path)
        .expect("failed to stat graph v2 artifact")
        .len()
}

fn pack_edge_prop(weight: u32, relation_bit: u32) -> u32 {
    (weight << 1) | (relation_bit & 1)
}

fn round_f64(value: f64, decimals: i32) -> f64 {
    let factor = 10_f64.powi(decimals);
    (value * factor).round() / factor
}

fn unix_timestamp_string() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn resolve_match_dir() -> PathBuf {
    if let Ok(value) = env::var("PATHFINDER_MATCH_DIR") {
        return PathBuf::from(value);
    }
    PathBuf::from("../data")
}

fn resolve_db_path() -> PathBuf {
    if let Ok(value) = env::var("GRAPH_DB_PATH") {
        return PathBuf::from(value);
    }
    if let Ok(value) = env::var("DB_PATH") {
        return PathBuf::from(value);
    }
    PathBuf::from("../../playersrefined.db")
}

fn resolve_cache_dir() -> PathBuf {
    if let Ok(value) = env::var("PATHFINDER_GRAPH_V2_CACHE_DIR") {
        return PathBuf::from(value);
    }
    PathBuf::from(CACHE_DIR_NAME)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn player(id: &str, label: &str, opscore: f64, feedscore: f64) -> PlayerRecord {
        PlayerRecord {
            id: id.to_string(),
            label: label.to_string(),
            opscore: Some(opscore),
            feedscore: Some(feedscore),
            match_count: 3,
        }
    }

    #[test]
    fn dominant_relation_prefers_ally_on_ties() {
        let tied = PairAccumulator {
            ally_weight: 2,
            enemy_weight: 2,
        };
        let enemy = PairAccumulator {
            ally_weight: 1,
            enemy_weight: 2,
        };

        assert_eq!(tied.dominant_relation(), Relation::Ally);
        assert_eq!(enemy.dominant_relation(), Relation::Enemy);
    }

    #[test]
    fn min_support_filter_keeps_only_repeated_pairs() {
        let pair_map = HashMap::from([
            (
                ("a".to_string(), "b".to_string()),
                PairAccumulator {
                    ally_weight: 1,
                    enemy_weight: 0,
                },
            ),
            (
                ("b".to_string(), "c".to_string()),
                PairAccumulator {
                    ally_weight: 1,
                    enemy_weight: 1,
                },
            ),
        ]);

        let visible = visible_node_ids(&pair_map);

        assert!(!visible.contains("a"));
        assert!(visible.contains("b"));
        assert!(visible.contains("c"));
    }

    #[test]
    fn ally_only_clustering_does_not_merge_through_enemy_edge() {
        let players = vec![
            player("a", "A#EUW", 1.0, 1.0),
            player("b", "B#EUW", 2.0, 2.0),
            player("c", "C#EUW", 3.0, 3.0),
        ];
        let adjacency = HashMap::from([
            (
                0usize,
                vec![AllyNeighbor {
                    index: 1usize,
                    weight: 2,
                }],
            ),
            (
                1usize,
                vec![AllyNeighbor {
                    index: 0usize,
                    weight: 2,
                }],
            ),
        ]);

        let clusters = build_clusters(&players, &adjacency);

        assert_eq!(clusters.len(), 2);
        assert_eq!(clusters[0].members, vec![0, 1]);
        assert_eq!(clusters[1].members, vec![2]);
    }

    #[test]
    fn oversized_ally_components_are_split_into_bounded_groups() {
        let players: Vec<PlayerRecord> = (0..25)
            .map(|index| {
                player(
                    &format!("p{index:02}"),
                    &format!("P{index:02}#EUNE"),
                    5.0,
                    5.0,
                )
            })
            .collect();
        let mut adjacency: HashMap<usize, Vec<AllyNeighbor>> = HashMap::new();

        for index in 0..24 {
            adjacency.entry(index).or_default().push(AllyNeighbor {
                index: index + 1,
                weight: 2,
            });
            adjacency
                .entry(index + 1)
                .or_default()
                .push(AllyNeighbor { index, weight: 2 });
        }

        let clusters = build_clusters(&players, &adjacency);

        assert!(clusters
            .iter()
            .all(|cluster| cluster.members.len() <= MAX_VISUAL_CLUSTER_SIZE));
        assert_eq!(
            clusters
                .iter()
                .map(|cluster| cluster.members.len())
                .sum::<usize>(),
            players.len(),
        );
    }

    fn cluster(id: &str, members: Vec<usize>) -> ClusterBuildRecord {
        ClusterBuildRecord {
            cluster_id: id.to_string(),
            members,
            anchor: [0.0, 0.0],
            internal_ally_edge_count: 0,
            enemy_cross_cluster_edge_count: 0,
            cross_ally_support: 0,
            connected_ally_cluster_count: 0,
            orbit_score: 0.0,
            orbit_radius: 0.0,
            best_op_member: None,
            worst_feed_member: None,
        }
    }

    fn ally_edge(left: u32, right: u32, support: u32) -> ExportEdge {
        ExportEdge {
            source_index: left,
            target_index: right,
            weight: support,
            ally_weight: support,
            relation: Relation::Ally,
        }
    }

    #[test]
    fn orbit_layout_pulls_stronger_bridge_clusters_closer_to_center() {
        let mut clusters = vec![
            cluster("cluster-a", vec![0, 1]),
            cluster("cluster-b", vec![2, 3]),
            cluster("cluster-c", vec![4, 5]),
            cluster("cluster-d", vec![6, 7]),
        ];
        let edges = vec![ally_edge(0, 2, 8), ally_edge(1, 4, 4), ally_edge(2, 4, 2)];

        apply_orbit_layout(&mut clusters, &edges);

        assert!(clusters[0].orbit_radius < clusters[1].orbit_radius);
        assert!(clusters[1].orbit_radius < clusters[3].orbit_radius);
        assert_eq!(clusters[3].cross_ally_support, 0);
        assert_eq!(clusters[3].connected_ally_cluster_count, 0);
    }

    #[test]
    fn orbit_layout_is_deterministic() {
        let clusters = vec![
            cluster("cluster-a", vec![0, 1, 2]),
            cluster("cluster-b", vec![3, 4]),
            cluster("cluster-c", vec![5, 6]),
        ];
        let edges = vec![ally_edge(0, 3, 5), ally_edge(1, 5, 2)];
        let mut first = clusters.clone();
        let mut second = clusters;

        apply_orbit_layout(&mut first, &edges);
        apply_orbit_layout(&mut second, &edges);

        for (left, right) in first.iter().zip(second.iter()) {
            assert_eq!(left.anchor, right.anchor);
            assert_eq!(left.orbit_radius, right.orbit_radius);
            assert_eq!(left.orbit_score, right.orbit_score);
        }
    }

    #[test]
    fn edge_prop_pack_matches_documented_encoding() {
        assert_eq!(pack_edge_prop(2, 0), 4);
        assert_eq!(pack_edge_prop(2, 1), 5);
    }
}
