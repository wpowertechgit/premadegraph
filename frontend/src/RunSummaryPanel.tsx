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
        background: "rgba(9, 16, 28, 0.85)",
        border: "1px solid rgba(128, 181, 255, 0.14)",
        borderRadius: "14px",
        padding: "0.75rem",
      }}
    >
      <div style={{ fontSize: "0.75rem", color: "#9cb3d1", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: "0.25rem", fontSize: "1.15rem", color: "#f5f9ff" }}>{value}</div>
    </div>
  );
}

export default function RunSummaryPanel({ run, comparisonNote }: RunSummaryPanelProps) {
  return (
    <section
      style={{
        background:
          "linear-gradient(140deg, rgba(19, 33, 52, 0.96), rgba(11, 18, 32, 0.98))",
        border: "1px solid rgba(128, 181, 255, 0.2)",
        borderRadius: "18px",
        padding: "1rem",
        color: "#f4f8ff",
      }}
    >
      <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>Run Summary</div>

      {!run ? (
        <div style={{ color: "#b5c7e3" }}>Select players and run a search to populate live stats.</div>
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
              background: "rgba(12, 19, 33, 0.82)",
              border: "1px solid rgba(128, 181, 255, 0.14)",
            }}
          >
            <div style={{ color: "#d6e3f5", fontWeight: 600 }}>Comparison Note</div>
            <div style={{ color: "#a9bdd8", marginTop: "0.3rem" }}>{comparisonNote}</div>
          </div>

          {run.warnings.length > 0 ? (
            <div
              style={{
                marginTop: "0.9rem",
                padding: "0.8rem",
                borderRadius: "14px",
                background: "rgba(71, 32, 14, 0.3)",
                border: "1px solid rgba(249, 115, 22, 0.22)",
                color: "#fdc58f",
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
