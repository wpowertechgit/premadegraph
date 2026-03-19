import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AlgorithmComparisonTable from "./AlgorithmComparisonTable";
import PathfinderCanvas from "./PathfinderCanvas";
import PathfinderControls from "./PathfinderControls";
import PathfinderGraphOverlay from "./PathfinderGraphOverlay";
import PlaybackControls from "./PlaybackControls";
import RunSummaryPanel from "./RunSummaryPanel";
import { getComparisonRows, getMockGraphSnapshot, mockDatasetSummary, mockPlayers, runPathfinderMock } from "./pathfinderMocks";
import {
  deletePathfinderReplay,
  fetchPathfinderEngineSpec,
  fetchPathfinderReplays,
  fetchPathfinderOptions,
  fetchRustPathfinderEngineSpec,
  fetchRustPathfinderOptions,
  runPathfinderBackend,
  runRustPathfinderBackend,
  savePathfinderReplay,
} from "./pathfinderApi";
import { usePathfinderPlayback } from "./usePathfinderPlayback";
import {
  ALGORITHM_LABELS,
  type AlgorithmId,
  type ComparisonRow,
  type DatasetSummary,
  type ExecutionMode,
  type PathfinderEngineSpecResponse,
  type PathfinderOptionsResponse,
  type PathfinderRunResponse,
  type PathMode,
  type PlayerOption,
  type SavedReplayRecord,
} from "./pathfinderTypes";
import { useI18n } from "./i18n";

function getDefaultComparisonNote(
  sourcePlayerId: string,
  targetPlayerId: string,
  pathMode: PathMode,
  weightedMode: boolean,
  fallbackLabel: string,
) {
  const rows = getComparisonRows(sourcePlayerId, targetPlayerId, pathMode, weightedMode);
  const firstRunnable = rows.find((row) => row.supportedNow);
  return firstRunnable?.relativeNote ?? fallbackLabel;
}

function getExecutionLabel(executionMode: ExecutionMode, labels: {
  nodeBackend: string;
  rustBackend: string;
  browserReplay: string;
}) {
  if (executionMode === "backend") {
    return labels.nodeBackend;
  }
  if (executionMode === "rust-backend") {
    return labels.rustBackend;
  }
  return labels.browserReplay;
}

function buildRunCacheKey(
  executionMode: ExecutionMode,
  sourcePlayerId: string,
  targetPlayerId: string,
  pathMode: PathMode,
  weightedMode: boolean,
  datasetPlayerCount: number,
) {
  return [
    executionMode,
    sourcePlayerId,
    targetPlayerId,
    pathMode,
    weightedMode ? "weighted" : "unweighted",
    datasetPlayerCount,
  ].join("|");
}

function getPlayerLabel(players: PlayerOption[], playerId: string) {
  return players.find((player) => player.id === playerId)?.label ?? playerId;
}

function buildReplayTitle(sourceLabel: string, targetLabel: string, datasetPlayerCount: number) {
  return `${sourceLabel}-${targetLabel}-${datasetPlayerCount}`;
}

const ALL_ALGORITHMS: AlgorithmId[] = ["bfs", "dijkstra", "bidirectional", "astar"];

function createComparisonRowsFromRuns(runs: PathfinderRunResponse[]): ComparisonRow[] {
  const runByAlgorithm = new Map(runs.map((run) => [run.request.algorithm, run] as const));
  return ALL_ALGORITHMS.map((algorithm) => {
    const run = runByAlgorithm.get(algorithm);
    return {
      algorithm,
      label: ALGORITHM_LABELS[algorithm],
      supportedNow: Boolean(run),
      pathFound: run ? run.status === "found" || run.status === "same_source_target" : null,
      pathLength: run?.summary.pathLength ?? null,
      nodesVisited: run?.summary.nodesVisited ?? null,
      runtimeMs: run?.summary.runtimeMs ?? null,
      relativeNote: run
        ? (run.status === "found" || run.status === "same_source_target"
            ? "Path found for this algorithm."
            : "No path found for this algorithm.")
        : "Algorithm not available.",
    };
  });
}

export default function PathfinderLabPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const autorunHandledRef = useRef(false);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("rust-backend");
  const [sourcePlayerId, setSourcePlayerId] = useState(searchParams.get("source") ?? "");
  const [targetPlayerId, setTargetPlayerId] = useState(searchParams.get("target") ?? "");
  const [algorithm, setAlgorithm] = useState<AlgorithmId>(
    searchParams.get("algorithm") === "bfs" ||
    searchParams.get("algorithm") === "dijkstra" ||
    searchParams.get("algorithm") === "bidirectional" ||
    searchParams.get("algorithm") === "astar"
      ? (searchParams.get("algorithm") as AlgorithmId)
      : "astar",
  );
  const [pathMode, setPathMode] = useState<PathMode>(
    searchParams.get("pathMode") === "social-path" ? "social-path" : "battle-path",
  );
  const [weightedMode, setWeightedMode] = useState(searchParams.get("weighted") !== "0");
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState<PathfinderRunResponse | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [backendOptions, setBackendOptions] = useState<PathfinderOptionsResponse | null>(null);
  const [engineSpec, setEngineSpec] = useState<PathfinderEngineSpecResponse | null>(null);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [metadataRefreshKey, setMetadataRefreshKey] = useState(0);
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>(
    getComparisonRows("a", "f", "battle-path", true),
  );
  const [savedReplays, setSavedReplays] = useState<SavedReplayRecord[]>([]);
  const [comparisonNote, setComparisonNote] = useState(
    getDefaultComparisonNote("a", "f", "battle-path", true, t.pathfinder.defaultComparison),
  );
  const replayCacheRef = useRef<Map<string, SavedReplayRecord>>(new Map());
  const playback = usePathfinderPlayback(run);
  const usingFrontendReplay = executionMode === "frontend-demo";
  const players: PlayerOption[] = usingFrontendReplay
    ? mockPlayers
    : backendOptions?.players ?? [];
  const supportedAlgorithms: AlgorithmId[] = usingFrontendReplay
    ? ["bfs", "dijkstra", "bidirectional", "astar"]
    : backendOptions?.supportedAlgorithms ?? [];
  const datasetSummary: DatasetSummary = usingFrontendReplay
    ? mockDatasetSummary
    : backendOptions?.datasetSummary ?? {
        players: 0,
        relationships: 0,
        allyRelationships: 0,
        enemyRelationships: 0,
      };
  const decorateRun = (
    nextRun: PathfinderRunResponse,
    replayRecord: SavedReplayRecord,
    loadedFromSave: boolean,
  ): PathfinderRunResponse => {
    return {
      ...nextRun,
      replayMeta: {
        title: replayRecord.title,
        cacheKey: replayRecord.cacheKey,
        sourceLabel: replayRecord.sourceLabel,
        targetLabel: replayRecord.targetLabel,
        datasetPlayerCount: replayRecord.datasetPlayerCount,
        loadedFromSave,
      },
    };
  };

  const snapshot = useMemo(
    () =>
      run?.graphSnapshot ??
      (usingFrontendReplay
        ? getMockGraphSnapshot(pathMode, sourcePlayerId || "a", targetPlayerId || "f")
        : backendOptions?.previewSnapshot ?? { nodes: [], edges: [] }),
    [backendOptions, pathMode, run, sourcePlayerId, targetPlayerId, usingFrontendReplay],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSavedReplays() {
      try {
        const response = await fetchPathfinderReplays();
        if (cancelled) {
          return;
        }
        replayCacheRef.current = new Map(response.replays.map((replay) => [replay.cacheKey, replay] as const));
        setSavedReplays(response.replays);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load saved pathfinder replays:", error);
        }
      }
    }

    void loadSavedReplays();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBackendPrototypeMeta() {
      if (executionMode === "frontend-demo") {
        return;
      }

      setBackendOptions(null);
      setEngineSpec(null);
      setPlayersLoading(true);

      try {
        const [optionsResponse, engineSpecResponse] = executionMode === "rust-backend"
          ? await Promise.all([
              fetchRustPathfinderOptions(),
              fetchRustPathfinderEngineSpec(),
            ])
          : await Promise.all([
              fetchPathfinderOptions(),
              fetchPathfinderEngineSpec(),
            ]);

        if (cancelled) {
          return;
        }

        setBackendOptions(optionsResponse);
        setEngineSpec(engineSpecResponse);

        const nextPlayers = optionsResponse.players;
        if (nextPlayers.length > 1) {
          const requestedSource = searchParams.get("source");
          const requestedTarget = searchParams.get("target");
          const validSource = requestedSource && nextPlayers.some((player) => player.id === requestedSource)
            ? requestedSource
            : nextPlayers[0].id;
          const validTarget = requestedTarget && nextPlayers.some((player) => player.id === requestedTarget)
            ? requestedTarget
            : (nextPlayers[5]?.id || nextPlayers[1].id);

          setSourcePlayerId(validSource);
          setTargetPlayerId(validTarget);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load backend pathfinder metadata:", error);
          setComparisonNote(
            executionMode === "rust-backend"
              ? t.pathfinder.metadataRustFailed
              : t.pathfinder.metadataFailed,
          );
        }
      } finally {
        if (!cancelled) {
          setPlayersLoading(false);
        }
      }
    }

    loadBackendPrototypeMeta();
    return () => {
      cancelled = true;
    };
  }, [executionMode, metadataRefreshKey, searchParams]);

  useEffect(() => {
    if (usingFrontendReplay || !backendOptions || autorunHandledRef.current) {
      return;
    }

    if (searchParams.get("autorun") !== "1") {
      return;
    }

    if (!sourcePlayerId || !targetPlayerId) {
      return;
    }

    autorunHandledRef.current = true;
    void runPathfinder({
      sourcePlayerId,
      targetPlayerId,
      algorithm,
      pathMode,
      weightedMode,
    });
  }, [algorithm, backendOptions, pathMode, searchParams, sourcePlayerId, targetPlayerId, usingFrontendReplay, weightedMode]);

  useEffect(() => {
    if (!sourcePlayerId || !targetPlayerId) {
      return;
    }

    if (executionMode === "frontend-demo") {
      const nextRows = getComparisonRows(sourcePlayerId, targetPlayerId, pathMode, weightedMode);
      setComparisonRows(nextRows);
      const firstRunnable = nextRows.find((row) => row.supportedNow);
      setComparisonNote(firstRunnable?.relativeNote ?? t.pathfinder.defaultComparison);
    }
  }, [executionMode, pathMode, sourcePlayerId, targetPlayerId, weightedMode, t.pathfinder.defaultComparison]);

  const resetPrototype = () => {
    setRun(null);
    setComparisonNote(getDefaultComparisonNote(sourcePlayerId, targetPlayerId, pathMode, weightedMode, t.pathfinder.defaultComparison));
  };

  const runPathfinder = async (overrides?: {
    sourcePlayerId?: string;
    targetPlayerId?: string;
    algorithm?: AlgorithmId;
    pathMode?: PathMode;
    weightedMode?: boolean;
  }) => {
    const nextSourcePlayerId = overrides?.sourcePlayerId ?? sourcePlayerId;
    const nextTargetPlayerId = overrides?.targetPlayerId ?? targetPlayerId;
    const nextAlgorithm = overrides?.algorithm ?? algorithm;
    const nextPathMode = overrides?.pathMode ?? pathMode;
    const nextWeightedMode = nextAlgorithm === "dijkstra" || nextAlgorithm === "astar"
      ? (overrides?.weightedMode ?? weightedMode)
      : false;

    setLoading(true);
    try {
      const request = {
        sourcePlayerId: nextSourcePlayerId,
        targetPlayerId: nextTargetPlayerId,
        algorithm: nextAlgorithm,
        pathMode: nextPathMode,
        weightedMode: nextWeightedMode,
        options: {
          includeTrace: true,
          maxSteps: 50000,
        },
      };
      const cacheKey = buildRunCacheKey(
        executionMode,
        nextSourcePlayerId,
        nextTargetPlayerId,
        nextPathMode,
        nextWeightedMode,
        datasetSummary.players,
      );
      const cachedReplay = replayCacheRef.current.get(cacheKey);
      if (cachedReplay) {
        const cachedRun = cachedReplay.algorithmRuns.find((item) => item.request.algorithm === nextAlgorithm);
        if (cachedRun) {
          const updatedReplay = {
            ...cachedReplay,
            selectedAlgorithm: nextAlgorithm,
          };
          replayCacheRef.current.set(updatedReplay.cacheKey, updatedReplay);
          setSavedReplays((current) => current.map((item) => item.id === updatedReplay.id ? updatedReplay : item));
          void savePathfinderReplay({
            cacheKey: updatedReplay.cacheKey,
            title: updatedReplay.title,
            executionMode: updatedReplay.executionMode,
            sourcePlayerId: updatedReplay.sourcePlayerId,
            targetPlayerId: updatedReplay.targetPlayerId,
            sourceLabel: updatedReplay.sourceLabel,
            targetLabel: updatedReplay.targetLabel,
            datasetPlayerCount: updatedReplay.datasetPlayerCount,
            pathMode: updatedReplay.pathMode,
            weightedMode: updatedReplay.weightedMode,
            selectedAlgorithm: updatedReplay.selectedAlgorithm,
            comparisonRows: updatedReplay.comparisonRows,
            algorithmRuns: updatedReplay.algorithmRuns,
          }).catch((error) => {
            console.error("Failed to refresh saved replay selection:", error);
          });
          setComparisonRows(updatedReplay.comparisonRows);
          setRun(decorateRun(cachedRun, updatedReplay, true));
          const matchingRow = updatedReplay.comparisonRows.find((row) => row.algorithm === nextAlgorithm);
          setComparisonNote(matchingRow?.relativeNote ?? t.pathfinder.comparisonUnavailable);
          return;
        }
      }

      const executeRun = (algorithmToRun: AlgorithmId) => {
        const perAlgorithmRequest = {
          ...request,
          algorithm: algorithmToRun,
          weightedMode: algorithmToRun === "dijkstra" || algorithmToRun === "astar"
            ? nextWeightedMode
            : false,
        };
        return executionMode === "backend"
          ? runPathfinderBackend(perAlgorithmRequest)
          : executionMode === "rust-backend"
            ? runRustPathfinderBackend(perAlgorithmRequest)
            : runPathfinderMock(perAlgorithmRequest);
      };

      const algorithmRuns = await Promise.all(
        ALL_ALGORITHMS.map((algorithmToRun) => executeRun(algorithmToRun)),
      );
      const nextComparisonRows = createComparisonRowsFromRuns(algorithmRuns);
      const selectedRun = algorithmRuns.find((item) => item.request.algorithm === nextAlgorithm);
      if (!selectedRun) {
        throw new Error(`Selected algorithm ${nextAlgorithm} did not return a run result.`);
      }

      const replayDraft: Omit<SavedReplayRecord, "id" | "createdAt"> = {
        cacheKey,
        title: buildReplayTitle(
          getPlayerLabel(players, nextSourcePlayerId),
          getPlayerLabel(players, nextTargetPlayerId),
          datasetSummary.players,
        ),
        executionMode,
        sourcePlayerId: nextSourcePlayerId,
        targetPlayerId: nextTargetPlayerId,
        sourceLabel: getPlayerLabel(players, nextSourcePlayerId),
        targetLabel: getPlayerLabel(players, nextTargetPlayerId),
        datasetPlayerCount: datasetSummary.players,
        pathMode: nextPathMode,
        weightedMode: nextWeightedMode,
        selectedAlgorithm: nextAlgorithm,
        comparisonRows: nextComparisonRows,
        algorithmRuns,
      };
      const savedReplay = await savePathfinderReplay(replayDraft);
      replayCacheRef.current.set(savedReplay.cacheKey, savedReplay);
      setSavedReplays((current) => {
        const withoutCurrent = current.filter((item) => item.id !== savedReplay.id);
        return [savedReplay, ...withoutCurrent];
      });
      setComparisonRows(savedReplay.comparisonRows);
      setRun(decorateRun(selectedRun, savedReplay, false));
      const matchingRow = savedReplay.comparisonRows.find((row) => row.algorithm === nextAlgorithm);
      setComparisonNote(matchingRow?.relativeNote ?? t.pathfinder.comparisonUnavailable);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    await runPathfinder();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        padding: "1.25rem",
        boxSizing: "border-box",
        background: "#15181d",
        color: "#f3f4f6",
      }}
    >
      <div
        style={{
          maxWidth: "1320px",
          margin: "0 auto",
          display: "grid",
          gap: "1rem",
        }}
      >
        <section
          style={{
            padding: "1.1rem 1.15rem",
            borderRadius: "18px",
            background: "#1d2127",
            border: "1px solid #303741",
          }}
        >
          <div style={{ color: "#8b98a7", fontSize: "0.82rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {t.pathfinder.pageLabel}
          </div>
          <h1 style={{ margin: "0.4rem 0 0.55rem", fontSize: "clamp(2rem, 4vw, 3rem)" }}>
            {t.pathfinder.pageTitle}
          </h1>
          <p style={{ margin: 0, maxWidth: "860px", color: "#9ca3af" }}>
            {t.pathfinder.pageDescription}
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
          >
          {[
            { label: t.pathfinder.availablePlayers, value: datasetSummary.players },
            { label: t.pathfinder.relationships, value: datasetSummary.relationships },
            { label: t.pathfinder.renderer, value: t.pathfinder.canvasOverlay },
            {
              label: t.pathfinder.execution,
              value: getExecutionLabel(executionMode, {
                nodeBackend: t.pathfinder.nodeBackend,
                rustBackend: t.pathfinder.rustBackend,
                browserReplay: t.pathfinder.browserReplay,
              }),
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                borderRadius: "16px",
                border: "1px solid #303741",
                background: "#1d2127",
                padding: "0.9rem 1rem",
              }}
            >
              <div style={{ color: "#8b98a7", fontSize: "0.78rem", textTransform: "uppercase" }}>{item.label}</div>
              <div style={{ color: "#f3f4f6", fontSize: "1.2rem", fontWeight: 700, marginTop: "0.25rem" }}>
                {item.value}
              </div>
            </div>
          ))}
        </section>

        <PathfinderControls
          players={players}
          supportedAlgorithms={supportedAlgorithms}
          sourcePlayerId={sourcePlayerId}
          targetPlayerId={targetPlayerId}
          algorithm={algorithm}
          pathMode={pathMode}
          weightedMode={weightedMode}
          executionMode={executionMode}
          loading={loading}
          playersLoading={playersLoading}
          onSourceChange={(value) => {
            setSourcePlayerId(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(value, targetPlayerId, pathMode, weightedMode, t.pathfinder.defaultComparison));
          }}
          onTargetChange={(value) => {
            setTargetPlayerId(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(sourcePlayerId, value, pathMode, weightedMode, t.pathfinder.defaultComparison));
          }}
          onAlgorithmChange={(value) => {
            setAlgorithm(value);
            if (value !== "dijkstra" && value !== "astar") {
              setWeightedMode(false);
            }
            setRun(null);
            setComparisonNote(
              getDefaultComparisonNote(
                sourcePlayerId,
                targetPlayerId,
                pathMode,
                value === "dijkstra" || value === "astar" ? weightedMode : false,
                t.pathfinder.defaultComparison,
              ),
            );
          }}
          onPathModeChange={(value) => {
            setPathMode(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(sourcePlayerId, targetPlayerId, value, weightedMode, t.pathfinder.defaultComparison));
          }}
          onWeightedModeChange={(value) => {
            setWeightedMode(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(sourcePlayerId, targetPlayerId, pathMode, value, t.pathfinder.defaultComparison));
          }}
          onExecutionModeChange={(value) => {
            const nextSourcePlayerId = value === "frontend-demo"
              ? (mockPlayers[0]?.id ?? "")
              : sourcePlayerId;
            const nextTargetPlayerId = value === "frontend-demo"
              ? (mockPlayers[mockPlayers.length - 1]?.id ?? "")
              : targetPlayerId;
            setExecutionMode(value);
            if (value === "frontend-demo") {
              setSourcePlayerId(nextSourcePlayerId);
              setTargetPlayerId(nextTargetPlayerId);
            }
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(nextSourcePlayerId, nextTargetPlayerId, pathMode, weightedMode, t.pathfinder.defaultComparison));
          }}
          onReloadPlayers={() => {
            setMetadataRefreshKey((current) => current + 1);
          }}
          onRun={handleRun}
          onReset={resetPrototype}
        />

        <section
          style={{
            borderRadius: "18px",
            border: "1px solid #303741",
            background: "#1d2127",
            padding: "1rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
          }}
        >
          <div>
            <div style={{ color: "#8b98a7", fontSize: "0.8rem", textTransform: "uppercase" }}>
              {t.pathfinder.whatGraphShows}
            </div>
            <div style={{ marginTop: "0.4rem", color: "#9ca3af", lineHeight: 1.5 }}>
              {t.pathfinder.whatGraphShowsText}
            </div>
          </div>
          <div>
            <div style={{ color: "#8b98a7", fontSize: "0.8rem", textTransform: "uppercase" }}>
              {t.pathfinder.pathModes}
            </div>
            <div style={{ marginTop: "0.4rem", color: "#9ca3af", lineHeight: 1.5 }}>
              {t.pathfinder.pathModesText}
            </div>
          </div>
          <div>
            <div style={{ color: "#8b98a7", fontSize: "0.8rem", textTransform: "uppercase" }}>
              {t.pathfinder.algorithmsPlayback}
            </div>
            <div style={{ marginTop: "0.4rem", color: "#9ca3af", lineHeight: 1.5 }}>
              {t.pathfinder.algorithmsPlaybackText}
            </div>
          </div>
          <div>
            <div style={{ color: "#8b98a7", fontSize: "0.8rem", textTransform: "uppercase" }}>
              {t.pathfinder.activeExecution}
            </div>
            <div style={{ marginTop: "0.4rem", color: "#9ca3af", lineHeight: 1.5 }}>
              {t.pathfinder.currentModePrefix}: {getExecutionLabel(executionMode, {
                nodeBackend: t.pathfinder.nodeBackend,
                rustBackend: t.pathfinder.rustBackend,
                browserReplay: t.pathfinder.browserReplay,
              })}.
              {engineSpec ? ` ${t.pathfinder.activeExecutionTextWithSpec}` : ` ${t.pathfinder.activeExecutionTextWithoutSpec}`}
            </div>
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1rem",
          }}
        >
          <PathfinderCanvas
            snapshot={snapshot}
            run={run}
            frame={playback.frame}
            sourcePlayerId={sourcePlayerId}
            targetPlayerId={targetPlayerId}
            onOpenOverlay={() => setOverlayOpen(true)}
          />
          <RunSummaryPanel
            run={run}
            comparisonNote={comparisonNote}
            savedReplays={savedReplays}
            onLoadSavedReplay={(savedReplay) => {
              const selectedRun = savedReplay.algorithmRuns.find((item) => item.request.algorithm === savedReplay.selectedAlgorithm)
                ?? savedReplay.algorithmRuns[0];
              if (!selectedRun) {
                return;
              }
              setSourcePlayerId(savedReplay.sourcePlayerId);
              setTargetPlayerId(savedReplay.targetPlayerId);
              setAlgorithm(selectedRun.request.algorithm);
              setPathMode(savedReplay.pathMode);
              setWeightedMode(savedReplay.weightedMode);
              setComparisonRows(savedReplay.comparisonRows);
              setRun(decorateRun(selectedRun, savedReplay, true));
              const matchingRow = savedReplay.comparisonRows.find((row) => row.algorithm === selectedRun.request.algorithm);
              setComparisonNote(matchingRow?.relativeNote ?? t.pathfinder.comparisonUnavailable);
            }}
            onDeleteSavedReplay={async (savedReplay) => {
              await deletePathfinderReplay(savedReplay.id);
              replayCacheRef.current.delete(savedReplay.cacheKey);
              setSavedReplays((current) => current.filter((item) => item.id !== savedReplay.id));
              setRun((current) => (
                current?.replayMeta?.cacheKey === savedReplay.cacheKey && current.replayMeta.loadedFromSave
                  ? null
                  : current
              ));
            }}
          />
        </div>

        <PlaybackControls
          playbackState={playback.playbackState}
          playbackSpeed={playback.playbackSpeed}
          canStep={playback.canStep}
          onPlay={playback.play}
          onPause={playback.pause}
          onRestart={playback.restart}
          onStepForward={playback.stepForward}
          onStepBackward={playback.stepBackward}
          onSpeedChange={playback.setPlaybackSpeed}
        />

        <AlgorithmComparisonTable rows={comparisonRows} />
      </div>

      <PathfinderGraphOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        players={players}
        supportedAlgorithms={supportedAlgorithms}
        snapshot={snapshot}
        run={run}
        frame={playback.frame}
        sourcePlayerId={sourcePlayerId}
        targetPlayerId={targetPlayerId}
        algorithm={algorithm}
        pathMode={pathMode}
        weightedMode={weightedMode}
        loading={loading}
        playbackState={playback.playbackState}
        playbackSpeed={playback.playbackSpeed}
        canStep={playback.canStep}
        currentStepIndex={playback.currentStepIndex}
        onPlay={playback.play}
        onPause={playback.pause}
        onRestart={playback.restart}
        onStepForward={playback.stepForward}
        onStepBackward={playback.stepBackward}
        onSpeedChange={playback.setPlaybackSpeed}
        onRunSearch={async (overrides) => {
          setSourcePlayerId(overrides.sourcePlayerId);
          setTargetPlayerId(overrides.targetPlayerId);
            setAlgorithm(overrides.algorithm);
            setPathMode(overrides.pathMode);
            setWeightedMode(
              overrides.algorithm === "dijkstra" || overrides.algorithm === "astar"
                ? overrides.weightedMode
                : false,
            );
            setComparisonNote(
              getDefaultComparisonNote(
                overrides.sourcePlayerId,
                overrides.targetPlayerId,
                overrides.pathMode,
                overrides.algorithm === "dijkstra" || overrides.algorithm === "astar"
                  ? overrides.weightedMode
                  : false,
                t.pathfinder.defaultComparison,
              ),
            );
            await runPathfinder(overrides);
        }}
        datasetSummary={datasetSummary}
      />
    </div>
  );
}
