import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import GraphSphereScene from "./GraphSphereScene";
import { fetchRustBirdseyeBuffers, fetchRustBirdseyeManifest, fetchRustBirdseyeNodeMeta } from "./pathfinderApi";
import type { BirdseyeBuffers, BirdseyeManifest, BirdseyeNodeMeta } from "./graphSphereTypes";
import { useI18n } from "./i18n";

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
  return {
    borderRadius: "18px",
    border: "1px solid rgba(116, 136, 158, 0.28)",
    background: "rgba(9, 13, 18, 0.82)",
    backdropFilter: "blur(20px)",
    boxShadow: "0 28px 80px rgba(0, 0, 0, 0.35)",
  } as const;
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
          height: "calc(100vh - 72px)",
          minHeight: "620px",
          background: "radial-gradient(circle at top, #16202f 0%, #05070b 62%, #020306 100%)",
          color: "#f3f4f6",
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
          height: "calc(100vh - 72px)",
          minHeight: "620px",
          background: "radial-gradient(circle at top, #16202f 0%, #05070b 62%, #020306 100%)",
          color: "#f3f4f6",
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
        height: "calc(100vh - 72px)",
        minHeight: "620px",
        background: "radial-gradient(circle at top, #16202f 0%, #05070b 62%, #020306 100%)",
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
        <div
          style={{
            ...overlayCardStyle(),
            pointerEvents: "auto",
            padding: "0.9rem 1rem",
            maxWidth: "420px",
            display: "grid",
            gap: "0.35rem",
          }}
        >
          <div style={{ color: "#7ba6d8", fontSize: "0.77rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            {t.graphSphere.pageLabel}
          </div>
          <div style={{ color: "#f5f7fb", fontSize: "1.15rem", fontWeight: 700 }}>{t.graphSphere.pageTitle}</div>
          <div style={{ color: "#94a4b8", lineHeight: 1.5, fontSize: "0.92rem" }}>{t.graphSphere.pageDescription}</div>
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
            color: "#f2f6fb",
            background: panelOpen ? "rgba(22, 29, 39, 0.88)" : "rgba(10, 14, 18, 0.82)",
            padding: "0.8rem 1rem",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          {panelOpen ? t.graphSphere.hidePanel : t.graphSphere.showPanel}
        </button>

        {panelOpen ? (
          <aside
            style={{
              ...overlayCardStyle(),
              pointerEvents: "auto",
              width: "min(360px, calc(100vw - 2rem))",
              maxHeight: "calc(100vh - 150px)",
              overflowY: "auto",
              padding: "1rem",
              display: "grid",
              gap: "0.95rem",
              color: "#e8edf6",
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
                  border: "1px solid rgba(116, 136, 158, 0.24)",
                  background: "rgba(5, 8, 12, 0.74)",
                  color: "#f3f4f6",
                  padding: "0.82rem 0.92rem",
                }}
              />
              {searchResults.length > 0 ? (
                <div
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
                        border: "1px solid rgba(116, 136, 158, 0.24)",
                        background: selectedIndex === result.index ? "rgba(50, 72, 98, 0.84)" : "rgba(12, 16, 22, 0.78)",
                        color: "#f3f4f6",
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
                      borderRadius: "12px",
                      border: "1px solid rgba(100, 132, 168, 0.42)",
                      background: "rgba(38, 53, 72, 0.82)",
                      color: "#f3f4f6",
                      padding: "0.78rem 0.86rem",
                      fontWeight: 700,
                      cursor: "pointer",
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
        ) : null}
      </div>
    </div>
  );
}
