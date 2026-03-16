const { performance } = require("perf_hooks");
const { nodes, edges, players, datasetSummary } = require("./prototypeData");
const WEIGHT_COST_SCALE = 1000;

function edgeKey(from, to) {
  return [from, to].sort().join("|");
}

function cloneArray(items) {
  return Array.isArray(items) ? [...items] : [];
}

function buildSignedGraph() {
  const nodeMap = new Map(nodes.map((node) => [node.id, { ...node }]));
  const adjacency = new Map();
  const relationMap = new Map();

  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    const key = edgeKey(edge.from, edge.to);
    const current = relationMap.get(key) || {
      from: edge.from,
      to: edge.to,
      allyWeight: 0,
      enemyWeight: 0,
      totalMatches: 0,
      dominantRelation: edge.relation,
    };

    if (edge.relation === "ally") {
      current.allyWeight += edge.weight;
    } else {
      current.enemyWeight += edge.weight;
    }

    current.totalMatches = current.allyWeight + current.enemyWeight;
    current.dominantRelation =
      current.allyWeight >= current.enemyWeight ? "ally" : "enemy";
    relationMap.set(key, current);

    adjacency.get(edge.from).push({ ...edge, id: edge.to });
    adjacency.get(edge.to).push({ ...edge, id: edge.from });
  }

  for (const neighbors of adjacency.values()) {
    neighbors.sort((left, right) => {
      if (left.weight !== right.weight) {
        return right.weight - left.weight;
      }
      return left.id.localeCompare(right.id);
    });
  }

  return {
    nodeMap,
    adjacency,
    relationMap,
  };
}

const graph = buildSignedGraph();

function createTraceStep(step, phase, activeNodeId, frontierNodeIds, visitedNodeIds, highlightedEdges) {
  return {
    step,
    phase,
    activeNodeId,
    frontierNodeIds: cloneArray(frontierNodeIds),
    visitedNodeIds: cloneArray(visitedNodeIds),
    highlightedEdges: cloneArray(highlightedEdges),
  };
}

function normalizePathEdge(from, to, relation) {
  return { from, to, relation };
}

function relationForPath(from, to, pathMode) {
  const relation = graph.relationMap.get(edgeKey(from, to));
  if (!relation) {
    return "ally";
  }

  if (pathMode === "social-path") {
    return "ally";
  }

  return relation.enemyWeight > relation.allyWeight ? "enemy" : relation.dominantRelation;
}

function getAllowedNeighbors(nodeId, pathMode) {
  const neighbors = graph.adjacency.get(nodeId) || [];
  if (pathMode === "battle-path") {
    return neighbors;
  }
  return neighbors.filter((neighbor) => neighbor.relation === "ally");
}

function getTraversalCost(weightedMode, edgeWeight) {
  if (!weightedMode) {
    return WEIGHT_COST_SCALE;
  }

  return Math.ceil(WEIGHT_COST_SCALE / Math.max(edgeWeight, 1));
}

function buildPath(parents, targetId, pathMode) {
  const pathNodes = [];
  let current = targetId;

  while (current) {
    pathNodes.push(current);
    current = parents.get(current) || null;
  }

  pathNodes.reverse();
  const pathEdges = [];

  for (let index = 0; index < pathNodes.length - 1; index += 1) {
    const from = pathNodes[index];
    const to = pathNodes[index + 1];
    pathEdges.push(normalizePathEdge(from, to, relationForPath(from, to, pathMode)));
  }

  return {
    pathNodes,
    pathEdges,
  };
}

function runBreadthFirst(request) {
  const queue = [request.sourcePlayerId];
  const visited = new Set([request.sourcePlayerId]);
  const parents = new Map([[request.sourcePlayerId, null]]);
  const trace = [];

  let step = 1;
  let edgesConsidered = 0;
  let found = false;

  while (queue.length > 0 && step <= request.options.maxSteps) {
    const current = queue.shift();
    trace.push(createTraceStep(step, "expand", current, queue, visited, []));
    step += 1;

    for (const neighbor of getAllowedNeighbors(current, request.pathMode)) {
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

function runDijkstra(request) {
  const frontier = [{ id: request.sourcePlayerId, cost: 0 }];
  const distances = new Map([[request.sourcePlayerId, 0]]);
  const parents = new Map([[request.sourcePlayerId, null]]);
  const seen = new Set();
  const trace = [];

  let step = 1;
  let edgesConsidered = 0;
  let found = false;

  while (frontier.length > 0 && step <= request.options.maxSteps) {
    frontier.sort((left, right) => left.cost - right.cost || left.id.localeCompare(right.id));
    const current = frontier.shift();

    if (seen.has(current.id)) {
      continue;
    }

    seen.add(current.id);
    trace.push(
      createTraceStep(step, "expand", current.id, frontier.map((item) => item.id), seen, []),
    );
    step += 1;

    if (current.id === request.targetPlayerId) {
      found = true;
      break;
    }

    for (const neighbor of getAllowedNeighbors(current.id, request.pathMode)) {
      if (step > request.options.maxSteps) {
        break;
      }

      edgesConsidered += 1;
      const nextCost = current.cost + getTraversalCost(Boolean(request.weightedMode), neighbor.weight);
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

function runBidirectional(request) {
  const sourceQueue = [request.sourcePlayerId];
  const targetQueue = [request.targetPlayerId];
  const sourceVisited = new Set([request.sourcePlayerId]);
  const targetVisited = new Set([request.targetPlayerId]);
  const sourceParents = new Map([[request.sourcePlayerId, null]]);
  const targetParents = new Map([[request.targetPlayerId, null]]);
  const trace = [];

  let step = 1;
  let edgesConsidered = 0;
  let meetingNode = null;

  function expand(queue, ownVisited, otherVisited, ownParents) {
    if (queue.length === 0 || step > request.options.maxSteps) {
      return;
    }

    const current = queue.shift();
    trace.push(
      createTraceStep(
        step,
        "expand",
        current,
        [...sourceQueue, ...targetQueue],
        new Set([...sourceVisited, ...targetVisited]),
        [],
      ),
    );
    step += 1;

    for (const neighbor of getAllowedNeighbors(current, request.pathMode)) {
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
          [...sourceQueue, ...targetQueue],
          new Set([...sourceVisited, ...targetVisited]),
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
  }

  while (
    sourceQueue.length > 0 &&
    targetQueue.length > 0 &&
    !meetingNode &&
    step <= request.options.maxSteps
  ) {
    expand(sourceQueue, sourceVisited, targetVisited, sourceParents);
    if (meetingNode) {
      break;
    }
    expand(targetQueue, targetVisited, sourceVisited, targetParents);
  }

  const combinedVisited = new Set([...sourceVisited, ...targetVisited]);

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

  const leftNodes = [];
  let currentLeft = meetingNode;
  while (currentLeft) {
    leftNodes.push(currentLeft);
    currentLeft = sourceParents.get(currentLeft) || null;
  }
  leftNodes.reverse();

  const rightNodes = [];
  let currentRight = targetParents.get(meetingNode) || null;
  while (currentRight) {
    rightNodes.push(currentRight);
    currentRight = targetParents.get(currentRight) || null;
  }

  const pathNodes = [...leftNodes, ...rightNodes];
  const pathEdges = [];
  for (let index = 0; index < pathNodes.length - 1; index += 1) {
    pathEdges.push(
      normalizePathEdge(
        pathNodes[index],
        pathNodes[index + 1],
        relationForPath(pathNodes[index], pathNodes[index + 1], request.pathMode),
      ),
    );
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

function getGraphSnapshot(pathMode, sourcePlayerId, targetPlayerId) {
  const allowedEdges =
    pathMode === "battle-path" ? edges : edges.filter((edge) => edge.relation === "ally");
  const visibleNodeIds = new Set([sourcePlayerId, targetPlayerId]);

  for (const edge of allowedEdges) {
    visibleNodeIds.add(edge.from);
    visibleNodeIds.add(edge.to);
  }

  return {
    nodes: nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges: allowedEdges,
  };
}

function validateRequest(request) {
  if (!graph.nodeMap.has(request.sourcePlayerId) || !graph.nodeMap.has(request.targetPlayerId)) {
    return "The selected player does not exist in the current dataset.";
  }
  if (!["bfs", "dijkstra", "bidirectional", "astar"].includes(request.algorithm)) {
    return "Unsupported algorithm.";
  }
  if (!["social-path", "battle-path"].includes(request.pathMode)) {
    return "Unsupported path mode.";
  }
  return null;
}

function runSearch(request) {
  const validationError = validateRequest(request);
  const baseRequest = {
    sourcePlayerId: request.sourcePlayerId,
    targetPlayerId: request.targetPlayerId,
    algorithm: request.algorithm,
    pathMode: request.pathMode,
    weightedMode: Boolean(request.weightedMode),
  };

  if (validationError) {
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
      warnings: [validationError],
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
      graphSnapshot: getGraphSnapshot(request.pathMode, request.sourcePlayerId, request.targetPlayerId),
      warnings: ["A* is not enabled yet because it still needs a valid heuristic."],
    };
  }

  if (request.sourcePlayerId === request.targetPlayerId) {
    return {
      request: baseRequest,
      status: "same_source_target",
      summary: {
        pathLength: 0,
        nodesVisited: 1,
        edgesConsidered: 0,
        runtimeMs: 0,
        backendRuntimeMs: 0,
        traceStepCount: 0,
      },
      path: { nodes: [request.sourcePlayerId], edges: [] },
      trace: [],
      graphSnapshot: getGraphSnapshot(request.pathMode, request.sourcePlayerId, request.targetPlayerId),
      warnings: [],
    };
  }

  const start = performance.now();
  let result;
  if (request.algorithm === "bfs") {
    result = runBreadthFirst(request);
  } else if (request.algorithm === "dijkstra") {
    result = runDijkstra(request);
  } else {
    result = runBidirectional(request);
  }
  const runtimeMs = Number((performance.now() - start).toFixed(3));

  const warnings = [];
  if (!result.found && request.pathMode === "social-path") {
    warnings.push("No friend-only route is available in the current graph.");
  }
  if (request.pathMode === "battle-path") {
    warnings.push("Enemy edges are enabled in this run.");
  }
  if (request.algorithm === "dijkstra" && request.weightedMode) {
    warnings.push("Weighted Dijkstra treats stronger repeated connections as cheaper edges.");
  }

  return {
    request: baseRequest,
    status: result.found ? "found" : "not_found",
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
    graphSnapshot: getGraphSnapshot(request.pathMode, request.sourcePlayerId, request.targetPlayerId),
    warnings,
  };
}

function compareAlgorithms(sourcePlayerId, targetPlayerId, pathMode, weightedMode = false) {
  const algorithms = ["bfs", "dijkstra", "bidirectional"];
  const rows = algorithms.map((algorithm) => {
    const socialRun = runSearch({
      sourcePlayerId,
      targetPlayerId,
      algorithm,
      pathMode: "social-path",
      weightedMode,
      options: { includeTrace: false, maxSteps: 5000 },
    });

    const battleRun = runSearch({
      sourcePlayerId,
      targetPlayerId,
      algorithm,
      pathMode: "battle-path",
      weightedMode,
      options: { includeTrace: false, maxSteps: 5000 },
    });

    let relativeNote = pathMode === "battle-path"
      ? "battle-path mirrors social-path here"
      : "social-only route is the current baseline";

    if (battleRun.status === "found" && socialRun.status !== "found") {
      relativeNote = "enemy edges create connectivity";
    } else if (battleRun.status === "found" && socialRun.status === "found") {
      if (battleRun.summary.pathLength < socialRun.summary.pathLength) {
        relativeNote = "shorter with enemy edges";
      } else if (battleRun.summary.pathLength === socialRun.summary.pathLength) {
        relativeNote = "no gain from enemy edges";
      }
    }

    const activeRun = pathMode === "battle-path" ? battleRun : socialRun;

    return {
      algorithm,
      label: algorithm === "bidirectional" ? "Bidirectional" : algorithm === "bfs" ? "BFS" : "Dijkstra",
      supportedNow: true,
      pathFound: activeRun.status === "found" || activeRun.status === "same_source_target",
      pathLength: activeRun.summary.pathLength,
      nodesVisited: activeRun.summary.nodesVisited,
      runtimeMs: activeRun.summary.runtimeMs,
      relativeNote,
    };
  });

  rows.push({
    algorithm: "astar",
    label: "A*",
    supportedNow: false,
    pathFound: null,
    pathLength: null,
    nodesVisited: null,
    runtimeMs: null,
    relativeNote: "coming later, pending heuristic",
  });

  return rows;
}

function getOptions() {
  return {
    executionMode: "backend",
    players,
    datasetSummary,
    supportedAlgorithms: ["bfs", "dijkstra", "bidirectional"],
    previewSnapshot: getGraphSnapshot("battle-path", players[0].id, players[players.length - 1].id),
  };
}

function getEngineSpec() {
  return {
    executionMode: "backend",
    requestContract: {
      sourcePlayerId: "string",
      targetPlayerId: "string",
      algorithm: ["bfs", "dijkstra", "bidirectional", "astar"],
      pathMode: ["social-path", "battle-path"],
      weightedMode: "boolean",
      options: {
        includeTrace: "boolean",
        maxSteps: "number",
      },
    },
    responseContract: {
      request: "echo of the search query without options",
      status: ["found", "not_found", "same_source_target", "invalid_input"],
      summary: {
        pathLength: "number",
        nodesVisited: "number",
        edgesConsidered: "number",
        runtimeMs: "number",
        backendRuntimeMs: "number",
        traceStepCount: "number",
      },
      path: {
        nodes: "string[]",
        edges: "{ from, to, relation }[]",
      },
      trace: "{ step, phase, activeNodeId, frontierNodeIds, visitedNodeIds, highlightedEdges }[]",
      graphSnapshot: "{ nodes, edges }",
      warnings: "string[]",
    },
    signedGraphModel: {
      nodeStore: "Map<playerId, PlayerNode>",
      adjacency: "Map<playerId, Neighbor[]>",
      pairRelation: {
        allyWeight: "number",
        enemyWeight: "number",
        totalMatches: "number",
        dominantRelation: "ally | enemy",
      },
      queryRules: {
        "social-path": "allyWeight > 0",
        "battle-path": "allyWeight > 0 || enemyWeight > 0",
      },
    },
    integrationPath: {
      rust: [
        "Move the search core into a Rust crate that owns the signed graph in memory.",
        "Expose the engine through a small HTTP service or a native bridge.",
        "Keep Node/Express as the API shell and replay contract layer.",
      ],
      go: [
        "Move the search core into a Go service with in-memory adjacency maps.",
        "Expose JSON endpoints compatible with the current prototype contract.",
        "Keep the frontend unchanged by preserving the same response schema.",
      ],
    },
  };
}

module.exports = {
  runSearch,
  compareAlgorithms,
  getOptions,
  getEngineSpec,
};
