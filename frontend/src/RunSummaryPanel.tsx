import React from "react";
import { type PathfinderRunResponse, type SavedReplayRecord } from "./pathfinderTypes";
import { getAlgorithmLabel, getPathModeLabel, getStatusLabel, translateBackendText, useI18n } from "./i18n";
import { buttonStyle, metricCardStyle, sectionLabelStyle, surfaceCardStyle } from "./theme";

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
        ...metricCardStyle(),
        padding: "0.75rem",
      }}
    >
      <div style={sectionLabelStyle()}>{label}</div>
      <div style={{ marginTop: "0.25rem", fontSize: "1.15rem", color: "var(--text-primary)" }}>{value}</div>
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
        ...surfaceCardStyle(),
        padding: "1rem",
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
                ...metricCardStyle(),
              }}
            >
              <div style={sectionLabelStyle()}>
                {t.pathfinder.replayTitle}
              </div>
              <div style={{ marginTop: "0.25rem", fontSize: "1rem", fontWeight: 700 }}>
                {run.replayMeta.title}
              </div>
              {run.replayMeta.loadedFromSave ? (
                <div style={{ marginTop: "0.3rem", color: "var(--accent-strong)", fontSize: "0.88rem" }}>
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
              ...metricCardStyle(),
            }}
          >
            <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{t.pathfinder.comparisonNote}</div>
            <div style={{ color: "var(--text-muted)", marginTop: "0.3rem" }}>{translateBackendText(language, comparisonNote)}</div>
          </div>

          {run.warnings.length > 0 ? (
            <div
            style={{
              marginTop: "0.9rem",
              padding: "0.8rem",
              borderRadius: "14px",
              background: "rgba(56, 34, 18, 0.68)",
              border: "1px solid rgba(234, 179, 108, 0.28)",
              color: "var(--warning)",
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
              ...metricCardStyle(),
            }}
          >
            <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{t.pathfinder.cachedReplays}</div>
            {savedReplays.length === 0 ? (
              <div style={{ color: "var(--text-muted)", marginTop: "0.3rem" }}>{t.pathfinder.runSummaryEmpty}</div>
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
                          ...buttonStyle("ghost"),
                          padding: "0.75rem 0.8rem",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {savedReplay.title}
                        </div>
                        <div style={{ marginTop: "0.25rem", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                          {getAlgorithmLabel(language, savedReplay.selectedAlgorithm)} • {getPathModeLabel(language, savedReplay.pathMode)} • {savedReplay.algorithmRuns.map((algorithmRun) => `${getAlgorithmLabel(language, algorithmRun.request.algorithm)} ${formatRuntime(algorithmRun.summary.runtimeMs)}`).join(" • ")}
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={t.pathfinder.deleteReplay}
                        title={t.pathfinder.deleteReplay}
                        onClick={() => onDeleteSavedReplay(savedReplay)}
                        style={{
                          ...buttonStyle("danger"),
                          width: "34px",
                          height: "34px",
                          fontSize: "1rem",
                          lineHeight: 1,
                          padding: 0,
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
