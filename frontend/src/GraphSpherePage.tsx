import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { RiCloseLine, RiInformationLine } from "react-icons/ri";
import GraphSphereScene from "./GraphSphereScene";
import { fetchRustBirdseyeBuffers, fetchRustBirdseyeManifest, fetchRustBirdseyeNodeMeta } from "./pathfinderApi";
import type { BirdseyeBuffers, BirdseyeManifest, BirdseyeNodeMeta } from "./graphSphereTypes";
import { useI18n } from "./i18n";
import { buttonStyle, glassCardStyle, pageShellStyle, sectionLabelStyle } from "./theme";

type FocusRequest = {
  index: number;
  token: number;
};

function formatBytes(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${value} B`;
}

function parseMetric(metrics: Uint32Array, index: number, offset: number) {
  return metrics[index * 4 + offset] ?? 0;
}

function overlayCardStyle() {
  return glassCardStyle();
}

export default function GraphSpherePage() {
  const { t } = useI18n();
  const [manifest, setManifest] = useState<BirdseyeManifest | null>(null);
  const [nodeMeta, setNodeMeta] = useState<BirdseyeNodeMeta | null>(null);
  const [buffers, setBuffers] = useState<BirdseyeBuffers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [introOpen, setIntroOpen] = useState(true);
  const [showPanelScrollCue, setShowPanelScrollCue] = useState(false);
  const [panelScrollViewport, setPanelScrollViewport] = useState<HTMLDivElement | null>(null);
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  useEffect(() => {
    let cancelled = false;

    async function loadBirdseyeData() {
      setLoading(true);
      setError(null);
      try {
        const manifestResponse = await fetchRustBirdseyeManifest();
        const [nodeMetaResponse, buffersResponse] = await Promise.all([
          fetchRustBirdseyeNodeMeta(),
          fetchRustBirdseyeBuffers(),
        ]);

        if (cancelled) {
          return;
        }

        if (nodeMetaResponse.ids.length !== manifestResponse.nodeCount) {
          throw new Error("Birdseye metadata length does not match manifest node count.");
        }
        if (buffersResponse.nodePositions.length !== manifestResponse.nodeCount * 3) {
          throw new Error("Birdseye node position buffer length does not match manifest.");
        }

        setManifest(manifestResponse);
        setNodeMeta(nodeMetaResponse);
        setBuffers(buffersResponse);
      } catch (loadError) {
        if (!cancelled) {
          console.error("Failed to load birdseye graph data:", loadError);
          setError(loadError instanceof Error ? loadError.message : t.graphSphere.loadFailed);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBirdseyeData();
    return () => {
      cancelled = true;
    };
  }, [t.graphSphere.loadFailed]);

  const searchResults = useMemo(() => {
    if (!nodeMeta || deferredQuery.length < 2) {
      return [];
    }

    const results: { index: number; label: string; id: string }[] = [];
    for (let index = 0; index < nodeMeta.ids.length; index += 1) {
      const id = nodeMeta.ids[index] || "";
      const label = nodeMeta.labels[index] || "";
      if (!label.toLowerCase().includes(deferredQuery) && !id.toLowerCase().includes(deferredQuery)) {
        continue;
      }
      results.push({ index, label, id });
      if (results.length >= 18) {
        break;
      }
    }
    return results;
  }, [deferredQuery, nodeMeta]);

  const activeIndex = selectedIndex ?? hoveredIndex;
  const activeInfo = activeIndex !== null && nodeMeta && buffers
    ? {
        id: nodeMeta.ids[activeIndex] ?? "",
        label: nodeMeta.labels[activeIndex] ?? "",
        clusterId: nodeMeta.clusterIds[activeIndex] ?? "",
        totalDegree: parseMetric(buffers.nodeMetrics, activeIndex, 0),
        allyDegree: parseMetric(buffers.nodeMetrics, activeIndex, 1),
        enemyDegree: parseMetric(buffers.nodeMetrics, activeIndex, 2),
        totalSupport: parseMetric(buffers.nodeMetrics, activeIndex, 3),
      }
    : null;

  useEffect(() => {
    if (!panelScrollViewport || !panelOpen) {
      setShowPanelScrollCue(false);
      return;
    }

    const updateCue = () => {
      const remaining = panelScrollViewport.scrollHeight - panelScrollViewport.scrollTop - panelScrollViewport.clientHeight;
      setShowPanelScrollCue(remaining > 24);
    };

    updateCue();
    panelScrollViewport.addEventListener("scroll", updateCue);
    window.addEventListener("resize", updateCue);

    return () => {
      panelScrollViewport.removeEventListener("scroll", updateCue);
      window.removeEventListener("resize", updateCue);
    };
  }, [panelOpen, panelScrollViewport, searchResults.length, activeIndex, manifest]);

  const requestFocus = (index: number) => {
    startTransition(() => {
      setSelectedIndex(index);
      setFocusRequest({
        index,
        token: Date.now() + Math.random(),
      });
    });
  };

  if (loading) {
    return (
      <div
        style={{
          height: "calc(100vh - var(--nav-height))",
          minHeight: "620px",
          background: "radial-gradient(circle at top, rgba(24, 46, 72, 0.92) 0%, rgba(6, 11, 18, 0.98) 62%, rgba(2, 4, 8, 1) 100%)",
          color: "var(--text-primary)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ textAlign: "center", display: "grid", gap: "0.45rem" }}>
          <div style={{ fontSize: "1.7rem", fontWeight: 700 }}>{t.graphSphere.loading}</div>
          <div style={{ color: "#9aa6b2" }}>{t.graphSphere.loadingDetail}</div>
        </div>
      </div>
    );
  }

  if (error || !manifest || !nodeMeta || !buffers) {
    return (
      <div
        style={{
          height: "calc(100vh - var(--nav-height))",
          minHeight: "620px",
          background: "radial-gradient(circle at top, rgba(24, 46, 72, 0.92) 0%, rgba(6, 11, 18, 0.98) 62%, rgba(2, 4, 8, 1) 100%)",
          color: "var(--text-primary)",
          display: "grid",
          placeItems: "center",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "720px", textAlign: "center", display: "grid", gap: "0.45rem" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{t.graphSphere.loadFailed}</div>
          <div style={{ color: "#d59f80" }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        ...pageShellStyle(true),
        height: "calc(100vh - var(--nav-height))",
        minHeight: "620px",
        background: "radial-gradient(circle at top, rgba(24, 46, 72, 0.92) 0%, rgba(6, 11, 18, 0.98) 62%, rgba(2, 4, 8, 1) 100%)",
        overflow: "hidden",
      }}
    >
      <GraphSphereScene
        manifest={manifest}
        nodeMeta={nodeMeta}
        buffers={buffers}
        selectedIndex={selectedIndex}
        focusRequest={focusRequest}
        onHoverIndexChange={setHoveredIndex}
        onSelectedIndexChange={setSelectedIndex}
      />

      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          display: "grid",
          gap: "0.75rem",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "grid", justifyItems: "start", gap: "0.55rem" }}>
          <button
            type="button"
            onClick={() => setIntroOpen((open) => !open)}
            aria-label={introOpen ? "Hide graph sphere info" : "Show graph sphere info"}
            title={introOpen ? "Hide graph sphere info" : "Show graph sphere info"}
            style={{
              ...overlayCardStyle(),
              ...buttonStyle("ghost"),
              pointerEvents: "auto",
              width: "2.6rem",
              height: "2.6rem",
              borderRadius: "999px",
              padding: 0,
              display: "grid",
              placeItems: "center",
              color: "#dce9f8",
            }}
          >
            <RiInformationLine size={18} aria-hidden="true" />
          </button>

          {introOpen ? (
            <div
              style={{
                ...overlayCardStyle(),
                pointerEvents: "auto",
                padding: "0.9rem 1rem",
                maxWidth: "420px",
                display: "grid",
                gap: "0.45rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "0.75rem" }}>
                <div style={sectionLabelStyle()}>
                  {t.graphSphere.pageLabel}
                </div>
                <button
                  type="button"
                  onClick={() => setIntroOpen(false)}
                  aria-label="Hide graph sphere info"
                  title="Hide graph sphere info"
                  style={{
                    ...buttonStyle("ghost"),
                    borderRadius: "999px",
                    minWidth: "2rem",
                    height: "2rem",
                    padding: "0 0.6rem",
                    pointerEvents: "auto",
                    color: "#9db3ca",
                  }}
                >
                  <RiCloseLine size={16} aria-hidden="true" />
                </button>
              </div>
              <div style={{ color: "#f5f7fb", fontSize: "1.15rem", fontWeight: 700 }}>{t.graphSphere.pageTitle}</div>
              <div style={{ color: "#94a4b8", lineHeight: 1.5, fontSize: "0.92rem" }}>{t.graphSphere.pageDescription}</div>
            </div>
          ) : null}
        </div>

        {activeInfo ? (
          <div
            style={{
              ...overlayCardStyle(),
              pointerEvents: "auto",
              padding: "0.85rem 1rem",
              maxWidth: "320px",
              display: "grid",
              gap: "0.35rem",
              color: "#e7edf5",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "#8aa3c2", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {selectedIndex !== null ? t.graphSphere.inspectPinned : t.graphSphere.inspectPreview}
            </div>
            <div style={{ fontWeight: 700 }}>{activeInfo.label}</div>
            <div style={{ color: "#9cb0c7", fontSize: "0.85rem", wordBreak: "break-all" }}>{activeInfo.id}</div>
            <div>{t.graphSphere.clusterId}: {activeInfo.clusterId}</div>
            <div>{t.graphSphere.totalDegree}: {activeInfo.totalDegree.toLocaleString()}</div>
            <div>{t.graphSphere.allyDegree}: {activeInfo.allyDegree.toLocaleString()}</div>
            <div>{t.graphSphere.enemyDegree}: {activeInfo.enemyDegree.toLocaleString()}</div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          display: "grid",
          justifyItems: "end",
          gap: "0.75rem",
          pointerEvents: "none",
        }}
      >
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          style={{
            ...overlayCardStyle(),
            pointerEvents: "auto",
            borderRadius: "999px",
            ...buttonStyle(panelOpen ? "secondary" : "ghost"),
            padding: "0.8rem 1rem",
          }}
        >
          {panelOpen ? t.graphSphere.hidePanel : t.graphSphere.showPanel}
        </button>

        {panelOpen ? (
          <div
            className="graph-sphere-panel"
            style={{
              ...overlayCardStyle(),
              pointerEvents: "auto",
              width: "min(360px, calc(100vw - 2rem))",
              maxHeight: "calc(100vh - 150px)",
              color: "#e8edf6",
            }}
          >
          <aside
            ref={setPanelScrollViewport}
            className="graph-sphere-panel__scroll app-hidden-scrollbar"
            style={{
              padding: "1rem",
              display: "grid",
              gap: "0.95rem",
            }}
          >
            <section style={{ display: "grid", gap: "0.55rem" }}>
              <div style={{ fontWeight: 700 }}>{t.graphSphere.controlsTitle}</div>
              <div style={{ color: "#94a4b8", lineHeight: 1.45 }}>{t.graphSphere.zoomHint}</div>
              <div style={{ color: "#94a4b8", lineHeight: 1.45 }}>{t.graphSphere.edgeMode}</div>
            </section>

            <section style={{ display: "grid", gap: "0.6rem" }}>
              <div style={{ fontWeight: 700 }}>{t.graphSphere.searchLabel}</div>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t.graphSphere.searchPlaceholder}
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--border-subtle)",
                  background: "rgba(5, 8, 12, 0.74)",
                  color: "var(--text-primary)",
                  padding: "0.82rem 0.92rem",
                }}
              />
              {searchResults.length > 0 ? (
                <div
                  className="app-hidden-scrollbar"
                  style={{
                    display: "grid",
                    gap: "0.45rem",
                    maxHeight: "220px",
                    overflowY: "auto",
                  }}
                >
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => requestFocus(result.index)}
                      style={{
                        borderRadius: "12px",
                        border: "1px solid var(--border-subtle)",
                        background: selectedIndex === result.index ? "rgba(102, 184, 255, 0.16)" : "rgba(12, 16, 22, 0.78)",
                        color: "var(--text-primary)",
                        textAlign: "left",
                        padding: "0.72rem 0.78rem",
                        display: "grid",
                        gap: "0.15rem",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{result.label}</span>
                      <span style={{ color: "#91a5ba", fontSize: "0.82rem", wordBreak: "break-all" }}>{result.id}</span>
                    </button>
                  ))}
                </div>
              ) : deferredQuery.length >= 2 ? (
                <div style={{ color: "#8f9ba7" }}>{t.common.na}</div>
              ) : null}
            </section>

            <section style={{ display: "grid", gap: "0.55rem" }}>
              <div style={{ fontWeight: 700 }}>{t.graphSphere.inspectTitle}</div>
              <div style={{ color: "#96a2ad" }}>{t.graphSphere.hoverHint}</div>
              {activeInfo ? (
                <>
                  <button
                    type="button"
                    onClick={() => requestFocus(activeIndex)}
                    style={{
                      ...buttonStyle("secondary"),
                      padding: "0.78rem 0.86rem",
                    }}
                  >
                    {t.graphSphere.focusNode}
                  </button>
                  <div><strong>{t.graphSphere.playerName}:</strong> {activeInfo.label}</div>
                  <div style={{ wordBreak: "break-all" }}><strong>{t.graphSphere.playerId}:</strong> {activeInfo.id}</div>
                  <div><strong>{t.graphSphere.clusterId}:</strong> {activeInfo.clusterId}</div>
                  <div><strong>{t.graphSphere.totalDegree}:</strong> {activeInfo.totalDegree.toLocaleString()}</div>
                  <div><strong>{t.graphSphere.allyDegree}:</strong> {activeInfo.allyDegree.toLocaleString()}</div>
                  <div><strong>{t.graphSphere.enemyDegree}:</strong> {activeInfo.enemyDegree.toLocaleString()}</div>
                  <div><strong>{t.graphSphere.totalSupport}:</strong> {activeInfo.totalSupport.toLocaleString()}</div>
                  {selectedIndex !== null ? (
                    <div style={{ color: "#7da0c6" }}>
                      {t.graphSphere.selectedNeighborhood}: {activeInfo.totalDegree.toLocaleString()}
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={{ color: "#96a2ad" }}>{t.graphSphere.noSelection}</div>
              )}
            </section>

            <section style={{ display: "grid", gap: "0.45rem" }}>
              <div style={{ fontWeight: 700 }}>{t.graphSphere.summary}</div>
              <div>{manifest.nodeCount.toLocaleString()} {t.graphSphere.nodes}</div>
              <div>{manifest.edgeCount.toLocaleString()} {t.graphSphere.edges}</div>
              <div>{manifest.clusterCount.toLocaleString()} {t.graphSphere.clusters}</div>
              <div>{manifest.allyEdgeCount.toLocaleString()} {t.graphSphere.allyEdges}</div>
              <div>{manifest.enemyEdgeCount.toLocaleString()} {t.graphSphere.enemyEdges}</div>
              <div>{t.graphSphere.generationTime}: {manifest.generationMs.toFixed(1)} ms</div>
              <div>{t.graphSphere.renderer}</div>
              <div style={{ color: "#8ea0b3", fontSize: "0.88rem" }}>
                `node_positions.f32`: {formatBytes(manifest.fileSizes.nodePositionsF32)}
              </div>
              <div style={{ color: "#8ea0b3", fontSize: "0.88rem" }}>
                `edge_pairs.u32`: {formatBytes(manifest.fileSizes.edgePairsU32)}
              </div>
              <div style={{ color: "#8ea0b3", fontSize: "0.88rem" }}>
                `edge_props.u32`: {formatBytes(manifest.fileSizes.edgePropsU32)}
              </div>
            </section>
          </aside>
          {showPanelScrollCue ? (
            <div className="app-scroll-cue graph-sphere-panel__scroll-cue" aria-hidden="true">
              <div className="app-scroll-fade" />
              <div className="app-scroll-arrow">↓</div>
            </div>
          ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
