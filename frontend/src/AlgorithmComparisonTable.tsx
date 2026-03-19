import React from "react";
import { type ComparisonRow } from "./pathfinderTypes";
import { getAlgorithmLabel, translateBackendText, useI18n } from "./i18n";
import { surfaceCardStyle } from "./theme";

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
        ...surfaceCardStyle(),
        padding: "1rem",
        color: "var(--text-primary)",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
        {t.pathfinder.algorithmComparison}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
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
            <tr key={row.algorithm} style={{ borderTop: "1px solid rgba(126, 155, 183, 0.14)", verticalAlign: "top" }}>
              <td style={{ padding: "0.8rem 0.45rem", fontWeight: 600, overflowWrap: "anywhere" }}>{getAlgorithmLabel(language, row.algorithm)}</td>
              <td style={{ padding: "0.8rem 0.45rem", overflowWrap: "anywhere" }}>
                {row.supportedNow ? (
                  t.common.yes
                ) : (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.15rem 0.45rem",
                      borderRadius: "999px",
                      background: "rgba(234, 179, 108, 0.16)",
                      color: "var(--warning)",
                    }}
                  >
                    {t.pathfinder.comingLater}
                  </span>
                )}
              </td>
              <td style={{ padding: "0.8rem 0.45rem", overflowWrap: "anywhere" }}>
                {row.pathFound === null ? t.common.na : row.pathFound ? t.common.yes : t.common.no}
              </td>
              <td style={{ padding: "0.8rem 0.45rem", overflowWrap: "anywhere" }}>{formatValue(row.pathLength, "", t.common.na)}</td>
              <td style={{ padding: "0.8rem 0.45rem", overflowWrap: "anywhere" }}>{formatValue(row.nodesVisited, "", t.common.na)}</td>
              <td style={{ padding: "0.8rem 0.45rem", overflowWrap: "anywhere" }}>{formatValue(row.runtimeMs, " ms", t.common.na)}</td>
              <td style={{ padding: "0.8rem 0.45rem", color: "var(--text-muted)", overflowWrap: "anywhere" }}>{translateBackendText(language, row.relativeNote)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
