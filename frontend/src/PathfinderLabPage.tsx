import React, { useEffect, useMemo, useState } from "react";
import AlgorithmComparisonTable from "./AlgorithmComparisonTable";
import PathfinderCanvas from "./PathfinderCanvas";
import PathfinderControls from "./PathfinderControls";
import PathfinderGraphOverlay from "./PathfinderGraphOverlay";
import PlaybackControls from "./PlaybackControls";
import RunSummaryPanel from "./RunSummaryPanel";
import { getComparisonRows, getMockGraphSnapshot, mockDatasetSummary, mockPlayers, runPathfinderMock } from "./pathfinderMocks";
import {
  fetchPathfinderCompare,
  fetchPathfinderEngineSpec,
  fetchPathfinderOptions,
  fetchRustPathfinderCompare,
  fetchRustPathfinderEngineSpec,
  fetchRustPathfinderOptions,
  runPathfinderBackend,
  runRustPathfinderBackend,
} from "./pathfinderApi";
import { usePathfinderPlayback } from "./usePathfinderPlayback";
import {
  type AlgorithmId,
  type ComparisonRow,
  type DatasetSummary,
  type ExecutionMode,
  type PathfinderEngineSpecResponse,
  type PathfinderOptionsResponse,
  type PathfinderRunResponse,
  type PathMode,
  type PlayerOption,
} from "./pathfinderTypes";

function getDefaultComparisonNote(
  sourcePlayerId: string,
  targetPlayerId: string,
  pathMode: PathMode,
  weightedMode: boolean,
) {
  const rows = getComparisonRows(sourcePlayerId, targetPlayerId, pathMode, weightedMode);
  const firstRunnable = rows.find((row) => row.supportedNow);
  return firstRunnable?.relativeNote ?? "Run a search to compare path modes.";
}

function getExecutionLabel(executionMode: ExecutionMode) {
  if (executionMode === "backend") {
    return "Node Backend";
  }
  if (executionMode === "rust-backend") {
    return "Rust Backend";
  }
  return "Browser Replay";
}

export default function PathfinderLabPage() {
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("frontend-demo");
  const [sourcePlayerId, setSourcePlayerId] = useState("a");
  const [targetPlayerId, setTargetPlayerId] = useState("f");
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("bfs");
  const [pathMode, setPathMode] = useState<PathMode>("social-path");
  const [weightedMode, setWeightedMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState<PathfinderRunResponse | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [backendOptions, setBackendOptions] = useState<PathfinderOptionsResponse | null>(null);
  const [engineSpec, setEngineSpec] = useState<PathfinderEngineSpecResponse | null>(null);
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>(
    getComparisonRows("a", "f", "social-path", false),
  );
  const [comparisonNote, setComparisonNote] = useState(
    getDefaultComparisonNote("a", "f", "social-path", false),
  );
  const playback = usePathfinderPlayback(run);
  const players: PlayerOption[] = executionMode !== "frontend-demo" && backendOptions
    ? backendOptions.players
    : mockPlayers;
  const supportedAlgorithms: AlgorithmId[] = executionMode !== "frontend-demo" && backendOptions
    ? backendOptions.supportedAlgorithms
    : ["bfs", "dijkstra", "bidirectional"];
  const datasetSummary: DatasetSummary = executionMode !== "frontend-demo" && backendOptions
    ? backendOptions.datasetSummary
    : mockDatasetSummary;
  const snapshot = useMemo(
    () =>
      run?.graphSnapshot ??
      (executionMode !== "frontend-demo" && backendOptions
        ? backendOptions.previewSnapshot
        : getMockGraphSnapshot(pathMode, sourcePlayerId, targetPlayerId)),
    [backendOptions, executionMode, pathMode, run, sourcePlayerId, targetPlayerId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadBackendPrototypeMeta() {
      if (executionMode === "frontend-demo") {
        return;
      }

      setBackendOptions(null);
      setEngineSpec(null);

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
          setSourcePlayerId(nextPlayers[0].id);
          setTargetPlayerId(nextPlayers[5]?.id || nextPlayers[1].id);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load backend pathfinder metadata:", error);
          setComparisonNote(
            executionMode === "rust-backend"
              ? "Rust backend is selected, but its metadata could not be loaded."
              : "Backend metadata failed to load.",
          );
        }
      }
    }

    loadBackendPrototypeMeta();
    return () => {
      cancelled = true;
    };
  }, [executionMode]);

  useEffect(() => {
    let cancelled = false;

    async function refreshComparison() {
      if (executionMode === "backend" || executionMode === "rust-backend") {
        try {
          const response = executionMode === "rust-backend"
            ? await fetchRustPathfinderCompare({
                sourcePlayerId,
                targetPlayerId,
                pathMode,
                weightedMode,
              })
            : await fetchPathfinderCompare({
                sourcePlayerId,
                targetPlayerId,
                pathMode,
                weightedMode,
              });

          if (!cancelled) {
            setComparisonRows(response.rows);
            const firstRunnable = response.rows.find((row) => row.supportedNow);
            setComparisonNote(firstRunnable?.relativeNote ?? "Comparison data unavailable.");
          }
        } catch (error) {
          if (!cancelled) {
            console.error("Failed to load backend compare data:", error);
          }
        }
        return;
      }

      const nextRows = getComparisonRows(sourcePlayerId, targetPlayerId, pathMode, weightedMode);
      if (!cancelled) {
        setComparisonRows(nextRows);
        const firstRunnable = nextRows.find((row) => row.supportedNow);
        setComparisonNote(firstRunnable?.relativeNote ?? "Run a search to compare path modes.");
      }
    }

    refreshComparison();
    return () => {
      cancelled = true;
    };
  }, [executionMode, pathMode, sourcePlayerId, targetPlayerId, weightedMode]);

  const resetPrototype = () => {
    setRun(null);
    setComparisonNote(getDefaultComparisonNote(sourcePlayerId, targetPlayerId, pathMode, weightedMode));
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
          maxSteps: 5000,
        },
      };

      const nextRun = executionMode === "backend"
        ? await runPathfinderBackend(request)
        : executionMode === "rust-backend"
          ? await runRustPathfinderBackend(request)
          : await runPathfinderMock(request);

      setRun(nextRun);
      const matchingRow = comparisonRows.find((row) => row.algorithm === nextAlgorithm);
      setComparisonNote(matchingRow?.relativeNote ?? "Comparison data unavailable.");
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
            Pathfinder Lab
          </div>
          <h1 style={{ margin: "0.4rem 0 0.55rem", fontSize: "clamp(2rem, 4vw, 3rem)" }}>
            Explore player connections and search routes through the graph
          </h1>
          <p style={{ margin: 0, maxWidth: "860px", color: "#9ca3af" }}>
            Choose two players, select a search algorithm, and compare how social-only versus battle-enabled
            traversal changes the route. Weighted Dijkstra uses match-count strength so repeated connections become
            cheaper to traverse. The playback view shows how the frontier grows, which nodes were visited, and
            when the final path resolves.
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
            { label: "Available Players", value: datasetSummary.players },
            { label: "Relationships", value: datasetSummary.relationships },
            { label: "Renderer", value: "Canvas overlay" },
            {
              label: "Execution",
              value: getExecutionLabel(executionMode),
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
          onSourceChange={(value) => {
            setSourcePlayerId(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(value, targetPlayerId, pathMode, weightedMode));
          }}
          onTargetChange={(value) => {
            setTargetPlayerId(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(sourcePlayerId, value, pathMode, weightedMode));
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
              ),
            );
          }}
          onPathModeChange={(value) => {
            setPathMode(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(sourcePlayerId, targetPlayerId, value, weightedMode));
          }}
          onWeightedModeChange={(value) => {
            setWeightedMode(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(sourcePlayerId, targetPlayerId, pathMode, value));
          }}
          onExecutionModeChange={(value) => {
            setExecutionMode(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(sourcePlayerId, targetPlayerId, pathMode, weightedMode));
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
              What the graph shows
            </div>
            <div style={{ marginTop: "0.4rem", color: "#9ca3af", lineHeight: 1.5 }}>
              Each node is a player. Edges represent repeated relationships. Ally edges reflect cooperative
              matches, while enemy edges represent repeated opposition that can still connect the graph.
            </div>
          </div>
          <div>
            <div style={{ color: "#8b98a7", fontSize: "0.8rem", textTransform: "uppercase" }}>
              Path modes
            </div>
            <div style={{ marginTop: "0.4rem", color: "#9ca3af", lineHeight: 1.5 }}>
              Social path searches through ally links only. Battle path also includes enemy links, which can
              uncover shorter or otherwise unreachable routes between players.
            </div>
          </div>
          <div>
            <div style={{ color: "#8b98a7", fontSize: "0.8rem", textTransform: "uppercase" }}>
              Algorithms and playback
            </div>
            <div style={{ marginTop: "0.4rem", color: "#9ca3af", lineHeight: 1.5 }}>
              BFS gives an intuitive breadth-first expansion, Bidirectional grows from both ends, and Dijkstra can
              optionally weight edges by repeated match history. In weighted mode, stronger ties become cheaper, so
              the route favors more established connections instead of treating every hop equally.
            </div>
          </div>
          <div>
            <div style={{ color: "#8b98a7", fontSize: "0.8rem", textTransform: "uppercase" }}>
              Active execution
            </div>
            <div style={{ marginTop: "0.4rem", color: "#9ca3af", lineHeight: 1.5 }}>
              Current mode: {getExecutionLabel(executionMode)}.
              {engineSpec ? " The response contract stays consistent across the available execution paths." : " Search results still use the same route and trace format across the interface."}
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
          <RunSummaryPanel run={run} comparisonNote={comparisonNote} />
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
              ),
            );
            await runPathfinder(overrides);
        }}
        datasetSummary={datasetSummary}
      />
    </div>
  );
}
