import React from "react";
import { type CanvasFrame, type PathfinderRunResponse, type RelationType } from "./pathfinderTypes";

interface PathfinderCanvasProps {
  run: PathfinderRunResponse | null;
  frame: CanvasFrame;
}

function edgeKey(from: string, to: string): string {
  return [from, to].sort().join("|");
}

function getBaseEdgeColor(relation: RelationType) {
  return relation === "enemy" ? "#f97316" : "#6b7f98";
}

export default function PathfinderCanvas({ run, frame }: PathfinderCanvasProps) {
  if (!run) {
    return (
      <section
        style={{
          minHeight: "440px",
          borderRadius: "20px",
          border: "1px solid rgba(123, 160, 216, 0.18)",
          background:
            "radial-gradient(circle at top, rgba(23, 51, 93, 0.35), rgba(7, 13, 22, 0.98))",
          display: "grid",
          placeItems: "center",
          color: "#c8d5ea",
        }}
      >
        Start from an empty canvas. Run a search to replay the trace.
      </section>
    );
  }

  return (
    <section
      style={{
        minHeight: "440px",
        borderRadius: "20px",
        border: "1px solid rgba(123, 160, 216, 0.18)",
        background:
          "radial-gradient(circle at top, rgba(23, 51, 93, 0.35), rgba(7, 13, 22, 0.98))",
        padding: "1rem",
        color: "#e8f1ff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "center",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <strong>Step {frame.stepNumber || 0}</strong>
        <span style={{ color: "#a7b8d6", fontSize: "0.9rem" }}>
          {run.status === "not_found" && frame.phase === "complete"
            ? "No path found"
            : run.status === "same_source_target"
              ? "Source and target are identical"
              : frame.phase
                ? `Phase: ${frame.phase}`
                : "Ready"}
        </span>
      </div>

      <svg viewBox="0 0 100 75" style={{ width: "100%", minHeight: "340px" }}>
        {run.graphSnapshot.edges.map((edge) => {
          const key = edgeKey(edge.from, edge.to);
          if (!frame.revealedEdgeKeys.includes(key)) {
            return null;
          }

          const fromNode = run.graphSnapshot.nodes.find((node) => node.id === edge.from);
          const toNode = run.graphSnapshot.nodes.find((node) => node.id === edge.to);

          if (!fromNode || !toNode) {
            return null;
          }

          const state = frame.edgeStateByKey[key] ?? "visible";
          const isPath = frame.pathEdgeKeys.includes(key);

          let stroke = getBaseEdgeColor(edge.relation);
          let strokeWidth = 1.4;

          if (state === "exploring") {
            stroke = "#fbbf24";
            strokeWidth = 2.2;
          } else if (state === "resolved" || isPath) {
            stroke = "#22c55e";
            strokeWidth = 2.6;
          }

          return (
            <line
              key={key}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={edge.relation === "enemy" ? "4 3" : undefined}
              opacity={state === "seen" ? 0.7 : 1}
            />
          );
        })}

        {run.graphSnapshot.nodes.map((node) => {
          if (!frame.revealedNodeIds.includes(node.id)) {
            return null;
          }

          const isPathNode = frame.pathNodeIds.includes(node.id);
          const isFrontierNode = frame.frontierNodeIds.includes(node.id);
          const isVisitedNode = frame.visitedNodeIds.includes(node.id);
          const isActiveNode = frame.activeNodeId === node.id;

          let fill = "#64748b";
          let radius = 3.4;

          if (isVisitedNode) {
            fill = "#38bdf8";
          }
          if (isFrontierNode) {
            fill = "#fbbf24";
          }
          if (isActiveNode) {
            fill = "#f59e0b";
            radius = 4;
          }
          if (isPathNode && frame.isTerminal) {
            fill = "#22c55e";
            radius = 4.2;
          }

          return (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r={radius} fill={fill} stroke="#e5efff" strokeWidth="0.35" />
              <text x={node.x} y={node.y - 5} textAnchor="middle" fill="#e8f1ff" fontSize="3">
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginTop: "0.35rem",
          color: "#b5c7e3",
          fontSize: "0.84rem",
        }}
      >
        <span>Gray: unseen graph</span>
        <span>Amber: frontier/exploring</span>
        <span>Blue: visited</span>
        <span>Green: final path</span>
        <span>Dashed: enemy edge</span>
      </div>
    </section>
  );
}
