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

interface MockMatch {
  blue: string[];
  red: string[];
}

const MOCK_CLUSTER_SIZES = [20, 18, 8, 4, 3, 12, 2, 16, 6, 14, 9];
const WEIGHT_COST_SCALE = 1000;

function edgeKey(from: string, to: string): string {
  return [from, to].sort().join("|");
}

function pickWindow(members: string[], start: number, count: number): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < members.length && result.length < count; offset += 1) {
    const candidate = members[(start + offset) % members.length];
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    result.push(candidate);
  }
  return result;
}

function buildTeam(...groups: string[][]): string[] {
  const team: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const playerId of group) {
      if (seen.has(playerId)) {
        continue;
      }
      seen.add(playerId);
      team.push(playerId);
      if (team.length === 5) {
        return team;
      }
    }
  }

  if (team.length !== 5) {
    throw new Error(`Mock match team construction failed. Expected 5 unique players, got ${team.length}.`);
  }

  return team;
}

function pickUnique(
  pool: string[],
  start: number,
  count: number,
  banned: Iterable<string> = [],
): string[] {
  const result: string[] = [];
  const blocked = new Set<string>(banned);

  for (let offset = 0; offset < pool.length && result.length < count; offset += 1) {
    const candidate = pool[(start + offset) % pool.length];
    if (blocked.has(candidate)) {
      continue;
    }
    blocked.add(candidate);
    result.push(candidate);
  }

  return result;
}

function buildPairStats(matches: MockMatch[]): Map<string, { ally: number; enemy: number }> {
  const pairStats = new Map<string, { ally: number; enemy: number }>();

  const bumpPair = (left: string, right: string, field: "ally" | "enemy") => {
    const key = edgeKey(left, right);
    const stats = pairStats.get(key) ?? { ally: 0, enemy: 0 };
    stats[field] += 1;
    pairStats.set(key, stats);
  };

  for (const match of matches) {
    for (let i = 0; i < match.blue.length - 1; i += 1) {
      for (let j = i + 1; j < match.blue.length; j += 1) {
        bumpPair(match.blue[i], match.blue[j], "ally");
      }
    }

    for (let i = 0; i < match.red.length - 1; i += 1) {
      for (let j = i + 1; j < match.red.length; j += 1) {
        bumpPair(match.red[i], match.red[j], "ally");
      }
    }

    for (const bluePlayer of match.blue) {
      for (const redPlayer of match.red) {
        bumpPair(bluePlayer, redPlayer, "enemy");
      }
    }
  }

  return pairStats;
}

function buildBattleComponents(nodeIds: string[], matches: MockMatch[]): string[][] {
  const pairStats = buildPairStats(matches);
  const adjacency = new Map<string, Set<string>>();

  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, new Set<string>());
  }

  for (const key of pairStats.keys()) {
    const [from, to] = key.split("|");
    adjacency.get(from)?.add(to);
    adjacency.get(to)?.add(from);
  }

  const seen = new Set<string>();
  const components: string[][] = [];

  for (const nodeId of nodeIds) {
    if (seen.has(nodeId)) {
      continue;
    }

    const queue = [nodeId];
    const component: string[] = [];
    seen.add(nodeId);

    while (queue.length > 0) {
      const current = queue.shift() as string;
      component.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        if (seen.has(neighbor)) {
          continue;
        }
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }

    component.sort((left, right) => left.localeCompare(right));
    components.push(component);
  }

  components.sort((left, right) => right.length - left.length || left[0].localeCompare(right[0]));
  return components;
}

function buildMockGraph() {
  const nodes: GraphNode[] = [];
  const clusters: string[][] = [];
  const clusterByNodeId = new Map<string, number>();
  const gridColumns = 4;

  for (let clusterIndex = 0; clusterIndex < MOCK_CLUSTER_SIZES.length; clusterIndex += 1) {
    const clusterSize = MOCK_CLUSTER_SIZES[clusterIndex];
    const clusterId = `mock-cluster-${clusterIndex + 1}`;
    const centerX = 18 + (clusterIndex % gridColumns) * 26;
    const centerY = 18 + Math.floor(clusterIndex / gridColumns) * 28;
    const members: string[] = [];
    const leafIndices = clusterSize >= 10 ? new Set([clusterSize - 2, clusterSize - 1]) : new Set<number>();

    for (let nodeIndex = 0; nodeIndex < clusterSize; nodeIndex += 1) {
      const angle = (nodeIndex / Math.max(clusterSize, 3)) * Math.PI * 2;
      const radius = leafIndices.has(nodeIndex)
        ? 10.5 + (nodeIndex - (clusterSize - 2)) * 1.6
        : 5.5 + (nodeIndex % 4) * 1.25;
      const id = `c${clusterIndex + 1}n${nodeIndex + 1}`;
      members.push(id);
      clusterByNodeId.set(id, clusterIndex);
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

  const matches: MockMatch[] = [];
  const addMatch = (blue: string[], red: string[]) => {
    const blueTeam = buildTeam(blue);
    const redTeam = buildTeam(red);
    const allParticipants = new Set([...blueTeam, ...redTeam]);
    if (allParticipants.size !== 10) {
      throw new Error(
        `Mock match construction failed. A synthetic match must contain 10 distinct participants. Blue=${blueTeam.join(",")} Red=${redTeam.join(",")}`,
      );
    }
    matches.push({ blue: blueTeam, red: redTeam });
  };

  // Base 5v5 rivalries between larger groups.
  addMatch(pickWindow(clusters[0], 0, 5), pickWindow(clusters[1], 0, 5));
  addMatch(pickWindow(clusters[0], 5, 5), pickWindow(clusters[1], 5, 5));
  addMatch(pickWindow(clusters[0], 10, 5), pickWindow(clusters[1], 10, 5));
  addMatch(pickWindow(clusters[0], 15, 5), pickWindow(clusters[1], 13, 5));

  addMatch(pickWindow(clusters[5], 0, 5), pickWindow(clusters[7], 0, 5));
  addMatch(pickWindow(clusters[5], 4, 5), pickWindow(clusters[9], 0, 5));
  addMatch(pickWindow(clusters[5], 7, 5), pickWindow(clusters[9], 5, 5));
  addMatch(pickWindow(clusters[7], 5, 5), pickWindow(clusters[9], 9, 5));
  addMatch(pickWindow(clusters[7], 11, 5), pickWindow(clusters[10], 0, 5));
  addMatch(pickWindow(clusters[10], 4, 5), pickWindow(clusters[2], 0, 5));

  // Small-cluster coalition matches.
  addMatch(
    buildTeam(clusters[3], pickWindow(clusters[4], 0, 1)),
    pickWindow(clusters[8], 0, 5),
  );
  addMatch(
    buildTeam(clusters[4], clusters[6]),
    pickWindow(clusters[2], 3, 5),
  );
  addMatch(
    buildTeam(clusters[6], pickWindow(clusters[8], 1, 3)),
    buildTeam(clusters[3], pickWindow(clusters[10], 8, 1)),
  );
  addMatch(
    buildTeam(pickWindow(clusters[2], 0, 3), pickWindow(clusters[3], 0, 2)),
    pickWindow(clusters[8], 1, 5),
  );
  addMatch(
    buildTeam(pickWindow(clusters[4], 0, 2), pickWindow(clusters[8], 4, 3)),
    pickWindow(clusters[10], 4, 5),
  );

  // Controlled chaos: same communities appearing on both sides creates mixed evidence.
  addMatch(
    buildTeam(pickWindow(clusters[0], 0, 3), pickWindow(clusters[1], 0, 2)),
    buildTeam(pickWindow(clusters[0], 3, 2), pickWindow(clusters[1], 2, 3)),
  );
  addMatch(
    buildTeam(pickWindow(clusters[5], 0, 3), pickWindow(clusters[9], 0, 2)),
    buildTeam(pickWindow(clusters[5], 3, 2), pickWindow(clusters[9], 2, 3)),
  );
  addMatch(
    buildTeam(pickWindow(clusters[7], 10, 3), pickWindow(clusters[10], 0, 2)),
    buildTeam(pickWindow(clusters[7], 13, 2), pickWindow(clusters[10], 2, 3)),
  );
  addMatch(
    buildTeam(pickWindow(clusters[2], 0, 3), pickWindow(clusters[4], 0, 2)),
    buildTeam(pickWindow(clusters[2], 3, 2), pickWindow(clusters[4], 2, 1), pickWindow(clusters[3], 0, 2)),
  );

  // Mixed scrims: both sides contain players from multiple clusters.
  addMatch(
    buildTeam(pickWindow(clusters[0], 8, 2), pickWindow(clusters[2], 0, 3)),
    buildTeam(pickWindow(clusters[1], 8, 2), pickWindow(clusters[8], 0, 3)),
  );
  addMatch(
    buildTeam(pickWindow(clusters[7], 2, 2), pickWindow(clusters[10], 1, 2), pickWindow(clusters[4], 0, 1)),
    buildTeam(pickWindow(clusters[9], 3, 2), pickWindow(clusters[5], 1, 2), pickWindow(clusters[3], 0, 1)),
  );
  addMatch(
    buildTeam(pickWindow(clusters[2], 1, 2), pickWindow(clusters[3], 0, 2), pickWindow(clusters[6], 0, 1)),
    buildTeam(pickWindow(clusters[8], 2, 2), pickWindow(clusters[10], 5, 2), pickWindow(clusters[6], 1, 1)),
  );

  const nodeIds = nodes.map((node) => node.id);
  const corePool = [
    ...clusters[0],
    ...clusters[1],
    ...clusters[5],
    ...clusters[7],
    ...clusters[9],
    ...clusters[10],
  ];
  let repairCursor = 0;

  const participationCounts = new Map<string, number>(nodeIds.map((nodeId) => [nodeId, 0]));
  for (const match of matches) {
    for (const playerId of [...match.blue, ...match.red]) {
      participationCounts.set(playerId, (participationCounts.get(playerId) ?? 0) + 1);
    }
  }

  const unplayedNodeIds = nodeIds.filter((nodeId) => (participationCounts.get(nodeId) ?? 0) === 0);
  for (const nodeId of unplayedNodeIds) {
    const clusterMembers = clusters[clusterByNodeId.get(nodeId) ?? 0];
    const localPartners = pickUnique(clusterMembers, clusterMembers.indexOf(nodeId) + 1, 2, [nodeId]);
    const blueTeam = buildTeam(
      [nodeId, ...localPartners],
      pickUnique(corePool, repairCursor, 5, [nodeId, ...localPartners]),
    );
    const redTeam = buildTeam(
      pickUnique(corePool, repairCursor + 9, 5, blueTeam),
    );
    addMatch(blueTeam, redTeam);
    repairCursor += 13;
  }

  const components = buildBattleComponents(nodeIds, matches);
  const mainComponentAnchor = clusters[0][0];
  const mainComponentIndex = components.findIndex((component) => component.includes(mainComponentAnchor));

  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    if (componentIndex === mainComponentIndex) {
      continue;
    }

    const component = components[componentIndex];
    const componentAnchors = pickUnique(component, 0, Math.min(component.length, 3));
    const blueTeam = buildTeam(
      componentAnchors,
      pickUnique(corePool, repairCursor, 5, componentAnchors),
    );
    const redTeam = buildTeam(
      pickUnique(corePool, repairCursor + 11, 5, blueTeam),
    );
    addMatch(blueTeam, redTeam);
    repairCursor += 17;
  }

  const finalComponents = buildBattleComponents(nodeIds, matches);
  if (finalComponents.length !== 1) {
    throw new Error(
      `Mock graph construction failed. Battle-path graph must be connected, but ${finalComponents.length} components remain.`,
    );
  }

  const pairStats = buildPairStats(matches);

  const edges: GraphEdge[] = [];
  for (const [key, stats] of pairStats.entries()) {
    const [from, to] = key.split("|");
    const relation: RelationType = stats.ally >= stats.enemy ? "ally" : "enemy";
    const weight = Math.max(stats.ally, stats.enemy);
    edges.push({ from, to, relation, weight });
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
