export interface BirdseyeManifest {
  layoutVersion: string;
  sphereRadius: number;
  layoutClusterSupportThreshold: number;
  nodeCount: number;
  edgeCount: number;
  allyEdgeCount: number;
  enemyEdgeCount: number;
  clusterCount: number;
  generationMs: number;
  nodeMetricStride: number;
  edgePairStride: number;
  edgePropEncoding: string;
  fileSizes: {
    nodePositionsF32: number;
    nodeMetricsU32: number;
    edgePairsU32: number;
    edgePropsU32: number;
    nodeMetaJson: number;
  };
}

export interface BirdseyeNodeMeta {
  ids: string[];
  labels: string[];
  clusterIds: string[];
}

export interface BirdseyeBuffers {
  nodePositions: Float32Array;
  nodeMetrics: Uint32Array;
  edgePairs: Uint32Array;
  edgeProps: Uint32Array;
}
