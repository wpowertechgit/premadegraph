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
import type { GraphV2Buffers, GraphV2ClusterMeta, GraphV2Manifest, GraphV2NodeMeta } from "./graphV2Types";
import type { SignedBalanceRequest, SignedBalanceResponse } from "./signedBalanceTypes";
import type { AssortativityRequest, AssortativityResponse } from "./assortativityTypes";
import type { BetweennessCentralityRequest, BetweennessCentralityResponse } from "./betweennessTypes";

const API_BASE = "http://localhost:3001/api/pathfinder";
const RUST_API_BASE = "http://localhost:3001/api/pathfinder-rust";
const BACKEND_API_BASE = "http://localhost:3001/api";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Pathfinder backend request failed.");
    }
    return payload as T;
  }

  const rawText = await response.text();
  if (rawText.trimStart().startsWith("<!DOCTYPE") || rawText.trimStart().startsWith("<html")) {
    throw new Error(
      "The backend returned HTML instead of JSON. The backend server likely needs a restart so the new analysis endpoint becomes available.",
    );
  }

  throw new Error(
    rawText.trim() || "Pathfinder backend returned a non-JSON response.",
  );
}

export async function fetchPathfinderOptions(): Promise<PathfinderOptionsResponse> {
  const response = await fetch(`${API_BASE}/options`);
  return parseJsonResponse<PathfinderOptionsResponse>(response);
}

export async function fetchRustPathfinderOptions(): Promise<PathfinderOptionsResponse> {
  const response = await fetch(`${RUST_API_BASE}/options`);
  return parseJsonResponse<PathfinderOptionsResponse>(response);
}

export async function fetchPlayerOptions(): Promise<{ players: PathfinderOptionsResponse["players"] }> {
  const response = await fetch(`${BACKEND_API_BASE}/players/options`);
  return parseJsonResponse<{ players: PathfinderOptionsResponse["players"] }>(response);
}

export async function fetchPlayerScores(playerId: string) {
  const response = await fetch(`${BACKEND_API_BASE}/players/${encodeURIComponent(playerId)}/scores`);
  return parseJsonResponse(response);
}

export async function fetchScoresConfig() {
  const response = await fetch(`${BACKEND_API_BASE}/scores/config`);
  return parseJsonResponse(response);
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
    let message = "Rust graph artifact request failed.";
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

function graphV2ApiBase(datasetId?: string): string {
  if (!datasetId) {
    return `${RUST_API_BASE}/graph-v2`;
  }
  return `${RUST_API_BASE}/datasets/${encodeURIComponent(datasetId)}/graph-v2`;
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

export async function fetchRustGraphV2Manifest(datasetId?: string): Promise<GraphV2Manifest> {
  const response = await fetch(`${graphV2ApiBase(datasetId)}/manifest`);
  return parseJsonResponse<GraphV2Manifest>(response);
}

export async function fetchRustGraphV2NodeMeta(datasetId?: string): Promise<GraphV2NodeMeta> {
  const response = await fetch(`${graphV2ApiBase(datasetId)}/node-meta`);
  return parseJsonResponse<GraphV2NodeMeta>(response);
}

export async function fetchRustGraphV2ClusterMeta(datasetId?: string): Promise<GraphV2ClusterMeta> {
  const response = await fetch(`${graphV2ApiBase(datasetId)}/cluster-meta`);
  return parseJsonResponse<GraphV2ClusterMeta>(response);
}

export async function fetchRustGraphV2Summary(datasetId?: string): Promise<string> {
  const response = await fetch(`${graphV2ApiBase(datasetId)}/summary`);
  if (!response.ok) {
    let message = "Rust graph summary request failed.";
    try {
      const payload = await response.json();
      message = payload?.error || message;
    } catch {
      // Keep fallback when the backend returns plain text.
    }
    throw new Error(message);
  }
  return response.text();
}

export async function fetchRustGraphV2Buffers(datasetId?: string): Promise<GraphV2Buffers> {
  const baseUrl = graphV2ApiBase(datasetId);
  const [nodePositions, nodeMetrics, edgePairs, edgeProps] = await Promise.all([
    fetchArrayBuffer(`${baseUrl}/node-positions`),
    fetchArrayBuffer(`${baseUrl}/node-metrics`),
    fetchArrayBuffer(`${baseUrl}/edge-pairs`),
    fetchArrayBuffer(`${baseUrl}/edge-props`),
  ]);

  return {
    nodePositions: new Float32Array(nodePositions),
    nodeMetrics: new Uint32Array(nodeMetrics),
    edgePairs: new Uint32Array(edgePairs),
    edgeProps: new Uint32Array(edgeProps),
  };
}

export async function rebuildRustGraphV2(datasetId?: string): Promise<{ ok: true; manifest: GraphV2Manifest }> {
  const response = await fetch(`${graphV2ApiBase(datasetId)}/rebuild`, {
    method: "POST",
  });
  return parseJsonResponse<{ ok: true; manifest: GraphV2Manifest }>(response);
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

export async function runRustAssortativity(request: AssortativityRequest): Promise<AssortativityResponse> {
  const response = await fetch(`${RUST_API_BASE}/assortativity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return parseJsonResponse<AssortativityResponse>(response);
}

export async function runRustBetweennessCentrality(
  request: BetweennessCentralityRequest,
): Promise<BetweennessCentralityResponse> {
  const response = await fetch(`${RUST_API_BASE}/betweenness-centrality`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return parseJsonResponse<BetweennessCentralityResponse>(response);
}
