import React, { useMemo, useState } from "react";
import AlgorithmComparisonTable from "./AlgorithmComparisonTable";
import PathfinderCanvas from "./PathfinderCanvas";
import PathfinderControls from "./PathfinderControls";
import PathfinderGraphOverlay from "./PathfinderGraphOverlay";
import PlaybackControls from "./PlaybackControls";
import RunSummaryPanel from "./RunSummaryPanel";
import { getComparisonRows, getMockGraphSnapshot, mockDatasetSummary, mockPlayers, runPathfinderMock } from "./pathfinderMocks";
import { usePathfinderPlayback } from "./usePathfinderPlayback";
import { type AlgorithmId, type PathfinderRunResponse, type PathMode } from "./pathfinderTypes";

function getDefaultComparisonNote(sourcePlayerId: string, targetPlayerId: string, pathMode: PathMode) {
  const rows = getComparisonRows(sourcePlayerId, targetPlayerId, pathMode);
  const firstRunnable = rows.find((row) => row.supportedNow);
  return firstRunnable?.relativeNote ?? "Run a search to compare path modes.";
}

export default function PathfinderLabPage() {
  const [sourcePlayerId, setSourcePlayerId] = useState("a");
  const [targetPlayerId, setTargetPlayerId] = useState("f");
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("bfs");
  const [pathMode, setPathMode] = useState<PathMode>("social-path");
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState<PathfinderRunResponse | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [comparisonNote, setComparisonNote] = useState(
    getDefaultComparisonNote("a", "f", "social-path"),
  );

  const comparisonRows = useMemo(
    () => getComparisonRows(sourcePlayerId, targetPlayerId, pathMode),
    [pathMode, sourcePlayerId, targetPlayerId],
  );
  const playback = usePathfinderPlayback(run);
  const snapshot = useMemo(
    () => run?.graphSnapshot ?? getMockGraphSnapshot(pathMode, sourcePlayerId, targetPlayerId),
    [pathMode, run, sourcePlayerId, targetPlayerId],
  );

  const resetPrototype = () => {
    setRun(null);
    setComparisonNote(getDefaultComparisonNote(sourcePlayerId, targetPlayerId, pathMode));
  };

  const handleRun = async () => {
    setLoading(true);
    const nextRun = await runPathfinderMock({
      sourcePlayerId,
      targetPlayerId,
      algorithm,
      pathMode,
      weightedMode: false,
      options: {
        includeTrace: true,
        maxSteps: 5000,
      },
    });
    setRun(nextRun);
    const matchingRow = comparisonRows.find((row) => row.algorithm === algorithm);
    setComparisonNote(matchingRow?.relativeNote ?? "Comparison data unavailable.");
    setLoading(false);
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
            { label: "Mock Players", value: mockDatasetSummary.players },
            { label: "Relationships", value: mockDatasetSummary.relationships },
            { label: "Renderer", value: "Canvas overlay" },
            { label: "Next backend step", value: "Graph snapshot API" },
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
          players={mockPlayers}
          sourcePlayerId={sourcePlayerId}
          targetPlayerId={targetPlayerId}
          algorithm={algorithm}
          pathMode={pathMode}
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
          onRun={handleRun}
          onReset={resetPrototype}
        />

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
        datasetSummary={mockDatasetSummary}
      />
    </div>
  );
}
