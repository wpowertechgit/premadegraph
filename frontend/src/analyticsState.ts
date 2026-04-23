import type { AssortativityRequest, AssortativityResponse } from "./assortativityTypes";
import type { SignedBalanceRequest, SignedBalanceResponse } from "./signedBalanceTypes";

export const ANALYTICS_STORAGE_KEYS = {
  signedBalance: "premadegraph:last-signed-balance",
  assortativity: "premadegraph:last-assortativity",
} as const;

export const RECOMMENDED_SIGNED_BALANCE_REQUEST: SignedBalanceRequest = {
  minEdgeSupport: 2,
  tiePolicy: "exclude",
  maxTopNodes: 10,
  includeClusterSummaries: true,
};

export const RECOMMENDED_ASSORTATIVITY_REQUEST: AssortativityRequest = {
  minEdgeSupport: 2,
  minPlayerMatchCount: 5,
  strongTieThreshold: 3,
  includeClusterBreakdown: true,
};

export type AnalyticsDatasetMode = "full" | "mock";

type PersistedRun<TRequest, TResult> = {
  datasetMode: AnalyticsDatasetMode;
  request: TRequest;
  result: TResult;
  savedAt: string;
};

function readPersistedRun<TRequest, TResult>(key: string): PersistedRun<TRequest, TResult> | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as PersistedRun<TRequest, TResult>;
  } catch {
    return null;
  }
}

function writePersistedRun<TRequest, TResult>(key: string, value: PersistedRun<TRequest, TResult>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures and keep the UI usable.
  }
}

export function loadPersistedSignedBalance() {
  return readPersistedRun<SignedBalanceRequest, SignedBalanceResponse>(ANALYTICS_STORAGE_KEYS.signedBalance);
}

export function loadPersistedAssortativity() {
  return readPersistedRun<AssortativityRequest, AssortativityResponse>(ANALYTICS_STORAGE_KEYS.assortativity);
}

export function persistSignedBalanceRun(
  request: SignedBalanceRequest,
  result: SignedBalanceResponse,
  datasetMode: AnalyticsDatasetMode,
) {
  writePersistedRun(ANALYTICS_STORAGE_KEYS.signedBalance, {
    datasetMode,
    request,
    result,
    savedAt: new Date().toISOString(),
  });
}

export function persistAssortativityRun(
  request: AssortativityRequest,
  result: AssortativityResponse,
  datasetMode: AnalyticsDatasetMode,
) {
  writePersistedRun(ANALYTICS_STORAGE_KEYS.assortativity, {
    datasetMode,
    request,
    result,
    savedAt: new Date().toISOString(),
  });
}

export function classifyBalanceFinding(balanceRatio: number | null | undefined) {
  if (balanceRatio === null || balanceRatio === undefined || Number.isNaN(balanceRatio)) {
    return "neutral" as const;
  }
  if (balanceRatio > 0.65) {
    return "high-balance" as const;
  }
  if (balanceRatio < 0.4) {
    return "low-balance" as const;
  }
  return "neutral" as const;
}

export function classifyAssortativityFinding(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "neutral" as const;
  }
  if (value > 0.2) {
    return "high-assortativity" as const;
  }
  if (value < -0.2) {
    return "low-assortativity" as const;
  }
  return "neutral" as const;
}

export function explainBalanceFinding(balanceRatio: number | null | undefined) {
  const finding = classifyBalanceFinding(balanceRatio);
  if (finding === "high-balance") {
    return "Most local patterns are coherent.";
  }
  if (finding === "low-balance") {
    return "Local patterns contain substantial contradictions.";
  }
  return "Local structure shows a mix of coherent and contradictory patterns.";
}

export function explainAssortativityFinding(value: number | null | undefined) {
  const finding = classifyAssortativityFinding(value);
  if (finding === "high-assortativity") {
    return "Connected players tend to have similar performance.";
  }
  if (finding === "low-assortativity") {
    return "Connected players tend to have dissimilar performance.";
  }
  return "Performance largely uncorrelated with connection.";
}

export function coefficientTone(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "neutral" as const;
  }
  if (value > 0.2) {
    return "balanced" as const;
  }
  if (value < -0.2) {
    return "unbalanced" as const;
  }
  return "neutral" as const;
}

export function formatSignedPercent(value: number, locale = "en-US") {
  return value.toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    style: "percent",
  });
}

export function formatCoefficient(value: number | null | undefined, locale = "en-US") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return value.toLocaleString(locale, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    signDisplay: "always",
  });
}

export function findAssortativityMetric(
  response: AssortativityResponse | null,
  graphMode: "social-path" | "battle-path",
  metric: "opscore" | "feedscore",
) {
  return response?.results.find((item) => item.graphMode === graphMode && item.metric === metric) ?? null;
}
