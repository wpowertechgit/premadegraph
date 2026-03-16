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
