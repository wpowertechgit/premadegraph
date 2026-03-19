import React from "react";
import PlayerLookupField from "./PlayerLookupField";
import {
  type AlgorithmId,
  type ExecutionMode,
  type PathMode,
  type PlayerOption,
} from "./pathfinderTypes";
import { getAlgorithmLabel, getPathModeLabel, useI18n } from "./i18n";
import { buttonStyle, inputStyle, sectionLabelStyle, surfaceCardStyle } from "./theme";

interface PathfinderControlsProps {
  players: PlayerOption[];
  supportedAlgorithms: AlgorithmId[];
  sourcePlayerId: string;
  targetPlayerId: string;
  algorithm: AlgorithmId;
  pathMode: PathMode;
  weightedMode: boolean;
  executionMode: ExecutionMode;
  loading: boolean;
  playersLoading: boolean;
  onSourceChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onAlgorithmChange: (value: AlgorithmId) => void;
  onPathModeChange: (value: PathMode) => void;
  onWeightedModeChange: (value: boolean) => void;
  onExecutionModeChange: (value: ExecutionMode) => void;
  onReloadPlayers: () => void;
  onRun: () => void;
  onReset: () => void;
}

const panelStyle: React.CSSProperties = {
  ...surfaceCardStyle(),
  padding: "1rem",
};

const labelStyle: React.CSSProperties = {
  ...sectionLabelStyle(),
  display: "block",
  marginBottom: "0.35rem",
};

export default function PathfinderControls({
  players,
  supportedAlgorithms,
  sourcePlayerId,
  targetPlayerId,
  algorithm,
  pathMode,
  weightedMode,
  executionMode,
  loading,
  playersLoading,
  onSourceChange,
  onTargetChange,
  onAlgorithmChange,
  onPathModeChange,
  onWeightedModeChange,
  onExecutionModeChange,
  onReloadPlayers,
  onRun,
  onReset,
}: PathfinderControlsProps) {
  const { language, t } = useI18n();
  return (
    <section style={panelStyle}>
      <div style={{ marginBottom: "0.95rem" }}>
        <label style={labelStyle}>{t.pathfinder.execution}</label>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {([
            { id: "rust-backend", label: t.pathfinder.rustBackend },
            { id: "frontend-demo", label: t.pathfinder.browserReplay },
          ] as const).map((option) => {
            const active = executionMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onExecutionModeChange(option.id)}
                style={{
                  ...buttonStyle(active ? "primary" : "secondary"),
                }}
              >
                {option.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onReloadPlayers}
            disabled={playersLoading || executionMode === "frontend-demo"}
            style={{
              ...buttonStyle("ghost"),
              cursor: playersLoading || executionMode === "frontend-demo" ? "not-allowed" : "pointer",
              opacity: executionMode === "frontend-demo" ? 0.6 : 1,
            }}
          >
            {playersLoading ? t.pathfinder.loadingPlayers : t.pathfinder.reloadPlayers}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "0.75rem",
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <PlayerLookupField
            label={t.pathfinder.sourcePlayer}
            players={players}
            selectedId={sourcePlayerId}
            onSelectedIdChange={onSourceChange}
            placeholder={playersLoading ? t.pathfinder.loadingPlayerList : t.pathfinder.typePlayerName}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <PlayerLookupField
            label={t.pathfinder.targetPlayer}
            players={players}
            selectedId={targetPlayerId}
            onSelectedIdChange={onTargetChange}
            placeholder={playersLoading ? t.pathfinder.loadingPlayerList : t.pathfinder.typePlayerName}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "0.85rem",
          marginTop: "0.95rem",
        }}
      >
        <div>
          <label style={labelStyle}>{t.pathfinder.algorithm}</label>
          <select
            value={algorithm}
            onChange={(event) => onAlgorithmChange(event.target.value as AlgorithmId)}
            style={inputStyle()}
          >
            {supportedAlgorithms.map((item) => (
              <option key={item} value={item}>
                {getAlgorithmLabel(language, item)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>{t.pathfinder.pathMode}</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["social-path", "battle-path"] as PathMode[]).map((mode) => {
              const active = mode === pathMode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onPathModeChange(mode)}
                  style={{
                    flex: 1,
                    ...buttonStyle(active ? "primary" : "secondary"),
                    padding: "0.8rem 0.5rem",
                  }}
                >
                  {getPathModeLabel(language, mode)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={labelStyle}>{t.pathfinder.weightedMode}</label>
          <button
            type="button"
            disabled={algorithm !== "dijkstra" && algorithm !== "astar"}
            title={algorithm === "dijkstra" || algorithm === "astar" ? t.pathfinder.weightedTitleEnabled : t.pathfinder.weightedTitleDisabled}
            onClick={() => onWeightedModeChange(!weightedMode)}
            style={{
              ...inputStyle(),
              textAlign: "left",
              opacity: algorithm === "dijkstra" || algorithm === "astar" ? 1 : 0.65,
              cursor: algorithm === "dijkstra" || algorithm === "astar" ? "pointer" : "not-allowed",
              background: weightedMode && (algorithm === "dijkstra" || algorithm === "astar")
                ? "rgba(102, 184, 255, 0.14)"
                : "var(--surface-soft)",
              border: weightedMode && (algorithm === "dijkstra" || algorithm === "astar")
                ? "1px solid rgba(102, 184, 255, 0.45)"
                : "1px solid var(--border-strong)",
            }}
          >
            {weightedMode && (algorithm === "dijkstra" || algorithm === "astar")
              ? t.pathfinder.weightedEnabled
              : t.pathfinder.weightedUnavailable}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginTop: "1rem",
          flexWrap: "wrap",
        }}
      >
          <button
            type="button"
            disabled={loading || playersLoading || !sourcePlayerId || !targetPlayerId}
          onClick={onRun}
          style={{
            ...buttonStyle("primary"),
            minWidth: "144px",
          }}
          >
            {loading ? t.pathfinder.running : t.pathfinder.runSearch}
          </button>
        <button
          type="button"
          onClick={onReset}
          style={{
            ...buttonStyle("secondary"),
            minWidth: "144px",
          }}
        >
          {t.pathfinder.reset}
        </button>
      </div>
    </section>
  );
}
