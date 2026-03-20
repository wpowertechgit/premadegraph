import { getMockGraphSnapshot, mockPlayers } from "./pathfinderMocks";
import type { GraphEdge, GraphNode } from "./pathfinderTypes";
import type {
  SignedBalanceClusterSummary,
  SignedBalanceNodeSummary,
  SignedBalanceRequest,
  SignedBalanceResponse,
  SignedTriadExample,
  SignedTriadTypeCount,
} from "./signedBalanceTypes";

type SignedEdge = {
  from: string;
  to: string;
  sign: 1 | -1;
  weight: number;
};

function triadKey(signA: number, signB: number, signC: number) {
  const plusCount = [signA, signB, signC].filter((sign) => sign > 0).length;
  if (plusCount === 3) {
    return "+++";
  }
  if (plusCount === 2) {
    return "++-";
  }
  if (plusCount === 1) {
    return "+--";
  }
  return "---";
}

function isBalanced(signA: number, signB: number, signC: number) {
  return signA * signB * signC > 0;
}

function pairKey(left: string, right: string) {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function sortTriadTypes(items: SignedTriadTypeCount[]) {
  const order = new Map([
    ["+++", 0],
    ["++-", 1],
    ["+--", 2],
    ["---", 3],
  ]);

  return items.sort((left, right) => {
    const leftOrder = order.get(left.triadType) ?? 99;
    const rightOrder = order.get(right.triadType) ?? 99;
    return leftOrder - rightOrder;
  });
}

function buildMockProjection(request: SignedBalanceRequest) {
  const sourceId = mockPlayers[0]?.id ?? "c1n1";
  const targetId = mockPlayers[mockPlayers.length - 1]?.id ?? "c11n20";
  const snapshot = getMockGraphSnapshot("battle-path", sourceId, targetId);
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node] as const));

  const candidateEdges = snapshot.edges.length;
  let excludedLowSupportEdges = 0;
  let excludedTiedEdges = 0;

  const projectedEdges: SignedEdge[] = [];
  for (const edge of snapshot.edges) {
    if (edge.weight < request.minEdgeSupport) {
      excludedLowSupportEdges += 1;
      continue;
    }

    projectedEdges.push({
      from: edge.from,
      to: edge.to,
      sign: edge.relation === "ally" ? 1 : -1,
      weight: edge.weight,
    });
  }

  const analyzedNodeIds = new Set<string>();
  const adjacency = new Map<string, Map<string, SignedEdge>>();
  for (const edge of projectedEdges) {
    analyzedNodeIds.add(edge.from);
    analyzedNodeIds.add(edge.to);

    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, new Map());
    }
    if (!adjacency.has(edge.to)) {
      adjacency.set(edge.to, new Map());
    }
    adjacency.get(edge.from)?.set(edge.to, edge);
    adjacency.get(edge.to)?.set(edge.from, edge);
  }

  return {
    snapshot,
    nodeById,
    candidateEdges,
    excludedLowSupportEdges,
    excludedTiedEdges,
    projectedEdges,
    adjacency,
    analyzedNodeIds: Array.from(analyzedNodeIds).sort((left, right) => left.localeCompare(right)),
  };
}

export async function runSignedBalanceMock(
  request: SignedBalanceRequest,
): Promise<SignedBalanceResponse> {
  const {
    snapshot,
    nodeById,
    candidateEdges,
    excludedLowSupportEdges,
    excludedTiedEdges,
    projectedEdges,
    adjacency,
    analyzedNodeIds,
  } = buildMockProjection(request);

  const triadCounts = new Map<string, SignedTriadTypeCount>();
  const triadExamples = new Map<string, SignedTriadExample[]>();
  const nodeStats = new Map<string, { total: number; unbalanced: number }>();
  const clusterStats = new Map<string, SignedBalanceClusterSummary>();

  for (const nodeId of analyzedNodeIds) {
    nodeStats.set(nodeId, { total: 0, unbalanced: 0 });
  }

  let totalAnalyzed = 0;
  let balancedCount = 0;
  let unbalancedCount = 0;

  for (let i = 0; i < analyzedNodeIds.length - 2; i += 1) {
    const a = analyzedNodeIds[i];
    const aNeighbors = adjacency.get(a);
    if (!aNeighbors) {
      continue;
    }

    for (let j = i + 1; j < analyzedNodeIds.length - 1; j += 1) {
      const b = analyzedNodeIds[j];
      const ab = aNeighbors.get(b);
      if (!ab) {
        continue;
      }

      const bNeighbors = adjacency.get(b);
      if (!bNeighbors) {
        continue;
      }

      for (let k = j + 1; k < analyzedNodeIds.length; k += 1) {
        const c = analyzedNodeIds[k];
        const ac = aNeighbors.get(c);
        const bc = bNeighbors.get(c);
        if (!ac || !bc) {
          continue;
        }

        totalAnalyzed += 1;
        const triadType = triadKey(ab.sign, ac.sign, bc.sign);
        const balanced = isBalanced(ab.sign, ac.sign, bc.sign);
        const current = triadCounts.get(triadType) ?? { triadType, balanced, count: 0 };
        current.count += 1;
        triadCounts.set(triadType, current);
        const currentExamples = triadExamples.get(triadType) ?? [];
        if (currentExamples.length < 2) {
          currentExamples.push({
            triadType,
            balanced,
            nodes: [a, b, c].map((playerId) => ({
              playerId,
              label: nodeById.get(playerId)?.label ?? playerId,
            })),
            edges: [
              { from: a, to: b, sign: ab.sign },
              { from: a, to: c, sign: ac.sign },
              { from: b, to: c, sign: bc.sign },
            ],
          });
          triadExamples.set(triadType, currentExamples);
        }

        if (balanced) {
          balancedCount += 1;
        } else {
          unbalancedCount += 1;
        }

        for (const nodeId of [a, b, c]) {
          const stats = nodeStats.get(nodeId);
          if (!stats) {
            continue;
          }
          stats.total += 1;
          if (!balanced) {
            stats.unbalanced += 1;
          }
        }

        const aNode = nodeById.get(a);
        const bNode = nodeById.get(b);
        const cNode = nodeById.get(c);
        if (aNode?.clusterId && aNode.clusterId === bNode?.clusterId && aNode.clusterId === cNode?.clusterId) {
          const clusterId = aNode.clusterId;
          const currentCluster = clusterStats.get(clusterId) ?? {
            clusterId,
            size: snapshot.nodes.filter((node) => node.clusterId === clusterId).length,
            localTriads: 0,
            balancedCount: 0,
            unbalancedCount: 0,
            balancedRatio: 0,
          };
          currentCluster.localTriads += 1;
          if (balanced) {
            currentCluster.balancedCount += 1;
          } else {
            currentCluster.unbalancedCount += 1;
          }
          clusterStats.set(clusterId, currentCluster);
        }
      }
    }
  }

  const topUnbalancedNodes: SignedBalanceNodeSummary[] = Array.from(nodeStats.entries())
    .map(([playerId, stats]) => {
      const node = nodeById.get(playerId);
      return {
        playerId,
        label: node?.label ?? playerId,
        totalTriads: stats.total,
        unbalancedTriads: stats.unbalanced,
        instabilityScore: stats.total > 0 ? stats.unbalanced / stats.total : 0,
      };
    })
    .sort((left, right) => {
      if (right.unbalancedTriads !== left.unbalancedTriads) {
        return right.unbalancedTriads - left.unbalancedTriads;
      }
      if (right.instabilityScore !== left.instabilityScore) {
        return right.instabilityScore - left.instabilityScore;
      }
      return left.label.localeCompare(right.label);
    })
    .slice(0, request.maxTopNodes);

  const clusterSummaries = Array.from(clusterStats.values())
    .map((cluster) => ({
      ...cluster,
      balancedRatio: cluster.localTriads > 0 ? cluster.balancedCount / cluster.localTriads : 0,
    }))
    .sort((left, right) => {
      if (right.localTriads !== left.localTriads) {
        return right.localTriads - left.localTriads;
      }
      return left.clusterId.localeCompare(right.clusterId);
    });

  const balancedRatio = totalAnalyzed > 0 ? balancedCount / totalAnalyzed : 0;
  const projectedNodeCount = new Set(projectedEdges.flatMap((edge) => [edge.from, edge.to])).size;

  return new Promise((resolve) => {
    window.setTimeout(() => resolve({
      status: "ok",
      decisions: {
        graphScope: "mock battle-path graph reused from Pathfinder Lab",
        edgeProjection: "collapsed mock signed simple graph",
        supportMeasure: "mock edge weight",
        canonicalPositiveSign: "ally",
        canonicalNegativeSign: "enemy",
        signRule: "direct edge relation in the mock graph",
        tiePolicy: request.tiePolicy,
        minEdgeSupport: request.minEdgeSupport,
        validTriadRule: "fully connected triples after thresholding",
      },
      graphSummary: {
        filteredNodes: snapshot.nodes.length,
        projectedNodes: projectedNodeCount,
        candidateEdges,
        analyzedEdges: projectedEdges.length,
        excludedLowSupportEdges,
        excludedTiedEdges,
      },
      triads: {
        totalAnalyzed,
        balancedCount,
        unbalancedCount,
        balancedRatio,
      },
      triadTypeDistribution: sortTriadTypes(Array.from(triadCounts.values())),
      exampleTriads: sortTriadTypes(Array.from(triadCounts.values()))
        .flatMap((item) => triadExamples.get(item.triadType) ?? []),
      topUnbalancedNodes,
      clusterSummaries: request.includeClusterSummaries ? clusterSummaries : [],
      warnings: ["Mock dataset mode is enabled. This run uses the smaller Pathfinder Lab demo graph for explanation and demos."],
    }), 180);
  });
}
