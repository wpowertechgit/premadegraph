import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PlayerLookupField from "./PlayerLookupField";
import { fetchRustPathfinderOptions } from "./pathfinderApi";
import { type PlayerOption } from "./pathfinderTypes";
import { getAlgorithmLabel, getPathModeLabel, translateBackendText, useI18n } from "./i18n";

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

  if (loading) return <div style={{ padding: "1rem", color: "white" }}>{t.graph.loading}</div>;
  if (error) return <div style={{ padding: "1rem", color: "red" }}>{t.app.alerts.errorPrefix}: {error}</div>;

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      {graphUrl ? (
        <iframe
          src={graphUrl}
          title={t.graph.iframeTitle}
          style={{ width: "100vw", height: "100vh", border: "none" }}
        />
      ) : (
        <div style={{ color: "white" }}>{t.graph.unavailable}</div>
      )}

      {panelMinimized ? (
        <button
          type="button"
          onClick={() => setPanelMinimized(false)}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            borderRadius: "999px",
            border: "1px solid rgba(79, 103, 127, 0.95)",
            background: "rgba(18, 22, 28, 0.92)",
            color: "#f3f4f6",
            padding: "0.75rem 1rem",
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(10px)",
            fontWeight: 700,
            cursor: "pointer",
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
            borderRadius: "18px",
            border: "1px solid rgba(79, 103, 127, 0.95)",
            background: "rgba(18, 22, 28, 0.92)",
            color: "#f3f4f6",
            padding: "1rem",
            boxShadow: "0 24px 50px rgba(0, 0, 0, 0.35)",
            backdropFilter: "blur(10px)",
            display: "grid",
            gap: "0.8rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af" }}>
                {t.graph.panelTitle}
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, marginTop: "0.25rem" }}>
                {t.graph.panelHeading}
              </div>
              <div style={{ marginTop: "0.35rem", color: "#c5ccd5", fontSize: "0.9rem", lineHeight: 1.45 }}>
                {t.graph.panelDescription}
              </div>
            </div>
            <button
              type="button"
              aria-label={t.graph.minimizePanel}
              onClick={() => setPanelMinimized(true)}
              style={{
                borderRadius: "10px",
                border: "1px solid #39424d",
                background: "#20252c",
                color: "#d1d5db",
                width: "2rem",
                height: "2rem",
                cursor: "pointer",
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
              border: "1px solid #39424d",
              background: "#20252c",
              padding: "0.8rem 0.9rem",
              color: "#d1d5db",
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
              borderRadius: "12px",
              border: "1px solid #4f677f",
              background: "#2f455b",
              color: "#f3f4f6",
              padding: "0.9rem 1rem",
              fontWeight: 700,
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
