import React from "react";
import { ALGORITHM_LABELS, PATH_MODE_LABELS, STATUS_LABELS, type PathfinderRunResponse } from "./pathfinderTypes";

interface RunSummaryPanelProps {
  run: PathfinderRunResponse | null;
  comparisonNote: string;
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
      <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>Run Summary</div>

      {!run ? (
        <div style={{ color: "#9ca3af" }}>Choose players, path mode, and algorithm to populate the live route metrics.</div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <StatCard label="Algorithm" value={ALGORITHM_LABELS[run.request.algorithm]} />
            <StatCard label="Path Mode" value={PATH_MODE_LABELS[run.request.pathMode]} />
            <StatCard label="Status" value={STATUS_LABELS[run.status]} />
            <StatCard label="Path Length" value={run.summary.pathLength} />
            <StatCard label="Nodes Visited" value={run.summary.nodesVisited} />
            <StatCard label="Edges Considered" value={run.summary.edgesConsidered} />
            <StatCard label="Runtime" value={`${run.summary.runtimeMs} ms`} />
            <StatCard label="Trace Steps" value={run.summary.traceStepCount} />
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
            <div style={{ color: "#f3f4f6", fontWeight: 600 }}>Comparison Note</div>
            <div style={{ color: "#9ca3af", marginTop: "0.3rem" }}>{comparisonNote}</div>
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
                <div key={warning}>{warning}</div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
