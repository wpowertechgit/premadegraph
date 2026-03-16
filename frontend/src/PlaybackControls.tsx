import React from "react";
import { type PlaybackState } from "./pathfinderTypes";

interface PlaybackControlsProps {
  playbackState: PlaybackState;
  playbackSpeed: number;
  canStep: boolean;
  title?: string;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSpeedChange: (value: number) => void;
}

export default function PlaybackControls({
  playbackState,
  playbackSpeed,
  canStep,
  title,
  onPlay,
  onPause,
  onRestart,
  onStepForward,
  onStepBackward,
  onSpeedChange,
}: PlaybackControlsProps) {
  return (
    <section
      style={{
        background: "#1d2127",
        border: "1px solid #303741",
        borderRadius: "18px",
        padding: "1rem",
        color: "#f3f4f6",
      }}
    >
      {title ? (
        <div style={{ marginBottom: "0.8rem", fontWeight: 700, color: "#f3f4f6" }}>{title}</div>
      ) : null}
      <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" disabled={!canStep || playbackState === "playing"} onClick={onPlay}>
          Play
        </button>
        <button type="button" disabled={!canStep || playbackState !== "playing"} onClick={onPause}>
          Pause
        </button>
        <button type="button" disabled={!canStep} onClick={onStepBackward}>
          Step Back
        </button>
        <button type="button" disabled={!canStep} onClick={onStepForward}>
          Step Forward
        </button>
        <button type="button" disabled={!canStep} onClick={onRestart}>
          Restart
        </button>

        <label style={{ marginLeft: "auto", color: "#9ca3af", fontSize: "0.88rem" }}>
          Speed{" "}
          <select
            value={playbackSpeed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            style={{
              marginLeft: "0.45rem",
              borderRadius: "10px",
              border: "1px solid #39424d",
              background: "#20252c",
              color: "#f3f4f6",
              padding: "0.45rem 0.6rem",
            }}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
          </select>
        </label>
      </div>
    </section>
  );
}
