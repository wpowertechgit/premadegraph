import { buildAssortativityMockResponse } from "../src/assortativityMock.ts";

const response = buildAssortativityMockResponse({
  minEdgeSupport: 1,
  minPlayerMatchCount: 1,
  strongTieThreshold: 3,
  includeClusterBreakdown: true,
});

console.log(JSON.stringify(response));
