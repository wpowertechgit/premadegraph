use crate::models::*;
use rusqlite::{params, Connection, OpenFlags};
use serde_json::Value;
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap, HashSet, VecDeque};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const CLUSTER_TYPE_RUST_PATHFINDING: &str = "rust_pathfinding";
const CLUSTER_ALGORITHM: &str = "strong_components";
const MIN_CLUSTER_EDGE_WEIGHT: u32 = 2;
const MAX_SNAPSHOT_CLUSTER_NODES: usize = 10;
const MAX_SNAPSHOT_VISITED_NODES: usize = 200;
const MAX_PREVIEW_CLUSTER_NODES: usize = 12;
const MIN_LANDMARKS: usize = 8;
const MAX_LANDMARKS: usize = 64;
const WEIGHT_COST_SCALE: usize = 1_000_000;
const INF_DISTANCE: usize = usize::MAX / 4;

#[derive(Debug, Clone)]
pub(super) struct Neighbor {
    pub(super) id: String,
    pub(super) ally_weight: u32,
    pub(super) total_matches: u32,
    pub(super) dominant_relation: String,
}

impl Neighbor {
    pub(super) fn is_allowed(&self, path_mode: &str) -> bool {
        if path_mode == "battle-path" {
            self.total_matches > 0
        } else {
            self.ally_weight > 0
        }
    }

    pub(super) fn weight_for_mode(&self, path_mode: &str) -> u32 {
        if path_mode == "battle-path" {
            self.total_matches.max(1)
        } else {
            self.ally_weight.max(1)
        }
    }

    pub(super) fn relation_for_mode(&self, path_mode: &str) -> String {
        if path_mode == "social-path" {
            "ally".to_string()
        } else {
            self.dominant_relation.clone()
        }
    }
}

#[derive(Debug, Clone)]
pub(super) struct PairRelation {
    pub(super) ally_weight: u32,
    pub(super) enemy_weight: u32,
    pub(super) total_matches: u32,
    pub(super) dominant_relation: String,
}

#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq)]
pub(super) enum ModeKey {
    SocialUnweighted,
    SocialWeighted,
    BattleUnweighted,
    BattleWeighted,
}

impl ModeKey {
    pub(super) fn from_request(path_mode: &str, weighted_mode: bool) -> Self {
        match (path_mode, weighted_mode) {
            ("social-path", true) => Self::SocialWeighted,
            ("battle-path", false) => Self::BattleUnweighted,
            ("battle-path", true) => Self::BattleWeighted,
            _ => Self::SocialUnweighted,
        }
    }

    fn path_mode(self) -> &'static str {
        match self {
            Self::SocialUnweighted | Self::SocialWeighted => "social-path",
            Self::BattleUnweighted | Self::BattleWeighted => "battle-path",
        }
    }

    fn weighted(self) -> bool {
        matches!(self, Self::SocialWeighted | Self::BattleWeighted)
    }

    fn all() -> [Self; 4] {
        [
            Self::SocialUnweighted,
            Self::SocialWeighted,
            Self::BattleUnweighted,
            Self::BattleWeighted,
        ]
    }
}

#[derive(Debug, Clone)]
pub struct GraphState {
    pub(super) node_map: HashMap<String, GraphNode>,
    pub(super) adjacency: HashMap<String, Vec<Neighbor>>,
    pub(super) pair_relations: HashMap<String, PairRelation>,
    pub(super) player_rows: HashMap<String, PlayerDbRow>,
    pub(super) dataset: PrototypeDataset,
    pub(super) population_snapshot: GraphSnapshot,
    pub(super) cluster_membership: HashMap<String, String>,
    pub(super) cluster_summaries: Vec<ClusterSummary>,
    pub(super) cluster_hops: HashMap<String, HashMap<String, usize>>,
    pub(super) landmark_distances: HashMap<ModeKey, Vec<Vec<usize>>>,
    pub(super) min_costs: HashMap<ModeKey, usize>,
    pub(super) node_indices: HashMap<String, usize>,
}

#[derive(Default, Clone, Debug)]
pub(super) struct PlayerDbRow {
    pub(super) label: String,
    pub(super) opscore: Option<f64>,
    pub(super) feedscore: Option<f64>,
    pub(super) match_count: u32,
}

#[derive(Default)]
struct PairAccumulator {
    ally_weight: u32,
    enemy_weight: u32,
}

#[derive(Clone)]
struct ClusterRecord {
    cluster_id: String,
    members: Vec<String>,
    best_op: Option<String>,
    worst_feed: Option<String>,
    center_x: f64,
    center_y: f64,
    highlighted_members: Vec<String>,
}

pub fn build_graph_state() -> GraphState {
    let match_dir = resolve_match_dir();
    let db_path = resolve_db_path();
    let player_rows = load_player_rows(&db_path);
    let (co_presence_edges, signed_pairs) = load_graph_edges(&match_dir);

    let (cluster_membership, cluster_records, cluster_edge_set) =
        build_clusters(&co_presence_edges, &signed_pairs, &player_rows);
    let filtered_nodes: HashSet<String> = cluster_membership.keys().cloned().collect();
    let pathfinding_nodes: HashSet<String> = signed_pairs
        .keys()
        .flat_map(|(left, right)| [left.clone(), right.clone()])
        .collect();
    let node_layouts = build_node_layouts(&cluster_records);
    let bridge_nodes = detect_bridge_nodes(&signed_pairs, &cluster_membership);
    let star_nodes: HashSet<String> = cluster_records
        .iter()
        .filter_map(|cluster| cluster.best_op.clone())
        .collect();
    persist_rust_clusters(&db_path, &cluster_records, &bridge_nodes, &star_nodes);

    let mut dataset_nodes = Vec::new();
    for node_id in filtered_nodes.iter() {
        dataset_nodes.push(build_graph_node(
            node_id,
            &player_rows,
            &node_layouts,
            &cluster_membership,
            &bridge_nodes,
            &star_nodes,
        ));
    }
    dataset_nodes.sort_by(|left, right| {
        left.label
            .cmp(&right.label)
            .then_with(|| left.id.cmp(&right.id))
    });

    let mut all_nodes = Vec::new();
    for node_id in pathfinding_nodes.iter() {
        all_nodes.push(build_graph_node(
            node_id,
            &player_rows,
            &node_layouts,
            &cluster_membership,
            &bridge_nodes,
            &star_nodes,
        ));
    }
    all_nodes.sort_by(|left, right| {
        left.label
            .cmp(&right.label)
            .then_with(|| left.id.cmp(&right.id))
    });

    let node_map: HashMap<String, GraphNode> = all_nodes
        .iter()
        .cloned()
        .map(|node| (node.id.clone(), node))
        .collect();

    let mut adjacency: HashMap<String, Vec<Neighbor>> = all_nodes
        .iter()
        .map(|node| (node.id.clone(), Vec::new()))
        .collect();
    let mut pair_relations = HashMap::new();
    let mut dataset_edges = Vec::new();
    let mut population_edges = Vec::new();

    for ((left, right), pair) in signed_pairs {
        if !pathfinding_nodes.contains(&left) || !pathfinding_nodes.contains(&right) {
            continue;
        }

        let total_matches = pair.ally_weight + pair.enemy_weight;
        let dominant_relation = if pair.ally_weight >= pair.enemy_weight {
            "ally".to_string()
        } else {
            "enemy".to_string()
        };

        pair_relations.insert(
            edge_key(&left, &right),
            PairRelation {
                ally_weight: pair.ally_weight,
                enemy_weight: pair.enemy_weight,
                total_matches,
                dominant_relation: dominant_relation.clone(),
            },
        );

        let neighbor = Neighbor {
            id: right.clone(),
            ally_weight: pair.ally_weight,
            total_matches,
            dominant_relation: dominant_relation.clone(),
        };
        adjacency.get_mut(&left).unwrap().push(neighbor.clone());
        adjacency.get_mut(&right).unwrap().push(Neighbor {
            id: left.clone(),
            ..neighbor
        });

        if filtered_nodes.contains(&left) && filtered_nodes.contains(&right) {
            dataset_edges.push(GraphEdge {
                from: left.clone(),
                to: right.clone(),
                relation: dominant_relation,
                weight: total_matches,
            });
        }
    }

    for ((left, right), weight) in co_presence_edges {
        if weight < MIN_CLUSTER_EDGE_WEIGHT {
            continue;
        }
        if !cluster_edge_set.contains(&edge_key(&left, &right)) {
            continue;
        }
        if !filtered_nodes.contains(&left) || !filtered_nodes.contains(&right) {
            continue;
        }
        population_edges.push(GraphEdge {
            from: left,
            to: right,
            relation: "ally".to_string(),
            weight,
        });
    }

    for neighbors in adjacency.values_mut() {
        neighbors.sort_by(|left, right| {
            right
                .total_matches
                .cmp(&left.total_matches)
                .then_with(|| left.id.cmp(&right.id))
        });
    }

    let dataset = PrototypeDataset {
        nodes: dataset_nodes.clone(),
        edges: dataset_edges,
    };
    let population_snapshot = GraphSnapshot {
        nodes: dataset_nodes.clone(),
        edges: population_edges,
    };

    let ordered_nodes: Vec<String> = all_nodes.iter().map(|node| node.id.clone()).collect();
    let node_indices: HashMap<String, usize> = ordered_nodes
        .iter()
        .enumerate()
        .map(|(index, node_id)| (node_id.clone(), index))
        .collect();
    let cluster_hops = build_cluster_hops(&pair_relations, &cluster_membership);
    let landmarks = choose_landmarks(
        &adjacency,
        &cluster_records,
        &bridge_nodes,
        &cluster_membership,
    );
    let min_costs = build_min_costs(&adjacency);
    let landmark_distances =
        build_landmark_distances(&adjacency, &node_indices, &ordered_nodes, &landmarks);

    GraphState {
        node_map,
        adjacency,
        pair_relations,
        player_rows,
        dataset,
        population_snapshot,
        cluster_membership,
        cluster_summaries: cluster_records
            .iter()
            .map(|cluster| ClusterSummary {
                cluster_id: cluster.cluster_id.clone(),
                cluster_type: CLUSTER_TYPE_RUST_PATHFINDING.to_string(),
                algorithm: CLUSTER_ALGORITHM.to_string(),
                size: cluster.members.len(),
                best_op: cluster.best_op.clone(),
                worst_feed: cluster.worst_feed.clone(),
                center_x: cluster.center_x,
                center_y: cluster.center_y,
                highlighted_members: cluster.highlighted_members.clone(),
            })
            .collect(),
        cluster_hops,
        landmark_distances,
        min_costs,
        node_indices,
    }
}

fn build_graph_node(
    node_id: &str,
    player_rows: &HashMap<String, PlayerDbRow>,
    node_layouts: &HashMap<String, (f64, f64)>,
    cluster_membership: &HashMap<String, String>,
    bridge_nodes: &HashSet<String>,
    star_nodes: &HashSet<String>,
) -> GraphNode {
    let row = player_rows.get(node_id).cloned().unwrap_or_default();
    let (x, y) = node_layouts
        .get(node_id)
        .copied()
        .unwrap_or_else(|| hidden_node_position(node_id));
    GraphNode {
        id: node_id.to_string(),
        label: row.label,
        x,
        y,
        cluster_id: cluster_membership.get(node_id).cloned(),
        is_bridge: Some(bridge_nodes.contains(node_id)),
        is_star: Some(star_nodes.contains(node_id)),
    }
}

fn hidden_node_position(node_id: &str) -> (f64, f64) {
    let hash = node_id.bytes().fold(1469598103934665603u64, |state, byte| {
        state.wrapping_mul(1099511628211).wrapping_add(byte as u64)
    });
    let angle = (hash % 360) as f64 * std::f64::consts::PI / 180.0;
    let radius = 700.0 + ((hash >> 9) % 180) as f64;
    (radius * angle.cos(), radius * angle.sin())
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

fn latest_name(raw_names: &str) -> String {
    serde_json::from_str::<Vec<String>>(raw_names)
        .ok()
        .and_then(|names| names.last().cloned())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Unknown#Unknown".to_string())
}

fn configure_read_only_connection(conn: &Connection) {
    let _ = conn.busy_timeout(std::time::Duration::from_millis(5_000));
    let _ = conn.pragma_update(None, "busy_timeout", 5_000);
    let _ = conn.pragma_update(None, "query_only", true);
}

fn configure_read_write_connection(conn: &Connection) {
    let _ = conn.busy_timeout(std::time::Duration::from_millis(5_000));
    let _ = conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        ",
    );
}

fn open_read_only_db(db_path: &Path) -> Connection {
    let conn = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .expect("failed to open player database");
    configure_read_only_connection(&conn);
    conn
}

fn open_read_write_db(db_path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_FULL_MUTEX,
    )?;
    configure_read_write_connection(&conn);
    Ok(conn)
}

fn load_player_rows(db_path: &Path) -> HashMap<String, PlayerDbRow> {
    let conn = open_read_only_db(db_path);
    let mut stmt = conn
        .prepare("SELECT puuid, names, feedscore, opscore, match_count FROM players")
        .expect("failed to prepare player query");
    let rows = stmt
        .query_map([], |row| {
            let puuid: String = row.get(0)?;
            let names: Option<String> = row.get(1)?;
            let feedscore: Option<f64> = row.get(2)?;
            let opscore: Option<f64> = row.get(3)?;
            let match_count: Option<u32> = row.get(4)?;
            Ok((
                puuid,
                PlayerDbRow {
                    label: latest_name(names.as_deref().unwrap_or("")),
                    opscore,
                    feedscore,
                    match_count: match_count.unwrap_or(0),
                },
            ))
        })
        .expect("failed to iterate players");

    rows.filter_map(Result::ok).collect()
}

fn load_graph_edges(
    match_dir: &Path,
) -> (
    HashMap<(String, String), u32>,
    HashMap<(String, String), PairAccumulator>,
) {
    let mut co_presence = HashMap::new();
    let mut signed_pairs = HashMap::new();

    let entries = fs::read_dir(match_dir).expect("failed to read match directory");
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
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
                let team_id = participant["teamId"].as_i64().unwrap_or(0);
                Some((puuid, team_id))
            })
            .collect();

        for index in 0..rows.len() {
            for next in (index + 1)..rows.len() {
                let (left_id, left_team) = &rows[index];
                let (right_id, right_team) = &rows[next];
                let pair_key = ordered_pair(left_id, right_id);
                *co_presence.entry(pair_key.clone()).or_insert(0) += 1;
                let entry = signed_pairs
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

    (co_presence, signed_pairs)
}

fn ordered_pair(left: &str, right: &str) -> (String, String) {
    if left <= right {
        (left.to_string(), right.to_string())
    } else {
        (right.to_string(), left.to_string())
    }
}

fn edge_key(from: &str, to: &str) -> String {
    if from <= to {
        format!("{}|{}", from, to)
    } else {
        format!("{}|{}", to, from)
    }
}

fn build_clusters(
    co_presence_edges: &HashMap<(String, String), u32>,
    signed_pairs: &HashMap<(String, String), PairAccumulator>,
    player_rows: &HashMap<String, PlayerDbRow>,
) -> (HashMap<String, String>, Vec<ClusterRecord>, HashSet<String>) {
    let mut cluster_adjacency: HashMap<String, Vec<(String, u32)>> = HashMap::new();
    let mut cluster_edge_set = HashSet::new();

    for ((left, right), weight) in co_presence_edges {
        if *weight < MIN_CLUSTER_EDGE_WEIGHT {
            continue;
        }
        cluster_adjacency
            .entry(left.clone())
            .or_default()
            .push((right.clone(), *weight));
        cluster_adjacency
            .entry(right.clone())
            .or_default()
            .push((left.clone(), *weight));
        cluster_edge_set.insert(edge_key(left, right));
    }

    let mut visited = HashSet::new();
    let mut components = Vec::new();
    for node_id in cluster_adjacency.keys() {
        if visited.contains(node_id) {
            continue;
        }

        let mut queue = VecDeque::from([node_id.clone()]);
        let mut component = Vec::new();
        visited.insert(node_id.clone());

        while let Some(current) = queue.pop_front() {
            component.push(current.clone());
            for (neighbor, _) in cluster_adjacency.get(&current).cloned().unwrap_or_default() {
                if visited.insert(neighbor.clone()) {
                    queue.push_back(neighbor);
                }
            }
        }

        if component.len() >= 2 {
            component.sort();
            components.push(component);
        }
    }

    components.sort_by_key(|component| Reverse(component.len()));
    let grid_columns = ((components.len().max(1) as f64).sqrt().ceil() as usize).max(1);
    let mut cluster_membership = HashMap::new();
    let mut cluster_records = Vec::new();

    for (index, members) in components.into_iter().enumerate() {
        let cluster_id = format!("{}:{}", CLUSTER_TYPE_RUST_PATHFINDING, index + 1);
        let center_x = 140.0 + ((index % grid_columns) as f64) * 220.0;
        let center_y = 140.0 + ((index / grid_columns) as f64) * 220.0;

        let mut best_op = None;
        let mut worst_feed = None;
        let mut best_op_score = f64::MIN;
        let mut worst_feed_score = f64::MIN;
        for member in &members {
            cluster_membership.insert(member.clone(), cluster_id.clone());
            if let Some(row) = player_rows.get(member) {
                if let Some(opscore) = row.opscore {
                    if opscore > best_op_score {
                        best_op_score = opscore;
                        best_op = Some(member.clone());
                    }
                }
                if let Some(feedscore) = row.feedscore {
                    if feedscore > worst_feed_score {
                        worst_feed_score = feedscore;
                        worst_feed = Some(member.clone());
                    }
                }
            }
        }

        let mut highlighted_members = Vec::new();
        if let Some(value) = best_op.clone() {
            highlighted_members.push(value);
        }
        if let Some(value) = worst_feed.clone() {
            if !highlighted_members.contains(&value) {
                highlighted_members.push(value);
            }
        }

        cluster_records.push(ClusterRecord {
            cluster_id,
            members,
            best_op,
            worst_feed,
            center_x,
            center_y,
            highlighted_members,
        });
    }

    let _ = signed_pairs;
    (cluster_membership, cluster_records, cluster_edge_set)
}

fn build_node_layouts(cluster_records: &[ClusterRecord]) -> HashMap<String, (f64, f64)> {
    let mut positions = HashMap::new();
    for cluster in cluster_records {
        let radius = 28.0 + (cluster.members.len() as f64).sqrt() * 12.0;
        for (index, member) in cluster.members.iter().enumerate() {
            let angle =
                (index as f64) * (std::f64::consts::TAU / cluster.members.len().max(1) as f64);
            positions.insert(
                member.clone(),
                (
                    cluster.center_x + radius * angle.cos(),
                    cluster.center_y + radius * angle.sin(),
                ),
            );
        }
    }
    positions
}

fn detect_bridge_nodes(
    signed_pairs: &HashMap<(String, String), PairAccumulator>,
    cluster_membership: &HashMap<String, String>,
) -> HashSet<String> {
    let mut external_counts: HashMap<String, usize> = HashMap::new();
    for ((left, right), pair) in signed_pairs {
        if pair.ally_weight + pair.enemy_weight == 0 {
            continue;
        }
        let Some(left_cluster) = cluster_membership.get(left) else {
            continue;
        };
        let Some(right_cluster) = cluster_membership.get(right) else {
            continue;
        };
        if left_cluster == right_cluster {
            continue;
        }
        *external_counts.entry(left.clone()).or_insert(0) += 1;
        *external_counts.entry(right.clone()).or_insert(0) += 1;
    }

    let mut by_cluster: HashMap<String, (String, usize)> = HashMap::new();
    for (node_id, count) in external_counts {
        let Some(cluster_id) = cluster_membership.get(&node_id) else {
            continue;
        };
        let replace = by_cluster
            .get(cluster_id)
            .map(|(_, current_count)| count > *current_count)
            .unwrap_or(true);
        if replace {
            by_cluster.insert(cluster_id.clone(), (node_id, count));
        }
    }

    by_cluster
        .into_values()
        .map(|(node_id, _)| node_id)
        .collect()
}

fn persist_rust_clusters(
    db_path: &Path,
    cluster_records: &[ClusterRecord],
    bridge_nodes: &HashSet<String>,
    star_nodes: &HashSet<String>,
) {
    let Ok(mut conn) = open_read_write_db(db_path) else {
        return;
    };
    if conn
        .execute_batch(
            "
        CREATE TABLE IF NOT EXISTS clusters (
            cluster_id TEXT PRIMARY KEY,
            cluster_type TEXT NOT NULL,
            algorithm TEXT,
            size INTEGER NOT NULL,
            best_op TEXT,
            worst_feed TEXT,
            summary_json TEXT,
            center_x REAL,
            center_y REAL,
            build_version TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS cluster_members (
            cluster_id TEXT NOT NULL,
            puuid TEXT NOT NULL,
            is_bridge INTEGER NOT NULL DEFAULT 0,
            is_star INTEGER NOT NULL DEFAULT 0,
            is_best_op INTEGER NOT NULL DEFAULT 0,
            is_worst_feed INTEGER NOT NULL DEFAULT 0,
            role_json TEXT,
            PRIMARY KEY (cluster_id, puuid)
        );
        ",
        )
        .is_err()
    {
        return;
    }

    let Ok(transaction) = conn.transaction() else {
        return;
    };

    let existing_ids: Vec<String> =
        match transaction.prepare("SELECT cluster_id FROM clusters WHERE cluster_type = ?1") {
            Ok(mut statement) => statement
                .query_map(params![CLUSTER_TYPE_RUST_PATHFINDING], |row| row.get(0))
                .ok()
                .into_iter()
                .flatten()
                .filter_map(Result::ok)
                .collect(),
            Err(_) => return,
        };
    for cluster_id in &existing_ids {
        let _ = transaction.execute(
            "DELETE FROM cluster_members WHERE cluster_id = ?1",
            params![cluster_id],
        );
    }
    let _ = transaction.execute(
        "DELETE FROM clusters WHERE cluster_type = ?1",
        params![CLUSTER_TYPE_RUST_PATHFINDING],
    );

    for cluster in cluster_records {
        let summary_json = serde_json::json!({
            "clusterId": cluster.cluster_id,
            "size": cluster.members.len(),
            "highlightedMembers": cluster.highlighted_members,
        })
        .to_string();
        if transaction
            .execute(
                "
            INSERT INTO clusters (
                cluster_id,
                cluster_type,
                algorithm,
                size,
                best_op,
                worst_feed,
                summary_json,
                center_x,
                center_y,
                build_version,
                updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            ",
                params![
                    cluster.cluster_id,
                    CLUSTER_TYPE_RUST_PATHFINDING,
                    CLUSTER_ALGORITHM,
                    cluster.members.len() as i64,
                    cluster.best_op,
                    cluster.worst_feed,
                    summary_json,
                    cluster.center_x,
                    cluster.center_y,
                    format!("rust:min_weight={}", MIN_CLUSTER_EDGE_WEIGHT),
                    "runtime"
                ],
            )
            .is_err()
        {
            return;
        }

        for member in &cluster.members {
            if transaction
                .execute(
                    "
                INSERT INTO cluster_members (
                    cluster_id,
                    puuid,
                    is_bridge,
                    is_star,
                    is_best_op,
                    is_worst_feed,
                    role_json
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                ",
                    params![
                        cluster.cluster_id,
                        member,
                        if bridge_nodes.contains(member) { 1 } else { 0 },
                        if star_nodes.contains(member) { 1 } else { 0 },
                        if cluster.best_op.as_deref() == Some(member.as_str()) {
                            1
                        } else {
                            0
                        },
                        if cluster.worst_feed.as_deref() == Some(member.as_str()) {
                            1
                        } else {
                            0
                        },
                        serde_json::json!({
                            "isBridge": bridge_nodes.contains(member),
                            "isStar": star_nodes.contains(member),
                            "isBestOp": cluster.best_op.as_deref() == Some(member.as_str()),
                            "isWorstFeed": cluster.worst_feed.as_deref() == Some(member.as_str()),
                        })
                        .to_string()
                    ],
                )
                .is_err()
            {
                return;
            }
        }
    }

    let _ = transaction.commit();
}

fn build_cluster_hops(
    pair_relations: &HashMap<String, PairRelation>,
    cluster_membership: &HashMap<String, String>,
) -> HashMap<String, HashMap<String, usize>> {
    let mut adjacency: HashMap<String, HashSet<String>> = HashMap::new();
    for key in pair_relations.keys() {
        let parts: Vec<&str> = key.split('|').collect();
        if parts.len() != 2 {
            continue;
        }
        let Some(left_cluster) = cluster_membership.get(parts[0]).cloned() else {
            continue;
        };
        let Some(right_cluster) = cluster_membership.get(parts[1]).cloned() else {
            continue;
        };
        if left_cluster == right_cluster {
            continue;
        }
        adjacency
            .entry(left_cluster.clone())
            .or_default()
            .insert(right_cluster.clone());
        adjacency
            .entry(right_cluster)
            .or_default()
            .insert(left_cluster);
    }

    let mut result = HashMap::new();
    for cluster_id in adjacency.keys() {
        let mut distances = HashMap::new();
        let mut queue = VecDeque::from([(cluster_id.clone(), 0usize)]);
        let mut visited = HashSet::from([cluster_id.clone()]);
        while let Some((current, distance)) = queue.pop_front() {
            distances.insert(current.clone(), distance);
            for neighbor in adjacency.get(&current).cloned().unwrap_or_default() {
                if visited.insert(neighbor.clone()) {
                    queue.push_back((neighbor, distance + 1));
                }
            }
        }
        result.insert(cluster_id.clone(), distances);
    }
    result
}

fn choose_landmarks(
    adjacency: &HashMap<String, Vec<Neighbor>>,
    cluster_records: &[ClusterRecord],
    bridge_nodes: &HashSet<String>,
    cluster_membership: &HashMap<String, String>,
) -> Vec<String> {
    let total_nodes = adjacency.len();
    let landmark_budget = adaptive_landmark_budget(total_nodes);
    if landmark_budget == 0 {
        return Vec::new();
    }

    let representative_nodes: HashSet<String> = cluster_records
        .iter()
        .flat_map(|cluster| {
            cluster
                .best_op
                .iter()
                .cloned()
                .chain(cluster.highlighted_members.iter().cloned())
        })
        .collect();
    let component_candidates: Vec<Vec<String>> = connected_components(adjacency)
        .into_iter()
        .map(|component| {
            component_landmark_candidates(
                adjacency,
                &component,
                bridge_nodes,
                cluster_membership,
                &representative_nodes,
            )
        })
        .collect();
    let mut component_offsets = vec![0usize; component_candidates.len()];
    let mut landmarks = Vec::new();
    let mut used = HashSet::new();

    loop {
        let mut progressed = false;
        for (component_index, candidates) in component_candidates.iter().enumerate() {
            if landmarks.len() >= landmark_budget {
                break;
            }

            while let Some(candidate) = candidates.get(component_offsets[component_index]) {
                component_offsets[component_index] += 1;
                if used.insert(candidate.clone()) {
                    landmarks.push(candidate.clone());
                    progressed = true;
                    break;
                }
            }
        }

        if landmarks.len() >= landmark_budget || !progressed {
            break;
        }
    }

    landmarks
}

fn adaptive_landmark_budget(total_nodes: usize) -> usize {
    if total_nodes == 0 {
        return 0;
    }

    let scaled_budget = (((total_nodes as f64).sqrt()) / 2.0).ceil() as usize;
    scaled_budget
        .max(1)
        .next_power_of_two()
        .clamp(MIN_LANDMARKS, MAX_LANDMARKS)
}

fn component_landmark_candidates(
    adjacency: &HashMap<String, Vec<Neighbor>>,
    component: &[String],
    bridge_nodes: &HashSet<String>,
    cluster_membership: &HashMap<String, String>,
    representative_nodes: &HashSet<String>,
) -> Vec<String> {
    let mut candidates = component.to_vec();
    candidates.sort_by(|left, right| {
        let left_bridge = bridge_nodes.contains(left);
        let right_bridge = bridge_nodes.contains(right);
        let left_representative = representative_nodes.contains(left);
        let right_representative = representative_nodes.contains(right);
        let left_clustered = cluster_membership.contains_key(left);
        let right_clustered = cluster_membership.contains_key(right);
        right_bridge
            .cmp(&left_bridge)
            .then_with(|| right_representative.cmp(&left_representative))
            .then_with(|| right_clustered.cmp(&left_clustered))
            .then_with(|| {
                node_strength_from_adjacency(adjacency, right)
                    .cmp(&node_strength_from_adjacency(adjacency, left))
            })
            .then_with(|| {
                adjacency
                    .get(right)
                    .map(|neighbors| neighbors.len())
                    .unwrap_or(0)
                    .cmp(
                        &adjacency
                            .get(left)
                            .map(|neighbors| neighbors.len())
                            .unwrap_or(0),
                    )
            })
            .then_with(|| left.cmp(right))
    });
    candidates
}

fn connected_components(adjacency: &HashMap<String, Vec<Neighbor>>) -> Vec<Vec<String>> {
    let mut visited = HashSet::new();
    let mut components = Vec::new();
    let mut node_ids: Vec<String> = adjacency.keys().cloned().collect();
    node_ids.sort();

    for node_id in node_ids {
        if !visited.insert(node_id.clone()) {
            continue;
        }

        let mut queue = VecDeque::from([node_id]);
        let mut component = Vec::new();
        while let Some(current) = queue.pop_front() {
            component.push(current.clone());
            for neighbor in adjacency.get(&current).into_iter().flatten() {
                if visited.insert(neighbor.id.clone()) {
                    queue.push_back(neighbor.id.clone());
                }
            }
        }

        component.sort();
        components.push(component);
    }

    components.sort_by_key(|component| Reverse(component.len()));
    components
}

fn traversal_cost(weighted: bool, weight: u32) -> usize {
    if !weighted {
        return WEIGHT_COST_SCALE;
    }

    let safe = (weight as usize).max(1);
    (WEIGHT_COST_SCALE + safe - 1) / safe
}

fn shortest_distances_from(
    adjacency: &HashMap<String, Vec<Neighbor>>,
    ordered_nodes: &[String],
    node_indices: &HashMap<String, usize>,
    start: &str,
    mode: ModeKey,
) -> Vec<usize> {
    let mut distances = vec![INF_DISTANCE; ordered_nodes.len()];
    let Some(&start_index) = node_indices.get(start) else {
        return distances;
    };
    distances[start_index] = 0;
    let mut heap = BinaryHeap::from([(Reverse(0usize), start.to_string())]);

    while let Some((Reverse(cost), current)) = heap.pop() {
        let current_index = node_indices[&current];
        if cost > distances[current_index] {
            continue;
        }
        for neighbor in adjacency.get(&current).cloned().unwrap_or_default() {
            if !neighbor.is_allowed(mode.path_mode()) {
                continue;
            }
            let next_cost =
                cost + traversal_cost(mode.weighted(), neighbor.weight_for_mode(mode.path_mode()));
            let neighbor_index = node_indices[&neighbor.id];
            if next_cost < distances[neighbor_index] {
                distances[neighbor_index] = next_cost;
                heap.push((Reverse(next_cost), neighbor.id.clone()));
            }
        }
    }

    distances
}

fn build_landmark_distances(
    adjacency: &HashMap<String, Vec<Neighbor>>,
    node_indices: &HashMap<String, usize>,
    ordered_nodes: &[String],
    landmarks: &[String],
) -> HashMap<ModeKey, Vec<Vec<usize>>> {
    let mut result = HashMap::new();
    for mode in ModeKey::all() {
        let rows = landmarks
            .iter()
            .map(|landmark| {
                shortest_distances_from(adjacency, ordered_nodes, node_indices, landmark, mode)
            })
            .collect();
        result.insert(mode, rows);
    }
    result
}

fn build_min_costs(adjacency: &HashMap<String, Vec<Neighbor>>) -> HashMap<ModeKey, usize> {
    let mut min_costs = HashMap::new();
    for mode in ModeKey::all() {
        let mut best = INF_DISTANCE;
        for neighbors in adjacency.values() {
            for neighbor in neighbors {
                if !neighbor.is_allowed(mode.path_mode()) {
                    continue;
                }
                best = best.min(traversal_cost(
                    mode.weighted(),
                    neighbor.weight_for_mode(mode.path_mode()),
                ));
            }
        }
        min_costs.insert(mode, if best == INF_DISTANCE { 0 } else { best });
    }
    min_costs
}

pub(super) fn neighbors_for<'a>(graph: &'a GraphState, node_id: &str) -> &'a [Neighbor] {
    graph
        .adjacency
        .get(node_id)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

pub(super) fn relation_for_path(
    graph: &GraphState,
    from: &str,
    to: &str,
    path_mode: &str,
) -> String {
    if path_mode == "social-path" {
        return "ally".to_string();
    }

    graph
        .pair_relations
        .get(&edge_key(from, to))
        .map(|relation| relation.dominant_relation.clone())
        .unwrap_or_else(|| "ally".to_string())
}

pub(super) fn build_path(
    graph: &GraphState,
    parents: &HashMap<String, Option<String>>,
    target_id: &str,
    path_mode: &str,
) -> (Vec<String>, Vec<PathEdge>) {
    let mut path_nodes = Vec::new();
    let mut current = Some(target_id.to_string());

    while let Some(node_id) = current {
        path_nodes.push(node_id.clone());
        current = parents.get(&node_id).cloned().unwrap_or(None);
    }

    path_nodes.reverse();

    let mut path_edges = Vec::new();
    for index in 0..path_nodes.len().saturating_sub(1) {
        let from = path_nodes[index].clone();
        let to = path_nodes[index + 1].clone();
        path_edges.push(PathEdge {
            from: from.clone(),
            to: to.clone(),
            relation: relation_for_path(graph, &from, &to, path_mode),
        });
    }

    (path_nodes, path_edges)
}

fn node_strength(graph: &GraphState, node_id: &str) -> u32 {
    node_strength_from_adjacency(&graph.adjacency, node_id)
}

fn node_strength_from_adjacency(adjacency: &HashMap<String, Vec<Neighbor>>, node_id: &str) -> u32 {
    adjacency
        .get(node_id)
        .map(|neighbors| {
            neighbors
                .iter()
                .map(|neighbor| neighbor.total_matches)
                .sum()
        })
        .unwrap_or(0)
}

fn select_cluster_nodes(
    graph: &GraphState,
    cluster_id: &str,
    preferred_nodes: &HashSet<String>,
    limit: usize,
) -> Vec<String> {
    let mut candidates: Vec<String> = graph
        .dataset
        .nodes
        .iter()
        .filter(|node| node.cluster_id.as_deref() == Some(cluster_id))
        .map(|node| node.id.clone())
        .collect();

    candidates.sort_by(|left, right| {
        let left_preferred = preferred_nodes.contains(left);
        let right_preferred = preferred_nodes.contains(right);
        right_preferred
            .cmp(&left_preferred)
            .then_with(|| {
                graph
                    .node_map
                    .get(right)
                    .and_then(|node| node.is_bridge)
                    .unwrap_or(false)
                    .cmp(
                        &graph
                            .node_map
                            .get(left)
                            .and_then(|node| node.is_bridge)
                            .unwrap_or(false),
                    )
            })
            .then_with(|| {
                graph
                    .node_map
                    .get(right)
                    .and_then(|node| node.is_star)
                    .unwrap_or(false)
                    .cmp(
                        &graph
                            .node_map
                            .get(left)
                            .and_then(|node| node.is_star)
                            .unwrap_or(false),
                    )
            })
            .then_with(|| node_strength(graph, right).cmp(&node_strength(graph, left)))
            .then_with(|| left.cmp(right))
    });

    candidates.truncate(limit.max(preferred_nodes.len()));
    candidates
}

pub(super) fn pathfinder_snapshot(
    graph: &GraphState,
    path_mode: &str,
    source_id: &str,
    target_id: &str,
    path_nodes: &[String],
    visited_nodes: &[String],
) -> GraphSnapshot {
    let mut preferred_nodes = HashSet::from([source_id.to_string(), target_id.to_string()]);
    for node_id in path_nodes {
        preferred_nodes.insert(node_id.clone());
    }
    for node_id in visited_nodes.iter().take(MAX_SNAPSHOT_VISITED_NODES) {
        preferred_nodes.insert(node_id.clone());
    }

    let mut visible = preferred_nodes.clone();
    let mut visible_clusters = HashSet::new();
    for node_id in &preferred_nodes {
        if let Some(cluster_id) = graph.cluster_membership.get(node_id) {
            visible_clusters.insert(cluster_id.clone());
        }
    }

    for cluster_id in visible_clusters {
        for node_id in select_cluster_nodes(
            graph,
            &cluster_id,
            &preferred_nodes,
            MAX_SNAPSHOT_CLUSTER_NODES,
        ) {
            visible.insert(node_id);
        }
    }

    let path_edge_keys: HashSet<String> = path_nodes
        .windows(2)
        .map(|pair| edge_key(&pair[0], &pair[1]))
        .collect();

    let source_position = graph
        .node_map
        .get(source_id)
        .map(|node| (node.x, node.y))
        .unwrap_or((0.0, 0.0));
    let target_position = graph
        .node_map
        .get(target_id)
        .map(|node| (node.x, node.y))
        .unwrap_or((source_position.0 + 180.0, source_position.1));
    let path_index_map: HashMap<String, usize> = path_nodes
        .iter()
        .enumerate()
        .map(|(index, node_id)| (node_id.clone(), index))
        .collect();
    let mut nodes: Vec<GraphNode> = visible
        .iter()
        .filter_map(|node_id| {
            let mut node = graph.node_map.get(node_id)?.clone();
            if node.cluster_id.is_none() && path_nodes.len() > 2 {
                if let Some(index) = path_index_map.get(node_id).copied() {
                    node.x = interpolated_path_x(
                        source_position.0,
                        target_position.0,
                        index,
                        path_nodes.len(),
                    );
                    node.y = interpolated_path_y(
                        source_position.1,
                        target_position.1,
                        index,
                        path_nodes.len(),
                    );
                }
            }
            Some(node)
        })
        .collect();
    nodes.sort_by(|left, right| {
        left.label
            .cmp(&right.label)
            .then_with(|| left.id.cmp(&right.id))
    });

    let mut edges: Vec<GraphEdge> = graph
        .dataset
        .edges
        .iter()
        .filter_map(|edge| {
            if !visible.contains(&edge.from) || !visible.contains(&edge.to) {
                return None;
            }
            let edge_key_value = edge_key(&edge.from, &edge.to);
            let same_cluster =
                graph.cluster_membership.get(&edge.from) == graph.cluster_membership.get(&edge.to);
            if !path_edge_keys.is_empty()
                && !same_cluster
                && !path_edge_keys.contains(&edge_key_value)
            {
                return None;
            }
            let relation = graph.pair_relations.get(&edge_key(&edge.from, &edge.to))?;
            if path_mode == "battle-path" {
                Some(GraphEdge {
                    from: edge.from.clone(),
                    to: edge.to.clone(),
                    relation: relation.dominant_relation.clone(),
                    weight: relation.total_matches,
                })
            } else if relation.ally_weight > 0 {
                Some(GraphEdge {
                    from: edge.from.clone(),
                    to: edge.to.clone(),
                    relation: "ally".to_string(),
                    weight: relation.ally_weight,
                })
            } else {
                None
            }
        })
        .collect();
    let mut seen_edge_keys: HashSet<String> = edges
        .iter()
        .map(|edge| edge_key(&edge.from, &edge.to))
        .collect();
    for pair in path_nodes.windows(2) {
        let key = edge_key(&pair[0], &pair[1]);
        if !seen_edge_keys.insert(key.clone()) {
            continue;
        }
        let Some(relation) = graph.pair_relations.get(&key) else {
            continue;
        };
        edges.push(if path_mode == "battle-path" {
            GraphEdge {
                from: pair[0].clone(),
                to: pair[1].clone(),
                relation: relation.dominant_relation.clone(),
                weight: relation.total_matches,
            }
        } else {
            GraphEdge {
                from: pair[0].clone(),
                to: pair[1].clone(),
                relation: "ally".to_string(),
                weight: relation.ally_weight.max(1),
            }
        });
    }

    GraphSnapshot { nodes, edges }
}

fn interpolated_path_x(start: f64, end: f64, index: usize, total: usize) -> f64 {
    let progress = index as f64 / total.saturating_sub(1).max(1) as f64;
    start + (end - start) * progress
}

fn interpolated_path_y(start: f64, end: f64, index: usize, total: usize) -> f64 {
    let progress = index as f64 / total.saturating_sub(1).max(1) as f64;
    let arc = ((progress * std::f64::consts::PI).sin() - 0.5) * 80.0;
    start + (end - start) * progress + arc
}

pub(super) fn population_snapshot(graph: &GraphState) -> GraphSnapshot {
    let mut visible: HashSet<String> = HashSet::new();
    for summary in &graph.cluster_summaries {
        for node_id in select_cluster_nodes(graph, &summary.cluster_id, &HashSet::new(), MAX_PREVIEW_CLUSTER_NODES) {
            visible.insert(node_id);
        }
    }
    let nodes: Vec<GraphNode> = graph
        .population_snapshot
        .nodes
        .iter()
        .filter(|n| visible.contains(&n.id))
        .cloned()
        .collect();
    let edges: Vec<GraphEdge> = graph
        .population_snapshot
        .edges
        .iter()
        .filter(|e| visible.contains(&e.from) && visible.contains(&e.to))
        .cloned()
        .collect();
    GraphSnapshot { nodes, edges }
}

pub(super) fn global_view_snapshot(graph: &GraphState) -> GraphSnapshot {
    graph.population_snapshot.clone()
}

pub(super) fn player_focus_snapshot(graph: &GraphState, player_id: &str) -> GraphSnapshot {
    let mut visible = HashSet::from([player_id.to_string()]);
    if let Some(cluster_id) = graph.cluster_membership.get(player_id) {
        for node in &graph.dataset.nodes {
            if node.cluster_id.as_deref() == Some(cluster_id.as_str()) {
                visible.insert(node.id.clone());
            }
        }
    }
    if let Some(neighbors) = graph.adjacency.get(player_id) {
        for neighbor in neighbors {
            visible.insert(neighbor.id.clone());
        }
    }

    let nodes = graph
        .dataset
        .nodes
        .iter()
        .filter(|node| visible.contains(&node.id))
        .cloned()
        .collect();
    let edges = graph
        .dataset
        .edges
        .iter()
        .filter(|edge| visible.contains(&edge.from) && visible.contains(&edge.to))
        .cloned()
        .collect();

    GraphSnapshot { nodes, edges }
}

pub(super) fn heuristic_lower_bound(
    graph: &GraphState,
    current_id: &str,
    target_id: &str,
    mode: ModeKey,
) -> usize {
    let alt = alt_lower_bound(graph, current_id, target_id, mode);
    let cluster = cluster_lower_bound(graph, current_id, target_id, mode);
    alt.max(cluster)
}

fn alt_lower_bound(graph: &GraphState, current_id: &str, target_id: &str, mode: ModeKey) -> usize {
    let Some(&current_index) = graph.node_indices.get(current_id) else {
        return 0;
    };
    let Some(&target_index) = graph.node_indices.get(target_id) else {
        return 0;
    };
    let Some(distances) = graph.landmark_distances.get(&mode) else {
        return 0;
    };

    let mut best = 0usize;
    for distance_row in distances {
        let current_distance = distance_row[current_index];
        let target_distance = distance_row[target_index];
        if current_distance >= INF_DISTANCE || target_distance >= INF_DISTANCE {
            continue;
        }
        best = best.max(current_distance.abs_diff(target_distance));
    }
    best
}

fn cluster_lower_bound(
    graph: &GraphState,
    current_id: &str,
    target_id: &str,
    mode: ModeKey,
) -> usize {
    let Some(current_cluster) = graph.cluster_membership.get(current_id) else {
        return 0;
    };
    let Some(target_cluster) = graph.cluster_membership.get(target_id) else {
        return 0;
    };
    if current_cluster == target_cluster {
        return 0;
    }

    let hop_distance = graph
        .cluster_hops
        .get(current_cluster)
        .and_then(|distances| distances.get(target_cluster))
        .copied()
        .unwrap_or(0);
    hop_distance * graph.min_costs.get(&mode).copied().unwrap_or(0)
}

pub(super) fn tie_break_distance(graph: &GraphState, current_id: &str, target_id: &str) -> usize {
    let Some(current) = graph.node_map.get(current_id) else {
        return 0;
    };
    let Some(target) = graph.node_map.get(target_id) else {
        return 0;
    };

    let dx = current.x - target.x;
    let dy = current.y - target.y;
    (((dx * dx) + (dy * dy)).sqrt() * 100.0) as usize
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cluster_record(id: &str, members: &[&str], best_op: Option<&str>) -> ClusterRecord {
        ClusterRecord {
            cluster_id: id.to_string(),
            members: members.iter().map(|member| (*member).to_string()).collect(),
            best_op: best_op.map(|value| value.to_string()),
            worst_feed: None,
            center_x: 0.0,
            center_y: 0.0,
            highlighted_members: vec![],
        }
    }

    #[test]
    fn adaptive_landmark_budget_grows_with_graph_size() {
        assert_eq!(adaptive_landmark_budget(0), 0);
        assert_eq!(adaptive_landmark_budget(64), 8);
        assert_eq!(adaptive_landmark_budget(1_600), 32);
        assert_eq!(adaptive_landmark_budget(10_000), 64);
        assert_eq!(adaptive_landmark_budget(50_000), 64);
    }

    #[test]
    fn choose_landmarks_can_select_multiple_from_large_clusters() {
        let clusters = vec![
            cluster_record("c1", &["a1", "a2", "a3", "a4"], Some("a3")),
            cluster_record("c2", &["b1", "b2", "b3", "b4"], Some("b2")),
            cluster_record("c3", &["c1", "c2", "c3", "c4"], Some("c4")),
            cluster_record("c4", &["d1", "d2", "d3", "d4"], Some("d1")),
        ];
        let bridge_nodes = HashSet::from([
            "a2".to_string(),
            "b3".to_string(),
            "c2".to_string(),
            "d4".to_string(),
        ]);
        let mut adjacency = HashMap::new();
        let mut cluster_membership = HashMap::new();
        for cluster in &clusters {
            for member in &cluster.members {
                cluster_membership.insert(member.clone(), cluster.cluster_id.clone());
                adjacency.insert(
                    member.clone(),
                    cluster
                        .members
                        .iter()
                        .filter(|candidate| *candidate != member)
                        .map(|candidate| Neighbor {
                            id: candidate.clone(),
                            ally_weight: 3,
                            total_matches: 3,
                            dominant_relation: "ally".to_string(),
                        })
                        .collect(),
                );
            }
        }

        let landmarks = choose_landmarks(&adjacency, &clusters, &bridge_nodes, &cluster_membership);

        assert_eq!(landmarks.len(), 8);
        assert!(landmarks.contains(&"a2".to_string()));
        assert!(landmarks.contains(&"b3".to_string()));
        assert!(landmarks.contains(&"c2".to_string()));
        assert!(landmarks.contains(&"d4".to_string()));
        assert!(landmarks.contains(&"a3".to_string()) || landmarks.contains(&"a1".to_string()));
    }
}
