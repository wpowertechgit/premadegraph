import React from "react";
import { type PathfinderRunResponse } from "./pathfinderTypes";
import { getAlgorithmLabel, getPathModeLabel, getStatusLabel, translateBackendText, useI18n } from "./i18n";

interface RunSummaryPanelProps {
  run: PathfinderRunResponse | null;
  comparisonNote: string;
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

export default function RunSummaryPanel({ run, comparisonNote }: RunSummaryPanelProps) {
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
        </>
      )}
    </section>
  );
}
