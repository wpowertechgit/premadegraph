import React from "react";
import PathfinderGraphScene from "./PathfinderGraphScene";
import { type CanvasFrame, type GraphSnapshot, type PathfinderRunResponse } from "./pathfinderTypes";
import { useI18n } from "./i18n";

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
  const { t } = useI18n();
  const progressLabel = run && run.trace.length > 0
    ? `${t.pathfinder.stepLabel} ${Math.min(frame.stepNumber || 1, run.trace.length)} / ${run.trace.length}`
    : t.pathfinder.overviewMode;

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
          <div style={{ fontSize: "1rem", fontWeight: 700 }}>{t.pathfinder.graphPreview}</div>
          <div style={{ color: "#9ca3af", fontSize: "0.9rem", marginTop: "0.2rem", maxWidth: "640px" }}>
            {t.pathfinder.graphPreviewText}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#9ca3af", fontSize: "0.88rem" }}>
            {progressLabel}
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
            {t.pathfinder.openOverlay}
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
        <span>{t.pathfinder.canvasNote1}</span>
        <span>{t.pathfinder.canvasNote2}</span>
        <span>{t.pathfinder.canvasNote3}</span>
        <span>{t.pathfinder.canvasNote4}</span>
      </div>
    </section>
  );
}
