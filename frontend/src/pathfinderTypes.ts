export type AlgorithmId = "bfs" | "dijkstra" | "bidirectional" | "astar";
export type PathMode = "social-path" | "battle-path";
export type RelationType = "ally" | "enemy";
export type RunStatus = "found" | "not_found" | "same_source_target" | "invalid_input";
export type PlaybackState = "idle" | "ready" | "playing" | "paused" | "finished";
export type TracePhase = "discover" | "expand" | "resolve" | "complete";
export type EdgeHighlightState = "exploring" | "seen" | "resolved";

export interface PathfinderRequest {
  sourcePlayerId: string;
  targetPlayerId: string;
  algorithm: AlgorithmId;
  pathMode: PathMode;
  weightedMode: boolean;
  options: {
    includeTrace: boolean;
    maxSteps: number;
  };
}

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: RelationType;
  weight: number;
}

export interface PathEdge {
  from: string;
  to: string;
  relation: RelationType;
}

export interface TraceHighlightedEdge extends PathEdge {
  state: EdgeHighlightState;
}

export interface TraceStep {
  step: number;
  phase: TracePhase;
  activeNodeId: string | null;
  frontierNodeIds: string[];
  visitedNodeIds: string[];
  highlightedEdges: TraceHighlightedEdge[];
}

export interface PathfinderRunResponse {
  request: Omit<PathfinderRequest, "options">;
  status: RunStatus;
  summary: {
    pathLength: number;
    nodesVisited: number;
    edgesConsidered: number;
    runtimeMs: number;
    backendRuntimeMs: number;
    traceStepCount: number;
  };
  path: {
    nodes: string[];
    edges: PathEdge[];
  };
  trace: TraceStep[];
  graphSnapshot: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  warnings: string[];
}

export interface PlayerOption {
  id: string;
  label: string;
}

export interface ComparisonRow {
  algorithm: AlgorithmId;
  label: string;
  supportedNow: boolean;
  pathFound: boolean | null;
  pathLength: number | null;
  nodesVisited: number | null;
  runtimeMs: number | null;
  relativeNote: string;
}

export interface CanvasFrame {
  stepNumber: number;
  activeNodeId: string | null;
  frontierNodeIds: string[];
  visitedNodeIds: string[];
  revealedNodeIds: string[];
  revealedEdgeKeys: string[];
  edgeStateByKey: Record<string, EdgeHighlightState | "visible">;
  pathNodeIds: string[];
  pathEdgeKeys: string[];
  isTerminal: boolean;
  phase: TracePhase | null;
}

export const ALGORITHM_LABELS: Record<AlgorithmId, string> = {
  bfs: "BFS",
  dijkstra: "Dijkstra",
  bidirectional: "Bidirectional",
  astar: "A*",
};

export const PATH_MODE_LABELS: Record<PathMode, string> = {
  "social-path": "Social Path",
  "battle-path": "Battle Path",
};

export const STATUS_LABELS: Record<RunStatus, string> = {
  found: "Found",
  not_found: "No path found",
  same_source_target: "Same source and target",
  invalid_input: "Invalid input",
};
