import React from "react";
import {
  RiPauseFill,
  RiPlayFill,
  RiRestartLine,
  RiSkipBackFill,
  RiSkipForwardFill,
  RiSkipRightLine,
} from "react-icons/ri";
import { type PlaybackState } from "./pathfinderTypes";
import { useI18n } from "./i18n";
import { buttonStyle, sectionLabelStyle, surfaceCardStyle } from "./theme";

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
  onJumpToEnd: () => void;
  onSpeedChange: (value: number) => void;
}

function PlaybackIconButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled ? "true" : undefined}
      title={label}
      onClick={() => {
        if (!disabled) {
          onClick();
        }
      }}
      style={{
        ...buttonStyle("ghost"),
        minWidth: "46px",
        width: "46px",
        height: "46px",
        padding: 0,
        display: "grid",
        placeItems: "center",
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon}
    </button>
  );
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
  onJumpToEnd,
  onSpeedChange,
}: PlaybackControlsProps) {
  const { t } = useI18n();
  return (
    <section
      style={{
        ...surfaceCardStyle(),
        padding: "1rem",
        color: "var(--text-primary)",
        minWidth: 0,
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
          <div>
            <div style={sectionLabelStyle()}>{t.pathfinder.playback}</div>
            <div style={{ marginTop: "0.25rem", fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
          </div>
          {progressLabel ? <div style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>{progressLabel}</div> : null}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
        <div style={{ display: "inline-flex", gap: "0.55rem", flexWrap: "wrap" }}>
          <PlaybackIconButton
            label={t.pathfinder.play}
            disabled={!canStep || playbackState === "playing"}
            onClick={onPlay}
            icon={<RiPlayFill size={18} aria-hidden="true" />}
          />
          <PlaybackIconButton
            label={t.pathfinder.pause}
            disabled={!canStep || playbackState !== "playing"}
            onClick={onPause}
            icon={<RiPauseFill size={18} aria-hidden="true" />}
          />
          <PlaybackIconButton
            label={t.pathfinder.stepBack}
            disabled={!canStep}
            onClick={onStepBackward}
            icon={<RiSkipBackFill size={18} aria-hidden="true" />}
          />
          <PlaybackIconButton
            label={t.pathfinder.stepForward}
            disabled={!canStep}
            onClick={onStepForward}
            icon={<RiSkipForwardFill size={18} aria-hidden="true" />}
          />
          <PlaybackIconButton
            label={t.pathfinder.jumpToEnd}
            disabled={!canStep}
            onClick={onJumpToEnd}
            icon={<RiSkipRightLine size={18} aria-hidden="true" />}
          />
          <PlaybackIconButton
            label={t.pathfinder.restart}
            disabled={!canStep}
            onClick={onRestart}
            icon={<RiRestartLine size={18} aria-hidden="true" />}
          />
        </div>

        <label style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "0.88rem" }}>
          {t.pathfinder.speed}{" "}
          <select
            value={playbackSpeed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            style={{
              marginLeft: "0.45rem",
              borderRadius: "10px",
              border: "1px solid var(--border-strong)",
              background: "rgba(10, 19, 28, 0.72)",
              color: "var(--text-primary)",
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
