import React from "react";
import { RiCloseLine } from "react-icons/ri";
import { getAlgorithmLabel, getPathModeLabel, useI18n } from "./i18n";
import { buttonStyle, metricCardStyle, sectionLabelStyle, surfaceCardStyle } from "./theme";
import type { SavedReplayRecord } from "./pathfinderTypes";

interface SavedReplaysOverlayProps {
  open: boolean;
  savedReplays: SavedReplayRecord[];
  onClose: () => void;
  onLoadReplay: (replay: SavedReplayRecord) => void;
  onDeleteReplay: (replay: SavedReplayRecord) => void | Promise<void>;
}

function formatSavedAt(value: string, language: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(language === "hu" ? "hu-HU" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRuntime(value: number) {
  return `${value.toFixed(2)} ms`;
}

export default function SavedReplaysOverlay({
  open,
  savedReplays,
  onClose,
  onLoadReplay,
  onDeleteReplay,
}: SavedReplaysOverlayProps) {
  const { language, t } = useI18n();

  return (
    <div
      aria-hidden={!open}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(6, 10, 14, 0.76)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 180ms ease",
        zIndex: 1250,
        padding: "1.25rem",
        display: "grid",
        placeItems: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.pathfinder.replayLibraryTitle}
        style={{
          ...surfaceCardStyle(),
          width: "min(980px, 100%)",
          maxHeight: "min(82vh, 900px)",
          display: "grid",
          gridTemplateRows: "auto 1fr",
          overflow: "hidden",
          padding: "1rem",
          gap: "0.9rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            alignItems: "start",
          }}
        >
          <div>
            <div style={sectionLabelStyle()}>{t.pathfinder.cachedReplays}</div>
            <div style={{ marginTop: "0.35rem", fontSize: "1.35rem", fontWeight: 700 }}>
              {t.pathfinder.replayLibraryTitle}
            </div>
            <div style={{ marginTop: "0.35rem", color: "var(--text-muted)", maxWidth: "720px", lineHeight: 1.5 }}>
              {t.pathfinder.replayLibraryDescription}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.pathfinder.closeReplayLibrary}
            title={t.pathfinder.closeReplayLibrary}
            style={{
              ...buttonStyle("ghost"),
              width: "42px",
              minHeight: "42px",
              height: "42px",
              padding: 0,
              display: "grid",
              placeItems: "center",
              borderRadius: "999px",
            }}
          >
            <RiCloseLine size={18} aria-hidden="true" />
          </button>
        </div>

        <div
          style={{
            minHeight: 0,
            overflowY: "auto",
            display: "grid",
            gap: "0.8rem",
            paddingRight: "0.15rem",
          }}
        >
          {savedReplays.length === 0 ? (
            <div
              style={{
                ...metricCardStyle(),
                padding: "1rem",
                color: "var(--text-muted)",
              }}
            >
              {t.pathfinder.noSavedReplays}
            </div>
          ) : (
            savedReplays.map((savedReplay) => (
              <article
                key={savedReplay.id}
                style={{
                  ...metricCardStyle(),
                  padding: "0.95rem 1rem",
                  gap: "0.8rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    alignItems: "start",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "1rem", fontWeight: 700 }}>{savedReplay.title}</div>
                    <div style={{ marginTop: "0.28rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                      {savedReplay.sourceLabel} {"->"} {savedReplay.targetLabel}
                    </div>
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    {t.pathfinder.savedAt}: {formatSavedAt(savedReplay.createdAt, language)}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "0.65rem",
                  }}
                >
                  <div>
                    <div style={sectionLabelStyle()}>{t.pathfinder.algorithm}</div>
                    <div style={{ marginTop: "0.2rem" }}>{getAlgorithmLabel(language, savedReplay.selectedAlgorithm)}</div>
                  </div>
                  <div>
                    <div style={sectionLabelStyle()}>{t.pathfinder.pathMode}</div>
                    <div style={{ marginTop: "0.2rem" }}>{getPathModeLabel(language, savedReplay.pathMode)}</div>
                  </div>
                  <div>
                    <div style={sectionLabelStyle()}>{t.pathfinder.execution}</div>
                    <div style={{ marginTop: "0.2rem" }}>{savedReplay.executionMode}</div>
                  </div>
                  <div>
                    <div style={sectionLabelStyle()}>{t.pathfinder.availablePlayers}</div>
                    <div style={{ marginTop: "0.2rem" }}>{savedReplay.datasetPlayerCount}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "0.45rem" }}>
                  <div style={sectionLabelStyle()}>{t.pathfinder.algorithmComparison}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                    {savedReplay.algorithmRuns.map((algorithmRun) => (
                      `${getAlgorithmLabel(language, algorithmRun.request.algorithm)} ${formatRuntime(algorithmRun.summary.runtimeMs)}`
                    )).join(" • ")}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadReplay(savedReplay);
                      onClose();
                    }}
                    style={buttonStyle("primary")}
                  >
                    {t.pathfinder.loadReplay}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteReplay(savedReplay)}
                    style={buttonStyle("danger")}
                  >
                    {t.pathfinder.deleteReplay}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
