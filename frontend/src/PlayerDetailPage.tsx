import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PlayerLookupField from "./PlayerLookupField";
import PlayerPerformanceCard from "./components/PlayerPerformanceCard.tsx";
import { fetchPlayerOptions } from "./pathfinderApi";
import { type PlayerOption } from "./pathfinderTypes";
import { useI18n } from "./i18n";
import { pageShellStyle, sectionLabelStyle } from "./theme";

const PlayerDetailPage = () => {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedPlayerId = useMemo(() => searchParams.get("puuid") || "", [searchParams]);

  React.useEffect(() => {
    const loadPlayers = async () => {
      try {
        setLoading(true);
        const response = await fetchPlayerOptions();
        setPlayers(response.players);
      } catch (err) {
        console.error("Failed to load players:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPlayers();
  }, []);

  const handlePlayerChange = (puuid: string) => {
    setSearchParams({ puuid });
  };

  if (loading) {
    return <div style={{ ...pageShellStyle(true), display: "grid", placeItems: "center" }}>Loading...</div>;
  }

  return (
    <div style={pageShellStyle(true)}>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1rem", display: "grid", gap: "2rem" }}>
        {/* Header */}
        <div>
          <div style={sectionLabelStyle()}>Player Analysis</div>
          <h1 style={{ margin: "0.5rem 0 0 0", fontSize: "2rem", fontWeight: 700 }}>Performance Breakdown</h1>
        </div>

        {/* Player Lookup */}
        <div style={{ padding: "1.5rem", border: "1px solid var(--border-subtle)", borderRadius: "12px" }}>
          <PlayerLookupField
            label="Select Player"
            players={players}
            selectedId={selectedPlayerId}
            onSelectedIdChange={handlePlayerChange}
          />
        </div>

        {/* Performance Card */}
        {selectedPlayerId && <PlayerPerformanceCard puuid={selectedPlayerId} />}

        {!selectedPlayerId && (
          <div
            style={{
              padding: "3rem 2rem",
              textAlign: "center",
              color: "var(--text-muted)",
              borderRadius: "12px",
              background: "rgba(8, 15, 23, 0.4)",
              border: "1px dashed var(--border-subtle)",
            }}
          >
            <p style={{ fontSize: "1.1rem", margin: 0 }}>Select a player above to view their performance metrics</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerDetailPage;
