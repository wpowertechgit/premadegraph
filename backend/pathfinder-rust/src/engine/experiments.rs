use super::graph::{GraphState, PairRelation, PlayerDbRow};
use super::signed_balance::signed_balance_response;
use crate::models::{
    AssortativityNullDistributionSummary, AssortativitySignificanceObserved,
    AssortativitySignificanceRequest, AssortativitySignificanceResponse,
    AssortativitySignificanceRun, AssortativitySignificanceStats, ExperimentDatasetSummary,
    ExperimentMetadata, SignedBalanceRequest, SignedBalanceSweepParameters,
    SignedBalanceSweepRequest, SignedBalanceSweepResponse, SignedBalanceSweepRun,
    SignedBalanceSweepSummary, SignedTiePolicy,
};
use std::collections::{BTreeSet, HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};

const BALANCE_SWEEP_SCHEMA_VERSION: &str = "signed-balance-sweep-v1";
const ASSORTATIVITY_SIGNIFICANCE_SCHEMA_VERSION: &str = "assortativity-significance-v1";
const DEFAULT_GRAPH_MODES: [&str; 2] = ["social-path", "battle-path"];
const DEFAULT_METRICS: [&str; 2] = ["opscore", "feedscore"];

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
enum CanonicalTiePolicy {
    Exclude,
    Ally,
    Enemy,
}

impl CanonicalTiePolicy {
    fn from_model(value: SignedTiePolicy) -> Self {
        match value {
            SignedTiePolicy::Exclude => Self::Exclude,
            SignedTiePolicy::Ally => Self::Ally,
            SignedTiePolicy::Enemy => Self::Enemy,
        }
    }

    fn into_model(self) -> SignedTiePolicy {
        match self {
            Self::Exclude => SignedTiePolicy::Exclude,
            Self::Ally => SignedTiePolicy::Ally,
            Self::Enemy => SignedTiePolicy::Enemy,
        }
    }
}

#[derive(Clone, Copy)]
enum MetricKey {
    Opscore,
    Feedscore,
}

impl MetricKey {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "opscore" => Some(Self::Opscore),
            "feedscore" => Some(Self::Feedscore),
            _ => None,
        }
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
    fn parse(value: &str) -> Option<Self> {
        match value {
            "social-path" => Some(Self::SocialPath),
            "battle-path" => Some(Self::BattlePath),
            _ => None,
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

    fn includes_edge(self, relation: &PairRelation) -> bool {
        self.support(relation) > 0
    }
}

#[derive(Default, Clone, Copy)]
struct ObservedAssortativityStats {
    eligible_nodes: usize,
    candidate_edges: usize,
    analyzed_edges: usize,
    skipped_low_edge_support_edges: usize,
    skipped_missing_metric_edges: usize,
    skipped_low_match_count_edges: usize,
    coefficient: Option<f64>,
    sample_size: usize,
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

struct DeterministicRng {
    state: u64,
}

impl DeterministicRng {
    fn new(seed: u64) -> Self {
        Self { state: seed.max(1) }
    }

    fn next_u64(&mut self) -> u64 {
        self.state = self
            .state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.state
    }

    fn gen_index(&mut self, upper_exclusive: usize) -> usize {
        if upper_exclusive <= 1 {
            0
        } else {
            (self.next_u64() % upper_exclusive as u64) as usize
        }
    }
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

pub(super) fn signed_balance_sweep_response(
    graph: &GraphState,
    request: SignedBalanceSweepRequest,
) -> SignedBalanceSweepResponse {
    let min_edge_supports = normalize_min_edge_supports(&request.min_edge_supports);
    let tie_policies = normalize_tie_policies(&request.tie_policies);
    let mut runs = Vec::new();

    for min_edge_support in &min_edge_supports {
        for tie_policy in &tie_policies {
            let response = signed_balance_response(
                graph,
                SignedBalanceRequest {
                    min_edge_support: *min_edge_support,
                    tie_policy: *tie_policy,
                    max_top_nodes: request.max_top_nodes,
                    include_cluster_summaries: request.include_cluster_summaries,
                },
            );

            runs.push(SignedBalanceSweepRun {
                run_index: runs.len() + 1,
                parameters: SignedBalanceSweepParameters {
                    min_edge_support: *min_edge_support,
                    tie_policy: *tie_policy,
                    include_cluster_summaries: request.include_cluster_summaries,
                },
                graph_summary: response.graph_summary,
                triads: response.triads,
                triad_type_distribution: response.triad_type_distribution,
                warnings: response.warnings,
            });
        }
    }

    let runs_with_triads = runs
        .iter()
        .filter(|run| run.triads.total_analyzed > 0)
        .count();
    let no_triad_runs = runs.len().saturating_sub(runs_with_triads);
    let ratios: Vec<f64> = runs
        .iter()
        .filter(|run| run.triads.total_analyzed > 0)
        .map(|run| run.triads.balanced_ratio)
        .collect();
    let summary = SignedBalanceSweepSummary {
        min_balanced_ratio: if ratios.is_empty() {
            0.0
        } else {
            ratios.iter().copied().fold(f64::INFINITY, f64::min)
        },
        max_balanced_ratio: ratios.iter().copied().fold(0.0, f64::max),
        mean_balanced_ratio: if ratios.is_empty() {
            0.0
        } else {
            ratios.iter().sum::<f64>() / ratios.len() as f64
        },
        runs_with_triads,
        no_triad_runs,
    };

    let warnings = if runs_with_triads == 0 {
        vec!["No sweep configuration produced analyzable signed triads.".to_string()]
    } else {
        Vec::new()
    };

    SignedBalanceSweepResponse {
        status: if runs_with_triads > 0 {
            "ok".to_string()
        } else {
            "no_triads".to_string()
        },
        metadata: build_metadata(
            graph,
            "signed-balance-sensitivity".to_string(),
            BALANCE_SWEEP_SCHEMA_VERSION.to_string(),
            None,
            runs.len(),
        ),
        parameter_grid: serde_json::json!({
            "minEdgeSupports": min_edge_supports,
            "tiePolicies": tie_policies,
            "includeClusterSummaries": request.include_cluster_summaries,
            "maxTopNodes": request.max_top_nodes,
        }),
        summary,
        runs,
        warnings,
    }
}

pub(super) fn assortativity_significance_response(
    graph: &GraphState,
    request: AssortativitySignificanceRequest,
) -> AssortativitySignificanceResponse {
    let graph_modes = normalize_graph_modes(&request.graph_modes);
    let metrics = normalize_metrics(&request.metrics);
    let permutation_count = request.permutation_count.max(1);
    let mut rng = DeterministicRng::new(request.seed);
    let mut runs = Vec::new();

    for graph_mode_name in &graph_modes {
        for metric_name in &metrics {
            let graph_mode = GraphMode::parse(graph_mode_name).expect("graph mode already normalized");
            let metric = MetricKey::parse(metric_name).expect("metric already normalized");
            let observed = compute_observed_assortativity(
                graph,
                graph_mode,
                metric,
                request.min_edge_support,
                request.min_player_match_count,
                None,
            );
            let mut null_samples = Vec::with_capacity(permutation_count);
            let eligible_metric_map = eligible_metric_values(
                graph,
                metric,
                request.min_player_match_count,
            );
            let eligible_node_ids: Vec<String> = {
                let mut ids: Vec<String> = eligible_metric_map.keys().cloned().collect();
                ids.sort();
                ids
            };
            let eligible_values: Vec<f64> = eligible_node_ids
                .iter()
                .filter_map(|node_id| eligible_metric_map.get(node_id).copied())
                .collect();

            for _ in 0..permutation_count {
                let shuffled_map = shuffled_metric_map(&eligible_node_ids, &eligible_values, &mut rng);
                let permutation = compute_observed_assortativity(
                    graph,
                    graph_mode,
                    metric,
                    request.min_edge_support,
                    request.min_player_match_count,
                    Some(&shuffled_map),
                );
                null_samples.push(permutation.coefficient);
            }

            let null_distribution = summarize_null_distribution(
                &null_samples,
                request.include_null_distribution_samples,
            );
            let significance = compute_significance(observed.coefficient, &null_samples);
            let mut warnings = Vec::new();
            if observed.analyzed_edges == 0 {
                warnings.push(
                    "No eligible edges satisfied the current graph mode and filtering rules."
                        .to_string(),
                );
            } else if observed.coefficient.is_none() {
                warnings.push(
                    "Observed assortativity was undefined because the eligible endpoint values had no measurable variance."
                        .to_string(),
                );
            }

            runs.push(AssortativitySignificanceRun {
                run_index: runs.len() + 1,
                graph_mode: graph_mode.as_str().to_string(),
                metric: metric.as_str().to_string(),
                observed: AssortativitySignificanceObserved {
                    coefficient: observed.coefficient,
                    sample_size: observed.sample_size,
                    eligible_nodes: observed.eligible_nodes,
                    candidate_edges: observed.candidate_edges,
                    analyzed_edges: observed.analyzed_edges,
                    skipped_low_edge_support_edges: observed.skipped_low_edge_support_edges,
                    skipped_missing_metric_edges: observed.skipped_missing_metric_edges,
                    skipped_low_match_count_edges: observed.skipped_low_match_count_edges,
                },
                permutation_count,
                null_distribution,
                significance,
                warnings,
            });
        }
    }

    let warnings = if runs.iter().all(|run| run.observed.coefficient.is_none()) {
        vec![
            "No assortativity significance configuration produced a defined observed coefficient."
                .to_string(),
        ]
    } else {
        Vec::new()
    };

    AssortativitySignificanceResponse {
        status: if runs.iter().any(|run| run.observed.coefficient.is_some()) {
            "ok".to_string()
        } else {
            "insufficient_data".to_string()
        },
        metadata: build_metadata(
            graph,
            "assortativity-significance".to_string(),
            ASSORTATIVITY_SIGNIFICANCE_SCHEMA_VERSION.to_string(),
            Some(request.seed),
            runs.len(),
        ),
        parameter_grid: serde_json::json!({
            "graphModes": graph_modes,
            "metrics": metrics,
            "minEdgeSupport": request.min_edge_support,
            "minPlayerMatchCount": request.min_player_match_count,
            "strongTieThreshold": request.strong_tie_threshold,
            "permutationCount": permutation_count,
        }),
        null_model: serde_json::json!({
            "name": "fixed-topology-metric-permutation",
            "description": "Keeps graph topology fixed and permutes the selected metric across eligible nodes only.",
            "eligibilityPreservedBeforeShuffle": true,
            "seed": request.seed,
        }),
        runs,
        warnings,
    }
}

fn normalize_min_edge_supports(values: &[u32]) -> Vec<u32> {
    let mut unique = BTreeSet::new();
    for &value in values {
        unique.insert(value.max(1));
    }
    if unique.is_empty() {
        unique.extend([1, 2, 3, 4]);
    }
    unique.into_iter().collect()
}

fn normalize_tie_policies(values: &[SignedTiePolicy]) -> Vec<SignedTiePolicy> {
    let mut unique = BTreeSet::new();
    for &value in values {
        unique.insert(CanonicalTiePolicy::from_model(value));
    }
    if unique.is_empty() {
        unique.extend([
            CanonicalTiePolicy::Exclude,
            CanonicalTiePolicy::Ally,
            CanonicalTiePolicy::Enemy,
        ]);
    }
    unique
        .into_iter()
        .map(CanonicalTiePolicy::into_model)
        .collect()
}

fn normalize_graph_modes(values: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for candidate in values {
        if let Some(mode) = GraphMode::parse(candidate) {
            let label = mode.as_str().to_string();
            if seen.insert(label.clone()) {
                normalized.push(label);
            }
        }
    }
    if normalized.is_empty() {
        DEFAULT_GRAPH_MODES
            .iter()
            .map(|value| (*value).to_string())
            .collect()
    } else {
        normalized
    }
}

fn normalize_metrics(values: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for candidate in values {
        if let Some(metric) = MetricKey::parse(candidate) {
            let label = metric.as_str().to_string();
            if seen.insert(label.clone()) {
                normalized.push(label);
            }
        }
    }
    if normalized.is_empty() {
        DEFAULT_METRICS
            .iter()
            .map(|value| (*value).to_string())
            .collect()
    } else {
        normalized
    }
}

fn build_metadata(
    graph: &GraphState,
    analysis_type: String,
    schema_version: String,
    seed: Option<u64>,
    run_count: usize,
) -> ExperimentMetadata {
    ExperimentMetadata {
        analysis_type,
        schema_version,
        generated_at_unix_ms: now_unix_ms(),
        dataset_scope: "active runtime dataset".to_string(),
        graph_scope: "runtime graph built from match JSON plus SQLite player metrics".to_string(),
        seed,
        run_count,
        dataset_summary: ExperimentDatasetSummary {
            filtered_nodes: graph.dataset.nodes.len(),
            runtime_nodes: graph.node_map.len(),
            pair_relations: graph.pair_relations.len(),
            dataset_edges: graph.dataset.edges.len(),
            runtime_clusters: graph.cluster_summaries.len(),
        },
    }
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn eligible_metric_values(
    graph: &GraphState,
    metric: MetricKey,
    min_player_match_count: u32,
) -> HashMap<String, f64> {
    graph.player_rows
        .iter()
        .filter_map(|(node_id, row)| {
            if row.match_count < min_player_match_count || !graph.node_map.contains_key(node_id) {
                return None;
            }
            metric.value_from(row).map(|value| (node_id.clone(), value))
        })
        .collect()
}

fn shuffled_metric_map(
    eligible_node_ids: &[String],
    eligible_values: &[f64],
    rng: &mut DeterministicRng,
) -> HashMap<String, f64> {
    let mut values = eligible_values.to_vec();
    for index in (1..values.len()).rev() {
        let swap_index = rng.gen_index(index + 1);
        values.swap(index, swap_index);
    }
    eligible_node_ids
        .iter()
        .cloned()
        .zip(values)
        .collect()
}

fn compute_observed_assortativity(
    graph: &GraphState,
    graph_mode: GraphMode,
    metric: MetricKey,
    min_edge_support: u32,
    min_player_match_count: u32,
    metric_overrides: Option<&HashMap<String, f64>>,
) -> ObservedAssortativityStats {
    let eligible_metric_map = if let Some(overrides) = metric_overrides {
        overrides.clone()
    } else {
        eligible_metric_values(graph, metric, min_player_match_count)
    };

    let mut accumulator = PearsonAccumulator::default();
    let mut stats = ObservedAssortativityStats {
        eligible_nodes: eligible_metric_map.len(),
        ..ObservedAssortativityStats::default()
    };

    let mut edge_keys: Vec<&String> = graph.pair_relations.keys().collect();
    edge_keys.sort();

    for key in edge_keys {
        let relation = graph
            .pair_relations
            .get(key)
            .expect("pair relation key should exist");
        if !graph_mode.includes_edge(relation) {
            continue;
        }
        stats.candidate_edges += 1;

        let support = graph_mode.support(relation);
        if support < min_edge_support {
            stats.skipped_low_edge_support_edges += 1;
            continue;
        }

        let Some((left_id, right_id)) = key.split_once('|') else {
            continue;
        };
        let Some(left_row) = graph.player_rows.get(left_id) else {
            stats.skipped_missing_metric_edges += 1;
            continue;
        };
        let Some(right_row) = graph.player_rows.get(right_id) else {
            stats.skipped_missing_metric_edges += 1;
            continue;
        };
        if left_row.match_count < min_player_match_count || right_row.match_count < min_player_match_count
        {
            stats.skipped_low_match_count_edges += 1;
            continue;
        }

        let Some(left_value) = eligible_metric_map.get(left_id).copied() else {
            stats.skipped_missing_metric_edges += 1;
            continue;
        };
        let Some(right_value) = eligible_metric_map.get(right_id).copied() else {
            stats.skipped_missing_metric_edges += 1;
            continue;
        };

        stats.analyzed_edges += 1;
        accumulator.add_undirected_edge(left_value, right_value);
    }

    stats.coefficient = accumulator.coefficient();
    stats.sample_size = accumulator.edge_count;
    stats
}

fn summarize_null_distribution(
    samples: &[Option<f64>],
    include_samples: bool,
) -> AssortativityNullDistributionSummary {
    let valid: Vec<f64> = samples.iter().copied().flatten().collect();
    let mean = mean(&valid);
    let stddev = stddev(&valid, mean);
    let min = valid.iter().copied().reduce(f64::min);
    let max = valid.iter().copied().reduce(f64::max);

    AssortativityNullDistributionSummary {
        mean,
        stddev,
        min,
        max,
        valid_permutations: valid.len(),
        undefined_permutations: samples.len().saturating_sub(valid.len()),
        samples: if include_samples {
            Some(samples.to_vec())
        } else {
            None
        },
    }
}

fn compute_significance(
    observed: Option<f64>,
    samples: &[Option<f64>],
) -> AssortativitySignificanceStats {
    let Some(observed_value) = observed else {
        return AssortativitySignificanceStats {
            empirical_percentile: None,
            empirical_upper_tail_p_value: None,
            empirical_two_sided_p_value: None,
            z_score: None,
        };
    };
    let valid: Vec<f64> = samples.iter().copied().flatten().collect();
    if valid.is_empty() {
        return AssortativitySignificanceStats {
            empirical_percentile: None,
            empirical_upper_tail_p_value: None,
            empirical_two_sided_p_value: None,
            z_score: None,
        };
    }

    let null_mean = mean(&valid);
    let null_stddev = stddev(&valid, null_mean);
    let less_or_equal = valid
        .iter()
        .filter(|value| **value <= observed_value)
        .count();
    let greater_or_equal = valid
        .iter()
        .filter(|value| **value >= observed_value)
        .count();
    let center = null_mean.unwrap_or(0.0);
    let observed_distance = (observed_value - center).abs();
    let as_extreme = valid
        .iter()
        .filter(|value| (**value - center).abs() >= observed_distance)
        .count();
    let denominator = valid.len() as f64;

    AssortativitySignificanceStats {
        empirical_percentile: Some(less_or_equal as f64 / denominator),
        empirical_upper_tail_p_value: Some((greater_or_equal as f64 + 1.0) / (denominator + 1.0)),
        empirical_two_sided_p_value: Some((as_extreme as f64 + 1.0) / (denominator + 1.0)),
        z_score: match (null_mean, null_stddev) {
            (Some(mean_value), Some(stddev_value)) if stddev_value > f64::EPSILON => {
                Some((observed_value - mean_value) / stddev_value)
            }
            _ => None,
        },
    }
}

fn mean(values: &[f64]) -> Option<f64> {
    if values.is_empty() {
        None
    } else {
        Some(values.iter().sum::<f64>() / values.len() as f64)
    }
}

fn stddev(values: &[f64], mean: Option<f64>) -> Option<f64> {
    let Some(mean_value) = mean else {
        return None;
    };
    if values.is_empty() {
        return None;
    }

    let variance = values
        .iter()
        .map(|value| {
            let delta = *value - mean_value;
            delta * delta
        })
        .sum::<f64>()
        / values.len() as f64;
    Some(variance.sqrt())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{GraphNode, GraphSnapshot, PrototypeDataset};

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
            ("c".to_string(), graph_node("c", "Charlie", Some("cluster:1"))),
        ]);
        graph.player_rows = HashMap::from([
            ("a".to_string(), player_row("Alpha", Some(1.0), Some(9.0), 5)),
            ("b".to_string(), player_row("Bravo", Some(2.0), Some(8.0), 5)),
            ("c".to_string(), player_row("Charlie", Some(3.0), Some(7.0), 5)),
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
                "b|c".to_string(),
                PairRelation {
                    ally_weight: 2,
                    enemy_weight: 0,
                    total_matches: 2,
                    dominant_relation: "ally".to_string(),
                },
            ),
            (
                "a|c".to_string(),
                PairRelation {
                    ally_weight: 1,
                    enemy_weight: 1,
                    total_matches: 2,
                    dominant_relation: "ally".to_string(),
                },
            ),
        ]);
        graph.dataset = PrototypeDataset {
            nodes: graph.node_map.values().cloned().collect(),
            edges: Vec::new(),
        };
        graph
    }

    #[test]
    fn signed_balance_sweep_returns_canonical_order() {
        let graph = build_test_graph();
        let response = signed_balance_sweep_response(
            &graph,
            SignedBalanceSweepRequest {
                min_edge_supports: vec![3, 1],
                tie_policies: vec![SignedTiePolicy::Enemy, SignedTiePolicy::Exclude],
                max_top_nodes: 5,
                include_cluster_summaries: false,
            },
        );

        let ordered: Vec<(u32, SignedTiePolicy)> = response
            .runs
            .iter()
            .map(|run| (run.parameters.min_edge_support, run.parameters.tie_policy))
            .collect();
        assert_eq!(
            ordered,
            vec![
                (1, SignedTiePolicy::Exclude),
                (1, SignedTiePolicy::Enemy),
                (3, SignedTiePolicy::Exclude),
                (3, SignedTiePolicy::Enemy),
            ]
        );
    }

    #[test]
    fn assortativity_significance_is_deterministic_for_fixed_seed() {
        let graph = build_test_graph();
        let request = AssortativitySignificanceRequest {
            graph_modes: vec!["social-path".to_string()],
            metrics: vec!["opscore".to_string()],
            min_edge_support: 1,
            min_player_match_count: 1,
            strong_tie_threshold: 3,
            permutation_count: 12,
            seed: 7,
            include_null_distribution_samples: true,
        };

        let first = assortativity_significance_response(&graph, request.clone());
        let second = assortativity_significance_response(&graph, request);

        assert_eq!(
            first.runs[0].null_distribution.samples,
            second.runs[0].null_distribution.samples
        );
        assert_eq!(
            first.runs[0].significance.z_score,
            second.runs[0].significance.z_score
        );
    }

    #[test]
    fn assortativity_null_distribution_reports_sane_stats() {
        let graph = build_test_graph();
        let response = assortativity_significance_response(
            &graph,
            AssortativitySignificanceRequest {
                graph_modes: vec!["social-path".to_string()],
                metrics: vec!["opscore".to_string()],
                min_edge_support: 2,
                min_player_match_count: 1,
                strong_tie_threshold: 3,
                permutation_count: 16,
                seed: 11,
                include_null_distribution_samples: false,
            },
        );

        let run = &response.runs[0];
        assert_eq!(run.observed.sample_size, 2);
        assert_eq!(run.null_distribution.valid_permutations, 16);
        assert!(run.null_distribution.mean.is_some());
        assert!(run.null_distribution.min.is_some());
        assert!(run.null_distribution.max.is_some());
        assert!(run.significance.empirical_percentile.is_some());
    }
}
