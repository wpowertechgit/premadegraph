import React from "react";
import { type PlaybackState } from "./pathfinderTypes";
import { useI18n } from "./i18n";

interface PlaybackControlsProps {
  playbackState: PlaybackState;
  playbackSpeed: number;
  canStep: boolean;
  title?: string;
  progressLabel?: string;
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
  progressLabel,
  onPlay,
  onPause,
  onRestart,
  onStepForward,
  onStepBackward,
  onSpeedChange,
}: PlaybackControlsProps) {
  const { t } = useI18n();
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
        <div
          style={{
            marginBottom: "0.8rem",
            display: "flex",
            justifyContent: "space-between",
            gap: "0.75rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 700, color: "#f3f4f6" }}>{title}</div>
          {progressLabel ? <div style={{ color: "#9ca3af", fontSize: "0.88rem" }}>{progressLabel}</div> : null}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" disabled={!canStep || playbackState === "playing"} onClick={onPlay}>
          {t.pathfinder.play}
        </button>
        <button type="button" disabled={!canStep || playbackState !== "playing"} onClick={onPause}>
          {t.pathfinder.pause}
        </button>
        <button type="button" disabled={!canStep} onClick={onStepBackward}>
          {t.pathfinder.stepBack}
        </button>
        <button type="button" disabled={!canStep} onClick={onStepForward}>
          {t.pathfinder.stepForward}
        </button>
        <button type="button" disabled={!canStep} onClick={onRestart}>
          {t.pathfinder.restart}
        </button>

        <label style={{ marginLeft: "auto", color: "#9ca3af", fontSize: "0.88rem" }}>
          {t.pathfinder.speed}{" "}
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
