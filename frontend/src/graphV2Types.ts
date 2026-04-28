export interface GraphV2Manifest {
  datasetId: string;
  summaryFile: string;
  summaryArchiveFile: string;
  matchCount: number;
  playerCount: number;
  nodeCount: number;
  edgeCount: number;
  allyEdgeCount: number;
  enemyEdgeCount: number;
  clusterCount: number;
  minSupportThreshold: number;
  allyClusterSupportThreshold: number;
  graphBuilderVersion: string;
  clusteringAlgorithmVersion: string;
  layoutVersion: string;
  generatedAt: string;
  generationMs: number;
  nodePositionStride: number;
  nodeMetricStride: number;
  edgePairStride: number;
  edgePropEncoding: string;
  nodeMetricEncoding: string[];
  graphConstructionRule: string;
  clusteringRule: string;
  fileSizes: {
    manifestJson: number;
    summaryMd: number;
    nodeMetaJson: number;
    nodePositionsF32: number;
    nodeMetricsU32: number;
    edgePairsU32: number;
    edgePropsU32: number;
    clusterMetaJson: number;
  };
}

export interface GraphV2NodeMeta {
  ids: string[];
  labels: string[];
  clusterIds: string[];
  opscores: Array<number | null>;
  feedscores: Array<number | null>;
  highlightFlags: number[];
}

export interface GraphV2Buffers {
  nodePositions: Float32Array;
  nodeMetrics: Uint32Array;
  edgePairs: Uint32Array;
  edgeProps: Uint32Array;
}

export interface GraphV2ClusterMeta {
  clusters: GraphV2Cluster[];
}

export interface GraphV2Cluster {
  clusterId: string;
  memberCount: number;
  representativePlayers: GraphV2PlayerSummary[];
  bestOpscoreMember: GraphV2PlayerSummary | null;
  worstFeedscoreMember: GraphV2PlayerSummary | null;
  highlightedPlayers: Array<{
    id: string;
    label: string;
    isBestOpscore: boolean;
    isWorstFeedscore: boolean;
  }>;
  internalAllyEdgeCount: number;
  enemyCrossClusterEdgeCount: number;
  crossAllySupport: number;
  connectedAllyClusterCount: number;
  orbitScore: number;
  orbitRadius: number;
  anchor: [number, number];
}

export interface GraphV2PlayerSummary {
  id: string;
  label: string;
  opscore: number | null;
  feedscore: number | null;
}
