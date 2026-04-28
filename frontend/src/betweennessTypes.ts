export type BetweennessPathMode = "social-path" | "battle-path";

export type BetweennessCentralityRequest = {
  pathMode: BetweennessPathMode;
  weightedMode: boolean;
  minEdgeSupport: number;
  maxTopNodes: number;
  parallel: boolean;
  runSerialBaseline: boolean;
  includeFullResults: boolean;
};

export type BetweennessCentralityDecisions = {
  graphScope: string;
  algorithm: string;
  parallelization: string;
  graphMode: BetweennessPathMode;
  weightedMode: boolean;
  edgeSupportRule: string;
  edgeCostRule: string;
  normalizationRule: string;
  minEdgeSupport: number;
};

export type BetweennessCentralityGraphSummary = {
  runtimeNodes: number;
  projectedNodes: number;
  candidateEdges: number;
  analyzedEdges: number;
  skippedLowSupportEdges: number;
  skippedInvalidEdges: number;
};

export type BetweennessCentralityRuntime = {
  algorithmRuntimeMs: number;
  serialRuntimeMs: number | null;
  parallelRuntimeMs: number | null;
  speedup: number | null;
  rayonThreads: number;
  parallelChunks: number;
  serialParallelMaxAbsDelta: number | null;
};

export type BetweennessCentralityNodeResult = {
  rank: number;
  playerId: string;
  label: string;
  clusterId: string | null;
  degree: number;
  weightedStrength: number;
  rawBetweenness: number;
  normalizedBetweenness: number;
};

export type BetweennessCentralityResponse = {
  status: string;
  decisions: BetweennessCentralityDecisions;
  graphSummary: BetweennessCentralityGraphSummary;
  runtime: BetweennessCentralityRuntime;
  topNodes: BetweennessCentralityNodeResult[];
  fullResults?: BetweennessCentralityNodeResult[];
  warnings: string[];
};
