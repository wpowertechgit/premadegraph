import React, { useEffect, useState } from "react";
import PlaybackControls from "./PlaybackControls";
import PlayerLookupField from "./PlayerLookupField";
import PathfinderGraphScene from "./PathfinderGraphScene";
import {
  type AlgorithmId,
  type CanvasFrame,
  type GraphSnapshot,
  type PathfinderRunResponse,
  type PathMode,
  type PlaybackState,
  type PlayerOption,
} from "./pathfinderTypes";
import { getAlgorithmLabel, getPathModeLabel, getPhaseLabel, useI18n } from "./i18n";

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
  currentStepIndex: number;
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
  currentStepIndex,
  onPlay,
  onPause,
  onRestart,
  onStepForward,
  onStepBackward,
  onSpeedChange,
  onRunSearch,
  datasetSummary,
}: PathfinderGraphOverlayProps) {
  const { language, t } = useI18n();
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

  const totalTraceSteps = run?.trace.length ?? 0;
  const playbackProgressLabel = totalTraceSteps > 0
    ? `${t.pathfinder.currentStep}: ${Math.min(currentStepIndex + 1, totalTraceSteps)} / ${totalTraceSteps}`
    : `${t.pathfinder.currentStep}: 0 / 0`;

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
          width: "calc(100vw - 1.5rem)",
          height: "calc(100vh - 1.5rem)",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(520px, 620px)",
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
                {t.pathfinder.graphExplorer}
              </div>
              <div style={{ color: "#f3f4f6", fontSize: "1.4rem", fontWeight: 700 }}>
                {t.pathfinder.fullGraphView}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: "999px",
                border: "1px solid #3a414a",
                background: "#252a31",
                color: "#e5e7eb",
                width: "2.4rem",
                height: "2.4rem",
                padding: 0,
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              X
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
          <div style={{ fontWeight: 700, color: "#f3f4f6" }}>{t.pathfinder.searchControls}</div>

          <div style={{ display: "grid", gap: "0.7rem" }}>
            <PlayerLookupField
              label={t.pathfinder.sourcePlayer}
              players={players}
              selectedId={draftSourcePlayerId}
              onSelectedIdChange={setDraftSourcePlayerId}
            />
            <PlayerLookupField
              label={t.pathfinder.targetPlayer}
              players={players}
              selectedId={draftTargetPlayerId}
              onSelectedIdChange={setDraftTargetPlayerId}
            />
            <div>
              <div style={{ color: "#9ca3af", fontSize: "0.82rem", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                {t.pathfinder.algorithm}
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
                    {getAlgorithmLabel(language, item)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ color: "#9ca3af", fontSize: "0.82rem", textTransform: "uppercase" }}>{t.pathfinder.pathMode}</div>
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
                {getPathModeLabel(language, "social-path")}
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
                {getPathModeLabel(language, "battle-path")}
              </button>
            </div>
            <div>
              <div style={{ color: "#9ca3af", fontSize: "0.82rem", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                {t.pathfinder.weightedMode}
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
                  ? t.pathfinder.weightedEnabled
                  : t.pathfinder.weightedOff}
              </button>
            </div>
            <div style={{ color: "#9ca3af", fontSize: "0.85rem", lineHeight: 1.5 }}>
              {t.pathfinder.pageDescription}
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
              {loading ? t.pathfinder.updating : t.pathfinder.applySearch}
            </button>
          </div>

          <div style={{ height: 1, background: "#323842", margin: "0.2rem 0" }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.85rem" }}>
            <PlaybackControls
              title={t.pathfinder.playback}
              progressLabel={playbackProgressLabel}
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

            <div
              style={{
                background: "#1d2127",
                border: "1px solid #303741",
                borderRadius: "18px",
                padding: "1rem",
                display: "grid",
                gap: "0.35rem",
              }}
            >
              <div style={{ fontWeight: 700, color: "#f3f4f6" }}>{t.pathfinder.runStatus}</div>
              <div>{t.pathfinder.source}: {players.find((player) => player.id === sourcePlayerId)?.label ?? sourcePlayerId}</div>
              <div>{t.pathfinder.target}: {players.find((player) => player.id === targetPlayerId)?.label ?? targetPlayerId}</div>
              <div>{t.pathfinder.algorithm}: {getAlgorithmLabel(language, algorithm)}</div>
              <div>{t.pathfinder.pathMode}: {getPathModeLabel(language, pathMode)}</div>
              <div>
                {t.pathfinder.weightedMode}: {(algorithm === "dijkstra" || algorithm === "astar") && weightedMode
                  ? t.pathfinder.weightedEnabled
                  : t.pathfinder.weightedOff}
              </div>
              <div>{t.pathfinder.phase}: {getPhaseLabel(language, frame.phase)}</div>
              <div>{playbackProgressLabel}</div>
              <div>{t.pathfinder.nodesVisited}: {frame.visitedNodeIds.length}</div>
              <div>{t.pathfinder.revealedEdges}: {frame.revealedEdgeKeys.length}</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.85rem",
              alignItems: "start",
            }}
          >
            <div
              style={{
                background: "#1d2127",
                border: "1px solid #303741",
                borderRadius: "18px",
                padding: "1rem",
                display: "grid",
                gap: "0.35rem",
              }}
            >
              <div style={{ fontWeight: 700, color: "#f3f4f6" }}>{t.pathfinder.graphSummary}</div>
              <div>{datasetSummary.players} {t.pathfinder.players}</div>
              <div>{datasetSummary.relationships} {t.pathfinder.relationships.toLowerCase()}</div>
              <div>{datasetSummary.allyRelationships} {t.pathfinder.allyEdges}</div>
              <div>{datasetSummary.enemyRelationships} {t.pathfinder.enemyEdges}</div>
            </div>

            <div
              style={{
                background: "#1d2127",
                border: "1px solid #303741",
                borderRadius: "18px",
                padding: "1rem",
                color: "#9ca3af",
                lineHeight: 1.5,
              }}
            >
              {t.pathfinder.overlayExplanation}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
