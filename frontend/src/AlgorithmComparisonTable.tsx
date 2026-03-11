import React from "react";
import { type ComparisonRow } from "./pathfinderTypes";

interface AlgorithmComparisonTableProps {
  rows: ComparisonRow[];
}

function formatValue(value: number | null, suffix = "") {
  if (value === null) {
    return "N/A";
  }
  return `${value}${suffix}`;
}

export default function AlgorithmComparisonTable({ rows }: AlgorithmComparisonTableProps) {
  return (
    <section
      style={{
        background: "#1d2127",
        border: "1px solid #303741",
        borderRadius: "18px",
        padding: "1rem",
        color: "#f3f4f6",
        overflowX: "auto",
      }}
    >
      <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
        Algorithm Comparison
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
        <thead>
          <tr style={{ color: "#9ca3af", textAlign: "left" }}>
            <th style={{ padding: "0.7rem 0.45rem" }}>Algorithm</th>
            <th style={{ padding: "0.7rem 0.45rem" }}>Supported Now?</th>
            <th style={{ padding: "0.7rem 0.45rem" }}>Path Found?</th>
            <th style={{ padding: "0.7rem 0.45rem" }}>Path Length</th>
            <th style={{ padding: "0.7rem 0.45rem" }}>Nodes Visited</th>
            <th style={{ padding: "0.7rem 0.45rem" }}>Runtime</th>
            <th style={{ padding: "0.7rem 0.45rem" }}>Relative Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.algorithm} style={{ borderTop: "1px solid #313842" }}>
              <td style={{ padding: "0.8rem 0.45rem", fontWeight: 600 }}>{row.label}</td>
              <td style={{ padding: "0.8rem 0.45rem" }}>
                {row.supportedNow ? (
                  "Yes"
                ) : (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.15rem 0.45rem",
                      borderRadius: "999px",
                      background: "#3a3122",
                      color: "#d7b16a",
                    }}
                  >
                    Planned
                  </span>
                )}
              </td>
              <td style={{ padding: "0.8rem 0.45rem" }}>
                {row.pathFound === null ? "N/A" : row.pathFound ? "Yes" : "No"}
              </td>
              <td style={{ padding: "0.8rem 0.45rem" }}>{formatValue(row.pathLength)}</td>
              <td style={{ padding: "0.8rem 0.45rem" }}>{formatValue(row.nodesVisited)}</td>
              <td style={{ padding: "0.8rem 0.45rem" }}>{formatValue(row.runtimeMs, " ms")}</td>
              <td style={{ padding: "0.8rem 0.45rem", color: "#9ca3af" }}>{row.relativeNote}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
