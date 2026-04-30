import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import GraphSphereScene from "./GraphSphereScene";
import { buildMockBirdseyeData } from "./graphBirdseyeMock";
import { fetchRustBirdseyeBuffers, fetchRustBirdseyeManifest, fetchRustBirdseyeNodeMeta, runRustAssortativity } from "./pathfinderApi";
import { useI18n } from "./i18n";
import { runAssortativityMock } from "./assortativityMock";
import type { AssortativityMetricResult, AssortativityRequest, AssortativityResponse, AssortativitySample } from "./assortativityTypes";
import type { BirdseyeBuffers, BirdseyeManifest, BirdseyeNodeMeta } from "./graphSphereTypes";
import { CoefficientBadge, EdgeCategoryLegend, InterpretationBanner, MethodologyCard, ParameterGuide } from "./analyticsComponents";
import { explainAssortativityFinding, persistAssortativityRun } from "./analyticsState";
import { buttonStyle, glassCardStyle, inputStyle, pageShellStyle, sectionLabelStyle } from "./theme";

const DEFAULT_REQUEST: AssortativityRequest = {
  minEdgeSupport: 1,
  minPlayerMatchCount: 1,
  strongTieThreshold: 3,
  includeClusterBreakdown: true,
};

const COLORS = {
  ink: "#f7f8f8",
  muted: "#8a8f98",
  accent: "#f0bb74",
  accentSoft: "#f7d5a9",
  mint: "#7fd2c3",
  mintSoft: "#d7fbf5",
  coral: "#ef9b7d",
  line: "rgba(255, 255, 255, 0.07)",
};

type FocusRequest = { index: number; token: number } | null;
type ActiveGraphInfo = {
  id: string;
  label: string;
  clusterId: string;
  totalDegree: number;
  allyDegree: number;
  enemyDegree: number;
  totalSupport: number;
};

function shellStyle(): React.CSSProperties {
  return { ...pageShellStyle(), color: COLORS.ink };
}

function panelStyle(): React.CSSProperties {
  return {
    borderRadius: "12px",
    border: `1px solid ${COLORS.line}`,
    background: "#0d1117",
    boxShadow: "0 4px 16px rgba(0,0,0,0.32)",
  };
}

function softCardStyle(): React.CSSProperties {
  return {
    borderRadius: "8px",
    border: `1px solid ${COLORS.line}`,
    background: "rgba(255,255,255,0.02)",
  };
}

function infoLabelStyle(): React.CSSProperties {
  return { ...sectionLabelStyle(), color: COLORS.muted };
}

function formatCoefficient(value: number | null, language: "en" | "hu", fallback: string) {
  if (value === null || Number.isNaN(value)) return fallback;
  return value.toLocaleString(language === "hu" ? "hu-HU" : "en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function metricTone(value: number | null) {
  if (value === null || Number.isNaN(value)) return "#8a8f98";
  if (value > 0.1) return COLORS.mint;
  if (value < -0.1) return COLORS.coral;
  return COLORS.accent;
}

function parseMetric(metrics: Uint32Array, index: number, offset: number) {
  return metrics[index * 4 + offset] ?? 0;
}

function graphModeLabel(graphMode: AssortativityMetricResult["graphMode"], isHu: boolean) {
  return graphMode === "social-path" ? "Social path" : isHu ? "Battle path" : "Battle path";
}

function metricLabel(metric: AssortativityMetricResult["metric"]) {
  return metric === "opscore" ? "Opscore" : "Feedscore";
}

function coefficientLabel(value: number | null, isHu: boolean) {
  if (value === null || Number.isNaN(value)) return isHu ? "nem definialt" : "undefined";
  if (value > 0.1) return isHu ? "pozitiv asszortativitas" : "positive assortativity";
  if (value < -0.1) return isHu ? "negativ asszortativitas" : "negative assortativity";
  return isHu ? "kozel semleges asszortativitas" : "near-neutral assortativity";
}

function DivergingBar({ value, color }: { value: number | null; color: string }) {
  const width = value === null ? 0 : Math.min(50, Math.abs(value) * 50);
  const left = value !== null && value < 0 ? 50 - width : 50;
  return (
    <div style={{ position: "relative", height: "12px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: "0 auto 0 50%", width: "1px", background: "rgba(255,255,255,0.24)", transform: "translateX(-0.5px)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${left}%`, width: `${width}%`, borderRadius: "999px", background: color }} />
    </div>
  );
}

function StoryCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ ...softCardStyle(), padding: "1rem", display: "grid", gap: "0.4rem" }}>
      <div style={{ fontWeight: 800, fontSize: "1.02rem" }}>{title}</div>
      <div style={{ color: COLORS.muted, lineHeight: 1.65 }}>{text}</div>
    </div>
  );
}

function SampleChip({ label, sample, language, isHu }: { label: string; sample: AssortativitySample; language: "en" | "hu"; isHu: boolean }) {
  const tone = metricTone(sample.coefficient);
  const width = sample.coefficient === null ? 0 : Math.min(100, Math.abs(sample.coefficient) * 100);
  return (
    <div style={{ ...softCardStyle(), padding: "0.85rem", display: "grid", gap: "0.45rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
        <strong>{label}</strong>
        <span style={{ color: COLORS.muted, fontSize: "0.82rem" }}>
          {isHu ? "Mintameret" : "Sample size"}: {sample.sampleSize.toLocaleString(language === "hu" ? "hu-HU" : "en-US")}
        </span>
      </div>
      <div style={{ fontSize: "1.2rem", fontWeight: 800, color: tone }}>{formatCoefficient(sample.coefficient, language, isHu ? "nem definialt" : "undefined")}</div>
      <div style={{ color: COLORS.muted, fontSize: "0.82rem" }}>{coefficientLabel(sample.coefficient, isHu)}</div>
      <div style={{ height: "10px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", borderRadius: "999px", background: `linear-gradient(90deg, ${tone} 0%, rgba(255,255,255,0.92) 100%)` }} />
      </div>
    </div>
  );
}

function CoefficientChart({ results, language, isHu }: { results: AssortativityMetricResult[]; language: "en" | "hu"; isHu: boolean }) {
  const opscore = results.find((item) => item.metric === "opscore") ?? null;
  const feedscore = results.find((item) => item.metric === "feedscore") ?? null;
  const rows = [
    { key: "global", label: isHu ? "Globalis" : "Global" },
    { key: "withinCluster", label: isHu ? "Klaszteren belul" : "Within cluster" },
    { key: "crossCluster", label: isHu ? "Klaszterek kozott" : "Cross cluster" },
    { key: "strongTies", label: isHu ? "Eros kapcsolatok" : "Strong ties" },
    { key: "weakTies", label: isHu ? "Gyenge kapcsolatok" : "Weak ties" },
  ] as const;

  return (
    <section style={{ ...panelStyle(), padding: "1.05rem", display: "grid", gap: "0.85rem" }}>
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <div style={infoLabelStyle()}>{isHu ? "Egyutthato osszevetes" : "Coefficient comparison"}</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.55 }}>
          {isHu
            ? "Gyors valosagellenorzes: mennyire marad hasonlo a ket metrika a graf kulonbozo szeleteiben."
            : "Quick reality check: how strongly the two metrics stay similar across different slices of the graph."}
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.55rem" }}>
        {rows.map((row) => {
          const ops = opscore ? opscore[row.key] : null;
          const feed = feedscore ? feedscore[row.key] : null;
          return (
            <div key={row.key} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 180px) minmax(260px, 1fr)", gap: "0.8rem", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>{row.label}</div>
              <div style={{ display: "grid", gap: "0.35rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem", alignItems: "center" }}>
                  <DivergingBar value={ops?.coefficient ?? null} color="linear-gradient(90deg, rgba(68, 186, 171, 0.9) 0%, rgba(111, 214, 196, 1) 100%)" />
                  <span style={{ color: COLORS.mintSoft, fontSize: "0.82rem", minWidth: "3.2rem", textAlign: "right" }}>
                    {formatCoefficient(ops?.coefficient ?? null, language, isHu ? "nem definialt" : "undefined")}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem", alignItems: "center" }}>
                  <DivergingBar value={feed?.coefficient ?? null} color="linear-gradient(90deg, rgba(220, 151, 83, 0.88) 0%, rgba(244, 181, 109, 1) 100%)" />
                  <span style={{ color: COLORS.accentSoft, fontSize: "0.82rem", minWidth: "3.2rem", textAlign: "right" }}>
                    {formatCoefficient(feed?.coefficient ?? null, language, isHu ? "nem definialt" : "undefined")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ResultCard({ result, language, isHu }: { result: AssortativityMetricResult; language: "en" | "hu"; isHu: boolean }) {
  const labels = {
    eligibleNodes: isHu ? "Ervenyes csomopontok" : "Eligible nodes",
    candidateEdges: isHu ? "Jelolt elek" : "Candidate edges",
    analyzedEdges: isHu ? "Elemzett elek" : "Analyzed edges",
    skippedLowSupport: isHu ? "Gyenge tamogatas miatt kihagyva" : "Skipped for low support",
    skippedMissingMetric: isHu ? "Hianyzo metrika miatt kihagyva" : "Skipped for missing metric",
    skippedLowMatchCount: isHu ? "Keves meccs miatt kihagyva" : "Skipped for low match count",
  };
  const interpretation = explainAssortativityFinding(result.global.coefficient);
  return (
    <section style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.95rem" }}>
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <div style={infoLabelStyle()}>{graphModeLabel(result.graphMode, isHu)}</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: "1.35rem" }}>{metricLabel(result.metric)}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", color: metricTone(result.global.coefficient), fontWeight: 700 }}>
            <span>{isHu ? "Egyutthato" : "Coefficient"}:</span>
            <CoefficientBadge value={result.global.coefficient} metric="assortativity" />
          </div>
        </div>
        <div style={{ color: metricTone(result.global.coefficient), lineHeight: 1.55, fontWeight: 700 }}>{interpretation}</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.55 }}>
          {isHu
            ? "A globalis egyutthato a teljes ervenyes elhalmaz atlagos iranyat mutatja, a reszbontasok pedig azt, hol erosodik vagy gyengul az effektus."
            : "The global coefficient shows the overall direction across eligible edges, while the breakdowns show where the effect strengthens or weakens."}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
        {[
          [labels.eligibleNodes, result.eligibleNodes],
          [labels.candidateEdges, result.candidateEdges],
          [labels.analyzedEdges, result.analyzedEdges],
          [labels.skippedLowSupport, result.skippedLowEdgeSupportEdges],
          [labels.skippedMissingMetric, result.skippedMissingMetricEdges],
          [labels.skippedLowMatchCount, result.skippedLowMatchCountEdges],
        ].map(([label, value]) => (
          <div key={label} style={{ ...softCardStyle(), padding: "0.8rem", display: "grid", gap: "0.25rem" }}>
            <div style={infoLabelStyle()}>{label}</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{Number(value).toLocaleString(language === "hu" ? "hu-HU" : "en-US")}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.75rem" }}>
        <SampleChip label={isHu ? "Globalis" : "Global"} sample={result.global} language={language} isHu={isHu} />
        <SampleChip label={isHu ? "Klaszteren belul" : "Within cluster"} sample={result.withinCluster} language={language} isHu={isHu} />
        <SampleChip label={isHu ? "Klaszterek kozott" : "Cross cluster"} sample={result.crossCluster} language={language} isHu={isHu} />
        <SampleChip label={isHu ? "Eros kapcsolatok" : "Strong ties"} sample={result.strongTies} language={language} isHu={isHu} />
        <SampleChip label={isHu ? "Gyenge kapcsolatok" : "Weak ties"} sample={result.weakTies} language={language} isHu={isHu} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.7rem" }}>
        {[
          {
            label: isHu ? "Klaszteren belul" : "Within cluster",
            text: isHu ? "Azonos kozossegben levo jatekosok kozotti hasonlosag." : "Similarity among players who sit inside the same detected community.",
            sample: result.withinCluster,
          },
          {
            label: isHu ? "Klaszterek kozott" : "Cross cluster",
            text: isHu ? "Atmeno kapcsolatok a kozossegi hatarokon." : "Boundary-crossing ties that connect different communities.",
            sample: result.crossCluster,
          },
          {
            label: isHu ? "Eros kapcsolatok" : "Strong ties",
            text: isHu ? "Gyakran megismetlodo kapcsolatok." : "Repeated ties with enough support to count as strong relationships.",
            sample: result.strongTies,
          },
          {
            label: isHu ? "Gyenge kapcsolatok" : "Weak ties",
            text: isHu ? "A minimumot elero, de nem dominant kapcsolatok." : "Edges that pass the minimum filter but do not reach the strong-tie threshold.",
            sample: result.weakTies,
          },
        ].map((item) => (
          <div key={item.label} style={{ ...softCardStyle(), padding: "0.85rem", display: "grid", gap: "0.25rem" }}>
            <div style={{ fontWeight: 800 }}>{item.label}</div>
            <div style={{ color: COLORS.muted, lineHeight: 1.55 }}>{item.text}</div>
            <div style={{ color: metricTone(item.sample.coefficient), fontWeight: 700 }}>
              {item.sample.sampleSize.toLocaleString(language === "hu" ? "hu-HU" : "en-US")} edges, {formatCoefficient(item.sample.coefficient, language, isHu ? "nem definialt" : "undefined")}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EvidenceGraph({
  datasetMode,
  setDatasetMode,
  language,
  isHu,
}: {
  datasetMode: "full" | "mock";
  setDatasetMode: React.Dispatch<React.SetStateAction<"full" | "mock">>;
  language: "en" | "hu";
  isHu: boolean;
}) {
  const [manifest, setManifest] = useState<BirdseyeManifest | null>(null);
  const [nodeMeta, setNodeMeta] = useState<BirdseyeNodeMeta | null>(null);
  const [buffers, setBuffers] = useState<BirdseyeBuffers | null>(null);
  const [renderMode, setRenderMode] = useState<"full" | "mock">("mock");
  const [loading, setLoading] = useState(true);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest>(null);
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const mockBirdseyeData = useMemo(() => buildMockBirdseyeData(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadBirdseyeData() {
      setLoading(true);
      setFallbackMessage(null);
      setSelectedIndex(null);
      setHoveredIndex(null);
      setFocusRequest(null);

      if (datasetMode === "mock") {
        if (!cancelled) {
          setManifest(mockBirdseyeData.manifest);
          setNodeMeta(mockBirdseyeData.nodeMeta);
          setBuffers(mockBirdseyeData.buffers);
          setRenderMode("mock");
          setLoading(false);
        }
        return;
      }

      try {
        const manifestResponse = await fetchRustBirdseyeManifest();
        const [nodeMetaResponse, buffersResponse] = await Promise.all([
          fetchRustBirdseyeNodeMeta(),
          fetchRustBirdseyeBuffers(),
        ]);
        if (cancelled) return;
        if (nodeMetaResponse.ids.length !== manifestResponse.nodeCount) throw new Error("Birdseye metadata length does not match manifest node count.");
        if (buffersResponse.nodePositions.length !== manifestResponse.nodeCount * 3) throw new Error("Birdseye node position buffer length does not match manifest.");
        setManifest(manifestResponse);
        setNodeMeta(nodeMetaResponse);
        setBuffers(buffersResponse);
        setRenderMode("full");
      } catch (loadError) {
        if (cancelled) return;
        console.error("Failed to load birdseye graph data:", loadError);
        setManifest(mockBirdseyeData.manifest);
        setNodeMeta(mockBirdseyeData.nodeMeta);
        setBuffers(mockBirdseyeData.buffers);
        setRenderMode("mock");
        setFallbackMessage(
          isHu
            ? "A teljes gráf itt nem érhető el, ezért ez a panel a minta gráfot mutatja."
            : "The full graph is not available here, so this panel is showing the sample graph instead.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBirdseyeData();
    return () => {
      cancelled = true;
    };
  }, [datasetMode, isHu, mockBirdseyeData]);

  const searchResults = useMemo(() => {
    if (!nodeMeta || deferredQuery.length < 2) return [];
    const results: { index: number; label: string; id: string }[] = [];
    for (let index = 0; index < nodeMeta.ids.length; index += 1) {
      const id = nodeMeta.ids[index] || "";
      const label = nodeMeta.labels[index] || "";
      if (!label.toLowerCase().includes(deferredQuery) && !id.toLowerCase().includes(deferredQuery)) continue;
      results.push({ index, label, id });
      if (results.length >= 12) break;
    }
    return results;
  }, [deferredQuery, nodeMeta]);

  const activeIndex = selectedIndex ?? hoveredIndex;
  const activeInfo: ActiveGraphInfo | null = activeIndex !== null && nodeMeta && buffers
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
      setFocusRequest({ index, token: Date.now() + Math.random() });
    });
  };

  return (
    <section style={{ ...panelStyle(), padding: "1.2rem", display: "grid", gap: "1rem" }}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <div style={infoLabelStyle()}>{isHu ? "Bizonyitek graf" : "Evidence graph"}</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ display: "grid", gap: "0.35rem", maxWidth: "58rem" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(1.5rem, 2.4vw, 2.2rem)" }}>
              {isHu ? "A hálózat, amelyre az eredmény épül" : "The network behind the result"}
            </h2>
            <div style={{ color: COLORS.muted, lineHeight: 1.65 }}>
              {isHu
                ? "Válts a demo és a teljes gráf között, majd futtasd ugyanabban a módban az elemzést."
                : "Switch between the sample and full graph, then run the analysis in the same mode."}
            </div>
          </div>
          <div style={{ borderRadius: "999px", padding: "0.32rem 0.78rem", background: renderMode === "mock" ? "rgba(120, 198, 183, 0.16)" : "rgba(240, 187, 116, 0.14)", color: renderMode === "mock" ? COLORS.mintSoft : COLORS.accentSoft, fontWeight: 700, fontSize: "0.82rem" }}>
            {renderMode === "mock"
              ? (isHu ? "Demo graf aktiv" : "Demo graph active")
              : (isHu ? "Teljes graf aktiv" : "Full graph active")}
          </div>
        </div>
      </div>

      <div style={{ display: "inline-flex", gap: "0.55rem", flexWrap: "wrap" }}>
        <button type="button" onClick={() => setDatasetMode("mock")} style={{ ...buttonStyle(datasetMode === "mock" ? "primary" : "secondary"), minWidth: "168px" }}>
          {isHu ? "Demo graf" : "Demo graph"}
        </button>
        <button type="button" onClick={() => setDatasetMode("full")} style={{ ...buttonStyle(datasetMode === "full" ? "primary" : "secondary"), minWidth: "168px" }}>
          {isHu ? "Teljes kiserleti graf" : "Full experimental graph"}
        </button>
      </div>

      {fallbackMessage ? <div style={{ ...softCardStyle(), padding: "0.95rem", color: COLORS.accentSoft, lineHeight: 1.6 }}>{fallbackMessage}</div> : null}

      <div style={{ ...softCardStyle(), padding: "0.35rem", overflow: "hidden" }}>
        <div style={{ position: "relative", minHeight: "560px", background: "radial-gradient(circle at top, rgba(24,46,72,0.92) 0%, rgba(6,11,18,0.98) 62%, rgba(2,4,8,1) 100%)", borderRadius: "12px" }}>
          {loading || !manifest || !nodeMeta || !buffers ? (
            <div style={{ minHeight: "560px", display: "grid", placeItems: "center", color: "#d8e7f9", textAlign: "center", padding: "1.5rem" }}>
              <div style={{ display: "grid", gap: "0.35rem" }}>
                <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>{isHu ? "Graf toltese..." : "Loading graph..."}</div>
                <div style={{ color: "#9db2ca" }}>{isHu ? "A bizonyitek panel elo halozati nezetet keszit." : "The evidence panel is preparing the live network view."}</div>
              </div>
            </div>
          ) : (
            <>
              <GraphSphereScene
                manifest={manifest}
                nodeMeta={nodeMeta}
                buffers={buffers}
                selectedIndex={selectedIndex}
                focusRequest={focusRequest}
                onHoverIndexChange={setHoveredIndex}
                onSelectedIndexChange={setSelectedIndex}
              />
              <div style={{ position: "absolute", left: "1rem", right: "1rem", bottom: "1rem", display: "flex", justifyContent: "space-between", gap: "0.9rem", alignItems: "end", flexWrap: "wrap", pointerEvents: "none" }}>
                <div style={{ ...glassCardStyle(), maxWidth: "540px", padding: "0.9rem 1rem", pointerEvents: "auto" }}>
                  <div style={infoLabelStyle()}>{isHu ? "Hogyan olvasd" : "How to read it"}</div>
                  <div style={{ color: "#eff5fd", lineHeight: 1.55, marginTop: "0.25rem" }}>
                    {isHu
                      ? "A pontok jatekosok, a vonalak ismetelt kozos jatekkapcsolatok, a klaszterburkok pedig azokat a szomszedsagokat mutatjak, amelyek ujra es ujra egyutt jelennek meg."
                      : "Nodes are players, lines are repeated co-play relationships, and the cluster hulls show neighborhoods that keep surfacing together."}
                  </div>
                </div>
                {activeInfo ? (
                  <div style={{ ...glassCardStyle(), minWidth: "260px", padding: "0.9rem 1rem", display: "grid", gap: "0.22rem", pointerEvents: "auto" }}>
                    <div style={{ color: "#94abc3", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {selectedIndex !== null ? (isHu ? "Rogzitett" : "Pinned") : (isHu ? "Elonezet" : "Preview")}
                    </div>
                    <div style={{ fontWeight: 700 }}>{activeInfo.label}</div>
                    <div style={{ color: "#aebfd2", fontSize: "0.82rem", wordBreak: "break-all" }}>{activeInfo.id}</div>
                    <div>{isHu ? "Klaszter" : "Cluster"}: {activeInfo.clusterId}</div>
                    <div>{isHu ? "Teljes fokszam" : "Total degree"}: {activeInfo.totalDegree.toLocaleString(language === "hu" ? "hu-HU" : "en-US")}</div>
                    <div>{isHu ? "Ally fokszam" : "Ally degree"}: {activeInfo.allyDegree.toLocaleString(language === "hu" ? "hu-HU" : "en-US")}</div>
                    <div>{isHu ? "Enemy fokszam" : "Enemy degree"}: {activeInfo.enemyDegree.toLocaleString(language === "hu" ? "hu-HU" : "en-US")}</div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {manifest ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.85rem" }}>
          <div style={{ ...softCardStyle(), padding: "1rem", display: "grid", gap: "0.55rem" }}>
            <div style={{ fontWeight: 800 }}>{isHu ? "Graf osszegzes" : "Graph summary"}</div>
            <div>{manifest.nodeCount.toLocaleString(language === "hu" ? "hu-HU" : "en-US")} {isHu ? "csomopont" : "nodes"}</div>
            <div>{manifest.edgeCount.toLocaleString(language === "hu" ? "hu-HU" : "en-US")} {isHu ? "el" : "edges"}</div>
            <div>{manifest.clusterCount.toLocaleString(language === "hu" ? "hu-HU" : "en-US")} {isHu ? "klaszter" : "clusters"}</div>
            <div>{manifest.allyEdgeCount.toLocaleString(language === "hu" ? "hu-HU" : "en-US")} ally {isHu ? "el" : "edges"}</div>
            <div>{manifest.enemyEdgeCount.toLocaleString(language === "hu" ? "hu-HU" : "en-US")} enemy {isHu ? "el" : "edges"}</div>
          </div>

          <div style={{ ...softCardStyle(), padding: "1rem", display: "grid", gap: "0.6rem" }}>
            <div style={{ fontWeight: 800 }}>{isHu ? "Keress ra egy jatekosra a grafban" : "Find a player in the graph"}</div>
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={isHu ? "Kereses cimke vagy player id alapjan" : "Search by label or player id"} style={inputStyle()} />
            {searchResults.length > 0 ? (
              <div className="app-hidden-scrollbar" style={{ display: "grid", gap: "0.45rem", maxHeight: "220px", overflowY: "auto" }}>
                {searchResults.map((result) => (
                  <button key={result.id} type="button" onClick={() => requestFocus(result.index)} style={{ ...buttonStyle(selectedIndex === result.index ? "secondary" : "ghost"), minHeight: "unset", padding: "0.72rem 0.78rem", textAlign: "left", display: "grid", gap: "0.15rem" }}>
                    <span style={{ fontWeight: 700 }}>{result.label}</span>
                    <span style={{ color: COLORS.muted, fontSize: "0.82rem", wordBreak: "break-all" }}>{result.id}</span>
                  </button>
                ))}
              </div>
            ) : deferredQuery.length >= 2 ? (
              <div style={{ color: COLORS.muted }}>{isHu ? "Ebben a grafnezetben nincs talalat." : "No matching player in this graph view yet."}</div>
            ) : null}
          </div>

          <div style={{ ...softCardStyle(), padding: "1rem", display: "grid", gap: "0.5rem" }}>
            <div style={{ fontWeight: 800 }}>{isHu ? "Aktualis csomopont vizsgalata" : "Inspect the current node"}</div>
            <div style={{ color: COLORS.muted, lineHeight: 1.55 }}>{isHu ? "Lebegj egy csomopont felett az elonezethez, majd kattints egy talalatra a fokuszhoz." : "Hover a node to preview it, then click a result to pin and focus it."}</div>
            {activeInfo ? (
              <>
                <button type="button" onClick={() => requestFocus(activeIndex ?? 0)} style={buttonStyle("secondary")}>{isHu ? "Fokusz a csomopontra" : "Focus node"}</button>
                <div><strong>{activeInfo.label}</strong></div>
                <div style={{ wordBreak: "break-all" }}><strong>{isHu ? "Player id" : "Player id"}:</strong> {activeInfo.id}</div>
                <div><strong>{isHu ? "Klaszter" : "Cluster"}:</strong> {activeInfo.clusterId}</div>
                <div><strong>{isHu ? "Teljes fokszam" : "Total degree"}:</strong> {activeInfo.totalDegree.toLocaleString(language === "hu" ? "hu-HU" : "en-US")}</div>
                <div><strong>{isHu ? "Ally fokszam" : "Ally degree"}:</strong> {activeInfo.allyDegree.toLocaleString(language === "hu" ? "hu-HU" : "en-US")}</div>
                <div><strong>{isHu ? "Enemy fokszam" : "Enemy degree"}:</strong> {activeInfo.enemyDegree.toLocaleString(language === "hu" ? "hu-HU" : "en-US")}</div>
                <div><strong>{isHu ? "Teljes tamogatas" : "Total support"}:</strong> {activeInfo.totalSupport.toLocaleString(language === "hu" ? "hu-HU" : "en-US")}</div>
              </>
            ) : (
              <div style={{ color: COLORS.muted }}>{isHu ? "Meg nincs kijelolt csomopont." : "No node selected yet."}</div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function buildSummaryBullets(result: AssortativityResponse, language: "en" | "hu", isHu: boolean) {
  const findMetric = (graphMode: AssortativityMetricResult["graphMode"], metric: AssortativityMetricResult["metric"]) =>
    result.results.find((item) => item.graphMode === graphMode && item.metric === metric) ?? null;
  const socialOps = findMetric("social-path", "opscore");
  const battleOps = findMetric("battle-path", "opscore");
  const socialFeed = findMetric("social-path", "feedscore");
  const battleFeed = findMetric("battle-path", "feedscore");
  const fallback = isHu ? "nem definialt" : "undefined";
  const bullets: string[] = [];
  if (
    socialOps &&
    battleOps &&
    socialOps.global.coefficient !== null &&
    battleOps.global.coefficient !== null
  ) {
    bullets.push(
      isHu
        ? `Az opscore mindket graf modban erdemben hasonlo marad a kapcsolt jatekosok kozott (${formatCoefficient(socialOps.global.coefficient, language, fallback)} / ${formatCoefficient(battleOps.global.coefficient, language, fallback)}).`
        : `Connected players stay meaningfully similar on opscore in both graph modes (${formatCoefficient(socialOps.global.coefficient, language, fallback)} / ${formatCoefficient(battleOps.global.coefficient, language, fallback)}).`,
    );
  }
  if (
    socialFeed &&
    battleFeed &&
    socialFeed.global.coefficient !== null &&
    battleFeed.global.coefficient !== null
  ) {
    bullets.push(
      isHu
        ? `A feedscore sokkal erosebben valtozik a graf modok kozott (${formatCoefficient(socialFeed.global.coefficient, language, fallback)} vs ${formatCoefficient(battleFeed.global.coefficient, language, fallback)}), vagyis a graf definicioja is szamit.`
        : `Feedscore changes much more across graph modes (${formatCoefficient(socialFeed.global.coefficient, language, fallback)} vs ${formatCoefficient(battleFeed.global.coefficient, language, fallback)}), which means the graph definition matters.`,
    );
  }
  bullets.push(
    isHu
      ? "A nagyobb tanulsag nem csak a szam, hanem az, hogy az ally-only es a battle-path graf masfajta hasonlosagot oriz meg."
      : "The bigger lesson is not just the number, but that ally-only and battle-path graphs preserve different kinds of sameness.",
  );
  bullets.push(
    isHu
      ? "Ez leiro grafszerkezet, nem bizonyitek arra, hogy a jatekosok egymast okozzak hasonlo viselkedesre."
      : "This is descriptive graph structure, not proof that players cause each other to behave similarly.",
  );
  return bullets;
}

export default function AssortativityPage() {
  const { language } = useI18n();
  const isHu = language === "hu";
  const [datasetMode, setDatasetMode] = useState<"full" | "mock">("mock");
  const [request, setRequest] = useState<AssortativityRequest>(DEFAULT_REQUEST);
  const [result, setResult] = useState<AssortativityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const groupedResults = useMemo(() => {
    const groups = new Map<AssortativityMetricResult["graphMode"], AssortativityMetricResult[]>();
    for (const item of result?.results ?? []) {
      const current = groups.get(item.graphMode) ?? [];
      current.push(item);
      groups.set(item.graphMode, current);
    }
    return groups;
  }, [result?.results]);
  const summaryBullets = useMemo(() => (result ? buildSummaryBullets(result, language, isHu) : []), [isHu, language, result]);
  const parameterGuideItems = useMemo(
    () => [
      {
        key: "minEdgeSupport",
        label: isHu ? "Minimum eltamogatas" : "Minimum edge support",
        explanation: isHu ? "Csak a megfeleloen alatamasztott kapcsolatok maradnak bent." : "Only sufficiently supported relationships stay in the graph before correlation is measured.",
        impact: isHu ? "Magasabb kuszob: konzervativabb, kisebb minta. Alacsonyabb kuszob: tobb, de zajosabb kapcsolat." : "Higher thresholds make the run more conservative; lower thresholds keep more but noisier edges.",
      },
      {
        key: "minPlayerMatchCount",
        label: isHu ? "Minimum jatekos meccsszam" : "Minimum player match count",
        explanation: isHu ? "A jatekosnak eleg meccse kell legyen a metrika hasznalatahoz." : "Players need enough history before their metrics count as reliable endpoints.",
        impact: isHu ? "Ez ved a kis mintas szelsosegek ellen." : "This protects the analysis from very small-sample extremes.",
      },
      {
        key: "strongTieThreshold",
        label: isHu ? "Eros kapcsolat kuszob" : "Strong-tie threshold",
        explanation: isHu ? "Ez valasztja szet az ismetlodo es az alkalmi kapcsolatokat." : "This separates repeated partnerships from lighter connections.",
        impact: isHu ? "A strong/weak bontas mutatja meg, hogy az effektus a kapcsolat erossegevel valtozik-e." : "The strong-versus-weak split shows whether the effect changes with tie strength.",
      },
    ],
    [isHu],
  );
  const featuredResult = useMemo(() => {
    const preferred = result?.results.find((item) => item.graphMode === "social-path" && item.metric === "opscore" && item.global.coefficient !== null);
    return preferred ?? result?.results.find((item) => item.global.coefficient !== null) ?? result?.results[0] ?? null;
  }, [result?.results]);
  const featuredLegend = useMemo(() => {
    if (!featuredResult) {
      return [];
    }
    return [
      { name: "Within cluster", count: featuredResult.withinCluster.sampleSize, sampleSize: featuredResult.withinCluster.sampleSize, coefficient: featuredResult.withinCluster.coefficient },
      { name: "Cross cluster", count: featuredResult.crossCluster.sampleSize, sampleSize: featuredResult.crossCluster.sampleSize, coefficient: featuredResult.crossCluster.coefficient },
      { name: "Strong ties", count: featuredResult.strongTies.sampleSize, sampleSize: featuredResult.strongTies.sampleSize, coefficient: featuredResult.strongTies.coefficient },
      { name: "Weak ties", count: featuredResult.weakTies.sampleSize, sampleSize: featuredResult.weakTies.sampleSize, coefficient: featuredResult.weakTies.coefficient },
    ];
  }, [featuredResult]);

  const runAnalysis = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setHasRun(true);
    try {
      const response = datasetMode === "mock" ? await runAssortativityMock(request) : await runRustAssortativity(request);
      setResult(response);
      persistAssortativityRun(request, response, datasetMode);
    } catch (runError) {
      console.error("Assortativity analysis failed:", runError);
      setError(runError instanceof Error ? runError.message : (isHu ? "Nem sikerult betolteni az asszortativitasi elemzest." : "Failed to load assortativity analysis."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={shellStyle()}>
      <div style={{ display: "grid", gap: "1.2rem" }}>
        <section style={{ ...panelStyle(), padding: "1.5rem", display: "grid", gap: "1rem" }}>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <div style={infoLabelStyle()}>{isHu ? "Asszortativitasi tortenet" : "Assortativity story"}</div>
            <h1 style={{ margin: 0, fontSize: "clamp(2.2rem, 4vw, 4rem)", lineHeight: 0.98, maxWidth: "18ch" }}>
              {isHu ? "Előbb a hálózat, utána a statisztika" : "See the network, then the statistic"}
            </h1>
            <div style={{ color: COLORS.muted, lineHeight: 1.7, maxWidth: "68rem" }}>
              {isHu
                ? "Ez az oldal most a valos jatekosgrafbol indul ki, es koznyelven magyarazza el, mit merunk: az egymashoz kapcsolodo emberek hasonloak-e egy adott teljesitmenyjelben."
                : "This page now starts with the actual player graph, then explains in plain language what we are measuring: whether people who end up connected in the match network also tend to look similar on a chosen performance signal."}
            </div>
          </div>

          <div style={{ ...softCardStyle(), padding: "1rem 1.1rem", display: "grid", gap: "0.45rem" }}>
            <div style={{ fontWeight: 800 }}>{isHu ? "Miért fontos ez" : "Why this matters"}</div>
            <div style={{ color: COLORS.accentSoft, lineHeight: 1.6 }}>
              {isHu
                ? "Ha a hálózat más, az eredmény értelmezése is más lehet."
                : "If the network changes, the interpretation can change too."}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.85rem" }}>
            <StoryCard title={isHu ? "1. Mi ez a graf?" : "1. What is this graph?"} text={isHu ? "Minden pont egy jatekos. Minden kapcsolat ismetelt kozos meccstortenetet jelent. A klaszterek olyan halozati zsebeket mutatnak, amelyek ujra es ujra egyutt jelennek meg." : "Each point is a player. Each connection means repeated shared match history. Clusters show pockets of the network that keep showing up together."} />
            <StoryCard title={isHu ? "2. Miert erdekes barkinek?" : "2. Why should anyone care?"} text={isHu ? "A halozat szerkezete mutatja meg, hogy egy eredmeny kis helyi csoportokban jelenik-e meg, a teljes grafon is athuzodik-e, vagy valojaban alig latszik." : "The structure of the network tells us whether a result is local to small groups, visible across the wider graph, or barely there at all."} />
            <StoryCard title={isHu ? "3. Milyen mintat latunk?" : "3. What patterns are we seeing?"} text={isHu ? "Az osszekotott jatekosokat `opscore` es `feedscore` szerint hasonlitjuk ossze. A pozitiv asszortativitas azt jelenti, hogy a kapcsolt emberek jobban hasonlitanak egymasra, mint veletlen parositasnal varnank." : "We compare connected players on `opscore` and `feedscore`. Positive assortativity means connected people look more alike than you would expect from random pairing."} />
          </div>
        </section>

        <EvidenceGraph datasetMode={datasetMode} setDatasetMode={setDatasetMode} language={language} isHu={isHu} />

        <section style={{ ...panelStyle(), padding: "1.15rem", display: "grid", gap: "0.9rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: "0.22rem" }}>
              <div style={infoLabelStyle()}>{isHu ? "Kiserleti vezerlok" : "Experiment controls"}</div>
              <div style={{ color: COLORS.muted, lineHeight: 1.55 }}>
                {isHu ? "Ha a graf mar ertheto vizualisan, futtasd le ugyanebben az adathalmaz modban a statisztikat is." : "Once the graph makes intuitive sense, run the statistic below in the same dataset mode."}
              </div>
            </div>
            <button type="button" onClick={runAnalysis} disabled={loading} style={buttonStyle("primary")}>
              {loading ? (isHu ? "Futas..." : "Running...") : (isHu ? "Asszortativitas futtatasa" : "Run assortativity analysis")}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem" }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 700 }}>{isHu ? "Minimum eltamogatas" : "Minimum edge support"}</span>
              <input type="number" min={1} value={request.minEdgeSupport} onChange={(event) => setRequest((current) => ({ ...current, minEdgeSupport: Math.max(1, Number(event.target.value) || 1) }))} style={inputStyle()} />
              <span style={{ color: COLORS.muted, fontSize: "0.84rem", lineHeight: 1.5 }}>{isHu ? "A hasonlosag merese elott dobd ki a gyengebb kapcsolatokat." : "Ignore weaker relationships before measuring similarity."}</span>
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 700 }}>{isHu ? "Minimum jatekos meccsszam" : "Minimum player match count"}</span>
              <input type="number" min={1} value={request.minPlayerMatchCount} onChange={(event) => setRequest((current) => ({ ...current, minPlayerMatchCount: Math.max(1, Number(event.target.value) || 1) }))} style={inputStyle()} />
              <span style={{ color: COLORS.muted, fontSize: "0.84rem", lineHeight: 1.5 }}>{isHu ? "Csak eleg meccstortenettel rendelkezo jatekos adjon metrikaerteket." : "Require enough match history before a player contributes a metric value."}</span>
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 700 }}>{isHu ? "Eros kapcsolat kuszob" : "Strong-tie threshold"}</span>
              <input type="number" min={1} value={request.strongTieThreshold} onChange={(event) => setRequest((current) => ({ ...current, strongTieThreshold: Math.max(1, Number(event.target.value) || 1) }))} style={inputStyle()} />
              <span style={{ color: COLORS.muted, fontSize: "0.84rem", lineHeight: 1.5 }}>{isHu ? "Valaszd szet az ismetlodo kapcsolatokat erosebb es gyengebb kotesekre." : "Split repeated relationships into stronger and weaker ties for comparison."}</span>
            </label>
          </div>
        </section>

        {error ? <section style={{ ...panelStyle(), padding: "1rem", color: "#ffb39b" }}>{error}</section> : null}

        {result?.warnings.length ? (
          <section style={{ ...panelStyle(), padding: "1rem", display: "grid", gap: "0.55rem" }}>
            <div style={{ fontWeight: 700 }}>{isHu ? "Figyelmeztetesek" : "Warnings"}</div>
            {result.warnings.map((warning) => <div key={warning} style={{ color: COLORS.muted, lineHeight: 1.6 }}>{warning}</div>)}
          </section>
        ) : null}

        <section style={{ display: "grid", gap: "0.95rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", flexWrap: "wrap" }}>
            <div>
              <div style={infoLabelStyle()}>{isHu ? "Eredmenyek" : "Results"}</div>
              <h2 style={{ margin: "0.2rem 0 0", fontSize: "clamp(1.5rem, 2.4vw, 2.1rem)" }}>{isHu ? "Mit mond ez a futas" : "What this run is saying"}</h2>
            </div>
            {result ? <div style={{ color: COLORS.muted }}>{result.status}</div> : null}
          </div>

          {!hasRun && !result ? (
            <section style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.45rem" }}>
              <div style={{ fontWeight: 700 }}>{isHu ? "A graf atnezese utan futtasd le az elemzest." : "Run the analysis after you inspect the graph."}</div>
              <div style={{ color: COLORS.muted, lineHeight: 1.55 }}>{isHu ? "A cel az, hogy a vizualis halozat es a numerikus riport osszekapcsolodjon." : "The goal is to connect the visual network and the numeric report."}</div>
            </section>
          ) : null}

          {result ? (
            <section style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.85rem" }}>
              <InterpretationBanner
                finding={featuredResult?.global.coefficient !== null && featuredResult?.global.coefficient !== undefined
                  ? (featuredResult.global.coefficient > 0.2 ? "high-assortativity" : featuredResult.global.coefficient < -0.2 ? "low-assortativity" : "neutral")
                  : "neutral"}
                title={featuredResult ? explainAssortativityFinding(featuredResult.global.coefficient) : "Performance largely uncorrelated with connection"}
                description={featuredResult
                  ? `${metricLabel(featuredResult.metric)} on ${graphModeLabel(featuredResult.graphMode, isHu)} reads ${formatCoefficient(featuredResult.global.coefficient, language, isHu ? "nem definialt" : "undefined")}. ${explainAssortativityFinding(featuredResult.global.coefficient)}`
                  : (isHu ? "Az aktualis futasnak meg nincs kiemelt egyutthatoja." : "This run does not have a featured coefficient yet.")}
              />
              <div style={{ display: "grid", gap: "0.2rem" }}>
                <div style={infoLabelStyle()}>{isHu ? "Mit sugall ez a futas" : "What this run suggests"}</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>{isHu ? "Kozertheto tanulsagok" : "Layman takeaways"}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
                {summaryBullets.map((bullet) => <div key={bullet} style={{ ...softCardStyle(), padding: "0.95rem", color: COLORS.ink, lineHeight: 1.6 }}>{bullet}</div>)}
              </div>
            </section>
          ) : null}

          <ParameterGuide title={isHu ? "Miert szamitanak ezek a parameterek" : "Why these parameters matter"} parameters={parameterGuideItems} />

          {featuredLegend.length > 0 ? <EdgeCategoryLegend categories={featuredLegend} /> : null}

          {(["social-path", "battle-path"] as const).map((graphMode) => {
            const modeResults = groupedResults.get(graphMode) ?? [];
            if (!modeResults.length) return null;
            return (
              <div key={graphMode} style={{ display: "grid", gap: "0.8rem" }}>
                <div>
                  <div style={infoLabelStyle()}>{isHu ? "Technikai riport" : "Technical readout"}</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>{graphModeLabel(graphMode, isHu)}</div>
                </div>
                <CoefficientChart results={modeResults} language={language} isHu={isHu} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0.9rem" }}>
                  {modeResults.map((item) => <ResultCard key={`${item.graphMode}-${item.metric}`} result={item} language={language} isHu={isHu} />)}
                </div>
              </div>
            );
          })}
        </section>

        {result ? (
          <section style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.8rem" }}>
            <div style={infoLabelStyle()}>{isHu ? "Dokumentalt dontesek" : "Documented decisions"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.8rem" }}>
              <MethodologyCard
                title={isHu ? "Pearson endpoint-korrelacio" : "Pearson endpoint correlation"}
                description={isHu ? "Az egyutthato azt meri, hogy a kapcsolat ket vegen allo jatekosok mennyire hasonloak a valasztott metrikaban." : "The coefficient measures how similar the two endpoints of each eligible edge are on the chosen metric."}
                ruleText={result.decisions.assortativityFormula}
                impact="high"
              />
              <MethodologyCard
                title={isHu ? "Grafmodok kulon kezelve" : "Graph modes kept separate"}
                description={isHu ? "A social-path es a battle-path kulon fut, hogy a kapcsolatjelentes ne mosodjon ossze." : "Social-path and battle-path stay separate so the relationship semantics do not blur together."}
                ruleText={result.decisions.graphModeRule}
                impact="medium"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.8rem" }}>
              {[
                [isHu ? "Graf modok" : "Graph modes", result.decisions.graphModes.join(", ")],
                [isHu ? "Metrikak" : "Metrics", result.decisions.metrics.join(", ")],
                [isHu ? "Graf mod szabaly" : "Graph mode rule", result.decisions.graphModeRule],
                [isHu ? "Csomopont ervenyessegi szabaly" : "Node eligibility rule", result.decisions.nodeEligibilityRule],
                [isHu ? "Asszortativitasi keplet" : "Assortativity formula", result.decisions.assortativityFormula],
              ].map(([label, value]) => (
                <div key={label} style={{ ...softCardStyle(), padding: "0.9rem", display: "grid", gap: "0.35rem" }}>
                  <div style={{ fontWeight: 700 }}>{label}</div>
                  <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>{value}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
