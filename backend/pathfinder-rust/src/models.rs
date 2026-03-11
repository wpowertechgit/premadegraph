use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub x: f64,
    pub y: f64,
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
pub struct PathfinderOptions {
    pub includeTrace: bool,
    pub maxSteps: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathfinderRequest {
    pub sourcePlayerId: String,
    pub targetPlayerId: String,
    pub algorithm: String,
    pub pathMode: String,
    pub weightedMode: bool,
    pub options: PathfinderOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompareRequest {
    pub sourcePlayerId: String,
    pub targetPlayerId: String,
    pub pathMode: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlayerOption {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DatasetSummary {
    pub players: usize,
    pub relationships: usize,
    pub allyRelationships: usize,
    pub enemyRelationships: usize,
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
pub struct TraceStep {
    pub step: usize,
    pub phase: String,
    pub activeNodeId: Option<String>,
    pub frontierNodeIds: Vec<String>,
    pub visitedNodeIds: Vec<String>,
    pub highlightedEdges: Vec<TraceHighlightedEdge>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PathfinderSummary {
    pub pathLength: usize,
    pub nodesVisited: usize,
    pub edgesConsidered: usize,
    pub runtimeMs: f64,
    pub backendRuntimeMs: f64,
    pub traceStepCount: usize,
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
pub struct RequestEcho {
    pub sourcePlayerId: String,
    pub targetPlayerId: String,
    pub algorithm: String,
    pub pathMode: String,
    pub weightedMode: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PathfinderResponse {
    pub request: RequestEcho,
    pub status: String,
    pub summary: PathfinderSummary,
    pub path: PathfinderPath,
    pub trace: Vec<TraceStep>,
    pub graphSnapshot: GraphSnapshot,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ComparisonRow {
    pub algorithm: String,
    pub label: String,
    pub supportedNow: bool,
    pub pathFound: Option<bool>,
    pub pathLength: Option<usize>,
    pub nodesVisited: Option<usize>,
    pub runtimeMs: Option<f64>,
    pub relativeNote: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompareResponse {
    pub rows: Vec<ComparisonRow>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OptionsResponse {
    pub executionMode: String,
    pub players: Vec<PlayerOption>,
    pub datasetSummary: DatasetSummary,
    pub supportedAlgorithms: Vec<String>,
    pub previewSnapshot: GraphSnapshot,
}

#[derive(Debug, Clone, Serialize)]
pub struct EngineSpecResponse {
    pub executionMode: String,
    pub requestContract: serde_json::Value,
    pub responseContract: serde_json::Value,
    pub signedGraphModel: serde_json::Value,
    pub integrationPath: serde_json::Value,
}
