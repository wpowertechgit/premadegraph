import React from "react";
import PathfinderGraphScene from "./PathfinderGraphScene";
import { type CanvasFrame, type GraphSnapshot, type PathfinderRunResponse } from "./pathfinderTypes";

interface PathfinderCanvasProps {
  snapshot: GraphSnapshot;
  run: PathfinderRunResponse | null;
  frame: CanvasFrame;
  sourcePlayerId: string;
  targetPlayerId: string;
  onOpenOverlay: () => void;
}

export default function PathfinderCanvas({
  snapshot,
  run,
  frame,
  sourcePlayerId,
  targetPlayerId,
  onOpenOverlay,
}: PathfinderCanvasProps) {
  return (
    <section
      style={{
        minHeight: "440px",
        borderRadius: "18px",
        border: "1px solid #303741",
        background: "#191d23",
        padding: "1rem",
        color: "#e5e7eb",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "flex-start",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 700 }}>Graph Preview</div>
          <div style={{ color: "#9ca3af", fontSize: "0.9rem", marginTop: "0.2rem", maxWidth: "640px" }}>
            PyVis-style network preview with a denser mock graph bank. Open the overlay for the larger persistent
            graph tool.
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#9ca3af", fontSize: "0.88rem" }}>
            {run ? `Step ${frame.stepNumber || 0}` : "Overview mode"}
          </span>
          <button
            type="button"
            onClick={onOpenOverlay}
            style={{
              borderRadius: "12px",
              border: "1px solid #3b434d",
              background: "#252a31",
              color: "#e5e7eb",
              padding: "0.65rem 0.9rem",
            }}
          >
            Open Overlay
          </button>
        </div>
      </div>

      <PathfinderGraphScene
        snapshot={snapshot}
        run={run}
        frame={frame}
        sourcePlayerId={sourcePlayerId}
        targetPlayerId={targetPlayerId}
        variant="preview"
      />

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginTop: "0.7rem",
          color: "#9ca3af",
          fontSize: "0.84rem",
        }}
      >
        <span>Canvas renderer for larger networks</span>
        <span>Neutral baseline matches backend graph direction</span>
        <span>Drag to pan, wheel to zoom</span>
        <span>Overlay stays stateful when closed</span>
      </div>
    </section>
  );
}
