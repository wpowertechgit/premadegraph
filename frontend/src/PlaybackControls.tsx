import React from "react";
import { type PlaybackState } from "./pathfinderTypes";

interface PlaybackControlsProps {
  playbackState: PlaybackState;
  playbackSpeed: number;
  canStep: boolean;
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
        background:
          "linear-gradient(140deg, rgba(19, 33, 52, 0.96), rgba(11, 18, 32, 0.98))",
        border: "1px solid rgba(128, 181, 255, 0.2)",
        borderRadius: "18px",
        padding: "1rem",
        color: "#f4f8ff",
      }}
    >
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

        <label style={{ marginLeft: "auto", color: "#b5c7e3", fontSize: "0.88rem" }}>
          Speed{" "}
          <select
            value={playbackSpeed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            style={{
              marginLeft: "0.45rem",
              borderRadius: "10px",
              border: "1px solid rgba(136, 173, 230, 0.2)",
              background: "rgba(13, 21, 36, 0.85)",
              color: "#f4f8ff",
              padding: "0.45rem 0.6rem",
            }}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
          </select>
        </label>
      </div>
    </section>
  );
}
