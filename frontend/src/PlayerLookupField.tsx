import React, { useEffect, useMemo, useState } from "react";
import { type PlayerOption } from "./pathfinderTypes";
import { useI18n } from "./i18n";
import { inputStyle, sectionLabelStyle, surfaceCardStyle } from "./theme";

interface PlayerLookupFieldProps {
  label: string;
  players: PlayerOption[];
  selectedId: string;
  onSelectedIdChange: (value: string) => void;
  placeholder?: string;
}

const labelStyle: React.CSSProperties = {
  ...sectionLabelStyle(),
  display: "block",
  marginBottom: "0.35rem",
};

export default function PlayerLookupField({
  label,
  players,
  selectedId,
  onSelectedIdChange,
  placeholder,
}: PlayerLookupFieldProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const selectedPlayer = players.find((player) => player.id === selectedId);
    setQuery(selectedPlayer?.label ?? "");
  }, [players, selectedId]);

  const filteredPlayers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 1) {
      return players.slice(0, 8);
    }

    return players
      .filter((player) => player.label.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [players, query]);

  return (
    <div style={{ position: "relative" }}>
      <label style={labelStyle}>{label}</label>
      <input
        value={query}
        placeholder={placeholder ?? t.pathfinder.typeAtLeastThreeLetters}
        onChange={(event) => {
          const nextValue = event.target.value;
          setQuery(nextValue);
          setOpen(true);

          const exactMatch = players.find(
            (player) => player.label.toLowerCase() === nextValue.trim().toLowerCase(),
          );
          if (exactMatch) {
            onSelectedIdChange(exactMatch.id);
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            const selectedPlayer = players.find((player) => player.id === selectedId);
            setQuery(selectedPlayer?.label ?? "");
          }, 120);
        }}
        style={inputStyle()}
      />

      {open && filteredPlayers.length > 0 ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 0.35rem)",
            left: 0,
            right: 0,
            maxHeight: "220px",
            overflowY: "auto",
            ...surfaceCardStyle(),
            borderRadius: "18px",
            zIndex: 20,
          }}
        >
          {filteredPlayers.map((player) => {
            const active = player.id === selectedId;
            return (
              <button
                key={player.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelectedIdChange(player.id);
                  setQuery(player.label);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  borderBottom: "1px solid rgba(126, 155, 183, 0.12)",
                  background: active ? "rgba(102, 184, 255, 0.12)" : "transparent",
                  color: "var(--text-primary)",
                  padding: "0.75rem 0.9rem",
                  cursor: "pointer",
                }}
              >
                {player.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
