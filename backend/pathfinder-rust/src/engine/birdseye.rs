use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet, VecDeque};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

const UNKNOWN_LABEL: &str = "Unknown#Unknown";
const SPHERE_RADIUS: f32 = 420.0;
const LAYOUT_VERSION: &str = "birdseye-static-v2";
const LAYOUT_CLUSTER_SUPPORT_THRESHOLD: u32 = 2;
const CACHE_DIR_NAME: &str = "cache/birdseye-3d-v2";
const METRIC_STRIDE: u32 = 4;
const EDGE_PAIR_STRIDE: u32 = 2;
const GOLDEN_ANGLE: f32 = 2.399_963_1;

#[derive(Debug, Clone)]
struct EligiblePlayer {
    id: String,
    label: String,
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

    fn dominant_relation(self) -> &'static str {
        if self.ally_weight >= self.enemy_weight {
            "ally"
        } else {
            "enemy"
        }
    }
}

#[derive(Debug, Clone)]
struct ExportEdge {
    source_index: u32,
    target_index: u32,
    weight: u32,
    relation_bit: u32,
}

#[derive(Debug, Clone)]
struct LayoutGroup {
    cluster_id: String,
    anchor: [f32; 3],
    members: Vec<usize>,
}

#[derive(Debug, Clone)]
struct NodeArtifact {
    id: String,
    label: String,
    cluster_id: String,
    position: [f32; 3],
    total_degree: u32,
    ally_degree: u32,
    enemy_degree: u32,
    total_support: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BirdseyeManifest {
    layout_version: String,
    sphere_radius: f32,
    layout_cluster_support_threshold: u32,
    node_count: usize,
    edge_count: usize,
    ally_edge_count: usize,
    enemy_edge_count: usize,
    cluster_count: usize,
    generation_ms: f64,
    node_metric_stride: u32,
    edge_pair_stride: u32,
    edge_prop_encoding: String,
    file_sizes: ArtifactFileSizes,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ArtifactFileSizes {
    node_positions_f32: u64,
    node_metrics_u32: u64,
    edge_pairs_u32: u64,
    edge_props_u32: u64,
    node_meta_json: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NodeMetaArtifact {
    ids: Vec<String>,
    labels: Vec<String>,
    cluster_ids: Vec<String>,
}

pub fn export_birdseye_3d_artifacts() -> PathBuf {
    let started_at = Instant::now();
    let db_path = resolve_db_path();
    let match_dir = resolve_match_dir();
    let cache_dir = resolve_cache_dir();

    let eligible_players = load_eligible_players(&db_path);
    let player_ids: HashSet<&str> = eligible_players
        .iter()
        .map(|player| player.id.as_str())
        .collect();
    let pair_map = load_full_graph_edges(&match_dir, &player_ids);
    let artifacts = build_artifacts(
        &eligible_players,
        &pair_map,
        started_at.elapsed().as_secs_f64() * 1000.0,
    );

    write_artifacts(&cache_dir, artifacts);
    cache_dir
}

fn build_artifacts(
    eligible_players: &[EligiblePlayer],
    pair_map: &HashMap<(String, String), PairAccumulator>,
    generation_ms: f64,
) -> ArtifactBundle {
    let mut sorted_players = eligible_players.to_vec();
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
    let mut export_edges = Vec::with_capacity(pair_map.len());
    let mut layout_adjacency: HashMap<usize, Vec<usize>> = HashMap::new();
    let mut sorted_pairs: Vec<(&(String, String), &PairAccumulator)> = pair_map.iter().collect();
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
        if total_matches == 0 {
            continue;
        }

        let relation_bit = if relation.dominant_relation() == "enemy" {
            1
        } else {
            0
        };
        if relation_bit == 1 {
            enemy_edge_count += 1;
        } else {
            ally_edge_count += 1;
        }

        export_edges.push(ExportEdge {
            source_index: left_index as u32,
            target_index: right_index as u32,
            weight: total_matches,
            relation_bit,
        });

        metrics[left_index].0 += 1;
        metrics[right_index].0 += 1;
        metrics[left_index].3 += total_matches;
        metrics[right_index].3 += total_matches;
        if relation_bit == 1 {
            metrics[left_index].2 += 1;
            metrics[right_index].2 += 1;
        } else {
            metrics[left_index].1 += 1;
            metrics[right_index].1 += 1;
        }

        if total_matches >= LAYOUT_CLUSTER_SUPPORT_THRESHOLD {
            layout_adjacency
                .entry(left_index)
                .or_default()
                .push(right_index);
            layout_adjacency
                .entry(right_index)
                .or_default()
                .push(left_index);
        }
    }

    let layout_groups = build_layout_groups(&sorted_players, &layout_adjacency);
    let mut node_cluster_ids = vec![String::new(); sorted_players.len()];
    let mut node_positions = vec![[0.0_f32; 3]; sorted_players.len()];
    for group in &layout_groups {
        for (member_offset, &node_index) in group.members.iter().enumerate() {
            node_cluster_ids[node_index] = group.cluster_id.clone();
            node_positions[node_index] = position_for_group_member(
                group.anchor,
                member_offset,
                group.members.len(),
                &sorted_players[node_index].id,
            );
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
        })
        .collect();

    ArtifactBundle {
        nodes,
        edges: export_edges,
        manifest_meta: ManifestMeta {
            generation_ms,
            ally_edge_count,
            enemy_edge_count,
            cluster_count: layout_groups.len(),
        },
    }
}

fn build_layout_groups(
    players: &[EligiblePlayer],
    layout_adjacency: &HashMap<usize, Vec<usize>>,
) -> Vec<LayoutGroup> {
    let mut visited = vec![false; players.len()];
    let mut components: Vec<Vec<usize>> = Vec::new();

    for start_index in 0..players.len() {
        if visited[start_index] || !layout_adjacency.contains_key(&start_index) {
            continue;
        }

        let mut queue = VecDeque::from([start_index]);
        let mut members = Vec::new();
        visited[start_index] = true;

        while let Some(current_index) = queue.pop_front() {
            members.push(current_index);
            if let Some(neighbors) = layout_adjacency.get(&current_index) {
                for &neighbor_index in neighbors {
                    if !visited[neighbor_index] {
                        visited[neighbor_index] = true;
                        queue.push_back(neighbor_index);
                    }
                }
            }
        }

        members.sort_by(|left, right| players[*left].id.cmp(&players[*right].id));
        components.push(members);
    }

    let mut singleton_members = Vec::new();
    for index in 0..players.len() {
        if !visited[index] {
            singleton_members.push(vec![index]);
        }
    }

    components.sort_by(|left, right| {
        right
            .len()
            .cmp(&left.len())
            .then_with(|| players[left[0]].id.cmp(&players[right[0]].id))
    });
    singleton_members.sort_by(|left, right| players[left[0]].id.cmp(&players[right[0]].id));
    components.extend(singleton_members);

    let anchors = fibonacci_sphere_points(components.len().max(1));
    components
        .into_iter()
        .enumerate()
        .map(|(index, members)| LayoutGroup {
            cluster_id: format!("birdseye:group:{}", index + 1),
            anchor: anchors[index],
            members,
        })
        .collect()
}

fn fibonacci_sphere_points(count: usize) -> Vec<[f32; 3]> {
    if count == 1 {
        return vec![[0.0, 1.0, 0.0]];
    }

    let mut points = Vec::with_capacity(count);
    for index in 0..count {
        let y = 1.0 - (2.0 * index as f32) / (count as f32 - 1.0);
        let radius = (1.0 - y * y).max(0.0).sqrt();
        let theta = GOLDEN_ANGLE * index as f32;
        points.push([radius * theta.cos(), y, radius * theta.sin()]);
    }
    points
}

fn position_for_group_member(
    anchor: [f32; 3],
    member_offset: usize,
    group_size: usize,
    player_id: &str,
) -> [f32; 3] {
    if group_size <= 1 {
        return [
            anchor[0] * SPHERE_RADIUS,
            anchor[1] * SPHERE_RADIUS,
            anchor[2] * SPHERE_RADIUS,
        ];
    }

    let normal = normalize(anchor);
    let tangent_a = tangent_basis_a(normal);
    let tangent_b = cross(normal, tangent_a);
    let group_spread = (0.014 + (group_size as f32).sqrt() * 0.006).min(0.13);
    let theta = GOLDEN_ANGLE * member_offset as f32;
    let radial = group_spread * (((member_offset + 1) as f32) / group_size as f32).sqrt();
    let offset_vector = [
        tangent_a[0] * theta.cos() * radial + tangent_b[0] * theta.sin() * radial,
        tangent_a[1] * theta.cos() * radial + tangent_b[1] * theta.sin() * radial,
        tangent_a[2] * theta.cos() * radial + tangent_b[2] * theta.sin() * radial,
    ];
    let jitter = ((stable_hash(player_id) % 7) as f32 - 3.0) * 0.0028;
    let direction = normalize([
        normal[0] + offset_vector[0],
        normal[1] + offset_vector[1],
        normal[2] + offset_vector[2],
    ]);
    let radius = SPHERE_RADIUS * (1.0 + jitter);
    [
        direction[0] * radius,
        direction[1] * radius,
        direction[2] * radius,
    ]
}

fn tangent_basis_a(normal: [f32; 3]) -> [f32; 3] {
    let reference = if normal[1].abs() < 0.92 {
        [0.0, 1.0, 0.0]
    } else {
        [1.0, 0.0, 0.0]
    };
    normalize(cross(normal, reference))
}

fn cross(left: [f32; 3], right: [f32; 3]) -> [f32; 3] {
    [
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    ]
}

fn normalize(vector: [f32; 3]) -> [f32; 3] {
    let magnitude = (vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]).sqrt();
    if magnitude == 0.0 {
        [0.0, 1.0, 0.0]
    } else {
        [
            vector[0] / magnitude,
            vector[1] / magnitude,
            vector[2] / magnitude,
        ]
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

fn write_artifacts(cache_dir: &Path, artifacts: ArtifactBundle) {
    fs::create_dir_all(cache_dir).expect("failed to create birdseye cache directory");

    let node_positions_path = cache_dir.join("node_positions.f32");
    let node_metrics_path = cache_dir.join("node_metrics.u32");
    let edge_pairs_path = cache_dir.join("edge_pairs.u32");
    let edge_props_path = cache_dir.join("edge_props.u32");
    let node_meta_path = cache_dir.join("node_meta.json");
    let manifest_path = cache_dir.join("manifest.json");

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
        .map(|edge| pack_edge_prop(edge.weight, edge.relation_bit))
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
    };

    write_f32_array(&node_positions_path, &node_positions);
    write_u32_array(&node_metrics_path, &node_metrics);
    write_u32_array(&edge_pairs_path, &edge_pairs);
    write_u32_array(&edge_props_path, &edge_props);
    fs::write(
        &node_meta_path,
        serde_json::to_vec(&node_meta).expect("failed to serialize birdseye node metadata"),
    )
    .expect("failed to write birdseye node metadata");

    let manifest = BirdseyeManifest {
        layout_version: LAYOUT_VERSION.to_string(),
        sphere_radius: SPHERE_RADIUS,
        layout_cluster_support_threshold: LAYOUT_CLUSTER_SUPPORT_THRESHOLD,
        node_count: artifacts.nodes.len(),
        edge_count: artifacts.edges.len(),
        ally_edge_count: artifacts.manifest_meta.ally_edge_count,
        enemy_edge_count: artifacts.manifest_meta.enemy_edge_count,
        cluster_count: artifacts.manifest_meta.cluster_count,
        generation_ms: artifacts.manifest_meta.generation_ms,
        node_metric_stride: METRIC_STRIDE,
        edge_pair_stride: EDGE_PAIR_STRIDE,
        edge_prop_encoding: "bit0=relation(0 ally,1 enemy); remaining bits store weight"
            .to_string(),
        file_sizes: ArtifactFileSizes {
            node_positions_f32: file_size(&node_positions_path),
            node_metrics_u32: file_size(&node_metrics_path),
            edge_pairs_u32: file_size(&edge_pairs_path),
            edge_props_u32: file_size(&edge_props_path),
            node_meta_json: file_size(&node_meta_path),
        },
    };

    fs::write(
        manifest_path,
        serde_json::to_vec(&manifest).expect("failed to serialize birdseye manifest"),
    )
    .expect("failed to write birdseye manifest");
}

fn write_f32_array(path: &Path, values: &[f32]) {
    let mut bytes = Vec::with_capacity(values.len() * 4);
    for value in values {
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    fs::write(path, bytes).expect("failed to write f32 artifact");
}

fn write_u32_array(path: &Path, values: &[u32]) {
    let mut bytes = Vec::with_capacity(values.len() * 4);
    for value in values {
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    fs::write(path, bytes).expect("failed to write u32 artifact");
}

fn file_size(path: &Path) -> u64 {
    fs::metadata(path).expect("failed to stat artifact").len()
}

fn pack_edge_prop(weight: u32, relation_bit: u32) -> u32 {
    (weight << 1) | (relation_bit & 1)
}

fn load_eligible_players(db_path: &Path) -> Vec<EligiblePlayer> {
    let conn = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .expect("failed to open birdseye player database");
    let _ = conn.busy_timeout(std::time::Duration::from_millis(5_000));
    let _ = conn.pragma_update(None, "busy_timeout", 5_000);
    let _ = conn.pragma_update(None, "query_only", true);
    let mut stmt = conn
        .prepare("SELECT puuid, names FROM players")
        .expect("failed to prepare birdseye player query");
    let rows = stmt
        .query_map([], |row| {
            let puuid: Option<String> = row.get(0)?;
            let names: Option<String> = row.get(1)?;
            Ok((
                puuid.unwrap_or_default(),
                latest_name(names.as_deref().unwrap_or("")),
            ))
        })
        .expect("failed to iterate birdseye players");

    rows.filter_map(Result::ok)
        .filter(|(id, label)| is_eligible_player(id, label))
        .map(|(id, label)| EligiblePlayer { id, label })
        .collect()
}

fn load_full_graph_edges(
    match_dir: &Path,
    eligible_player_ids: &HashSet<&str>,
) -> HashMap<(String, String), PairAccumulator> {
    let mut pair_map = HashMap::new();
    let entries = fs::read_dir(match_dir).expect("failed to read birdseye match directory");
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

        for left_index in 0..rows.len() {
            for right_index in (left_index + 1)..rows.len() {
                let (left_id, left_team) = &rows[left_index];
                let (right_id, right_team) = &rows[right_index];
                let pair_key = ordered_pair(left_id, right_id);
                let entry = pair_map
                    .entry(pair_key)
                    .or_insert_with(PairAccumulator::default);
                if left_team == right_team {
                    entry.ally_weight += 1;
                } else {
                    entry.enemy_weight += 1;
                }
            }
        }
    }

    pair_map
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
    if let Ok(value) = env::var("PATHFINDER_BIRDSEYE_CACHE_DIR") {
        return PathBuf::from(value);
    }
    PathBuf::from(CACHE_DIR_NAME)
}

#[derive(Debug)]
struct ArtifactBundle {
    nodes: Vec<NodeArtifact>,
    edges: Vec<ExportEdge>,
    manifest_meta: ManifestMeta,
}

#[derive(Debug)]
struct ManifestMeta {
    generation_ms: f64,
    ally_edge_count: usize,
    enemy_edge_count: usize,
    cluster_count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn eligible_player_filter_rejects_unknown_label() {
        assert!(is_eligible_player("puuid-1", "Player#EUNE"));
        assert!(!is_eligible_player("", "Player#EUNE"));
        assert!(!is_eligible_player("puuid-1", UNKNOWN_LABEL));
    }

    #[test]
    fn edge_prop_pack_keeps_weight_and_relation_bit() {
        assert_eq!(pack_edge_prop(5, 0), 10);
        assert_eq!(pack_edge_prop(5, 1), 11);
    }

    #[test]
    fn fibonacci_layout_is_deterministic() {
        let first = fibonacci_sphere_points(5);
        let second = fibonacci_sphere_points(5);
        assert_eq!(first, second);
        assert_eq!(first.len(), 5);
    }

    #[test]
    fn grouped_member_positions_are_deterministic() {
        let anchor = [0.0, 1.0, 0.0];
        let first = position_for_group_member(anchor, 2, 9, "player-42");
        let second = position_for_group_member(anchor, 2, 9, "player-42");
        assert_eq!(first, second);
        let radius = (first[0] * first[0] + first[1] * first[1] + first[2] * first[2]).sqrt();
        assert!((radius - SPHERE_RADIUS).abs() < 5.0);
    }
}
