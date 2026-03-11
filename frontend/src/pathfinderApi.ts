import type {
  PathfinderCompareResponse,
  PathfinderEngineSpecResponse,
  PathfinderOptionsResponse,
  PathfinderRequest,
  PathfinderRunResponse,
} from "./pathfinderTypes";

const API_BASE = "http://localhost:3001/api/pathfinder";
const RUST_API_BASE = "http://localhost:3001/api/pathfinder-rust";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "Pathfinder backend request failed.");
  }
  return payload as T;
}

export async function fetchPathfinderOptions(): Promise<PathfinderOptionsResponse> {
  const response = await fetch(`${API_BASE}/options`);
  return parseJsonResponse<PathfinderOptionsResponse>(response);
}

export async function fetchRustPathfinderOptions(): Promise<PathfinderOptionsResponse> {
  const response = await fetch(`${RUST_API_BASE}/options`);
  return parseJsonResponse<PathfinderOptionsResponse>(response);
}

export async function fetchPathfinderEngineSpec(): Promise<PathfinderEngineSpecResponse> {
  const response = await fetch(`${API_BASE}/engine-spec`);
  return parseJsonResponse<PathfinderEngineSpecResponse>(response);
}

export async function fetchRustPathfinderEngineSpec(): Promise<PathfinderEngineSpecResponse> {
  const response = await fetch(`${RUST_API_BASE}/engine-spec`);
  return parseJsonResponse<PathfinderEngineSpecResponse>(response);
}

export async function runPathfinderBackend(request: PathfinderRequest): Promise<PathfinderRunResponse> {
  const response = await fetch(`${API_BASE}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return parseJsonResponse<PathfinderRunResponse>(response);
}

export async function runRustPathfinderBackend(request: PathfinderRequest): Promise<PathfinderRunResponse> {
  const response = await fetch(`${RUST_API_BASE}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return parseJsonResponse<PathfinderRunResponse>(response);
}

export async function fetchPathfinderCompare(request: {
  sourcePlayerId: string;
  targetPlayerId: string;
  pathMode: "social-path" | "battle-path";
}): Promise<PathfinderCompareResponse> {
  const response = await fetch(`${API_BASE}/compare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return parseJsonResponse<PathfinderCompareResponse>(response);
}

export async function fetchRustPathfinderCompare(request: {
  sourcePlayerId: string;
  targetPlayerId: string;
  pathMode: "social-path" | "battle-path";
}): Promise<PathfinderCompareResponse> {
  const response = await fetch(`${RUST_API_BASE}/compare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return parseJsonResponse<PathfinderCompareResponse>(response);
}
