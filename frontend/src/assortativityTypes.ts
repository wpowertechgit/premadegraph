export type AssortativityRequest = {
  minEdgeSupport: number;
  minPlayerMatchCount: number;
  strongTieThreshold: number;
  includeClusterBreakdown: boolean;
};

export type AssortativitySample = {
  coefficient: number | null;
  sampleSize: number;
};

export type AssortativityMetricResult = {
  graphMode: "social-path" | "battle-path";
  metric: "opscore" | "feedscore";
  eligibleNodes: number;
  candidateEdges: number;
  analyzedEdges: number;
  skippedLowEdgeSupportEdges: number;
  skippedMissingMetricEdges: number;
  skippedLowMatchCountEdges: number;
  global: AssortativitySample;
  withinCluster: AssortativitySample;
  crossCluster: AssortativitySample;
  strongTies: AssortativitySample;
  weakTies: AssortativitySample;
};

export type AssortativityDecisions = {
  graphScope: string;
  graphModes: string[];
  metrics: string[];
  graphModeRule: string;
  nodeEligibilityRule: string;
  assortativityFormula: string;
  minEdgeSupport: number;
  minPlayerMatchCount: number;
  strongTieThreshold: number;
};

export type AssortativityResponse = {
  status: "ok" | "insufficient_data";
  decisions: AssortativityDecisions;
  results: AssortativityMetricResult[];
  warnings: string[];
};
