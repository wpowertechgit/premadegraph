import React, { useEffect, useState } from "react";
import PlaybackControls from "./PlaybackControls";
import PlayerLookupField from "./PlayerLookupField";
import PathfinderGraphScene from "./PathfinderGraphScene";
import {
  ALGORITHM_LABELS,
  PATH_MODE_LABELS,
  type AlgorithmId,
  type CanvasFrame,
  type GraphSnapshot,
  type PathfinderRunResponse,
  type PathMode,
  type PlaybackState,
  type PlayerOption,
} from "./pathfinderTypes";

interface PathfinderGraphOverlayProps {
  open: boolean;
  onClose: () => void;
  players: PlayerOption[];
  supportedAlgorithms: AlgorithmId[];
  snapshot: GraphSnapshot;
  run: PathfinderRunResponse | null;
  frame: CanvasFrame;
  sourcePlayerId: string;
  targetPlayerId: string;
  algorithm: AlgorithmId;
  pathMode: PathMode;
  weightedMode: boolean;
  loading: boolean;
  playbackState: PlaybackState;
  playbackSpeed: number;
  canStep: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSpeedChange: (value: number) => void;
  onRunSearch: (overrides: {
    sourcePlayerId: string;
    targetPlayerId: string;
    algorithm: AlgorithmId;
    pathMode: PathMode;
    weightedMode: boolean;
  }) => void | Promise<void>;
  datasetSummary: {
    players: number;
    relationships: number;
    allyRelationships: number;
    enemyRelationships: number;
  };
}

export default function PathfinderGraphOverlay({
  open,
  onClose,
  players,
  supportedAlgorithms,
  snapshot,
  run,
  frame,
  sourcePlayerId,
  targetPlayerId,
  algorithm,
  pathMode,
  weightedMode,
  loading,
  playbackState,
  playbackSpeed,
  canStep,
  onPlay,
  onPause,
  onRestart,
  onStepForward,
  onStepBackward,
  onSpeedChange,
  onRunSearch,
  datasetSummary,
}: PathfinderGraphOverlayProps) {
  const [draftSourcePlayerId, setDraftSourcePlayerId] = useState(sourcePlayerId);
  const [draftTargetPlayerId, setDraftTargetPlayerId] = useState(targetPlayerId);
  const [draftAlgorithm, setDraftAlgorithm] = useState<AlgorithmId>(algorithm);
  const [draftPathMode, setDraftPathMode] = useState<PathMode>(pathMode);
  const [draftWeightedMode, setDraftWeightedMode] = useState(weightedMode);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftSourcePlayerId(sourcePlayerId);
    setDraftTargetPlayerId(targetPlayerId);
    setDraftAlgorithm(algorithm);
    setDraftPathMode(pathMode);
    setDraftWeightedMode(weightedMode);
  }, [algorithm, open, pathMode, sourcePlayerId, targetPlayerId, weightedMode]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 12, 16, 0.78)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 180ms ease",
        zIndex: 1200,
        padding: "0.75rem",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "min(1420px, calc(100vw - 1.5rem))",
          height: "min(960px, calc(100vh - 1.5rem))",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 340px)",
          gap: "0.85rem",
          background: "#171a1f",
          border: "1px solid #313740",
          borderRadius: "22px",
          boxShadow: "0 30px 90px rgba(0, 0, 0, 0.45)",
          padding: "0.85rem",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "grid", gap: "0.75rem", minWidth: 0, minHeight: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ color: "#9ca3af", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Graph Explorer
              </div>
              <div style={{ color: "#f3f4f6", fontSize: "1.4rem", fontWeight: 700 }}>
                Full graph view with live controls
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: "12px",
                border: "1px solid #3a414a",
                background: "#252a31",
                color: "#e5e7eb",
                padding: "0.65rem 0.9rem",
              }}
            >
              Close Overlay
            </button>
          </div>

          <div style={{ minWidth: 0, minHeight: 0 }}>
            <PathfinderGraphScene
              snapshot={snapshot}
              run={run}
              frame={frame}
              sourcePlayerId={sourcePlayerId}
              targetPlayerId={targetPlayerId}
              variant="overlay"
            />
          </div>
        </div>

        <aside
          style={{
            borderRadius: "16px",
            border: "1px solid #2f363f",
            background: "#1d2127",
            padding: "1rem",
            color: "#d1d5db",
            display: "grid",
            alignContent: "start",
            gap: "0.85rem",
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          <div style={{ fontWeight: 700, color: "#f3f4f6" }}>Search Controls</div>

          <div style={{ display: "grid", gap: "0.7rem" }}>
            <PlayerLookupField
              label="Source Player"
              players={players}
              selectedId={draftSourcePlayerId}
              onSelectedIdChange={setDraftSourcePlayerId}
            />
            <PlayerLookupField
              label="Target Player"
              players={players}
              selectedId={draftTargetPlayerId}
              onSelectedIdChange={setDraftTargetPlayerId}
            />
            <div>
              <div style={{ color: "#9ca3af", fontSize: "0.82rem", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                Algorithm
              </div>
              <select
                value={draftAlgorithm}
                onChange={(event) => {
                  const nextAlgorithm = event.target.value as AlgorithmId;
                  setDraftAlgorithm(nextAlgorithm);
                  if (nextAlgorithm !== "dijkstra" && nextAlgorithm !== "astar") {
                    setDraftWeightedMode(false);
                  }
                }}
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  border: "1px solid #39424d",
                  background: "#20252c",
                  color: "#f3f4f6",
                  padding: "0.8rem 0.9rem",
                }}
              >
                {supportedAlgorithms.map((item) => (
                  <option key={item} value={item}>
                    {ALGORITHM_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ color: "#9ca3af", fontSize: "0.82rem", textTransform: "uppercase" }}>Path Mode</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
              <button
                type="button"
                disabled={loading || draftPathMode === "social-path"}
                onClick={() => setDraftPathMode("social-path")}
                style={{
                  borderRadius: "12px",
                  border: "1px solid #39424d",
                  background: draftPathMode === "social-path" ? "#d6f5e8" : "#20252c",
                  color: draftPathMode === "social-path" ? "#114b33" : "#f3f4f6",
                  padding: "0.7rem",
                  fontWeight: 700,
                }}
              >
                {PATH_MODE_LABELS["social-path"]}
              </button>
              <button
                type="button"
                disabled={loading || draftPathMode === "battle-path"}
                onClick={() => setDraftPathMode("battle-path")}
                style={{
                  borderRadius: "12px",
                  border: "1px solid #39424d",
                  background: draftPathMode === "battle-path" ? "#fde4d7" : "#20252c",
                  color: draftPathMode === "battle-path" ? "#6e2812" : "#f3f4f6",
                  padding: "0.7rem",
                  fontWeight: 700,
                }}
              >
                {PATH_MODE_LABELS["battle-path"]}
              </button>
            </div>
            <div>
              <div style={{ color: "#9ca3af", fontSize: "0.82rem", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                Weighted Mode
              </div>
              <button
                type="button"
                disabled={loading || (draftAlgorithm !== "dijkstra" && draftAlgorithm !== "astar")}
                onClick={() => setDraftWeightedMode((current) => !current)}
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  border: draftWeightedMode && (draftAlgorithm === "dijkstra" || draftAlgorithm === "astar") ? "1px solid #5680a7" : "1px solid #39424d",
                  background: draftWeightedMode && (draftAlgorithm === "dijkstra" || draftAlgorithm === "astar") ? "#263844" : "#20252c",
                  color: "#f3f4f6",
                  padding: "0.8rem 0.9rem",
                  textAlign: "left",
                  opacity: draftAlgorithm === "dijkstra" || draftAlgorithm === "astar" ? 1 : 0.65,
                  cursor: draftAlgorithm === "dijkstra" || draftAlgorithm === "astar" ? "pointer" : "not-allowed",
                }}
              >
                {draftWeightedMode && (draftAlgorithm === "dijkstra" || draftAlgorithm === "astar")
                  ? "Enabled: prioritize stronger repeated edges"
                  : "Off: treat every edge as the same cost"}
              </button>
            </div>
            <div style={{ color: "#9ca3af", fontSize: "0.85rem", lineHeight: 1.5 }}>
              Use player search, algorithm choice, path mode, and weighted Dijkstra together, then apply the
              query from here.
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                onRunSearch({
                  sourcePlayerId: draftSourcePlayerId,
                  targetPlayerId: draftTargetPlayerId,
                  algorithm: draftAlgorithm,
                  pathMode: draftPathMode,
                  weightedMode:
                    draftAlgorithm === "dijkstra" || draftAlgorithm === "astar"
                      ? draftWeightedMode
                      : false,
                })
              }
              style={{
                borderRadius: "12px",
                border: "1px solid #4f677f",
                background: "#2f455b",
                color: "#f3f4f6",
                padding: "0.85rem 0.9rem",
                fontWeight: 700,
              }}
            >
              {loading ? "Updating..." : "Apply Search"}
            </button>
          </div>

          <div style={{ height: 1, background: "#323842", margin: "0.2rem 0" }} />

          <PlaybackControls
            title="Playback"
            playbackState={playbackState}
            playbackSpeed={playbackSpeed}
            canStep={canStep}
            onPlay={onPlay}
            onPause={onPause}
            onRestart={onRestart}
            onStepForward={onStepForward}
            onStepBackward={onStepBackward}
            onSpeedChange={onSpeedChange}
          />

          <div style={{ display: "grid", gap: "0.35rem" }}>
            <div style={{ fontWeight: 700, color: "#f3f4f6" }}>Run Status</div>
            <div>Source: {players.find((player) => player.id === sourcePlayerId)?.label ?? sourcePlayerId}</div>
            <div>Target: {players.find((player) => player.id === targetPlayerId)?.label ?? targetPlayerId}</div>
            <div>Algorithm: {ALGORITHM_LABELS[algorithm]}</div>
            <div>Path Mode: {PATH_MODE_LABELS[pathMode]}</div>
            <div>
              Weighted Mode: {(algorithm === "dijkstra" || algorithm === "astar") && weightedMode
                ? "Match-strength weighted"
                : "Uniform edge cost"}
            </div>
            <div>Phase: {frame.phase ?? "idle"}</div>
            <div>Step: {frame.stepNumber}</div>
            <div>Visited nodes: {frame.visitedNodeIds.length}</div>
            <div>Revealed edges: {frame.revealedEdgeKeys.length}</div>
          </div>

          <div style={{ display: "grid", gap: "0.35rem" }}>
            <div style={{ fontWeight: 700, color: "#f3f4f6" }}>Graph Summary</div>
            <div>{datasetSummary.players} players</div>
            <div>{datasetSummary.relationships} relationships</div>
            <div>{datasetSummary.allyRelationships} ally edges</div>
            <div>{datasetSummary.enemyRelationships} enemy edges</div>
          </div>

          <div style={{ color: "#9ca3af", lineHeight: 1.5 }}>
            Social path limits traversal to ally links. Battle path also allows enemy links, which can expose
            shorter or otherwise unreachable routes. When weighted search is enabled, repeated connections are
            cheaper, so stronger match-history edges are favored during the search. Playback reveals the visited
            frontier and then resolves the final route when the search finishes.
          </div>
        </aside>
      </div>
    </div>
  );
}
