import {
  ALGORITHM_LABELS,
  type AlgorithmId,
  type ComparisonRow,
  type GraphEdge,
  type GraphNode,
  type GraphSnapshot,
  type PathEdge,
  type PathfinderRequest,
  type PathfinderRunResponse,
  type PathMode,
  type PlayerOption,
  type RelationType,
  type TraceHighlightedEdge,
  type TraceStep,
} from "./pathfinderTypes";

interface Neighbor extends GraphEdge {
  id: string;
}

interface SearchResult {
  found: boolean;
  pathNodes: string[];
  pathEdges: PathEdge[];
  visitedCount: number;
  edgesConsidered: number;
  trace: TraceStep[];
}

const NODE_MAP: Record<string, GraphNode> = {
  a: { id: "a", label: "Aster#EUNE", x: 10, y: 28 },
  b: { id: "b", label: "Breach#EUNE", x: 17, y: 20 },
  c: { id: "c", label: "Cipher#EUNE", x: 20, y: 36 },
  d: { id: "d", label: "Drift#EUNE", x: 30, y: 30 },
  e: { id: "e", label: "Ember#EUNE", x: 36, y: 18 },
  f: { id: "f", label: "Flux#EUNE", x: 38, y: 41 },
  g: { id: "g", label: "Glint#EUNE", x: 49, y: 18 },
  h: { id: "h", label: "Halo#EUNE", x: 53, y: 31 },
  i: { id: "i", label: "Ion#EUNE", x: 58, y: 12 },
  j: { id: "j", label: "Jolt#EUNE", x: 61, y: 26 },
  k: { id: "k", label: "Kite#EUNE", x: 72, y: 13 },
  l: { id: "l", label: "Lumen#EUNE", x: 76, y: 26 },
  m: { id: "m", label: "Myth#EUNE", x: 81, y: 10 },
  n: { id: "n", label: "Nova#EUNE", x: 84, y: 22 },
  o: { id: "o", label: "Onyx#EUNE", x: 88, y: 34 },
  p: { id: "p", label: "Pulse#EUNE", x: 92, y: 18 },
  q: { id: "q", label: "Quill#EUNE", x: 20, y: 66 },
  r: { id: "r", label: "Rune#EUNE", x: 30, y: 56 },
  s: { id: "s", label: "Shade#EUNE", x: 41, y: 69 },
  t: { id: "t", label: "Talon#EUNE", x: 50, y: 57 },
  u: { id: "u", label: "Umbra#EUNE", x: 61, y: 69 },
  v: { id: "v", label: "Vex#EUNE", x: 71, y: 57 },
  w: { id: "w", label: "Wisp#EUNE", x: 81, y: 67 },
  x: { id: "x", label: "Xylo#EUNE", x: 90, y: 57 },
};

const ALL_NODES = Object.values(NODE_MAP);
const WEIGHT_COST_SCALE = 1000;

const SIGNED_EDGES: GraphEdge[] = [
  { from: "a", to: "b", relation: "ally", weight: 2 },
  { from: "a", to: "c", relation: "ally", weight: 4 },
  { from: "b", to: "d", relation: "ally", weight: 3 },
  { from: "b", to: "e", relation: "ally", weight: 5 },
  { from: "c", to: "d", relation: "ally", weight: 3 },
  { from: "d", to: "f", relation: "ally", weight: 2 },
  { from: "e", to: "f", relation: "ally", weight: 4 },
  { from: "g", to: "h", relation: "ally", weight: 3 },
  { from: "g", to: "i", relation: "ally", weight: 4 },
  { from: "h", to: "j", relation: "ally", weight: 3 },
  { from: "i", to: "j", relation: "ally", weight: 2 },
  { from: "k", to: "l", relation: "ally", weight: 5 },
  { from: "k", to: "m", relation: "ally", weight: 2 },
  { from: "l", to: "n", relation: "ally", weight: 4 },
  { from: "m", to: "n", relation: "ally", weight: 3 },
  { from: "n", to: "o", relation: "ally", weight: 3 },
  { from: "o", to: "p", relation: "ally", weight: 4 },
  { from: "l", to: "o", relation: "ally", weight: 2 },
  { from: "q", to: "r", relation: "ally", weight: 5 },
  { from: "r", to: "s", relation: "ally", weight: 3 },
  { from: "s", to: "t", relation: "ally", weight: 2 },
  { from: "t", to: "u", relation: "ally", weight: 4 },
  { from: "u", to: "v", relation: "ally", weight: 3 },
  { from: "v", to: "w", relation: "ally", weight: 2 },
  { from: "w", to: "x", relation: "ally", weight: 4 },
  { from: "q", to: "s", relation: "ally", weight: 2 },
  { from: "r", to: "t", relation: "ally", weight: 2 },
  { from: "a", to: "e", relation: "enemy", weight: 1 },
  { from: "b", to: "g", relation: "enemy", weight: 1 },
  { from: "c", to: "f", relation: "enemy", weight: 1 },
  { from: "d", to: "g", relation: "enemy", weight: 2 },
  { from: "f", to: "g", relation: "enemy", weight: 1 },
  { from: "c", to: "h", relation: "enemy", weight: 1 },
  { from: "e", to: "j", relation: "enemy", weight: 1 },
  { from: "h", to: "l", relation: "enemy", weight: 2 },
  { from: "i", to: "k", relation: "enemy", weight: 1 },
  { from: "j", to: "m", relation: "enemy", weight: 1 },
  { from: "f", to: "q", relation: "enemy", weight: 1 },
  { from: "e", to: "r", relation: "enemy", weight: 1 },
  { from: "j", to: "t", relation: "enemy", weight: 1 },
  { from: "n", to: "v", relation: "enemy", weight: 1 },
  { from: "o", to: "w", relation: "enemy", weight: 2 },
  { from: "p", to: "x", relation: "enemy", weight: 1 },
];

export const mockDatasetSummary = {
  players: ALL_NODES.length,
  relationships: SIGNED_EDGES.length,
  allyRelationships: SIGNED_EDGES.filter((edge) => edge.relation === "ally").length,
  enemyRelationships: SIGNED_EDGES.filter((edge) => edge.relation === "enemy").length,
};

export const mockPlayers: PlayerOption[] = ALL_NODES.map((node) => ({
  id: node.id,
  label: node.label,
}));

function edgeKey(from: string, to: string): string {
  return [from, to].sort().join("|");
}

function normalizeEdge(from: string, to: string, relation: RelationType): PathEdge {
  return { from, to, relation };
}

function relationForEdge(from: string, to: string, pathMode: PathMode): RelationType {
  const candidate = SIGNED_EDGES.find(
    (edge) =>
      edgeKey(edge.from, edge.to) === edgeKey(from, to) &&
      (pathMode === "battle-path" || edge.relation === "ally"),
  );
  return candidate?.relation ?? "ally";
}

function getAllowedEdges(pathMode: PathMode): GraphEdge[] {
  return SIGNED_EDGES.filter(
    (edge) => pathMode === "battle-path" || edge.relation === "ally",
  );
}

function buildAdjacency(pathMode: PathMode): Record<string, Neighbor[]> {
  const adjacency: Record<string, Neighbor[]> = {};
  for (const node of ALL_NODES) {
    adjacency[node.id] = [];
  }

  for (const edge of getAllowedEdges(pathMode)) {
    adjacency[edge.from].push({ ...edge, id: edge.to });
    adjacency[edge.to].push({ ...edge, id: edge.from });
  }

  for (const nodeId of Object.keys(adjacency)) {
    adjacency[nodeId].sort((left, right) => {
      if (left.weight !== right.weight) {
        return right.weight - left.weight;
      }
      return left.id.localeCompare(right.id);
    });
  }

  return adjacency;
}

function getTraversalCost(weightedMode: boolean, edgeWeight: number): number {
  if (!weightedMode) {
    return WEIGHT_COST_SCALE;
  }

  return Math.ceil(WEIGHT_COST_SCALE / Math.max(edgeWeight, 1));
}

function createTraceStep(
  step: number,
  phase: TraceStep["phase"],
  activeNodeId: string | null,
  frontierNodeIds: Iterable<string>,
  visitedNodeIds: Iterable<string>,
  highlightedEdges: TraceHighlightedEdge[],
): TraceStep {
  return {
    step,
    phase,
    activeNodeId,
    frontierNodeIds: Array.from(frontierNodeIds),
    visitedNodeIds: Array.from(visitedNodeIds),
    highlightedEdges,
  };
}

function buildPath(
  parents: Map<string, string | null>,
  targetId: string,
  pathMode: PathMode,
): { pathNodes: string[]; pathEdges: PathEdge[] } {
  const pathNodes: string[] = [];
  let current: string | null = targetId;

  while (current) {
    pathNodes.push(current);
    current = parents.get(current) ?? null;
  }

  pathNodes.reverse();

  const pathEdges: PathEdge[] = [];
  for (let index = 0; index < pathNodes.length - 1; index += 1) {
    const from = pathNodes[index];
    const to = pathNodes[index + 1];
    pathEdges.push(normalizeEdge(from, to, relationForEdge(from, to, pathMode)));
  }

  return { pathNodes, pathEdges };
}

function runBreadthFirst(request: PathfinderRequest): SearchResult {
  const adjacency = buildAdjacency(request.pathMode);
  const queue: string[] = [request.sourcePlayerId];
  const visited = new Set<string>([request.sourcePlayerId]);
  const parents = new Map<string, string | null>([[request.sourcePlayerId, null]]);
  const trace: TraceStep[] = [];

  let step = 1;
  let edgesConsidered = 0;
  let found = false;

  while (queue.length > 0 && step <= request.options.maxSteps) {
    const current = queue.shift() as string;
    trace.push(createTraceStep(step, "expand", current, queue, visited, []));
    step += 1;

    for (const neighbor of adjacency[current]) {
      if (step > request.options.maxSteps) {
        break;
      }

      edgesConsidered += 1;
      const isNew = !visited.has(neighbor.id);

      if (isNew) {
        visited.add(neighbor.id);
        parents.set(neighbor.id, current);
        queue.push(neighbor.id);
      }

      trace.push(
        createTraceStep(step, "discover", current, queue, visited, [
          {
            from: current,
            to: neighbor.id,
            relation: neighbor.relation,
            state: isNew ? "exploring" : "seen",
          },
        ]),
      );
      step += 1;

      if (neighbor.id === request.targetPlayerId && isNew) {
        found = true;
        queue.length = 0;
        break;
      }
    }
  }

  if (!found) {
    trace.push(createTraceStep(step, "complete", null, [], visited, []));
    return {
      found: false,
      pathNodes: [],
      pathEdges: [],
      visitedCount: visited.size,
      edgesConsidered,
      trace,
    };
  }

  const { pathNodes, pathEdges } = buildPath(parents, request.targetPlayerId, request.pathMode);
  trace.push(
    createTraceStep(step, "resolve", request.targetPlayerId, [], visited, pathEdges.map((edge) => ({
      ...edge,
      state: "resolved",
    }))),
  );

  return {
    found: true,
    pathNodes,
    pathEdges,
    visitedCount: visited.size,
    edgesConsidered,
    trace,
  };
}

function runDijkstra(request: PathfinderRequest): SearchResult {
  const adjacency = buildAdjacency(request.pathMode);
  const distances = new Map<string, number>([[request.sourcePlayerId, 0]]);
  const parents = new Map<string, string | null>([[request.sourcePlayerId, null]]);
  const seen = new Set<string>();
  const frontier = [{ id: request.sourcePlayerId, cost: 0 }];
  const trace: TraceStep[] = [];

  let step = 1;
  let edgesConsidered = 0;
  let found = false;

  while (frontier.length > 0 && step <= request.options.maxSteps) {
    frontier.sort((left, right) => left.cost - right.cost || left.id.localeCompare(right.id));
    const current = frontier.shift() as { id: string; cost: number };

    if (seen.has(current.id)) {
      continue;
    }

    seen.add(current.id);
    trace.push(
      createTraceStep(
        step,
        "expand",
        current.id,
        frontier.map((item) => item.id),
        seen,
        [],
      ),
    );
    step += 1;

    if (current.id === request.targetPlayerId) {
      found = true;
      break;
    }

    for (const neighbor of adjacency[current.id]) {
      if (step > request.options.maxSteps) {
        break;
      }

      edgesConsidered += 1;
      const nextCost = current.cost + getTraversalCost(request.weightedMode, neighbor.weight);
      const knownCost = distances.get(neighbor.id);
      const improved = knownCost === undefined || nextCost < knownCost;

      if (improved) {
        distances.set(neighbor.id, nextCost);
        parents.set(neighbor.id, current.id);
        frontier.push({ id: neighbor.id, cost: nextCost });
      }

      trace.push(
        createTraceStep(
          step,
          "discover",
          current.id,
          frontier.map((item) => item.id),
          seen,
          [
            {
              from: current.id,
              to: neighbor.id,
              relation: neighbor.relation,
              state: improved ? "exploring" : "seen",
            },
          ],
        ),
      );
      step += 1;
    }
  }

  if (!found) {
    trace.push(createTraceStep(step, "complete", null, [], seen, []));
    return {
      found: false,
      pathNodes: [],
      pathEdges: [],
      visitedCount: seen.size,
      edgesConsidered,
      trace,
    };
  }

  const { pathNodes, pathEdges } = buildPath(parents, request.targetPlayerId, request.pathMode);
  trace.push(
    createTraceStep(step, "resolve", request.targetPlayerId, [], seen, pathEdges.map((edge) => ({
      ...edge,
      state: "resolved",
    }))),
  );

  return {
    found: true,
    pathNodes,
    pathEdges,
    visitedCount: seen.size,
    edgesConsidered,
    trace,
  };
}

function runBidirectional(request: PathfinderRequest): SearchResult {
  const adjacency = buildAdjacency(request.pathMode);
  const sourceQueue: string[] = [request.sourcePlayerId];
  const targetQueue: string[] = [request.targetPlayerId];
  const sourceVisited = new Set<string>([request.sourcePlayerId]);
  const targetVisited = new Set<string>([request.targetPlayerId]);
  const sourceParents = new Map<string, string | null>([[request.sourcePlayerId, null]]);
  const targetParents = new Map<string, string | null>([[request.targetPlayerId, null]]);
  const trace: TraceStep[] = [];

  let step = 1;
  let edgesConsidered = 0;
  let meetingNode: string | null = null;

  const expandFrontier = (
    queue: string[],
    ownVisited: Set<string>,
    otherVisited: Set<string>,
    ownParents: Map<string, string | null>,
  ) => {
    if (queue.length === 0 || step > request.options.maxSteps) {
      return;
    }

    const current = queue.shift() as string;
    trace.push(
      createTraceStep(
        step,
        "expand",
        current,
        [...queue, ...targetQueue],
        new Set<string>([...sourceVisited, ...targetVisited]),
        [],
      ),
    );
    step += 1;

    for (const neighbor of adjacency[current]) {
      if (step > request.options.maxSteps) {
        break;
      }

      edgesConsidered += 1;
      const isNew = !ownVisited.has(neighbor.id);

      if (isNew) {
        ownVisited.add(neighbor.id);
        ownParents.set(neighbor.id, current);
        queue.push(neighbor.id);
      }

      trace.push(
        createTraceStep(
          step,
          "discover",
          current,
          [...queue, ...targetQueue],
          new Set<string>([...sourceVisited, ...targetVisited]),
          [
            {
              from: current,
              to: neighbor.id,
              relation: neighbor.relation,
              state: isNew ? "exploring" : "seen",
            },
          ],
        ),
      );
      step += 1;

      if (otherVisited.has(neighbor.id)) {
        meetingNode = neighbor.id;
        return;
      }
    }
  };

  while (
    sourceQueue.length > 0 &&
    targetQueue.length > 0 &&
    !meetingNode &&
    step <= request.options.maxSteps
  ) {
    expandFrontier(sourceQueue, sourceVisited, targetVisited, sourceParents);
    if (meetingNode) {
      break;
    }
    expandFrontier(targetQueue, targetVisited, sourceVisited, targetParents);
  }

  const combinedVisited = new Set<string>([...sourceVisited, ...targetVisited]);

  if (!meetingNode) {
    trace.push(createTraceStep(step, "complete", null, [], combinedVisited, []));
    return {
      found: false,
      pathNodes: [],
      pathEdges: [],
      visitedCount: combinedVisited.size,
      edgesConsidered,
      trace,
    };
  }

  const leftNodes: string[] = [];
  let currentLeft: string | null = meetingNode;
  while (currentLeft) {
    leftNodes.push(currentLeft);
    currentLeft = sourceParents.get(currentLeft) ?? null;
  }
  leftNodes.reverse();

  const rightNodes: string[] = [];
  let currentRight = targetParents.get(meetingNode) ?? null;
  while (currentRight) {
    rightNodes.push(currentRight);
    currentRight = targetParents.get(currentRight) ?? null;
  }

  const pathNodes = [...leftNodes, ...rightNodes];
  const pathEdges: PathEdge[] = [];
  for (let index = 0; index < pathNodes.length - 1; index += 1) {
    const from = pathNodes[index];
    const to = pathNodes[index + 1];
    pathEdges.push(normalizeEdge(from, to, relationForEdge(from, to, request.pathMode)));
  }

  trace.push(
    createTraceStep(step, "resolve", meetingNode, [], combinedVisited, pathEdges.map((edge) => ({
      ...edge,
      state: "resolved",
    }))),
  );

  return {
    found: true,
    pathNodes,
    pathEdges,
    visitedCount: combinedVisited.size,
    edgesConsidered,
    trace,
  };
}

function getScenarioId(request: PathfinderRequest, result: SearchResult): string {
  if (request.sourcePlayerId === request.targetPlayerId) {
    return "same_player";
  }
  if (request.pathMode === "social-path" && result.found) {
    return "friend_only_connected";
  }
  if (request.pathMode === "social-path" && !result.found) {
    return "friend_only_disconnected";
  }
  return "battle_path_shorter";
}

function pickSearch(request: PathfinderRequest): SearchResult {
  if (request.sourcePlayerId === request.targetPlayerId) {
    return {
      found: true,
      pathNodes: [request.sourcePlayerId],
      pathEdges: [],
      visitedCount: 1,
      edgesConsidered: 0,
      trace: [],
    };
  }

  switch (request.algorithm) {
    case "bfs":
      return runBreadthFirst(request);
    case "dijkstra":
      return runDijkstra(request);
    case "bidirectional":
      return runBidirectional(request);
    default:
      return {
        found: false,
        pathNodes: [],
        pathEdges: [],
        visitedCount: 0,
        edgesConsidered: 0,
        trace: [],
      };
  }
}

function makeRuntime(algorithm: AlgorithmId, traceLength: number, found: boolean): number {
  const base = algorithm === "bidirectional" ? 1.9 : algorithm === "dijkstra" ? 2.8 : 2.4;
  const traceCost = traceLength * 0.17;
  const outcomeBias = found ? 0.4 : 0.8;
  return Number((base + traceCost + outcomeBias).toFixed(1));
}

export function getMockGraphSnapshot(
  pathMode: PathMode,
  sourceId: string,
  targetId: string,
): GraphSnapshot {
  const edges = getAllowedEdges(pathMode);
  const visibleNodeIds = new Set<string>([sourceId, targetId]);

  for (const edge of edges) {
    visibleNodeIds.add(edge.from);
    visibleNodeIds.add(edge.to);
  }

  return {
    nodes: ALL_NODES.filter((node) => visibleNodeIds.has(node.id)),
    edges,
  };
}

function buildResponse(request: PathfinderRequest): PathfinderRunResponse {
  const baseRequest = {
    sourcePlayerId: request.sourcePlayerId,
    targetPlayerId: request.targetPlayerId,
    algorithm: request.algorithm,
    pathMode: request.pathMode,
    weightedMode: request.weightedMode,
  };

  if (!NODE_MAP[request.sourcePlayerId] || !NODE_MAP[request.targetPlayerId]) {
    return {
      request: baseRequest,
      status: "invalid_input",
      summary: {
      pathLength: 0,
        nodesVisited: 0,
        edgesConsidered: 0,
        runtimeMs: 0,
        backendRuntimeMs: 0,
        traceStepCount: 0,
      },
      path: { nodes: [], edges: [] },
      trace: [],
      graphSnapshot: { nodes: [], edges: [] },
      warnings: ["The selected player does not exist in the current dataset."],
    };
  }

  if (request.algorithm === "astar") {
    return {
      request: baseRequest,
      status: "invalid_input",
      summary: {
        pathLength: 0,
        nodesVisited: 0,
        edgesConsidered: 0,
        runtimeMs: 0,
        backendRuntimeMs: 0,
        traceStepCount: 0,
      },
      path: { nodes: [], edges: [] },
      trace: [],
      graphSnapshot: getMockGraphSnapshot(request.pathMode, request.sourcePlayerId, request.targetPlayerId),
      warnings: ["A* is not enabled yet for this search view."],
    };
  }

  const result = pickSearch(request);
  const runtimeMs = makeRuntime(request.algorithm, result.trace.length, result.found);
  const scenarioId = getScenarioId(request, result);

  const warnings: string[] = [];
  if (scenarioId === "friend_only_disconnected") {
    warnings.push("No friend-only route is available in the current graph.");
    warnings.push("Try battle-path to include enemy edges.");
  }
  if (scenarioId === "battle_path_shorter") {
    warnings.push("Enemy edges are enabled in this run and may shorten the route.");
  }
  if (request.algorithm === "dijkstra" && request.weightedMode) {
    warnings.push("Weighted Dijkstra treats stronger repeated connections as cheaper edges.");
  }

  return {
    request: baseRequest,
    status:
      request.sourcePlayerId === request.targetPlayerId
        ? "same_source_target"
        : result.found
          ? "found"
          : "not_found",
    summary: {
      pathLength: Math.max(result.pathNodes.length - 1, 0),
      nodesVisited: result.visitedCount,
      edgesConsidered: result.edgesConsidered,
      runtimeMs,
      backendRuntimeMs: runtimeMs,
      traceStepCount: result.trace.length,
    },
    path: {
      nodes: result.pathNodes,
      edges: result.pathEdges,
    },
    trace: result.trace,
    graphSnapshot: getMockGraphSnapshot(request.pathMode, request.sourcePlayerId, request.targetPlayerId),
    warnings,
  };
}

export function runPathfinderMock(
  request: PathfinderRequest,
): Promise<PathfinderRunResponse> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(buildResponse(request)), 220);
  });
}

function describeRelativeNote(
  socialRun: PathfinderRunResponse,
  battleRun: PathfinderRunResponse,
  currentMode: PathMode,
): string {
  if (battleRun.status === "found" && socialRun.status !== "found") {
    return "enemy edges create connectivity";
  }

  if (battleRun.status === "found" && socialRun.status === "found") {
    if (battleRun.summary.pathLength < socialRun.summary.pathLength) {
      return "shorter with enemy edges";
    }
    if (battleRun.summary.pathLength === socialRun.summary.pathLength) {
      return "no gain from enemy edges";
    }
  }

  return currentMode === "battle-path"
    ? "battle-path mirrors social-path here"
    : "social-only route is the current baseline";
}

export function getComparisonRows(
  sourcePlayerId: string,
  targetPlayerId: string,
  currentMode: PathMode,
  weightedMode: boolean,
): ComparisonRow[] {
  const runnableAlgorithms: AlgorithmId[] = ["bfs", "dijkstra", "bidirectional"];

  const rows = runnableAlgorithms.map((algorithm) => {
    const socialRun = buildResponse({
      sourcePlayerId,
      targetPlayerId,
      algorithm,
      pathMode: "social-path",
      weightedMode,
      options: {
        includeTrace: true,
        maxSteps: 5000,
      },
    });
    const battleRun = buildResponse({
      sourcePlayerId,
      targetPlayerId,
      algorithm,
      pathMode: "battle-path",
      weightedMode,
      options: {
        includeTrace: true,
        maxSteps: 5000,
      },
    });
    const activeRun = currentMode === "social-path" ? socialRun : battleRun;

    return {
      algorithm,
      label: ALGORITHM_LABELS[algorithm],
      supportedNow: true,
      pathFound: activeRun.status === "found" || activeRun.status === "same_source_target",
      pathLength: activeRun.summary.pathLength,
      nodesVisited: activeRun.summary.nodesVisited,
      runtimeMs: activeRun.summary.runtimeMs,
      relativeNote: describeRelativeNote(socialRun, battleRun, currentMode),
    };
  });

  rows.push({
    algorithm: "astar",
    label: ALGORITHM_LABELS.astar,
    supportedNow: false,
    pathFound: null,
    pathLength: null,
    nodesVisited: null,
    runtimeMs: null,
    relativeNote: "coming later, pending heuristic",
  });

  return rows;
}
