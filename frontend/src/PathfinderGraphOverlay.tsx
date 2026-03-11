import React from "react";
import PathfinderGraphScene from "./PathfinderGraphScene";
import { type CanvasFrame, type GraphSnapshot, type PathfinderRunResponse } from "./pathfinderTypes";

interface PathfinderGraphOverlayProps {
  open: boolean;
  onClose: () => void;
  snapshot: GraphSnapshot;
  run: PathfinderRunResponse | null;
  frame: CanvasFrame;
  sourcePlayerId: string;
  targetPlayerId: string;
  datasetSummary: {
    players: number;
    relationships: number;
    allyRelationships: number;
    enemyRelationships: number;
  };
}

export default function PathfinderGraphOverlay({
  open,
  onClose,
  snapshot,
  run,
  frame,
  sourcePlayerId,
  targetPlayerId,
  datasetSummary,
}: PathfinderGraphOverlayProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 12, 16, 0.78)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 180ms ease",
        zIndex: 1200,
        padding: "1.25rem",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "min(1480px, 100%)",
          height: "min(88vh, 980px)",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: "1rem",
          background: "#171a1f",
          border: "1px solid #313740",
          borderRadius: "22px",
          boxShadow: "0 30px 90px rgba(0, 0, 0, 0.45)",
          padding: "1rem",
        }}
      >
        <div style={{ display: "grid", gap: "0.75rem", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ color: "#9ca3af", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Pathfinder Network Overlay
              </div>
              <div style={{ color: "#f3f4f6", fontSize: "1.4rem", fontWeight: 700 }}>
                Large graph view with persistent state
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: "12px",
                border: "1px solid #3a414a",
                background: "#252a31",
                color: "#e5e7eb",
                padding: "0.65rem 0.9rem",
              }}
            >
              Close Overlay
            </button>
          </div>

          <div style={{ minWidth: 0, minHeight: 0 }}>
            <PathfinderGraphScene
              snapshot={snapshot}
              run={run}
              frame={frame}
              sourcePlayerId={sourcePlayerId}
              targetPlayerId={targetPlayerId}
              variant="overlay"
            />
          </div>
        </div>

        <aside
          style={{
            borderRadius: "16px",
            border: "1px solid #2f363f",
            background: "#1d2127",
            padding: "1rem",
            color: "#d1d5db",
            display: "grid",
            alignContent: "start",
            gap: "0.85rem",
          }}
        >
          <div style={{ fontWeight: 700, color: "#f3f4f6" }}>Graph Bank</div>
          <div>{datasetSummary.players} players</div>
          <div>{datasetSummary.relationships} relationships</div>
          <div>{datasetSummary.allyRelationships} ally edges</div>
          <div>{datasetSummary.enemyRelationships} enemy edges</div>

          <div style={{ height: 1, background: "#323842", margin: "0.2rem 0" }} />

          <div style={{ fontWeight: 700, color: "#f3f4f6" }}>Why this comes first</div>
          <div style={{ color: "#9ca3af", lineHeight: 1.5 }}>
            Before touching the real backend graph, the frontend needs a denser mock network and a renderer
            that behaves like a graph tool rather than a decorative animation panel.
          </div>

          <div style={{ fontWeight: 700, color: "#f3f4f6" }}>Implementation order</div>
          <div style={{ color: "#9ca3af", lineHeight: 1.5 }}>
            1. Grow the mock graph bank
            <br />
            2. Validate the canvas renderer and overlay workflow
            <br />
            3. Introduce backend graph snapshots behind the same contract
          </div>

          <div style={{ fontWeight: 700, color: "#f3f4f6" }}>State behavior</div>
          <div style={{ color: "#9ca3af", lineHeight: 1.5 }}>
            Closing the overlay does not reset the current run or playback. The graph component stays mounted and
            keeps the active content.
          </div>
        </aside>
      </div>
    </div>
  );
}
