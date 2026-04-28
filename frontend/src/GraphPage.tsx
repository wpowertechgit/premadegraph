import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GraphV2Scene from "./GraphV2Scene";
import PlayerLookupField from "./PlayerLookupField";
import {
  fetchRustGraphV2Buffers,
  fetchRustGraphV2ClusterMeta,
  fetchRustGraphV2Manifest,
  fetchRustGraphV2NodeMeta,
  fetchRustPathfinderOptions,
  rebuildRustGraphV2,
  runRustPathfinderBackend,
} from "./pathfinderApi";
import { type PathMode, type PlayerOption } from "./pathfinderTypes";
import type { GraphV2Buffers, GraphV2ClusterMeta, GraphV2Manifest, GraphV2NodeMeta } from "./graphV2Types";
import { getAlgorithmLabel, getPathModeLabel, translateBackendText, useI18n } from "./i18n";
import { buttonStyle, glassCardStyle, pageShellStyle, sectionLabelStyle } from "./theme";

const metricLabelStyle: React.CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.72rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const metricValueStyle: React.CSSProperties = {
  color: "var(--text-primary)",
  fontSize: "1.08rem",
  fontWeight: 800,
};

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatGeneratedAt(value: string) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return value;
  }
  return new Date(timestamp * 1000).toLocaleString();
}

const GraphPage = () => {
  const { language, t } = useI18n();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<GraphV2Manifest | null>(null);
  const [nodeMeta, setNodeMeta] = useState<GraphV2NodeMeta | null>(null);
  const [clusterMeta, setClusterMeta] = useState<GraphV2ClusterMeta | null>(null);
  const [buffers, setBuffers] = useState<GraphV2Buffers | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [sourcePlayerId, setSourcePlayerId] = useState("");
  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [pathMode, setPathMode] = useState<PathMode>("battle-path");
  const [showEnemyEdges, setShowEnemyEdges] = useState(false);
  const [showBridgeEdges, setShowBridgeEdges] = useState(true);
  const [showRawInternalEdges, setShowRawInternalEdges] = useState(true);
  const [pathNodeIds, setPathNodeIds] = useState<string[]>([]);
  const [pathStatus, setPathStatus] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [panelMinimized, setPanelMinimized] = useState(false);

  const loadGraph = useCallback(async () => {
    const [manifestResponse, nodeMetaResponse, clusterMetaResponse, buffersResponse] =
      await Promise.all([
        fetchRustGraphV2Manifest(),
        fetchRustGraphV2NodeMeta(),
        fetchRustGraphV2ClusterMeta(),
        fetchRustGraphV2Buffers(),
      ]);

    if (nodeMetaResponse.ids.length !== manifestResponse.nodeCount) {
      throw new Error("Graph V2 metadata length does not match manifest node count.");
    }
    if (buffersResponse.nodePositions.length !== manifestResponse.nodeCount * manifestResponse.nodePositionStride) {
      throw new Error("Graph V2 node position buffer length does not match manifest.");
    }
    if (buffersResponse.edgePairs.length !== manifestResponse.edgeCount * manifestResponse.edgePairStride) {
      throw new Error("Graph V2 edge pair buffer length does not match manifest.");
    }

    setManifest(manifestResponse);
    setNodeMeta(nodeMetaResponse);
    setClusterMeta(clusterMetaResponse);
    setBuffers(buffersResponse);
  }, []);

  const loadPlayerOptions = useCallback(async () => {
    const optionsResponse = await fetchRustPathfinderOptions();
    setPlayers(optionsResponse.players);
  }, []);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        setLoading(true);
        setError(null);
        await loadGraph();
        void loadPlayerOptions();
      } catch (err: any) {
        setError(translateBackendText(language, err.message || t.app.alerts.unknown));
      } finally {
        setLoading(false);
      }
    };

    fetchGraph();
  }, [language, loadGraph, loadPlayerOptions, t.app.alerts.unknown]);

  const runSelectedPath = useCallback(
    async (sourceId: string, targetId: string, mode: PathMode = pathMode) => {
      if (!sourceId || !targetId || sourceId === targetId) {
        setPathNodeIds([]);
        setPathStatus(null);
        return;
      }
      setPathStatus("running");
      try {
        const response = await runRustPathfinderBackend({
          sourcePlayerId: sourceId,
          targetPlayerId: targetId,
          algorithm: "astar",
          pathMode: mode,
          weightedMode: true,
          options: {
            includeTrace: false,
            maxSteps: 50000,
          },
        });
        setPathNodeIds(response.path.nodes);
        setPathStatus(response.status);
      } catch (err: any) {
        setPathNodeIds([]);
        setPathStatus(err.message || "failed");
      }
    },
    [pathMode],
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (!sourcePlayerId || (sourcePlayerId && targetPlayerId)) {
        setSourcePlayerId(nodeId);
        setTargetPlayerId("");
        setPathNodeIds([]);
        setPathStatus(null);
        return;
      }

      setTargetPlayerId(nodeId);
      void runSelectedPath(sourcePlayerId, nodeId);
    },
    [runSelectedPath, sourcePlayerId, targetPlayerId],
  );

  const clearPathSelection = useCallback(() => {
    setSourcePlayerId("");
    setTargetPlayerId("");
    setPathNodeIds([]);
    setPathStatus(null);
  }, []);

  const showClustersOnly = useCallback(() => {
    setShowBridgeEdges(false);
    setShowEnemyEdges(false);
    setShowRawInternalEdges(true);
  }, []);

  const hoveredPlayer = useMemo(() => {
    if (hoverIndex === null || !nodeMeta || !buffers || !manifest) {
      return null;
    }
    const stride = manifest.nodeMetricStride;
    return {
      id: nodeMeta.ids[hoverIndex],
      label: nodeMeta.labels[hoverIndex],
      opscore: nodeMeta.opscores[hoverIndex],
      feedscore: nodeMeta.feedscores[hoverIndex],
      totalDegree: buffers.nodeMetrics[hoverIndex * stride] ?? 0,
      allyDegree: buffers.nodeMetrics[hoverIndex * stride + 1] ?? 0,
      enemyDegree: buffers.nodeMetrics[hoverIndex * stride + 2] ?? 0,
      totalSupport: buffers.nodeMetrics[hoverIndex * stride + 3] ?? 0,
    };
  }, [buffers, hoverIndex, manifest, nodeMeta]);

  const topClusters = useMemo(
    () => clusterMeta?.clusters.slice(0, 4) ?? [],
    [clusterMeta],
  );

  const rebuildGraph = async () => {
    try {
      setRebuilding(true);
      setError(null);
      await rebuildRustGraphV2();
      await loadGraph();
      setPathNodeIds([]);
      setPathStatus(null);
    } catch (err: any) {
      setError(translateBackendText(language, err.message || t.app.alerts.unknown));
    } finally {
      setRebuilding(false);
    }
  };

  if (loading) return <div className="app-empty-state">{t.graph.loading}</div>;
  if (error) return <div className="app-empty-state">{t.app.alerts.errorPrefix}: {error}</div>;
  if (!manifest || !nodeMeta || !buffers) return <div className="app-empty-state">{t.graph.unavailable}</div>;

  return (
    <div
      style={{
        ...pageShellStyle(true),
        height: "calc(100vh - var(--nav-height))",
        overflow: "hidden",
        position: "relative",
        background: "#071019",
      }}
    >
      <GraphV2Scene
        manifest={manifest}
        nodeMeta={nodeMeta}
        buffers={buffers}
        showEnemyEdges={showEnemyEdges}
        showBridgeEdges={showBridgeEdges}
        showRawInternalEdges={showRawInternalEdges}
        selectedSourceId={sourcePlayerId}
        selectedTargetId={targetPlayerId}
        pathNodeIds={pathNodeIds}
        onNodeClick={handleNodeClick}
        onHoverIndexChange={setHoverIndex}
      />

      <div
        style={{
          position: "absolute",
          left: "1rem",
          bottom: "1rem",
          display: "flex",
          gap: "0.55rem",
          flexWrap: "wrap",
          maxWidth: "min(720px, calc(100vw - 2rem))",
        }}
      >
        {[
          ["Dataset", manifest.datasetId],
          ["Nodes", formatCount(manifest.nodeCount)],
          ["Edges", formatCount(manifest.edgeCount)],
          ["Clusters", formatCount(manifest.clusterCount)],
          ["Generated", formatGeneratedAt(manifest.generatedAt)],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              ...glassCardStyle(),
              borderRadius: "8px",
              padding: "0.55rem 0.7rem",
              minWidth: label === "Generated" ? "13rem" : "5.6rem",
            }}
          >
            <div style={metricLabelStyle}>{label}</div>
            <div style={{ ...metricValueStyle, fontSize: label === "Generated" ? "0.82rem" : metricValueStyle.fontSize }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {hoveredPlayer && (
        <div
          style={{
            position: "absolute",
            left: "1rem",
            top: "1rem",
            ...glassCardStyle(),
            borderRadius: "8px",
            padding: "0.75rem 0.85rem",
            minWidth: "250px",
          }}
        >
          <div style={{ fontWeight: 800 }}>{hoveredPlayer.label}</div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "0.18rem" }}>
            {hoveredPlayer.id.slice(0, 16)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.55rem", marginTop: "0.75rem" }}>
            <div><div style={metricLabelStyle}>opscore</div><div style={metricValueStyle}>{hoveredPlayer.opscore?.toFixed(2) ?? "-"}</div></div>
            <div><div style={metricLabelStyle}>feedscore</div><div style={metricValueStyle}>{hoveredPlayer.feedscore?.toFixed(2) ?? "-"}</div></div>
            <div><div style={metricLabelStyle}>ally degree</div><div style={metricValueStyle}>{hoveredPlayer.allyDegree}</div></div>
            <div><div style={metricLabelStyle}>enemy degree</div><div style={metricValueStyle}>{hoveredPlayer.enemyDegree}</div></div>
          </div>
        </div>
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
            width: "min(390px, calc(100vw - 2rem))",
            maxHeight: "calc(100vh - var(--nav-height) - 2rem)",
            overflow: "auto",
            ...glassCardStyle(),
            borderRadius: "8px",
            padding: "1rem",
            display: "grid",
            gap: "0.8rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
            <div>
              <div style={sectionLabelStyle()}>{t.graph.panelTitle}</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, marginTop: "0.25rem" }}>
                Graph Builder V2
              </div>
              <div style={{ marginTop: "0.35rem", color: "var(--text-muted)", fontSize: "0.88rem", lineHeight: 1.45 }}>
                Rust artifact graph, `min_weight = {manifest.minSupportThreshold}`, bridge-orbit ally groups.
              </div>
            </div>
            <button
              type="button"
              aria-label={t.graph.minimizePanel}
              onClick={() => setPanelMinimized(true)}
              style={{
                ...buttonStyle("ghost"),
                borderRadius: "8px",
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.55rem" }}>
            <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "0.55rem" }}>
              <div style={metricLabelStyle}>ally</div>
              <div style={metricValueStyle}>{formatCount(manifest.allyEdgeCount)}</div>
            </div>
            <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "0.55rem" }}>
              <div style={metricLabelStyle}>enemy</div>
              <div style={metricValueStyle}>{formatCount(manifest.enemyEdgeCount)}</div>
            </div>
            <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "0.55rem" }}>
              <div style={metricLabelStyle}>matches</div>
              <div style={metricValueStyle}>{formatCount(manifest.matchCount)}</div>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.55rem", color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={showBridgeEdges}
              onChange={(event) => {
                setShowBridgeEdges(event.target.checked);
                if (!event.target.checked) {
                  setShowEnemyEdges(false);
                  setShowRawInternalEdges(true);
                }
              }}
            />
            Show bridge links
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "0.55rem", color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={showEnemyEdges}
              disabled={!showBridgeEdges}
              onChange={(event) => setShowEnemyEdges(event.target.checked)}
            />
            Show enemy edges
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "0.55rem", color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={showRawInternalEdges}
              onChange={(event) => setShowRawInternalEdges(event.target.checked)}
            />
            Show member links
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={showClustersOnly}
              style={{ ...buttonStyle("secondary"), padding: "0.62rem 0.7rem" }}
            >
              Clusters only
            </button>
            <button
              type="button"
              disabled={!sourcePlayerId && !targetPlayerId && pathNodeIds.length === 0}
              onClick={clearPathSelection}
              style={{
                ...buttonStyle("secondary"),
                padding: "0.62rem 0.7rem",
                cursor: !sourcePlayerId && !targetPlayerId && pathNodeIds.length === 0 ? "not-allowed" : "pointer",
                opacity: !sourcePlayerId && !targetPlayerId && pathNodeIds.length === 0 ? 0.62 : 1,
              }}
            >
              Clear path
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.45rem 0.65rem",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              padding: "0.65rem",
              color: "var(--text-secondary)",
              fontSize: "0.78rem",
            }}
          >
            {[
              ["#8fdcff", "regular player"],
              ["#2fde82", "best opscore"],
              ["#ff4d5f", "worst feedscore"],
              ["#52c7ff", "ally bridge"],
              ["#f4d35e", "selected route"],
            ].map(([color, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.42rem", minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: "0.62rem",
                    height: "0.62rem",
                    borderRadius: "999px",
                    background: color,
                    boxShadow: `0 0 10px ${color}`,
                    flex: "0 0 auto",
                  }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {(["social-path", "battle-path"] as PathMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setPathMode(mode);
                  if (sourcePlayerId && targetPlayerId) {
                    void runSelectedPath(sourcePlayerId, targetPlayerId, mode);
                  }
                }}
                style={{
                  ...buttonStyle(pathMode === mode ? "primary" : "secondary"),
                  padding: "0.65rem 0.7rem",
                }}
              >
                {getPathModeLabel(language, mode)}
              </button>
            ))}
          </div>

          <PlayerLookupField
            label={t.graph.sourcePlayer}
            players={players}
            selectedId={sourcePlayerId}
            onSelectedIdChange={(id) => {
              setSourcePlayerId(id);
              if (id && targetPlayerId) {
                void runSelectedPath(id, targetPlayerId);
              }
            }}
          />
          <PlayerLookupField
            label={t.graph.targetPlayer}
            players={players}
            selectedId={targetPlayerId}
            onSelectedIdChange={(id) => {
              setTargetPlayerId(id);
              if (sourcePlayerId && id) {
                void runSelectedPath(sourcePlayerId, id);
              }
            }}
          />

          <div
            style={{
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              background: "rgba(8, 15, 23, 0.68)",
              padding: "0.75rem 0.85rem",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              fontSize: "0.9rem",
            }}
          >
            {t.graph.algorithm}: <strong>{getAlgorithmLabel(language, "astar")}</strong><br />
            {t.graph.pathMode}: <strong>{getPathModeLabel(language, pathMode)}</strong><br />
            {t.graph.weightedMode}: <strong>{t.common.enabled}</strong><br />
            Route: <strong>{pathStatus || "click nodes or choose players"}</strong>
          </div>

          <button
            type="button"
            disabled={!sourcePlayerId || !targetPlayerId}
            onClick={() =>
              navigate(
                `/pathfinder-lab?source=${encodeURIComponent(sourcePlayerId)}&target=${encodeURIComponent(targetPlayerId)}&algorithm=astar&pathMode=${pathMode}&weighted=1&autorun=1`,
              )
            }
            style={{
              ...buttonStyle("primary"),
              padding: "0.82rem 1rem",
              cursor: !sourcePlayerId || !targetPlayerId ? "not-allowed" : "pointer",
              opacity: !sourcePlayerId || !targetPlayerId ? 0.7 : 1,
            }}
          >
            {t.graph.openAnimatedRoute}
          </button>

          <button
            type="button"
            disabled={rebuilding}
            onClick={rebuildGraph}
            style={{ ...buttonStyle("secondary"), padding: "0.74rem 1rem" }}
          >
            {rebuilding ? "Rebuilding..." : "Rebuild Graph V2"}
          </button>

          {topClusters.length > 0 && (
            <div style={{ display: "grid", gap: "0.45rem" }}>
              <div style={sectionLabelStyle()}>Largest ally groups</div>
              {topClusters.map((cluster) => (
                <div
                  key={cluster.clusterId}
                  style={{
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    padding: "0.58rem 0.65rem",
                    color: "var(--text-secondary)",
                    fontSize: "0.83rem",
                  }}
                >
                  <strong style={{ color: "var(--text-primary)" }}>{cluster.memberCount}</strong> players
                  {cluster.bestOpscoreMember ? ` · best ${cluster.bestOpscoreMember.label}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GraphPage;
