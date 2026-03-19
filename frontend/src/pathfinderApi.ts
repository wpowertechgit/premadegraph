import type {
  PathfinderCompareRequest,
  PathfinderCompareResponse,
  PathfinderEngineSpecResponse,
  PathfinderOptionsResponse,
  PathfinderRequest,
  PathfinderRunResponse,
  SavedReplayRecord,
} from "./pathfinderTypes";
import type { BirdseyeBuffers, BirdseyeManifest, BirdseyeNodeMeta } from "./graphSphereTypes";
import type { SignedBalanceRequest, SignedBalanceResponse } from "./signedBalanceTypes";

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

export async function fetchPathfinderCompare(
  request: PathfinderCompareRequest,
): Promise<PathfinderCompareResponse> {
  const response = await fetch(`${API_BASE}/compare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return parseJsonResponse<PathfinderCompareResponse>(response);
}

export async function fetchRustPathfinderCompare(
  request: PathfinderCompareRequest,
): Promise<PathfinderCompareResponse> {
  const response = await fetch(`${RUST_API_BASE}/compare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return parseJsonResponse<PathfinderCompareResponse>(response);
}

export async function fetchPathfinderReplays(): Promise<{ replays: SavedReplayRecord[] }> {
  const response = await fetch("http://localhost:3001/api/pathfinder-replays");
  return parseJsonResponse<{ replays: SavedReplayRecord[] }>(response);
}

export async function savePathfinderReplay(replay: Omit<SavedReplayRecord, "id" | "createdAt">): Promise<SavedReplayRecord> {
  const response = await fetch("http://localhost:3001/api/pathfinder-replays", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(replay),
  });

  return parseJsonResponse<SavedReplayRecord>(response);
}

export async function deletePathfinderReplay(replayId: number): Promise<{ ok: true }> {
  const response = await fetch(`http://localhost:3001/api/pathfinder-replays/${replayId}`, {
    method: "DELETE",
  });

  return parseJsonResponse<{ ok: true }>(response);
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    let message = "Birdseye backend request failed.";
    try {
      const payload = await response.json();
      message = payload?.error || message;
    } catch {
      // Keep the fallback message when the endpoint is binary or invalid JSON.
    }
    throw new Error(message);
  }
  return response.arrayBuffer();
}

export async function fetchRustBirdseyeManifest(): Promise<BirdseyeManifest> {
  const response = await fetch(`${RUST_API_BASE}/birdseye-3d/manifest`);
  return parseJsonResponse<BirdseyeManifest>(response);
}

export async function fetchRustBirdseyeNodeMeta(): Promise<BirdseyeNodeMeta> {
  const response = await fetch(`${RUST_API_BASE}/birdseye-3d/node-meta`);
  return parseJsonResponse<BirdseyeNodeMeta>(response);
}

export async function fetchRustBirdseyeBuffers(): Promise<BirdseyeBuffers> {
  const [nodePositions, nodeMetrics, edgePairs, edgeProps] = await Promise.all([
    fetchArrayBuffer(`${RUST_API_BASE}/birdseye-3d/node-positions`),
    fetchArrayBuffer(`${RUST_API_BASE}/birdseye-3d/node-metrics`),
    fetchArrayBuffer(`${RUST_API_BASE}/birdseye-3d/edge-pairs`),
    fetchArrayBuffer(`${RUST_API_BASE}/birdseye-3d/edge-props`),
  ]);

  return {
    nodePositions: new Float32Array(nodePositions),
    nodeMetrics: new Uint32Array(nodeMetrics),
    edgePairs: new Uint32Array(edgePairs),
    edgeProps: new Uint32Array(edgeProps),
  };
}

export async function runRustSignedBalance(request: SignedBalanceRequest): Promise<SignedBalanceResponse> {
  const response = await fetch(`${RUST_API_BASE}/signed-balance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return parseJsonResponse<SignedBalanceResponse>(response);
}
