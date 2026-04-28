use super::graph::{GraphState, PairRelation};
use crate::models::{
    BetweennessCentralityDecisions, BetweennessCentralityGraphSummary,
    BetweennessCentralityNodeResult, BetweennessCentralityRequest, BetweennessCentralityResponse,
    BetweennessCentralityRuntime,
};
use rayon::prelude::*;
use std::cmp::Ordering;
use std::collections::{BTreeSet, BinaryHeap};
use std::time::Instant;

const COST_SCALE: u64 = 1_000_000;
const INF_DISTANCE: u64 = u64::MAX / 4;

#[derive(Clone, Copy)]
enum CentralityGraphMode {
    SocialPath,
    BattlePath,
}

impl CentralityGraphMode {
    fn parse(value: &str) -> Self {
        match value {
            "social-path" => Self::SocialPath,
            _ => Self::BattlePath,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::SocialPath => "social-path",
            Self::BattlePath => "battle-path",
        }
    }

    fn support(self, relation: &PairRelation) -> u32 {
        match self {
            Self::SocialPath => relation.ally_weight,
            Self::BattlePath => relation.total_matches,
        }
    }

    fn support_rule(self) -> &'static str {
        match self {
            Self::SocialPath => "social-path uses allyWeight as edge strength",
            Self::BattlePath => "battle-path uses allyWeight + enemyWeight as edge strength",
        }
    }
}

#[derive(Clone, Copy, Eq, PartialEq)]
struct QueueState {
    cost: u64,
    node: usize,
}

impl Ord for QueueState {
    fn cmp(&self, other: &Self) -> Ordering {
        other
            .cost
            .cmp(&self.cost)
            .then_with(|| other.node.cmp(&self.node))
    }
}

impl PartialOrd for QueueState {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

#[derive(Default, Clone, Copy)]
struct ProjectionStats {
    candidate_edges: usize,
    analyzed_edges: usize,
    skipped_low_support_edges: usize,
    skipped_invalid_edges: usize,
}

#[derive(Clone)]
struct CentralityProjection {
    node_ids: Vec<String>,
    adjacency: Vec<Vec<(usize, u64)>>,
    degree: Vec<usize>,
    weighted_strength: Vec<u32>,
    stats: ProjectionStats,
}

struct ScoreRun {
    scores: Vec<f64>,
    runtime_ms: f64,
    chunks: usize,
}

pub(super) fn betweenness_centrality_response(
    graph: &GraphState,
    request: BetweennessCentralityRequest,
) -> BetweennessCentralityResponse {
    let graph_mode = CentralityGraphMode::parse(&request.path_mode);
    let min_edge_support = request.min_edge_support.max(1);
    let projection = build_projection(graph, graph_mode, request.weighted_mode, min_edge_support);
    let mut warnings = Vec::new();

    if projection.stats.analyzed_edges == 0 {
        warnings.push(
            "No edges satisfied the selected graph mode and minimum support threshold.".to_string(),
        );
    }
    if projection.node_ids.len() < 3 {
        warnings.push(
            "Betweenness centrality needs at least three projected nodes for normalized scores."
                .to_string(),
        );
    }

    let (selected_run, serial_run, parallel_run, max_delta) = if request.parallel {
        let parallel = compute_parallel_scores(&projection);
        if request.run_serial_baseline {
            let serial = compute_serial_scores(&projection);
            let delta = max_abs_delta(&serial.scores, &parallel.scores);
            (parallel.scores.clone(), Some(serial), Some(parallel), delta)
        } else {
            (parallel.scores.clone(), None, Some(parallel), None)
        }
    } else {
        let serial = compute_serial_scores(&projection);
        (serial.scores.clone(), Some(serial), None, None)
    };

    let results = build_node_results(graph, &projection, &selected_run);
    let max_top_nodes = request.max_top_nodes.max(1);
    let top_nodes = results.iter().take(max_top_nodes).cloned().collect();
    let full_results = if request.include_full_results {
        Some(results.clone())
    } else {
        None
    };

    let serial_runtime_ms = serial_run.as_ref().map(|run| run.runtime_ms);
    let parallel_runtime_ms = parallel_run.as_ref().map(|run| run.runtime_ms);
    let speedup = match (serial_runtime_ms, parallel_runtime_ms) {
        (Some(serial_ms), Some(parallel_ms)) if parallel_ms > f64::EPSILON => {
            Some(serial_ms / parallel_ms)
        }
        _ => None,
    };
    let algorithm_runtime_ms = if request.parallel {
        parallel_runtime_ms.unwrap_or(0.0)
    } else {
        serial_runtime_ms.unwrap_or(0.0)
    };
    let parallel_chunks = parallel_run
        .as_ref()
        .map(|run| run.chunks)
        .or_else(|| serial_run.as_ref().map(|run| run.chunks))
        .unwrap_or(1);

    BetweennessCentralityResponse {
        status: if projection.stats.analyzed_edges > 0 && projection.node_ids.len() >= 3 {
            "ok".to_string()
        } else {
            "insufficient_data".to_string()
        },
        decisions: BetweennessCentralityDecisions {
            graph_scope: "active runtime graph projected from signed match co-presence edges"
                .to_string(),
            algorithm: "Brandes node betweenness centrality".to_string(),
            parallelization: if request.parallel {
                "Rayon chunk parallelism over deterministic source-node ranges".to_string()
            } else {
                "serial source-node iteration".to_string()
            },
            graph_mode: graph_mode.as_str().to_string(),
            weighted_mode: request.weighted_mode,
            edge_support_rule: graph_mode.support_rule().to_string(),
            edge_cost_rule: if request.weighted_mode {
                "shortest-path edge cost is ceil(1_000_000 / strength), equivalent to 1 / strength with integer scaling".to_string()
            } else {
                "all included edges have equal shortest-path cost".to_string()
            },
            normalization_rule: "undirected raw scores are divided by ((n - 1) * (n - 2) / 2)"
                .to_string(),
            min_edge_support,
        },
        graph_summary: BetweennessCentralityGraphSummary {
            runtime_nodes: graph.node_map.len(),
            projected_nodes: projection.node_ids.len(),
            candidate_edges: projection.stats.candidate_edges,
            analyzed_edges: projection.stats.analyzed_edges,
            skipped_low_support_edges: projection.stats.skipped_low_support_edges,
            skipped_invalid_edges: projection.stats.skipped_invalid_edges,
        },
        runtime: BetweennessCentralityRuntime {
            algorithm_runtime_ms,
            serial_runtime_ms,
            parallel_runtime_ms,
            speedup,
            rayon_threads: rayon::current_num_threads(),
            parallel_chunks,
            serial_parallel_max_abs_delta: max_delta,
        },
        top_nodes,
        full_results,
        warnings,
    }
}

fn build_projection(
    graph: &GraphState,
    graph_mode: CentralityGraphMode,
    weighted_mode: bool,
    min_edge_support: u32,
) -> CentralityProjection {
    let mut stats = ProjectionStats::default();
    let mut raw_edges = Vec::new();
    let mut projected_ids = BTreeSet::new();
    let mut keys: Vec<&String> = graph.pair_relations.keys().collect();
    keys.sort();

    for key in keys {
        let Some(relation) = graph.pair_relations.get(key) else {
            continue;
        };
        let support = graph_mode.support(relation);
        if support == 0 {
            continue;
        }
        stats.candidate_edges += 1;
        if support < min_edge_support {
            stats.skipped_low_support_edges += 1;
            continue;
        }
        let Some((left_id, right_id)) = key.split_once('|') else {
            stats.skipped_invalid_edges += 1;
            continue;
        };
        if !graph.node_map.contains_key(left_id) || !graph.node_map.contains_key(right_id) {
            stats.skipped_invalid_edges += 1;
            continue;
        }

        projected_ids.insert(left_id.to_string());
        projected_ids.insert(right_id.to_string());
        raw_edges.push((left_id.to_string(), right_id.to_string(), support));
        stats.analyzed_edges += 1;
    }

    let mut node_ids: Vec<String> = projected_ids.into_iter().collect();
    node_ids.sort_by(|left, right| {
        node_label(graph, left)
            .cmp(&node_label(graph, right))
            .then_with(|| left.cmp(right))
    });
    let node_index: std::collections::HashMap<String, usize> = node_ids
        .iter()
        .enumerate()
        .map(|(index, node_id)| (node_id.clone(), index))
        .collect();
    let mut adjacency = vec![Vec::new(); node_ids.len()];
    let mut weighted_strength = vec![0u32; node_ids.len()];

    for (left_id, right_id, support) in raw_edges {
        let Some(&left) = node_index.get(&left_id) else {
            continue;
        };
        let Some(&right) = node_index.get(&right_id) else {
            continue;
        };
        let cost = edge_cost(support, weighted_mode);
        adjacency[left].push((right, cost));
        adjacency[right].push((left, cost));
        weighted_strength[left] = weighted_strength[left].saturating_add(support);
        weighted_strength[right] = weighted_strength[right].saturating_add(support);
    }

    for neighbors in &mut adjacency {
        neighbors.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));
    }
    let degree = adjacency.iter().map(Vec::len).collect();

    CentralityProjection {
        node_ids,
        adjacency,
        degree,
        weighted_strength,
        stats,
    }
}

fn compute_serial_scores(projection: &CentralityProjection) -> ScoreRun {
    let started_at = Instant::now();
    let mut scores = vec![0.0; projection.node_ids.len()];
    for source in 0..projection.node_ids.len() {
        let dependencies = source_dependencies(projection, source);
        add_scores(&mut scores, &dependencies);
    }
    finalize_undirected_scores(&mut scores);

    ScoreRun {
        scores,
        runtime_ms: started_at.elapsed().as_secs_f64() * 1000.0,
        chunks: 1,
    }
}

fn compute_parallel_scores(projection: &CentralityProjection) -> ScoreRun {
    let started_at = Instant::now();
    let node_count = projection.node_ids.len();
    if node_count == 0 {
        return ScoreRun {
            scores: Vec::new(),
            runtime_ms: started_at.elapsed().as_secs_f64() * 1000.0,
            chunks: 0,
        };
    }

    let target_chunks = (rayon::current_num_threads() * 4).max(1).min(node_count);
    let chunk_size = node_count.div_ceil(target_chunks).max(1);
    let mut chunk_scores: Vec<(usize, Vec<f64>)> = (0..node_count)
        .step_by(chunk_size)
        .collect::<Vec<_>>()
        .into_par_iter()
        .map(|start| {
            let end = (start + chunk_size).min(node_count);
            let mut local_scores = vec![0.0; node_count];
            for source in start..end {
                let dependencies = source_dependencies(projection, source);
                add_scores(&mut local_scores, &dependencies);
            }
            (start, local_scores)
        })
        .collect();
    chunk_scores.sort_by_key(|(start, _)| *start);

    let mut scores = vec![0.0; node_count];
    for (_, local_scores) in &chunk_scores {
        add_scores(&mut scores, local_scores);
    }
    finalize_undirected_scores(&mut scores);

    ScoreRun {
        scores,
        runtime_ms: started_at.elapsed().as_secs_f64() * 1000.0,
        chunks: chunk_scores.len(),
    }
}

fn source_dependencies(projection: &CentralityProjection, source: usize) -> Vec<f64> {
    let n = projection.node_ids.len();
    let mut stack = Vec::with_capacity(n);
    let mut predecessors = vec![Vec::new(); n];
    let mut sigma = vec![0.0; n];
    let mut distances = vec![INF_DISTANCE; n];
    let mut heap = BinaryHeap::new();

    sigma[source] = 1.0;
    distances[source] = 0;
    heap.push(QueueState {
        cost: 0,
        node: source,
    });

    while let Some(current) = heap.pop() {
        if current.cost != distances[current.node] {
            continue;
        }
        stack.push(current.node);

        for &(neighbor, edge_cost) in &projection.adjacency[current.node] {
            let next_cost = current.cost.saturating_add(edge_cost);
            if next_cost < distances[neighbor] {
                distances[neighbor] = next_cost;
                sigma[neighbor] = sigma[current.node];
                predecessors[neighbor].clear();
                predecessors[neighbor].push(current.node);
                heap.push(QueueState {
                    cost: next_cost,
                    node: neighbor,
                });
            } else if next_cost == distances[neighbor] {
                sigma[neighbor] += sigma[current.node];
                predecessors[neighbor].push(current.node);
            }
        }
    }

    let mut dependencies = vec![0.0; n];
    while let Some(node) = stack.pop() {
        if sigma[node] <= f64::EPSILON {
            continue;
        }
        for &predecessor in &predecessors[node] {
            dependencies[predecessor] +=
                (sigma[predecessor] / sigma[node]) * (1.0 + dependencies[node]);
        }
    }
    dependencies[source] = 0.0;
    dependencies
}

fn build_node_results(
    graph: &GraphState,
    projection: &CentralityProjection,
    scores: &[f64],
) -> Vec<BetweennessCentralityNodeResult> {
    let normalization = normalization_denominator(projection.node_ids.len());
    let mut results: Vec<BetweennessCentralityNodeResult> = projection
        .node_ids
        .iter()
        .enumerate()
        .map(|(index, player_id)| BetweennessCentralityNodeResult {
            rank: 0,
            player_id: player_id.clone(),
            label: node_label(graph, player_id),
            cluster_id: graph.cluster_membership.get(player_id).cloned(),
            degree: projection.degree[index],
            weighted_strength: projection.weighted_strength[index],
            raw_betweenness: scores.get(index).copied().unwrap_or(0.0),
            normalized_betweenness: if normalization > 0.0 {
                scores.get(index).copied().unwrap_or(0.0) / normalization
            } else {
                0.0
            },
        })
        .collect();

    results.sort_by(|left, right| {
        right
            .raw_betweenness
            .total_cmp(&left.raw_betweenness)
            .then_with(|| right.degree.cmp(&left.degree))
            .then_with(|| right.weighted_strength.cmp(&left.weighted_strength))
            .then_with(|| left.label.cmp(&right.label))
            .then_with(|| left.player_id.cmp(&right.player_id))
    });
    for (index, result) in results.iter_mut().enumerate() {
        result.rank = index + 1;
    }
    results
}

fn add_scores(target: &mut [f64], source: &[f64]) {
    for (target_value, source_value) in target.iter_mut().zip(source) {
        *target_value += source_value;
    }
}

fn finalize_undirected_scores(scores: &mut [f64]) {
    for score in scores {
        *score /= 2.0;
    }
}

fn edge_cost(support: u32, weighted_mode: bool) -> u64 {
    if !weighted_mode {
        return COST_SCALE;
    }
    let safe_support = u64::from(support.max(1));
    (COST_SCALE + safe_support - 1) / safe_support
}

fn normalization_denominator(node_count: usize) -> f64 {
    if node_count < 3 {
        0.0
    } else {
        ((node_count - 1) * (node_count - 2)) as f64 / 2.0
    }
}

fn max_abs_delta(left: &[f64], right: &[f64]) -> Option<f64> {
    if left.len() != right.len() {
        return None;
    }
    Some(
        left.iter()
            .zip(right)
            .map(|(left_value, right_value)| (left_value - right_value).abs())
            .fold(0.0, f64::max),
    )
}

fn node_label(graph: &GraphState, player_id: &str) -> String {
    graph
        .node_map
        .get(player_id)
        .map(|node| node.label.clone())
        .unwrap_or_else(|| player_id.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::graph::{GraphState, PairRelation};
    use crate::models::{GraphNode, GraphSnapshot, PrototypeDataset};
    use std::collections::HashMap;

    fn graph_with_edges(edges: &[(&str, &str, u32, u32)]) -> GraphState {
        let mut node_ids = BTreeSet::new();
        let mut pair_relations = HashMap::new();
        for (left, right, ally_weight, total_matches) in edges {
            node_ids.insert((*left).to_string());
            node_ids.insert((*right).to_string());
            let enemy_weight = total_matches.saturating_sub(*ally_weight);
            pair_relations.insert(
                format!("{}|{}", left.min(right), left.max(right)),
                PairRelation {
                    ally_weight: *ally_weight,
                    enemy_weight,
                    total_matches: *total_matches,
                    dominant_relation: if *ally_weight >= enemy_weight {
                        "ally".to_string()
                    } else {
                        "enemy".to_string()
                    },
                },
            );
        }

        let nodes: Vec<GraphNode> = node_ids
            .into_iter()
            .map(|id| GraphNode {
                id: id.clone(),
                label: id,
                x: 0.0,
                y: 0.0,
                cluster_id: None,
                is_bridge: None,
                is_star: None,
            })
            .collect();
        let node_map = nodes
            .iter()
            .cloned()
            .map(|node| (node.id.clone(), node))
            .collect();

        GraphState {
            node_map,
            adjacency: HashMap::new(),
            pair_relations,
            player_rows: HashMap::new(),
            dataset: PrototypeDataset {
                nodes,
                edges: Vec::new(),
            },
            population_snapshot: GraphSnapshot {
                nodes: Vec::new(),
                edges: Vec::new(),
            },
            cluster_membership: HashMap::new(),
            cluster_summaries: Vec::new(),
            cluster_hops: HashMap::new(),
            landmark_distances: HashMap::new(),
            min_costs: HashMap::new(),
            node_indices: HashMap::new(),
        }
    }

    fn serial_scores_for(
        graph: &GraphState,
        graph_mode: CentralityGraphMode,
        weighted_mode: bool,
    ) -> Vec<BetweennessCentralityNodeResult> {
        let projection = build_projection(graph, graph_mode, weighted_mode, 1);
        let scores = compute_serial_scores(&projection).scores;
        build_node_results(graph, &projection, &scores)
    }

    fn score(results: &[BetweennessCentralityNodeResult], player_id: &str) -> f64 {
        results
            .iter()
            .find(|result| result.player_id == player_id)
            .map(|result| result.raw_betweenness)
            .unwrap_or(0.0)
    }

    #[test]
    fn path_graph_middle_nodes_have_highest_betweenness() {
        let graph = graph_with_edges(&[("a", "b", 1, 1), ("b", "c", 1, 1), ("c", "d", 1, 1)]);
        let results = serial_scores_for(&graph, CentralityGraphMode::BattlePath, false);

        assert!((score(&results, "b") - 2.0).abs() < 1e-9);
        assert!((score(&results, "c") - 2.0).abs() < 1e-9);
        assert_eq!(score(&results, "a"), 0.0);
        assert_eq!(score(&results, "d"), 0.0);
    }

    #[test]
    fn star_graph_center_has_normalized_score_one() {
        let graph = graph_with_edges(&[
            ("center", "a", 1, 1),
            ("center", "b", 1, 1),
            ("center", "c", 1, 1),
        ]);
        let results = serial_scores_for(&graph, CentralityGraphMode::BattlePath, false);
        let center = results
            .iter()
            .find(|result| result.player_id == "center")
            .expect("center result");

        assert!((center.raw_betweenness - 3.0).abs() < 1e-9);
        assert!((center.normalized_betweenness - 1.0).abs() < 1e-9);
        assert_eq!(score(&results, "a"), 0.0);
    }

    #[test]
    fn dumbbell_bridge_node_ranks_first() {
        let graph = graph_with_edges(&[
            ("a", "b", 1, 1),
            ("a", "c", 1, 1),
            ("b", "c", 1, 1),
            ("c", "bridge", 1, 1),
            ("bridge", "d", 1, 1),
            ("d", "e", 1, 1),
            ("d", "f", 1, 1),
            ("e", "f", 1, 1),
        ]);
        let results = serial_scores_for(&graph, CentralityGraphMode::BattlePath, false);

        assert_eq!(
            results.first().map(|result| result.player_id.as_str()),
            Some("bridge")
        );
    }

    #[test]
    fn weighted_cost_uses_inverse_strength() {
        let graph = graph_with_edges(&[("a", "b", 10, 10), ("b", "c", 10, 10), ("a", "c", 1, 1)]);
        let unweighted = serial_scores_for(&graph, CentralityGraphMode::BattlePath, false);
        let weighted = serial_scores_for(&graph, CentralityGraphMode::BattlePath, true);

        assert_eq!(score(&unweighted, "b"), 0.0);
        assert!((score(&weighted, "b") - 1.0).abs() < 1e-9);
    }

    #[test]
    fn social_projection_excludes_enemy_only_edges() {
        let graph = graph_with_edges(&[("a", "b", 1, 1), ("b", "c", 1, 1), ("a", "c", 0, 2)]);
        let projection = build_projection(&graph, CentralityGraphMode::SocialPath, false, 1);

        assert_eq!(projection.stats.candidate_edges, 2);
        assert_eq!(projection.stats.analyzed_edges, 2);
    }

    #[test]
    fn parallel_matches_serial() {
        let graph = graph_with_edges(&[
            ("a", "b", 1, 1),
            ("b", "c", 1, 1),
            ("c", "d", 1, 1),
            ("b", "e", 2, 2),
            ("e", "f", 2, 2),
            ("f", "d", 2, 2),
        ]);
        let projection = build_projection(&graph, CentralityGraphMode::BattlePath, true, 1);
        let serial = compute_serial_scores(&projection);
        let parallel = compute_parallel_scores(&projection);

        assert_eq!(max_abs_delta(&serial.scores, &parallel.scores), Some(0.0));
    }
}
