import React from "react";
import {
  ALGORITHM_LABELS,
  PATH_MODE_LABELS,
  type AlgorithmId,
  type PathMode,
  type PlayerOption,
} from "./pathfinderTypes";

interface PathfinderControlsProps {
  players: PlayerOption[];
  sourcePlayerId: string;
  targetPlayerId: string;
  algorithm: AlgorithmId;
  pathMode: PathMode;
  loading: boolean;
  onSourceChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onAlgorithmChange: (value: AlgorithmId) => void;
  onPathModeChange: (value: PathMode) => void;
  onRun: () => void;
  onReset: () => void;
}

const panelStyle: React.CSSProperties = {
  background: "#1d2127",
  border: "1px solid #303741",
  borderRadius: "18px",
  padding: "1rem",
  color: "#f3f4f6",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  marginBottom: "0.35rem",
  color: "#9ca3af",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: "12px",
  border: "1px solid #39424d",
  background: "#20252c",
  color: "#f3f4f6",
  padding: "0.8rem 0.9rem",
};

export default function PathfinderControls({
  players,
  sourcePlayerId,
  targetPlayerId,
  algorithm,
  pathMode,
  loading,
  onSourceChange,
  onTargetChange,
  onAlgorithmChange,
  onPathModeChange,
  onRun,
  onReset,
}: PathfinderControlsProps) {
  const runnableAlgorithms = (["bfs", "dijkstra", "bidirectional"] as AlgorithmId[]);

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Source Player</label>
          <select
            value={sourcePlayerId}
            onChange={(event) => onSourceChange(event.target.value)}
            style={inputStyle}
          >
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Target Player</label>
          <select
            value={targetPlayerId}
            onChange={(event) => onTargetChange(event.target.value)}
            style={inputStyle}
          >
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.label}
              </option>
            ))}
          </select>
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
          <label style={labelStyle}>Algorithm</label>
          <select
            value={algorithm}
            onChange={(event) => onAlgorithmChange(event.target.value as AlgorithmId)}
            style={inputStyle}
          >
            {runnableAlgorithms.map((item) => (
              <option key={item} value={item}>
                {ALGORITHM_LABELS[item]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Path Mode</label>
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
                    borderRadius: "12px",
                    border: active
                      ? "1px solid #5680a7"
                      : "1px solid #39424d",
                    background: active ? "#2c3540" : "#20252c",
                    color: "#f3f4f6",
                    padding: "0.8rem 0.5rem",
                  }}
                >
                  {PATH_MODE_LABELS[mode]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Weighted Mode</label>
          <button
            type="button"
            disabled
            title="Coming later"
            style={{
              ...inputStyle,
              textAlign: "left",
              opacity: 0.65,
              cursor: "not-allowed",
            }}
          >
            Coming later
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
          disabled={loading}
          onClick={onRun}
          style={{
            background: "#2f455b",
            color: "#f3f4f6",
            minWidth: "144px",
            border: "1px solid #4f677f",
          }}
        >
          {loading ? "Running..." : "Run Search"}
        </button>
        <button
          type="button"
          onClick={onReset}
          style={{
            background: "#20252c",
            color: "#d1d5db",
            minWidth: "144px",
            border: "1px solid #39424d",
          }}
        >
          Reset
        </button>
      </div>
    </section>
  );
}
