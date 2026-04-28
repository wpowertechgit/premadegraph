use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub x: f64,
    pub y: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cluster_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_bridge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_star: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
    pub relation: String,
    pub weight: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrototypeDataset {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathfinderOptions {
    pub include_trace: bool,
    pub max_steps: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathfinderRequest {
    pub source_player_id: String,
    pub target_player_id: String,
    pub algorithm: String,
    pub path_mode: String,
    #[serde(default)]
    pub weighted_mode: bool,
    pub options: PathfinderOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareRequest {
    pub source_player_id: String,
    pub target_player_id: String,
    pub path_mode: String,
    #[serde(default)]
    pub weighted_mode: bool,
}

fn default_signed_balance_min_edge_support() -> u32 {
    2
}

fn default_signed_balance_top_nodes() -> usize {
    10
}

fn default_assortativity_min_edge_support() -> u32 {
    1
}

fn default_assortativity_min_player_match_count() -> u32 {
    1
}

fn default_assortativity_strong_tie_threshold() -> u32 {
    3
}

fn default_balance_sweep_edge_supports() -> Vec<u32> {
    vec![1, 2, 3, 4]
}

fn default_balance_sweep_tie_policies() -> Vec<SignedTiePolicy> {
    vec![
        SignedTiePolicy::Exclude,
        SignedTiePolicy::Ally,
        SignedTiePolicy::Enemy,
    ]
}

fn default_assortativity_significance_graph_modes() -> Vec<String> {
    vec!["social-path".to_string(), "battle-path".to_string()]
}

fn default_assortativity_significance_metrics() -> Vec<String> {
    vec!["opscore".to_string(), "feedscore".to_string()]
}

fn default_assortativity_permutation_count() -> usize {
    100
}

fn default_assortativity_seed() -> u64 {
    42
}

fn default_betweenness_path_mode() -> String {
    "battle-path".to_string()
}

fn default_betweenness_min_edge_support() -> u32 {
    1
}

fn default_betweenness_top_nodes() -> usize {
    20
}

fn default_betweenness_parallel() -> bool {
    true
}

fn default_betweenness_weighted() -> bool {
    true
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SignedTiePolicy {
    Exclude,
    Ally,
    Enemy,
}

impl Default for SignedTiePolicy {
    fn default() -> Self {
        Self::Exclude
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBalanceRequest {
    #[serde(default = "default_signed_balance_min_edge_support")]
    pub min_edge_support: u32,
    #[serde(default)]
    pub tie_policy: SignedTiePolicy,
    #[serde(default = "default_signed_balance_top_nodes")]
    pub max_top_nodes: usize,
    #[serde(default = "default_true")]
    pub include_cluster_summaries: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssortativityRequest {
    #[serde(default = "default_assortativity_min_edge_support")]
    pub min_edge_support: u32,
    #[serde(default = "default_assortativity_min_player_match_count")]
    pub min_player_match_count: u32,
    #[serde(default = "default_assortativity_strong_tie_threshold")]
    pub strong_tie_threshold: u32,
    #[serde(default = "default_true")]
    pub include_cluster_breakdown: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBalanceSweepRequest {
    #[serde(default = "default_balance_sweep_edge_supports")]
    pub min_edge_supports: Vec<u32>,
    #[serde(default = "default_balance_sweep_tie_policies")]
    pub tie_policies: Vec<SignedTiePolicy>,
    #[serde(default = "default_signed_balance_top_nodes")]
    pub max_top_nodes: usize,
    #[serde(default)]
    pub include_cluster_summaries: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssortativitySignificanceRequest {
    #[serde(default = "default_assortativity_significance_graph_modes")]
    pub graph_modes: Vec<String>,
    #[serde(default = "default_assortativity_significance_metrics")]
    pub metrics: Vec<String>,
    #[serde(default = "default_assortativity_min_edge_support")]
    pub min_edge_support: u32,
    #[serde(default = "default_assortativity_min_player_match_count")]
    pub min_player_match_count: u32,
    #[serde(default = "default_assortativity_strong_tie_threshold")]
    pub strong_tie_threshold: u32,
    #[serde(default = "default_assortativity_permutation_count")]
    pub permutation_count: usize,
    #[serde(default = "default_assortativity_seed")]
    pub seed: u64,
    #[serde(default)]
    pub include_null_distribution_samples: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BetweennessCentralityRequest {
    #[serde(default = "default_betweenness_path_mode")]
    pub path_mode: String,
    #[serde(default = "default_betweenness_weighted")]
    pub weighted_mode: bool,
    #[serde(default = "default_betweenness_min_edge_support")]
    pub min_edge_support: u32,
    #[serde(default = "default_betweenness_top_nodes")]
    pub max_top_nodes: usize,
    #[serde(default = "default_betweenness_parallel")]
    pub parallel: bool,
    #[serde(default)]
    pub run_serial_baseline: bool,
    #[serde(default)]
    pub include_full_results: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlayerOption {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatasetSummary {
    pub players: usize,
    pub relationships: usize,
    pub ally_relationships: usize,
    pub enemy_relationships: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct PathEdge {
    pub from: String,
    pub to: String,
    pub relation: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TraceHighlightedEdge {
    pub from: String,
    pub to: String,
    pub relation: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceStep {
    pub step: usize,
    pub phase: String,
    pub active_node_id: Option<String>,
    pub frontier_node_ids: Vec<String>,
    pub visited_node_ids: Vec<String>,
    pub highlighted_edges: Vec<TraceHighlightedEdge>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathfinderSummary {
    pub path_length: usize,
    pub nodes_visited: usize,
    pub edges_considered: usize,
    pub runtime_ms: f64,
    pub backend_runtime_ms: f64,
    pub graph_build_ms: f64,
    pub search_runtime_ms: f64,
    pub response_assembly_ms: f64,
    pub total_runtime_ms: f64,
    pub trace_step_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct PathfinderPath {
    pub nodes: Vec<String>,
    pub edges: Vec<PathEdge>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GraphSnapshot {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterSummary {
    pub cluster_id: String,
    pub cluster_type: String,
    pub algorithm: String,
    pub size: usize,
    pub best_op: Option<String>,
    pub worst_feed: Option<String>,
    pub center_x: f64,
    pub center_y: f64,
    pub highlighted_members: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestEcho {
    pub source_player_id: String,
    pub target_player_id: String,
    pub algorithm: String,
    pub path_mode: String,
    pub weighted_mode: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathfinderResponse {
    pub request: RequestEcho,
    pub status: String,
    pub summary: PathfinderSummary,
    pub path: PathfinderPath,
    pub trace: Vec<TraceStep>,
    pub graph_snapshot: GraphSnapshot,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonRow {
    pub algorithm: String,
    pub label: String,
    pub supported_now: bool,
    pub path_found: Option<bool>,
    pub path_length: Option<usize>,
    pub nodes_visited: Option<usize>,
    pub runtime_ms: Option<f64>,
    pub relative_note: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompareResponse {
    pub rows: Vec<ComparisonRow>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionsResponse {
    pub execution_mode: String,
    pub players: Vec<PlayerOption>,
    pub dataset_summary: DatasetSummary,
    pub supported_algorithms: Vec<String>,
    pub preview_snapshot: GraphSnapshot,
    pub cluster_summaries: Vec<ClusterSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalViewResponse {
    pub cluster_summaries: Vec<ClusterSummary>,
    pub snapshot: GraphSnapshot,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerFocusResponse {
    pub player: PlayerOption,
    pub cluster_id: Option<String>,
    pub snapshot: GraphSnapshot,
    pub related_clusters: Vec<ClusterSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineSpecResponse {
    pub execution_mode: String,
    pub request_contract: serde_json::Value,
    pub response_contract: serde_json::Value,
    pub signed_graph_model: serde_json::Value,
    pub integration_path: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBalanceDecisions {
    pub graph_scope: String,
    pub edge_projection: String,
    pub support_measure: String,
    pub canonical_positive_sign: String,
    pub canonical_negative_sign: String,
    pub sign_rule: String,
    pub tie_policy: SignedTiePolicy,
    pub min_edge_support: u32,
    pub valid_triad_rule: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBalanceGraphSummary {
    pub filtered_nodes: usize,
    pub projected_nodes: usize,
    pub candidate_edges: usize,
    pub analyzed_edges: usize,
    pub excluded_low_support_edges: usize,
    pub excluded_tied_edges: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBalanceTriadSummary {
    pub total_analyzed: usize,
    pub balanced_count: usize,
    pub unbalanced_count: usize,
    pub balanced_ratio: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SignedTriadTypeCount {
    pub triad_type: String,
    pub balanced: bool,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedTriadExampleNode {
    pub player_id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedTriadExampleEdge {
    pub from: String,
    pub to: String,
    pub sign: i8,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedTriadExample {
    pub triad_type: String,
    pub balanced: bool,
    pub nodes: Vec<SignedTriadExampleNode>,
    pub edges: Vec<SignedTriadExampleEdge>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBalanceNodeSummary {
    pub player_id: String,
    pub label: String,
    pub total_triads: usize,
    pub unbalanced_triads: usize,
    pub instability_score: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBalanceClusterSummary {
    pub cluster_id: String,
    pub size: usize,
    pub local_triads: usize,
    pub balanced_count: usize,
    pub unbalanced_count: usize,
    pub balanced_ratio: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBalanceResponse {
    pub status: String,
    pub decisions: SignedBalanceDecisions,
    pub graph_summary: SignedBalanceGraphSummary,
    pub triads: SignedBalanceTriadSummary,
    pub triad_type_distribution: Vec<SignedTriadTypeCount>,
    pub example_triads: Vec<SignedTriadExample>,
    pub top_unbalanced_nodes: Vec<SignedBalanceNodeSummary>,
    pub cluster_summaries: Vec<SignedBalanceClusterSummary>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssortativityDecisions {
    pub graph_scope: String,
    pub graph_modes: Vec<String>,
    pub metrics: Vec<String>,
    pub graph_mode_rule: String,
    pub node_eligibility_rule: String,
    pub assortativity_formula: String,
    pub min_edge_support: u32,
    pub min_player_match_count: u32,
    pub strong_tie_threshold: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssortativitySample {
    pub coefficient: Option<f64>,
    pub sample_size: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssortativityMetricResult {
    pub graph_mode: String,
    pub metric: String,
    pub eligible_nodes: usize,
    pub candidate_edges: usize,
    pub analyzed_edges: usize,
    pub skipped_low_edge_support_edges: usize,
    pub skipped_missing_metric_edges: usize,
    pub skipped_low_match_count_edges: usize,
    pub global: AssortativitySample,
    pub within_cluster: AssortativitySample,
    pub cross_cluster: AssortativitySample,
    pub strong_ties: AssortativitySample,
    pub weak_ties: AssortativitySample,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssortativityResponse {
    pub status: String,
    pub decisions: AssortativityDecisions,
    pub results: Vec<AssortativityMetricResult>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExperimentDatasetSummary {
    pub filtered_nodes: usize,
    pub runtime_nodes: usize,
    pub pair_relations: usize,
    pub dataset_edges: usize,
    pub runtime_clusters: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExperimentMetadata {
    pub analysis_type: String,
    pub schema_version: String,
    pub generated_at_unix_ms: u64,
    pub dataset_scope: String,
    pub graph_scope: String,
    pub seed: Option<u64>,
    pub run_count: usize,
    pub dataset_summary: ExperimentDatasetSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBalanceSweepParameters {
    pub min_edge_support: u32,
    pub tie_policy: SignedTiePolicy,
    pub include_cluster_summaries: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBalanceSweepRun {
    pub run_index: usize,
    pub parameters: SignedBalanceSweepParameters,
    pub graph_summary: SignedBalanceGraphSummary,
    pub triads: SignedBalanceTriadSummary,
    pub triad_type_distribution: Vec<SignedTriadTypeCount>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBalanceSweepSummary {
    pub min_balanced_ratio: f64,
    pub max_balanced_ratio: f64,
    pub mean_balanced_ratio: f64,
    pub runs_with_triads: usize,
    pub no_triad_runs: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBalanceSweepResponse {
    pub status: String,
    pub metadata: ExperimentMetadata,
    pub parameter_grid: serde_json::Value,
    pub summary: SignedBalanceSweepSummary,
    pub runs: Vec<SignedBalanceSweepRun>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssortativitySignificanceObserved {
    pub coefficient: Option<f64>,
    pub sample_size: usize,
    pub eligible_nodes: usize,
    pub candidate_edges: usize,
    pub analyzed_edges: usize,
    pub skipped_low_edge_support_edges: usize,
    pub skipped_missing_metric_edges: usize,
    pub skipped_low_match_count_edges: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssortativityNullDistributionSummary {
    pub mean: Option<f64>,
    pub stddev: Option<f64>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub valid_permutations: usize,
    pub undefined_permutations: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub samples: Option<Vec<Option<f64>>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssortativitySignificanceStats {
    pub empirical_percentile: Option<f64>,
    pub empirical_upper_tail_p_value: Option<f64>,
    pub empirical_two_sided_p_value: Option<f64>,
    pub z_score: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssortativitySignificanceRun {
    pub run_index: usize,
    pub graph_mode: String,
    pub metric: String,
    pub observed: AssortativitySignificanceObserved,
    pub permutation_count: usize,
    pub null_distribution: AssortativityNullDistributionSummary,
    pub significance: AssortativitySignificanceStats,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssortativitySignificanceResponse {
    pub status: String,
    pub metadata: ExperimentMetadata,
    pub parameter_grid: serde_json::Value,
    pub null_model: serde_json::Value,
    pub runs: Vec<AssortativitySignificanceRun>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BetweennessCentralityDecisions {
    pub graph_scope: String,
    pub algorithm: String,
    pub parallelization: String,
    pub graph_mode: String,
    pub weighted_mode: bool,
    pub edge_support_rule: String,
    pub edge_cost_rule: String,
    pub normalization_rule: String,
    pub min_edge_support: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BetweennessCentralityGraphSummary {
    pub runtime_nodes: usize,
    pub projected_nodes: usize,
    pub candidate_edges: usize,
    pub analyzed_edges: usize,
    pub skipped_low_support_edges: usize,
    pub skipped_invalid_edges: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BetweennessCentralityRuntime {
    pub algorithm_runtime_ms: f64,
    pub serial_runtime_ms: Option<f64>,
    pub parallel_runtime_ms: Option<f64>,
    pub speedup: Option<f64>,
    pub rayon_threads: usize,
    pub parallel_chunks: usize,
    pub serial_parallel_max_abs_delta: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BetweennessCentralityNodeResult {
    pub rank: usize,
    pub player_id: String,
    pub label: String,
    pub cluster_id: Option<String>,
    pub degree: usize,
    pub weighted_strength: u32,
    pub raw_betweenness: f64,
    pub normalized_betweenness: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BetweennessCentralityResponse {
    pub status: String,
    pub decisions: BetweennessCentralityDecisions,
    pub graph_summary: BetweennessCentralityGraphSummary,
    pub runtime: BetweennessCentralityRuntime,
    pub top_nodes: Vec<BetweennessCentralityNodeResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_results: Option<Vec<BetweennessCentralityNodeResult>>,
    pub warnings: Vec<String>,
}
