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

function getDefaultComparisonNote(sourcePlayerId: string, targetPlayerId: string, pathMode: PathMode) {
  const rows = getComparisonRows(sourcePlayerId, targetPlayerId, pathMode);
  const firstRunnable = rows.find((row) => row.supportedNow);
  return firstRunnable?.relativeNote ?? "Run a search to compare path modes.";
}

export default function PathfinderLabPage() {
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("frontend-demo");
  const [sourcePlayerId, setSourcePlayerId] = useState("a");
  const [targetPlayerId, setTargetPlayerId] = useState("f");
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("bfs");
  const [pathMode, setPathMode] = useState<PathMode>("social-path");
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState<PathfinderRunResponse | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [backendOptions, setBackendOptions] = useState<PathfinderOptionsResponse | null>(null);
  const [engineSpec, setEngineSpec] = useState<PathfinderEngineSpecResponse | null>(null);
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>(
    getComparisonRows("a", "f", "social-path"),
  );
  const [comparisonNote, setComparisonNote] = useState(
    getDefaultComparisonNote("a", "f", "social-path"),
  );
  const playback = usePathfinderPlayback(run);
  const players: PlayerOption[] = executionMode !== "frontend-demo" && backendOptions
    ? backendOptions.players
    : mockPlayers;
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
        const [optionsResponse, engineSpecResponse] = executionMode === "rust-backend-prototype"
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
            executionMode === "rust-backend-prototype"
              ? "Rust prototype is configured, but no Rust binary is available yet."
              : "Backend prototype metadata failed to load.",
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
      if (executionMode === "backend-prototype" || executionMode === "rust-backend-prototype") {
        try {
          const response = executionMode === "rust-backend-prototype"
            ? await fetchRustPathfinderCompare({
                sourcePlayerId,
                targetPlayerId,
                pathMode,
              })
            : await fetchPathfinderCompare({
                sourcePlayerId,
                targetPlayerId,
                pathMode,
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

      const nextRows = getComparisonRows(sourcePlayerId, targetPlayerId, pathMode);
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
  }, [executionMode, pathMode, sourcePlayerId, targetPlayerId]);

  const resetPrototype = () => {
    setRun(null);
    setComparisonNote(getDefaultComparisonNote(sourcePlayerId, targetPlayerId, pathMode));
  };

  const handleRun = async () => {
    setLoading(true);
    try {
      const request = {
        sourcePlayerId,
        targetPlayerId,
        algorithm,
        pathMode,
        weightedMode: false,
        options: {
          includeTrace: true,
          maxSteps: 5000,
        },
      };

      const nextRun = executionMode === "backend-prototype"
        ? await runPathfinderBackend(request)
        : executionMode === "rust-backend-prototype"
          ? await runRustPathfinderBackend(request)
          : await runPathfinderMock(request);

      setRun(nextRun);
      const matchingRow = comparisonRows.find((row) => row.algorithm === algorithm);
      setComparisonNote(matchingRow?.relativeNote ?? "Comparison data unavailable.");
    } finally {
      setLoading(false);
    }
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
            Build the graph tool first, then connect it to the backend
          </h1>
          <p style={{ margin: 0, maxWidth: "860px", color: "#9ca3af" }}>
            The immediate job is not backend integration. It is proving a denser mock dataset, an efficient
            graph rendering surface, and a reusable overlay component that can survive close and reopen cycles
            without resetting the active content.
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
            { label: executionMode === "frontend-demo" ? "Mock Players" : "Backend Players", value: datasetSummary.players },
            { label: "Relationships", value: datasetSummary.relationships },
            { label: "Renderer", value: "Canvas overlay" },
            {
              label: "Execution",
              value:
                executionMode === "backend-prototype"
                  ? "Node backend demo"
                  : executionMode === "rust-backend-prototype"
                    ? "Rust backend demo"
                    : "Frontend mock demo",
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
          sourcePlayerId={sourcePlayerId}
          targetPlayerId={targetPlayerId}
          algorithm={algorithm}
          pathMode={pathMode}
          executionMode={executionMode}
          loading={loading}
          onSourceChange={(value) => {
            setSourcePlayerId(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(value, targetPlayerId, pathMode));
          }}
          onTargetChange={(value) => {
            setTargetPlayerId(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(sourcePlayerId, value, pathMode));
          }}
          onAlgorithmChange={(value) => {
            setAlgorithm(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(sourcePlayerId, targetPlayerId, pathMode));
          }}
          onPathModeChange={(value) => {
            setPathMode(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(sourcePlayerId, targetPlayerId, value));
          }}
          onExecutionModeChange={(value) => {
            setExecutionMode(value);
            setRun(null);
            setComparisonNote(getDefaultComparisonNote(sourcePlayerId, targetPlayerId, pathMode));
          }}
          onRun={handleRun}
          onReset={resetPrototype}
        />

        {(executionMode === "backend-prototype" || executionMode === "rust-backend-prototype") && engineSpec ? (
          <section
            style={{
              borderRadius: "18px",
              border: "1px solid #303741",
              background: "#1d2127",
              padding: "1rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ color: "#8b98a7", fontSize: "0.8rem", textTransform: "uppercase" }}>
                Backend Prototype
              </div>
              <div style={{ marginTop: "0.4rem", color: "#f3f4f6", fontWeight: 700 }}>
                {executionMode === "rust-backend-prototype"
                  ? "Search logic now runs through the optional Rust backend bridge"
                  : "Search logic now runs through Express on the backend"}
              </div>
              <div style={{ marginTop: "0.4rem", color: "#9ca3af", lineHeight: 1.5 }}>
                The frontend still replays the result visually, but the path computation now goes through
                {executionMode === "rust-backend-prototype"
                  ? " `/api/pathfinder-rust/run` and `/api/pathfinder-rust/compare`."
                  : " `/api/pathfinder/run` and `/api/pathfinder/compare` as an optional demo path."}
              </div>
            </div>
            <div>
              <div style={{ color: "#8b98a7", fontSize: "0.8rem", textTransform: "uppercase" }}>
                Signed Graph Model
              </div>
              <div style={{ marginTop: "0.4rem", color: "#9ca3af", lineHeight: 1.5 }}>
                `allyWeight`, `enemyWeight`, `totalMatches`, and `dominantRelation` are modeled in the
                backend prototype now so the response contract already matches the future engine split.
              </div>
            </div>
            <div>
              <div style={{ color: "#8b98a7", fontSize: "0.8rem", textTransform: "uppercase" }}>
                Faster Engine Path
              </div>
              <div style={{ marginTop: "0.4rem", color: "#9ca3af", lineHeight: 1.5 }}>
                Rust path: {engineSpec.integrationPath.rust[0]}
                <br />
                Go path: {engineSpec.integrationPath.go[0]}
              </div>
            </div>
          </section>
        ) : null}

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
        snapshot={snapshot}
        run={run}
        frame={playback.frame}
        sourcePlayerId={sourcePlayerId}
        targetPlayerId={targetPlayerId}
        datasetSummary={datasetSummary}
      />
    </div>
  );
}
