import { getMockGraphSnapshot, mockPlayers } from "./pathfinderMocks";
import type { GraphNode } from "./pathfinderTypes";
import type {
  AssortativityMetricResult,
  AssortativityRequest,
  AssortativityResponse,
} from "./assortativityTypes";

type MockMetricRow = {
  label: string;
  opscore: number;
  feedscore: number;
  matchCount: number;
};

type MetricKey = "opscore" | "feedscore";
type GraphMode = "social-path" | "battle-path";

type EdgeAccumulator = {
  orientedPairs: number;
  edgeCount: number;
  sumX: number;
  sumY: number;
  sumX2: number;
  sumY2: number;
  sumXY: number;
};

function emptyAccumulator(): EdgeAccumulator {
  return {
    orientedPairs: 0,
    edgeCount: 0,
    sumX: 0,
    sumY: 0,
    sumX2: 0,
    sumY2: 0,
    sumXY: 0,
  };
}

function addUndirectedEdge(accumulator: EdgeAccumulator, left: number, right: number) {
  const addPair = (x: number, y: number) => {
    accumulator.orientedPairs += 1;
    accumulator.sumX += x;
    accumulator.sumY += y;
    accumulator.sumX2 += x * x;
    accumulator.sumY2 += y * y;
    accumulator.sumXY += x * y;
  };

  addPair(left, right);
  addPair(right, left);
  accumulator.edgeCount += 1;
}

function coefficient(accumulator: EdgeAccumulator) {
  if (accumulator.orientedPairs < 2) {
    return null;
  }

  const n = accumulator.orientedPairs;
  const numerator = n * accumulator.sumXY - accumulator.sumX * accumulator.sumY;
  const denomX = n * accumulator.sumX2 - accumulator.sumX * accumulator.sumX;
  const denomY = n * accumulator.sumY2 - accumulator.sumY * accumulator.sumY;
  const denominator = Math.sqrt(denomX * denomY);

  if (!Number.isFinite(denominator) || denominator <= Number.EPSILON) {
    return null;
  }

  return numerator / denominator;
}

function sample(accumulator: EdgeAccumulator) {
  return {
    coefficient: coefficient(accumulator),
    sampleSize: accumulator.edgeCount,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseMockNodeId(nodeId: string) {
  const match = /^c(\d+)n(\d+)$/i.exec(nodeId);
  if (!match) {
    return { clusterIndex: 1, nodeIndex: 1 };
  }
  return {
    clusterIndex: Number(match[1]),
    nodeIndex: Number(match[2]),
  };
}

function buildMockMetricRows(nodes: GraphNode[]) {
  const rows = new Map<string, MockMetricRow>();

  for (const node of nodes) {
    const { clusterIndex, nodeIndex } = parseMockNodeId(node.id);
    const bridgeBonus = nodeIndex <= 2 ? 0.45 : 0;
    const clusterWave = ((clusterIndex % 4) - 1.5) * 0.22;
    const nodeWave = ((nodeIndex % 5) - 2) * 0.24;

    const opscore = clamp(3.1 + clusterIndex * 0.39 + bridgeBonus + nodeWave + clusterWave, 1, 10);
    const feedscore = clamp(
      6.7 - clusterIndex * 0.17 + (((nodeIndex * 3) % 7) - 3) * 0.31 - bridgeBonus * 0.2 + clusterWave,
      1,
      10,
    );
    const matchCount = 6 + (clusterIndex % 5) + (nodeIndex % 4);

    rows.set(node.id, {
      label: node.label,
      opscore,
      feedscore,
      matchCount,
    });
  }

  return rows;
}

function eligibleNodeCount(
  rows: Map<string, MockMetricRow>,
  metric: MetricKey,
  minPlayerMatchCount: number,
) {
  let count = 0;
  for (const row of rows.values()) {
    if (row.matchCount < minPlayerMatchCount) {
      continue;
    }
    if (!Number.isFinite(row[metric])) {
      continue;
    }
    count += 1;
  }
  return count;
}

export function buildAssortativityMockResponse(
  request: AssortativityRequest,
): AssortativityResponse {
  const sourceId = mockPlayers[0]?.id ?? "c1n1";
  const targetId = mockPlayers[mockPlayers.length - 1]?.id ?? "c11n20";
  const battleSnapshot = getMockGraphSnapshot("battle-path", sourceId, targetId);
  const socialSnapshot = getMockGraphSnapshot("social-path", sourceId, targetId);
  const nodeById = new Map(battleSnapshot.nodes.map((node) => [node.id, node] as const));
  const rows = buildMockMetricRows(battleSnapshot.nodes);

  const computeFor = (graphMode: GraphMode, metric: MetricKey): AssortativityMetricResult => {
    const snapshot = graphMode === "social-path" ? socialSnapshot : battleSnapshot;
    const global = emptyAccumulator();
    const withinCluster = emptyAccumulator();
    const crossCluster = emptyAccumulator();
    const strongTies = emptyAccumulator();
    const weakTies = emptyAccumulator();

    let candidateEdges = 0;
    let analyzedEdges = 0;
    let skippedLowEdgeSupportEdges = 0;
    let skippedMissingMetricEdges = 0;
    let skippedLowMatchCountEdges = 0;

    for (const edge of snapshot.edges) {
      candidateEdges += 1;
      if (edge.weight < request.minEdgeSupport) {
        skippedLowEdgeSupportEdges += 1;
        continue;
      }

      const leftRow = rows.get(edge.from);
      const rightRow = rows.get(edge.to);
      if (!leftRow || !rightRow) {
        skippedMissingMetricEdges += 1;
        continue;
      }

      const leftValue = leftRow[metric];
      const rightValue = rightRow[metric];
      if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
        skippedMissingMetricEdges += 1;
        continue;
      }

      if (leftRow.matchCount < request.minPlayerMatchCount || rightRow.matchCount < request.minPlayerMatchCount) {
        skippedLowMatchCountEdges += 1;
        continue;
      }

      analyzedEdges += 1;
      addUndirectedEdge(global, leftValue, rightValue);

      if (nodeById.get(edge.from)?.clusterId === nodeById.get(edge.to)?.clusterId) {
        addUndirectedEdge(withinCluster, leftValue, rightValue);
      } else {
        addUndirectedEdge(crossCluster, leftValue, rightValue);
      }

      if (edge.weight >= request.strongTieThreshold) {
        addUndirectedEdge(strongTies, leftValue, rightValue);
      } else {
        addUndirectedEdge(weakTies, leftValue, rightValue);
      }
    }

    return {
      graphMode,
      metric,
      eligibleNodes: eligibleNodeCount(rows, metric, request.minPlayerMatchCount),
      candidateEdges,
      analyzedEdges,
      skippedLowEdgeSupportEdges,
      skippedMissingMetricEdges,
      skippedLowMatchCountEdges,
      global: sample(global),
      withinCluster: sample(withinCluster),
      crossCluster: sample(crossCluster),
      strongTies: sample(strongTies),
      weakTies: sample(weakTies),
    };
  };

  const results = (["social-path", "battle-path"] as const).flatMap((graphMode) =>
    (["opscore", "feedscore"] as const).map((metric) => computeFor(graphMode, metric)),
  );

  return {
    status: results.some((item) => item.global.coefficient !== null) ? "ok" : "insufficient_data",
    decisions: {
      graphScope: "mock Pathfinder Lab graph with deterministic synthetic player metrics",
      graphModes: ["social-path", "battle-path"],
      metrics: ["opscore", "feedscore"],
      graphModeRule:
        "social-path uses ally-only mock edges; battle-path uses the full mock signed graph with support measured from mock edge weights",
      nodeEligibilityRule:
        "both endpoints must have the selected synthetic metric and satisfy the minimum mock match-count threshold",
      assortativityFormula: "Pearson correlation across both endpoint orientations of each eligible undirected mock edge",
      minEdgeSupport: request.minEdgeSupport,
      minPlayerMatchCount: request.minPlayerMatchCount,
      strongTieThreshold: request.strongTieThreshold,
    },
    results,
    warnings: [
      "Mock dataset mode is enabled. This run uses the smaller Pathfinder Lab demo graph with deterministic synthetic performance metrics for demos and explanation.",
    ],
  };
}

export async function runAssortativityMock(
  request: AssortativityRequest,
): Promise<AssortativityResponse> {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      resolve(buildAssortativityMockResponse(request));
    }, 180);
  });
}
