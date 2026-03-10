import React, { useMemo, useState } from "react";
import AlgorithmComparisonTable from "./AlgorithmComparisonTable";
import PathfinderCanvas from "./PathfinderCanvas";
import PathfinderControls from "./PathfinderControls";
import PlaybackControls from "./PlaybackControls";
import RunSummaryPanel from "./RunSummaryPanel";
import { getComparisonRows, mockPlayers, runPathfinderMock } from "./pathfinderMocks";
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
  const [comparisonNote, setComparisonNote] = useState(
    getDefaultComparisonNote("a", "f", "social-path"),
  );

  const comparisonRows = useMemo(
    () => getComparisonRows(sourcePlayerId, targetPlayerId, pathMode),
    [pathMode, sourcePlayerId, targetPlayerId],
  );
  const playback = usePathfinderPlayback(run);

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
        background:
          "radial-gradient(circle at top left, rgba(16, 58, 110, 0.55), rgba(4, 10, 20, 1) 55%)",
        color: "#f4f8ff",
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
            borderRadius: "20px",
            background: "linear-gradient(135deg, rgba(13, 24, 42, 0.95), rgba(8, 15, 27, 0.98))",
            border: "1px solid rgba(128, 181, 255, 0.16)",
            boxShadow: "0 18px 48px rgba(3, 10, 21, 0.35)",
          }}
        >
          <div style={{ color: "#7dd3fc", fontSize: "0.82rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Pathfinder Lab
          </div>
          <h1 style={{ margin: "0.4rem 0 0.55rem", fontSize: "clamp(2rem, 4vw, 3rem)" }}>
            Search replay for player-to-player graph traversal
          </h1>
          <p style={{ margin: 0, maxWidth: "760px", color: "#afc4df" }}>
            This frontend-only prototype runs against a curated local graph and returns the same response
            shape the future backend will use. Switch between social-path and battle-path to see how
            enemy edges can reduce distance or create connectivity.
          </p>
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
          <PathfinderCanvas run={run} frame={playback.frame} />
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
    </div>
  );
}
