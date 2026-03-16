import React, { useEffect, useMemo, useState } from "react";
import { type PlayerOption } from "./pathfinderTypes";
import { useI18n } from "./i18n";

interface PlayerLookupFieldProps {
  label: string;
  players: PlayerOption[];
  selectedId: string;
  onSelectedIdChange: (value: string) => void;
  placeholder?: string;
}

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
  boxSizing: "border-box",
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
        style={inputStyle}
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
            borderRadius: "14px",
            border: "1px solid #39424d",
            background: "#161a20",
            boxShadow: "0 16px 30px rgba(0, 0, 0, 0.35)",
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
                  borderBottom: "1px solid #252b33",
                  background: active ? "#24303b" : "transparent",
                  color: "#f3f4f6",
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
