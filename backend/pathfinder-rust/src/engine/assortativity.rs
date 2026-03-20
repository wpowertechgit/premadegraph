use super::graph::{GraphState, PlayerDbRow};
use crate::models::{
    AssortativityDecisions, AssortativityMetricResult, AssortativityRequest,
    AssortativityResponse, AssortativitySample,
};
use std::collections::HashSet;

#[derive(Clone, Copy)]
enum MetricKey {
    Opscore,
    Feedscore,
}

impl MetricKey {
    fn all() -> [Self; 2] {
        [Self::Opscore, Self::Feedscore]
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Opscore => "opscore",
            Self::Feedscore => "feedscore",
        }
    }

    fn value_from(self, row: &PlayerDbRow) -> Option<f64> {
        match self {
            Self::Opscore => row.opscore,
            Self::Feedscore => row.feedscore,
        }
    }
}

#[derive(Clone, Copy)]
enum GraphMode {
    SocialPath,
    BattlePath,
}

impl GraphMode {
    fn all() -> [Self; 2] {
        [Self::SocialPath, Self::BattlePath]
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::SocialPath => "social-path",
            Self::BattlePath => "battle-path",
        }
    }

    fn edge_support(self, ally_weight: u32, total_matches: u32) -> u32 {
        match self {
            Self::SocialPath => ally_weight,
            Self::BattlePath => total_matches,
        }
    }

    fn includes_edge(self, ally_weight: u32, total_matches: u32) -> bool {
        self.edge_support(ally_weight, total_matches) > 0
    }
}

#[derive(Default, Clone, Copy)]
struct PearsonAccumulator {
    oriented_pairs: usize,
    edge_count: usize,
    sum_x: f64,
    sum_y: f64,
    sum_x2: f64,
    sum_y2: f64,
    sum_xy: f64,
}

impl PearsonAccumulator {
    fn add_undirected_edge(&mut self, left: f64, right: f64) {
        self.add_oriented_pair(left, right);
        self.add_oriented_pair(right, left);
        self.edge_count += 1;
    }

    fn add_oriented_pair(&mut self, left: f64, right: f64) {
        self.oriented_pairs += 1;
        self.sum_x += left;
        self.sum_y += right;
        self.sum_x2 += left * left;
        self.sum_y2 += right * right;
        self.sum_xy += left * right;
    }

    fn sample(self) -> AssortativitySample {
        AssortativitySample {
            coefficient: self.coefficient(),
            sample_size: self.edge_count,
        }
    }

    fn coefficient(self) -> Option<f64> {
        if self.oriented_pairs < 2 {
            return None;
        }

        let n = self.oriented_pairs as f64;
        let numerator = n * self.sum_xy - self.sum_x * self.sum_y;
        let denom_x = n * self.sum_x2 - self.sum_x * self.sum_x;
        let denom_y = n * self.sum_y2 - self.sum_y * self.sum_y;
        let denominator = (denom_x * denom_y).sqrt();

        if denominator <= f64::EPSILON {
            None
        } else {
            Some(numerator / denominator)
        }
    }
}

#[derive(Default)]
struct MetricComputation {
    eligible_nodes: usize,
    candidate_edges: usize,
    analyzed_edges: usize,
    skipped_low_edge_support_edges: usize,
    skipped_missing_metric_edges: usize,
    skipped_low_match_count_edges: usize,
    global: PearsonAccumulator,
    within_cluster: PearsonAccumulator,
    cross_cluster: PearsonAccumulator,
    strong_ties: PearsonAccumulator,
    weak_ties: PearsonAccumulator,
}

pub(super) fn assortativity_response(
    graph: &GraphState,
    request: AssortativityRequest,
) -> AssortativityResponse {
    let mut results = Vec::new();
    for graph_mode in GraphMode::all() {
        for metric in MetricKey::all() {
            results.push(compute_metric_result(graph, &request, graph_mode, metric));
        }
    }

    let mut warnings = Vec::new();
    if results.iter().all(|result| result.analyzed_edges == 0) {
        warnings.push(
            "No graph edges satisfied the current support threshold and player eligibility rules."
                .to_string(),
        );
    }
    for result in &results {
        if result.analyzed_edges > 0 && result.global.coefficient.is_none() {
            warnings.push(format!(
                "{} {} assortativity was undefined because the eligible endpoint values had no measurable variance.",
                result.graph_mode, result.metric
            ));
        }
    }

    AssortativityResponse {
        status: if results.iter().any(|result| result.global.coefficient.is_some()) {
            "ok".to_string()
        } else {
            "insufficient_data".to_string()
        },
        decisions: AssortativityDecisions {
            graph_scope: "runtime graph built from player metrics plus signed match co-presence edges"
                .to_string(),
            graph_modes: GraphMode::all()
                .into_iter()
                .map(|mode| mode.as_str().to_string())
                .collect(),
            metrics: MetricKey::all()
                .into_iter()
                .map(|metric| metric.as_str().to_string())
                .collect(),
            graph_mode_rule: "social-path uses allyWeight-supported edges only; battle-path uses all co-play edges with support measured by allyWeight + enemyWeight".to_string(),
            node_eligibility_rule: "both endpoints must have the selected metric value present and both players must meet the minimum player match count".to_string(),
            assortativity_formula: "Pearson correlation across both endpoint orientations of each eligible undirected edge".to_string(),
            min_edge_support: request.min_edge_support,
            min_player_match_count: request.min_player_match_count,
            strong_tie_threshold: request.strong_tie_threshold,
        },
        results,
        warnings,
    }
}

fn compute_metric_result(
    graph: &GraphState,
    request: &AssortativityRequest,
    graph_mode: GraphMode,
    metric: MetricKey,
) -> AssortativityMetricResult {
    let mut computation = MetricComputation {
        eligible_nodes: eligible_node_count(graph, request.min_player_match_count, metric),
        ..MetricComputation::default()
    };

    for (key, relation) in &graph.pair_relations {
        let support = graph_mode.edge_support(relation.ally_weight, relation.total_matches);
        if !graph_mode.includes_edge(relation.ally_weight, relation.total_matches) {
            continue;
        }
        computation.candidate_edges += 1;

        if support < request.min_edge_support {
            computation.skipped_low_edge_support_edges += 1;
            continue;
        }

        let Some((left_id, right_id)) = key.split_once('|') else {
            continue;
        };
        let Some(left_row) = graph.player_rows.get(left_id) else {
            computation.skipped_missing_metric_edges += 1;
            continue;
        };
        let Some(right_row) = graph.player_rows.get(right_id) else {
            computation.skipped_missing_metric_edges += 1;
            continue;
        };
        let Some(left_value) = metric.value_from(left_row) else {
            computation.skipped_missing_metric_edges += 1;
            continue;
        };
        let Some(right_value) = metric.value_from(right_row) else {
            computation.skipped_missing_metric_edges += 1;
            continue;
        };
        if left_row.match_count < request.min_player_match_count
            || right_row.match_count < request.min_player_match_count
        {
            computation.skipped_low_match_count_edges += 1;
            continue;
        }

        computation.analyzed_edges += 1;
        computation.global.add_undirected_edge(left_value, right_value);

        if same_cluster(graph, left_id, right_id) {
            computation
                .within_cluster
                .add_undirected_edge(left_value, right_value);
        } else {
            computation
                .cross_cluster
                .add_undirected_edge(left_value, right_value);
        }

        if support >= request.strong_tie_threshold {
            computation.strong_ties.add_undirected_edge(left_value, right_value);
        } else {
            computation.weak_ties.add_undirected_edge(left_value, right_value);
        }
    }

    AssortativityMetricResult {
        graph_mode: graph_mode.as_str().to_string(),
        metric: metric.as_str().to_string(),
        eligible_nodes: computation.eligible_nodes,
        candidate_edges: computation.candidate_edges,
        analyzed_edges: computation.analyzed_edges,
        skipped_low_edge_support_edges: computation.skipped_low_edge_support_edges,
        skipped_missing_metric_edges: computation.skipped_missing_metric_edges,
        skipped_low_match_count_edges: computation.skipped_low_match_count_edges,
        global: computation.global.sample(),
        within_cluster: computation.within_cluster.sample(),
        cross_cluster: computation.cross_cluster.sample(),
        strong_ties: computation.strong_ties.sample(),
        weak_ties: computation.weak_ties.sample(),
    }
}

fn eligible_node_count(
    graph: &GraphState,
    min_player_match_count: u32,
    metric: MetricKey,
) -> usize {
    let mut eligible = HashSet::new();

    for (node_id, row) in &graph.player_rows {
        if row.match_count < min_player_match_count {
            continue;
        }
        if metric.value_from(row).is_none() {
            continue;
        }
        if graph.node_map.contains_key(node_id) {
            eligible.insert(node_id.clone());
        }
    }

    eligible.len()
}

fn same_cluster(graph: &GraphState, left_id: &str, right_id: &str) -> bool {
    matches!(
        (
            graph.cluster_membership.get(left_id),
            graph.cluster_membership.get(right_id),
        ),
        (Some(left_cluster), Some(right_cluster)) if left_cluster == right_cluster
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::graph::{GraphState, PairRelation};
    use crate::models::{ClusterSummary, GraphNode, GraphSnapshot, PrototypeDataset};
    use std::collections::HashMap;

    fn graph_node(id: &str, label: &str, cluster_id: Option<&str>) -> GraphNode {
        GraphNode {
            id: id.to_string(),
            label: label.to_string(),
            x: 0.0,
            y: 0.0,
            cluster_id: cluster_id.map(|value| value.to_string()),
            is_bridge: Some(false),
            is_star: Some(false),
        }
    }

    fn player_row(label: &str, opscore: Option<f64>, feedscore: Option<f64>, match_count: u32) -> PlayerDbRow {
        PlayerDbRow {
            label: label.to_string(),
            opscore,
            feedscore,
            match_count,
        }
    }

    fn empty_graph_state() -> GraphState {
        GraphState {
            node_map: HashMap::new(),
            adjacency: HashMap::new(),
            pair_relations: HashMap::new(),
            player_rows: HashMap::new(),
            dataset: PrototypeDataset {
                nodes: Vec::new(),
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

    fn build_test_graph() -> GraphState {
        let mut graph = empty_graph_state();
        graph.node_map = HashMap::from([
            ("a".to_string(), graph_node("a", "Alpha", Some("cluster:1"))),
            ("b".to_string(), graph_node("b", "Bravo", Some("cluster:1"))),
            ("c".to_string(), graph_node("c", "Charlie", Some("cluster:2"))),
        ]);
        graph.player_rows = HashMap::from([
            ("a".to_string(), player_row("Alpha", Some(1.0), Some(10.0), 5)),
            ("b".to_string(), player_row("Bravo", Some(2.0), Some(20.0), 5)),
            ("c".to_string(), player_row("Charlie", Some(3.0), None, 2)),
        ]);
        graph.pair_relations = HashMap::from([
            (
                "a|b".to_string(),
                PairRelation {
                    ally_weight: 3,
                    enemy_weight: 0,
                    total_matches: 3,
                    dominant_relation: "ally".to_string(),
                },
            ),
            (
                "a|c".to_string(),
                PairRelation {
                    ally_weight: 0,
                    enemy_weight: 2,
                    total_matches: 2,
                    dominant_relation: "enemy".to_string(),
                },
            ),
            (
                "b|c".to_string(),
                PairRelation {
                    ally_weight: 1,
                    enemy_weight: 1,
                    total_matches: 2,
                    dominant_relation: "ally".to_string(),
                },
            ),
        ]);
        graph.cluster_membership = HashMap::from([
            ("a".to_string(), "cluster:1".to_string()),
            ("b".to_string(), "cluster:1".to_string()),
            ("c".to_string(), "cluster:2".to_string()),
        ]);
        graph.cluster_summaries = vec![
            ClusterSummary {
                cluster_id: "cluster:1".to_string(),
                cluster_type: "rust_pathfinding".to_string(),
                algorithm: "strong_components".to_string(),
                size: 2,
                best_op: Some("b".to_string()),
                worst_feed: Some("b".to_string()),
                center_x: 0.0,
                center_y: 0.0,
                highlighted_members: vec!["b".to_string()],
            },
            ClusterSummary {
                cluster_id: "cluster:2".to_string(),
                cluster_type: "rust_pathfinding".to_string(),
                algorithm: "strong_components".to_string(),
                size: 1,
                best_op: Some("c".to_string()),
                worst_feed: None,
                center_x: 0.0,
                center_y: 0.0,
                highlighted_members: vec!["c".to_string()],
            },
        ];
        graph.dataset = PrototypeDataset {
            nodes: graph.node_map.values().cloned().collect(),
            edges: Vec::new(),
        };
        graph
    }

    #[test]
    fn pearson_accumulator_reports_positive_correlation() {
        let mut accumulator = PearsonAccumulator::default();
        accumulator.add_undirected_edge(1.0, 1.0);
        accumulator.add_undirected_edge(2.0, 2.0);
        accumulator.add_undirected_edge(3.0, 3.0);

        let coefficient = accumulator.coefficient().expect("expected coefficient");
        assert!((coefficient - 1.0).abs() < 1e-9);
        assert_eq!(accumulator.sample().sample_size, 3);
    }

    #[test]
    fn social_mode_excludes_enemy_only_edges() {
        let graph = build_test_graph();
        let request = AssortativityRequest {
            min_edge_support: 1,
            min_player_match_count: 1,
            strong_tie_threshold: 3,
            include_cluster_breakdown: true,
        };

        let result = compute_metric_result(&graph, &request, GraphMode::SocialPath, MetricKey::Opscore);

        assert_eq!(result.candidate_edges, 2);
        assert_eq!(result.analyzed_edges, 2);
        assert_eq!(result.global.sample_size, 2);
        assert_eq!(result.within_cluster.sample_size, 1);
        assert_eq!(result.cross_cluster.sample_size, 1);
    }

    #[test]
    fn missing_metrics_and_low_match_counts_are_counted_explicitly() {
        let graph = build_test_graph();
        let request = AssortativityRequest {
            min_edge_support: 1,
            min_player_match_count: 3,
            strong_tie_threshold: 3,
            include_cluster_breakdown: true,
        };

        let feed_result =
            compute_metric_result(&graph, &request, GraphMode::BattlePath, MetricKey::Feedscore);
        let op_result =
            compute_metric_result(&graph, &request, GraphMode::BattlePath, MetricKey::Opscore);

        assert_eq!(feed_result.candidate_edges, 3);
        assert_eq!(feed_result.analyzed_edges, 1);
        assert_eq!(feed_result.skipped_missing_metric_edges, 2);
        assert_eq!(feed_result.skipped_low_match_count_edges, 0);

        assert_eq!(op_result.candidate_edges, 3);
        assert_eq!(op_result.analyzed_edges, 1);
        assert_eq!(op_result.skipped_missing_metric_edges, 0);
        assert_eq!(op_result.skipped_low_match_count_edges, 2);
        assert_eq!(op_result.global.sample_size, 1);
    }
}
