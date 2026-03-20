export type SignedTiePolicy = "exclude" | "ally" | "enemy";

export interface SignedBalanceRequest {
  minEdgeSupport: number;
  tiePolicy: SignedTiePolicy;
  maxTopNodes: number;
  includeClusterSummaries: boolean;
}

export interface SignedBalanceDecisions {
  graphScope: string;
  edgeProjection: string;
  supportMeasure: string;
  canonicalPositiveSign: string;
  canonicalNegativeSign: string;
  signRule: string;
  tiePolicy: SignedTiePolicy;
  minEdgeSupport: number;
  validTriadRule: string;
}

export interface SignedBalanceGraphSummary {
  filteredNodes: number;
  projectedNodes: number;
  candidateEdges: number;
  analyzedEdges: number;
  excludedLowSupportEdges: number;
  excludedTiedEdges: number;
}

export interface SignedBalanceTriadSummary {
  totalAnalyzed: number;
  balancedCount: number;
  unbalancedCount: number;
  balancedRatio: number;
}

export interface SignedTriadTypeCount {
  triadType: "+++" | "++-" | "+--" | "---" | string;
  balanced: boolean;
  count: number;
}

export interface SignedTriadExampleNode {
  playerId: string;
  label: string;
}

export interface SignedTriadExampleEdge {
  from: string;
  to: string;
  sign: 1 | -1;
}

export interface SignedTriadExample {
  triadType: "+++" | "++-" | "+--" | "---" | string;
  balanced: boolean;
  nodes: SignedTriadExampleNode[];
  edges: SignedTriadExampleEdge[];
}

export interface SignedBalanceNodeSummary {
  playerId: string;
  label: string;
  totalTriads: number;
  unbalancedTriads: number;
  instabilityScore: number;
}

export interface SignedBalanceClusterSummary {
  clusterId: string;
  size: number;
  localTriads: number;
  balancedCount: number;
  unbalancedCount: number;
  balancedRatio: number;
}

export interface SignedBalanceResponse {
  status: string;
  decisions: SignedBalanceDecisions;
  graphSummary: SignedBalanceGraphSummary;
  triads: SignedBalanceTriadSummary;
  triadTypeDistribution: SignedTriadTypeCount[];
  exampleTriads?: SignedTriadExample[];
  topUnbalancedNodes: SignedBalanceNodeSummary[];
  clusterSummaries: SignedBalanceClusterSummary[];
  warnings: string[];
}
