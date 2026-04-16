import { getMockGraphSnapshot, mockDatasetSummary, mockPlayers } from "./pathfinderMocks";
import type { BirdseyeBuffers, BirdseyeManifest, BirdseyeNodeMeta } from "./graphSphereTypes";

export function buildMockBirdseyeData(): {
  manifest: BirdseyeManifest;
  nodeMeta: BirdseyeNodeMeta;
  buffers: BirdseyeBuffers;
} {
  const sphereRadius = 420;
  const snapshot = getMockGraphSnapshot(
    "battle-path",
    mockPlayers[0]?.id ?? "c1n1",
    mockPlayers[mockPlayers.length - 1]?.id ?? "c11n20",
  );
  const clusterIds = Array.from(new Set(snapshot.nodes.map((node) => node.clusterId ?? "mock-cluster-solo")));
  const clusterIndexMap = new Map(clusterIds.map((clusterId, index) => [clusterId, index]));

  const xs = snapshot.nodes.map((node) => node.x);
  const ys = snapshot.nodes.map((node) => node.y);
  const centerX = xs.reduce((sum, value) => sum + value, 0) / Math.max(xs.length, 1);
  const centerY = ys.reduce((sum, value) => sum + value, 0) / Math.max(ys.length, 1);
  const maxDistance = Math.max(
    1,
    ...snapshot.nodes.map((node) => Math.hypot(node.x - centerX, node.y - centerY)),
  );

  const nodePositions = new Float32Array(snapshot.nodes.length * 3);
  const nodeMetrics = new Uint32Array(snapshot.nodes.length * 4);
  const ids: string[] = [];
  const labels: string[] = [];
  const outClusterIds: string[] = [];
  const nodeIndexById = new Map<string, number>();

  snapshot.nodes.forEach((node, index) => {
    const normalizedX = ((node.x - centerX) / maxDistance) * 0.72;
    const normalizedY = ((node.y - centerY) / maxDistance) * 0.72;
    const clusterOffset = ((clusterIndexMap.get(node.clusterId ?? "mock-cluster-solo") ?? 0) % 7) * 0.01;
    const cappedX = Math.max(-0.84, Math.min(0.84, normalizedX + clusterOffset));
    const cappedY = Math.max(-0.84, Math.min(0.84, normalizedY - clusterOffset * 0.6));
    const z = Math.sqrt(Math.max(0.12, 1 - cappedX * cappedX - cappedY * cappedY));
    const offset = index * 3;
    nodePositions[offset] = cappedX * sphereRadius;
    nodePositions[offset + 1] = z * sphereRadius;
    nodePositions[offset + 2] = cappedY * sphereRadius;

    ids.push(node.id);
    labels.push(node.label);
    outClusterIds.push(node.clusterId ?? "mock-cluster-solo");
    nodeIndexById.set(node.id, index);
  });

  const edgePairs = new Uint32Array(snapshot.edges.length * 2);
  const edgeProps = new Uint32Array(snapshot.edges.length);

  snapshot.edges.forEach((edge, edgeIndex) => {
    const sourceIndex = nodeIndexById.get(edge.from) ?? 0;
    const targetIndex = nodeIndexById.get(edge.to) ?? 0;
    edgePairs[edgeIndex * 2] = sourceIndex;
    edgePairs[edgeIndex * 2 + 1] = targetIndex;
    edgeProps[edgeIndex] = (Math.max(edge.weight, 1) << 1) | (edge.relation === "enemy" ? 1 : 0);

    nodeMetrics[sourceIndex * 4] += 1;
    nodeMetrics[targetIndex * 4] += 1;
    nodeMetrics[sourceIndex * 4 + 3] += edge.weight;
    nodeMetrics[targetIndex * 4 + 3] += edge.weight;
    if (edge.relation === "enemy") {
      nodeMetrics[sourceIndex * 4 + 2] += 1;
      nodeMetrics[targetIndex * 4 + 2] += 1;
    } else {
      nodeMetrics[sourceIndex * 4 + 1] += 1;
      nodeMetrics[targetIndex * 4 + 1] += 1;
    }
  });

  return {
    manifest: {
      layoutVersion: "mock-birdseye-static-v1",
      sphereRadius,
      layoutClusterSupportThreshold: 1,
      nodeCount: snapshot.nodes.length,
      edgeCount: snapshot.edges.length,
      allyEdgeCount: mockDatasetSummary.allyRelationships,
      enemyEdgeCount: mockDatasetSummary.enemyRelationships,
      clusterCount: clusterIds.length,
      generationMs: 0.2,
      nodeMetricStride: 4,
      edgePairStride: 2,
      edgePropEncoding: "bit0=relation(0 ally,1 enemy); remaining bits store weight",
      fileSizes: {
        nodePositionsF32: nodePositions.byteLength,
        nodeMetricsU32: nodeMetrics.byteLength,
        edgePairsU32: edgePairs.byteLength,
        edgePropsU32: edgeProps.byteLength,
        nodeMetaJson: JSON.stringify({ ids, labels, clusterIds: outClusterIds }).length,
      },
    },
    nodeMeta: {
      ids,
      labels,
      clusterIds: outClusterIds,
    },
    buffers: {
      nodePositions,
      nodeMetrics,
      edgePairs,
      edgeProps,
    },
  };
}
