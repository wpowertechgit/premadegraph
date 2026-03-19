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

const CLUSTER_COUNT = 11;
const NODES_PER_CLUSTER = 20;
const WEIGHT_COST_SCALE = 1000;

function edgeKey(from: string, to: string): string {
  return [from, to].sort().join("|");
}

function buildMockGraph() {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  const clusters: string[][] = [];
  const gridColumns = 4;
  const leafIndices = new Set([18, 19]);

  for (let clusterIndex = 0; clusterIndex < CLUSTER_COUNT; clusterIndex += 1) {
    const clusterId = `mock-cluster-${clusterIndex + 1}`;
    const centerX = 18 + (clusterIndex % gridColumns) * 26;
    const centerY = 18 + Math.floor(clusterIndex / gridColumns) * 28;
    const members: string[] = [];

    for (let nodeIndex = 0; nodeIndex < NODES_PER_CLUSTER; nodeIndex += 1) {
      const angle = (nodeIndex / NODES_PER_CLUSTER) * Math.PI * 2;
      const radius = leafIndices.has(nodeIndex)
        ? 10.5 + (nodeIndex - 18) * 1.6
        : 5.5 + (nodeIndex % 4) * 1.25;
      const id = `c${clusterIndex + 1}n${nodeIndex + 1}`;
      members.push(id);
      nodes.push({
        id,
        label: `Demo${String(clusterIndex + 1).padStart(2, "0")}-${String(nodeIndex + 1).padStart(2, "0")}#MOCK`,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        clusterId,
        isBridge: nodeIndex === 0 || nodeIndex === 1,
        isStar: nodeIndex === 0,
      });
    }

    clusters.push(members);
  }

  const addEdge = (from: string, to: string, relation: RelationType, weight: number) => {
    const key = edgeKey(from, to);
    if (edgeKeys.has(key)) {
      return;
    }
    edgeKeys.add(key);
    edges.push({ from, to, relation, weight });
  };

  for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex += 1) {
    const members = clusters[clusterIndex];
    const hub = members[0];

    for (let nodeIndex = 0; nodeIndex < members.length; nodeIndex += 1) {
      if (leafIndices.has(nodeIndex)) {
        continue;
      }

      const current = members[nodeIndex];
      const next = members[(nodeIndex + 1) % members.length];
      const skip = members[(nodeIndex + 2) % members.length];
      const nextIndex = (nodeIndex + 1) % members.length;
      const skipIndex = (nodeIndex + 2) % members.length;

      if (!leafIndices.has(nextIndex)) {
        addEdge(current, next, "ally", 3 + ((clusterIndex + nodeIndex) % 4));
      }
      if (!leafIndices.has(skipIndex)) {
        addEdge(current, skip, "ally", 2 + ((clusterIndex + nodeIndex) % 3));
      }

      if (nodeIndex > 1 && nodeIndex % 3 === 0) {
        addEdge(hub, current, "ally", 4 + ((clusterIndex + nodeIndex) % 4));
      }
    }

    const fringeAnchor = members[17];
    const fringeNode = members[18];
    const leafNode = members[19];

    addEdge(hub, fringeNode, "ally", 1 + (clusterIndex % 2));
    addEdge(fringeNode, leafNode, clusterIndex % 2 === 0 ? "enemy" : "ally", 1);

    if (clusterIndex % 3 === 1) {
      addEdge(fringeAnchor, fringeNode, "enemy", 1);
    }
  }

  for (let clusterIndex = 0; clusterIndex < clusters.length - 1; clusterIndex += 1) {
    const current = clusters[clusterIndex];
    const next = clusters[clusterIndex + 1];
    addEdge(current[0], next[0], "enemy", 1 + (clusterIndex % 2));
    addEdge(current[1], next[2], "enemy", 1);
    addEdge(current[4], next[6], "ally", 2 + (clusterIndex % 3));
  }

  for (let clusterIndex = 0; clusterIndex < clusters.length - 2; clusterIndex += 1) {
    const current = clusters[clusterIndex];
    const next = clusters[clusterIndex + 2];
    addEdge(current[8], next[10], "enemy", 1);
    addEdge(current[12], next[14], "ally", 2);
  }

  addEdge(clusters[0][0], clusters[clusters.length - 1][0], "enemy", 2);
  addEdge(clusters[2][3], clusters[7][4], "enemy", 1);
  addEdge(clusters[5][5], clusters[9][6], "ally", 3);

  // Add a few explicitly unstable local structures so the mock dataset is easier to explain.
  for (const clusterIndex of [0, 3, 6, 9]) {
    const members = clusters[clusterIndex];
    addEdge(members[0], members[7], "ally", 3);
    addEdge(members[0], members[11], "ally", 2);
    addEdge(members[7], members[11], "enemy", 1);
  }

  for (const clusterIndex of [1, 5, 8]) {
    const members = clusters[clusterIndex];
    addEdge(members[2], members[9], "enemy", 1);
    addEdge(members[9], members[14], "enemy", 1);
    addEdge(members[2], members[14], "enemy", 1);
  }

  for (let clusterIndex = 0; clusterIndex < clusters.length - 1; clusterIndex += 2) {
    const currentLeaf = clusters[clusterIndex][19];
    const nextHub = clusters[clusterIndex + 1][0];
    addEdge(currentLeaf, nextHub, "enemy", 1);
  }

  return { nodes, edges };
}

const { nodes: ALL_NODES, edges: SIGNED_EDGES } = buildMockGraph();
const NODE_MAP: Record<string, GraphNode> = Object.fromEntries(
  ALL_NODES.map((node) => [node.id, node] as const),
);
const EDGE_MAP = new Map(SIGNED_EDGES.map((edge) => [edgeKey(edge.from, edge.to), edge] as const));

function buildAdjacencyForMode(pathMode: PathMode): Record<string, Neighbor[]> {
  const adjacency: Record<string, Neighbor[]> = {};
  for (const node of ALL_NODES) {
    adjacency[node.id] = [];
  }

  for (const edge of SIGNED_EDGES) {
    if (pathMode === "social-path" && edge.relation !== "ally") {
      continue;
    }
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

const ADJACENCY_BY_MODE: Record<PathMode, Record<string, Neighbor[]>> = {
  "social-path": buildAdjacencyForMode("social-path"),
  "battle-path": buildAdjacencyForMode("battle-path"),
};

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

function normalizeEdge(from: string, to: string, relation: RelationType): PathEdge {
  return { from, to, relation };
}

function relationForEdge(from: string, to: string, pathMode: PathMode): RelationType {
  const candidate = EDGE_MAP.get(edgeKey(from, to));
  if (pathMode === "social-path" && candidate?.relation === "enemy") {
    return "ally";
  }
  return candidate?.relation ?? "ally";
}

function getAllowedEdges(pathMode: PathMode): GraphEdge[] {
  return SIGNED_EDGES.filter(
    (edge) => pathMode === "battle-path" || edge.relation === "ally",
  );
}

function buildAdjacency(pathMode: PathMode): Record<string, Neighbor[]> {
  return ADJACENCY_BY_MODE[pathMode];
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
    case "astar":
      return runDijkstra(request);
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
  const runnableAlgorithms: AlgorithmId[] = ["bfs", "dijkstra", "bidirectional", "astar"];

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

  return rows;
}
