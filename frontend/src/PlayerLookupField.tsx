import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const selectedPlayer = players.find((player) => player.id === selectedId);
    const label = selectedPlayer?.label ?? "";
    setQuery(label);
    setDebouncedQuery(label);
  }, [players, selectedId]);

  const filteredPlayers = useMemo(() => {
    const normalized = debouncedQuery.trim().toLowerCase();
    if (normalized.length < 1) {
      return players.slice(0, 8);
    }

    return players
      .filter((player) => player.label.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [players, debouncedQuery]);

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

          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            setDebouncedQuery(nextValue);
            const exactMatch = players.find(
              (player) => player.label.toLowerCase() === nextValue.trim().toLowerCase(),
            );
            if (exactMatch) {
              onSelectedIdChange(exactMatch.id);
            }
          }, 150);
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
                  // Cancel any pending debounce so it cannot fire a second onSelectedIdChange.
                  if (debounceRef.current) {
                    clearTimeout(debounceRef.current);
                    debounceRef.current = null;
                  }
                  onSelectedIdChange(player.id);
                  setQuery(player.label);
                  setDebouncedQuery(player.label);
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
