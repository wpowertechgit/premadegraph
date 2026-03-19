import React from "react";
import { type PathfinderRunResponse, type SavedReplayRecord } from "./pathfinderTypes";
import { getAlgorithmLabel, getPathModeLabel, getStatusLabel, translateBackendText, useI18n } from "./i18n";

interface RunSummaryPanelProps {
  run: PathfinderRunResponse | null;
  comparisonNote: string;
  savedReplays: SavedReplayRecord[];
  onLoadSavedReplay: (replay: SavedReplayRecord) => void;
  onDeleteSavedReplay: (replay: SavedReplayRecord) => void;
}

function formatRuntime(value: number) {
  return `${value.toFixed(2)} ms`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#20252c",
        border: "1px solid #313842",
        borderRadius: "14px",
        padding: "0.75rem",
      }}
    >
      <div style={{ fontSize: "0.75rem", color: "#9ca3af", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: "0.25rem", fontSize: "1.15rem", color: "#f3f4f6" }}>{value}</div>
    </div>
  );
}

export default function RunSummaryPanel({
  run,
  comparisonNote,
  savedReplays,
  onLoadSavedReplay,
  onDeleteSavedReplay,
}: RunSummaryPanelProps) {
  const { language, t } = useI18n();
  return (
    <section
      style={{
        background: "#1d2127",
        border: "1px solid #303741",
        borderRadius: "18px",
        padding: "1rem",
        color: "#f3f4f6",
      }}
    >
      <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>{t.pathfinder.runSummary}</div>

      {!run ? (
        <div style={{ color: "#9ca3af" }}>{t.pathfinder.runSummaryEmpty}</div>
      ) : (
        <>
          {run.replayMeta ? (
            <div
              style={{
                marginBottom: "0.9rem",
                padding: "0.8rem",
                borderRadius: "14px",
                background: "#20252c",
                border: "1px solid #313842",
              }}
            >
              <div style={{ color: "#9ca3af", fontSize: "0.75rem", textTransform: "uppercase" }}>
                {t.pathfinder.replayTitle}
              </div>
              <div style={{ marginTop: "0.25rem", fontSize: "1rem", fontWeight: 700 }}>
                {run.replayMeta.title}
              </div>
              {run.replayMeta.loadedFromSave ? (
                <div style={{ marginTop: "0.3rem", color: "#8bb6de", fontSize: "0.88rem" }}>
                  {t.pathfinder.loadedFromMemory}
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <StatCard label={t.pathfinder.algorithm} value={getAlgorithmLabel(language, run.request.algorithm)} />
            <StatCard label={t.pathfinder.pathMode} value={getPathModeLabel(language, run.request.pathMode)} />
            <StatCard label={t.pathfinder.status} value={getStatusLabel(language, run.status)} />
            <StatCard label={t.pathfinder.pathLength} value={run.summary.pathLength} />
            <StatCard label={t.pathfinder.nodesVisited} value={run.summary.nodesVisited} />
            <StatCard label={t.pathfinder.edgesConsidered} value={run.summary.edgesConsidered} />
            <StatCard label={t.pathfinder.runtime} value={formatRuntime(run.summary.runtimeMs)} />
            <StatCard label={t.pathfinder.traceSteps} value={run.summary.traceStepCount} />
          </div>

          <div
            style={{
              marginTop: "0.9rem",
              padding: "0.8rem",
              borderRadius: "14px",
              background: "#20252c",
              border: "1px solid #313842",
            }}
          >
            <div style={{ color: "#f3f4f6", fontWeight: 600 }}>{t.pathfinder.comparisonNote}</div>
            <div style={{ color: "#9ca3af", marginTop: "0.3rem" }}>{translateBackendText(language, comparisonNote)}</div>
          </div>

          {run.warnings.length > 0 ? (
            <div
              style={{
                marginTop: "0.9rem",
                padding: "0.8rem",
                borderRadius: "14px",
                background: "#30261f",
                border: "1px solid #62493a",
                color: "#d9b08c",
              }}
            >
              {run.warnings.map((warning) => (
                <div key={warning}>{translateBackendText(language, warning)}</div>
              ))}
            </div>
          ) : null}

          <div
            style={{
              marginTop: "0.9rem",
              padding: "0.8rem",
              borderRadius: "14px",
              background: "#20252c",
              border: "1px solid #313842",
            }}
          >
            <div style={{ color: "#f3f4f6", fontWeight: 600 }}>{t.pathfinder.cachedReplays}</div>
            {savedReplays.length === 0 ? (
              <div style={{ color: "#9ca3af", marginTop: "0.3rem" }}>{t.pathfinder.runSummaryEmpty}</div>
            ) : (
                <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.7rem" }}>
                  {savedReplays.map((savedReplay) => (
                    <div
                      key={savedReplay.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: "0.55rem",
                        alignItems: "start",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onLoadSavedReplay(savedReplay)}
                        style={{
                          textAlign: "left",
                          borderRadius: "12px",
                          border: "1px solid #39424d",
                          background: "#1a1f25",
                          color: "#f3f4f6",
                          padding: "0.75rem 0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {savedReplay.title}
                        </div>
                        <div style={{ marginTop: "0.25rem", color: "#9ca3af", fontSize: "0.88rem" }}>
                          {getAlgorithmLabel(language, savedReplay.selectedAlgorithm)} • {getPathModeLabel(language, savedReplay.pathMode)} • {savedReplay.algorithmRuns.map((algorithmRun) => `${getAlgorithmLabel(language, algorithmRun.request.algorithm)} ${formatRuntime(algorithmRun.summary.runtimeMs)}`).join(" • ")}
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={t.pathfinder.deleteReplay}
                        title={t.pathfinder.deleteReplay}
                        onClick={() => onDeleteSavedReplay(savedReplay)}
                        style={{
                          width: "34px",
                          height: "34px",
                          borderRadius: "10px",
                          border: "1px solid #4b3a3a",
                          background: "#2a1f1f",
                          color: "#f4b4b4",
                          cursor: "pointer",
                          fontSize: "1rem",
                          lineHeight: 1,
                        }}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
