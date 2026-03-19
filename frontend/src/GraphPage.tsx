import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PlayerLookupField from "./PlayerLookupField";
import { fetchRustPathfinderOptions } from "./pathfinderApi";
import { type PlayerOption } from "./pathfinderTypes";
import { getAlgorithmLabel, getPathModeLabel, translateBackendText, useI18n } from "./i18n";
import { buttonStyle, glassCardStyle, pageShellStyle, sectionLabelStyle } from "./theme";

const GraphPage = () => {
  const { language, t } = useI18n();
  const navigate = useNavigate();
  const [graphUrl, setGraphUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [sourcePlayerId, setSourcePlayerId] = useState("");
  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [panelMinimized, setPanelMinimized] = useState(false);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        setLoading(true);
        setError(null);

        const [graphResponse, optionsResponse] = await Promise.all([
          fetch("http://localhost:3001/api/graph"),
          fetchRustPathfinderOptions(),
        ]);

        if (!graphResponse.ok) {
          throw new Error(`${t.graph.backendErrorPrefix}: ${graphResponse.statusText}`);
        }

        const graphData = await graphResponse.json();
        setGraphUrl(graphData.url);
        setPlayers(optionsResponse.players);

        if (optionsResponse.players.length > 1) {
          setSourcePlayerId(optionsResponse.players[0].id);
          setTargetPlayerId(optionsResponse.players[5]?.id || optionsResponse.players[1].id);
        }
      } catch (err: any) {
        setError(translateBackendText(language, err.message || t.app.alerts.unknown));
      } finally {
        setLoading(false);
      }
    };

    fetchGraph();
  }, []);

  if (loading) return <div className="app-empty-state">{t.graph.loading}</div>;
  if (error) return <div className="app-empty-state">{t.app.alerts.errorPrefix}: {error}</div>;

  return (
    <div style={{ ...pageShellStyle(true), overflow: "hidden", position: "relative" }}>
      {graphUrl ? (
        <iframe
          src={graphUrl}
          title={t.graph.iframeTitle}
          style={{ width: "100%", height: "calc(100vh - var(--nav-height))", border: "none" }}
        />
      ) : (
        <div className="app-empty-state">{t.graph.unavailable}</div>
      )}

      {panelMinimized ? (
        <button
          type="button"
          onClick={() => setPanelMinimized(false)}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            ...buttonStyle("secondary"),
            borderRadius: "999px",
            padding: "0.75rem 1rem",
          }}
        >
          {t.graph.openPathfinder}
        </button>
      ) : (
        <div
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            width: "min(360px, calc(100vw - 2rem))",
            ...glassCardStyle(),
            padding: "1rem",
            display: "grid",
            gap: "0.8rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
            <div>
              <div style={sectionLabelStyle()}>
                {t.graph.panelTitle}
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, marginTop: "0.25rem" }}>
                {t.graph.panelHeading}
              </div>
              <div style={{ marginTop: "0.35rem", color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.45 }}>
                {t.graph.panelDescription}
              </div>
            </div>
            <button
              type="button"
              aria-label={t.graph.minimizePanel}
              onClick={() => setPanelMinimized(true)}
              style={{
                ...buttonStyle("ghost"),
                borderRadius: "10px",
                width: "2rem",
                height: "2rem",
                fontWeight: 700,
                lineHeight: 1,
                display: "grid",
                placeItems: "center",
                alignSelf: "center",
                padding: 0,
              }}
            >
              X
            </button>
          </div>

          <PlayerLookupField
            label={t.graph.sourcePlayer}
            players={players}
            selectedId={sourcePlayerId}
            onSelectedIdChange={setSourcePlayerId}
          />
          <PlayerLookupField
            label={t.graph.targetPlayer}
            players={players}
            selectedId={targetPlayerId}
            onSelectedIdChange={setTargetPlayerId}
          />

          <div
            style={{
              borderRadius: "12px",
              border: "1px solid var(--border-subtle)",
              background: "rgba(8, 15, 23, 0.68)",
              padding: "0.8rem 0.9rem",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {t.graph.algorithm}: <strong>{getAlgorithmLabel(language, "astar")}</strong><br />
            {t.graph.pathMode}: <strong>{getPathModeLabel(language, "battle-path")}</strong><br />
            {t.graph.weightedMode}: <strong>{t.common.enabled}</strong>
          </div>

          <button
            type="button"
            disabled={!sourcePlayerId || !targetPlayerId}
            onClick={() =>
              navigate(
                `/pathfinder-lab?source=${encodeURIComponent(sourcePlayerId)}&target=${encodeURIComponent(targetPlayerId)}&algorithm=astar&pathMode=battle-path&weighted=1&autorun=1`,
              )
            }
            style={{
              ...buttonStyle("primary"),
              padding: "0.9rem 1rem",
              cursor: !sourcePlayerId || !targetPlayerId ? "not-allowed" : "pointer",
              opacity: !sourcePlayerId || !targetPlayerId ? 0.7 : 1,
            }}
          >
            {t.graph.openAnimatedRoute}
          </button>
        </div>
      )}
    </div>
  );
};

export default GraphPage;
