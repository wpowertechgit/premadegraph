import React from "react";
import { type ComparisonRow } from "./pathfinderTypes";
import { getAlgorithmLabel, translateBackendText, useI18n } from "./i18n";

interface AlgorithmComparisonTableProps {
  rows: ComparisonRow[];
}

function formatValue(value: number | null, suffix = "", emptyLabel = "N/A") {
  if (value === null) {
    return emptyLabel;
  }
  if (suffix && Number.isFinite(value)) {
    return `${value.toFixed(2)}${suffix}`;
  }
  return `${value}${suffix}`;
}

export default function AlgorithmComparisonTable({ rows }: AlgorithmComparisonTableProps) {
  const { language, t } = useI18n();
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
        {t.pathfinder.algorithmComparison}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
        <thead>
          <tr style={{ color: "#9ca3af", textAlign: "left" }}>
            <th style={{ padding: "0.7rem 0.45rem" }}>{t.pathfinder.algorithm}</th>
            <th style={{ padding: "0.7rem 0.45rem" }}>{t.pathfinder.available}</th>
            <th style={{ padding: "0.7rem 0.45rem" }}>{t.pathfinder.pathFound}</th>
            <th style={{ padding: "0.7rem 0.45rem" }}>{t.pathfinder.pathLength}</th>
            <th style={{ padding: "0.7rem 0.45rem" }}>{t.pathfinder.nodesVisited}</th>
            <th style={{ padding: "0.7rem 0.45rem" }}>{t.pathfinder.runtime}</th>
            <th style={{ padding: "0.7rem 0.45rem" }}>{t.pathfinder.relativeNote}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.algorithm} style={{ borderTop: "1px solid #313842" }}>
              <td style={{ padding: "0.8rem 0.45rem", fontWeight: 600 }}>{getAlgorithmLabel(language, row.algorithm)}</td>
              <td style={{ padding: "0.8rem 0.45rem" }}>
                {row.supportedNow ? (
                  t.common.yes
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
                    {t.pathfinder.comingLater}
                  </span>
                )}
              </td>
              <td style={{ padding: "0.8rem 0.45rem" }}>
                {row.pathFound === null ? t.common.na : row.pathFound ? t.common.yes : t.common.no}
              </td>
              <td style={{ padding: "0.8rem 0.45rem" }}>{formatValue(row.pathLength, "", t.common.na)}</td>
              <td style={{ padding: "0.8rem 0.45rem" }}>{formatValue(row.nodesVisited, "", t.common.na)}</td>
              <td style={{ padding: "0.8rem 0.45rem" }}>{formatValue(row.runtimeMs, " ms", t.common.na)}</td>
              <td style={{ padding: "0.8rem 0.45rem", color: "#9ca3af" }}>{translateBackendText(language, row.relativeNote)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
