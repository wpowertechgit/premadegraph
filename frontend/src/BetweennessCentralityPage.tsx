import React, { useMemo, useState } from "react";
import { FaBolt, FaCheckCircle, FaExclamationTriangle, FaNetworkWired, FaStopwatch } from "react-icons/fa";
import { runRustBetweennessCentrality } from "./pathfinderApi";
import { useI18n } from "./i18n";
import { buttonStyle, inputStyle, pageShellStyle, sectionLabelStyle } from "./theme";
import type {
  BetweennessCentralityNodeResult,
  BetweennessCentralityRequest,
  BetweennessCentralityResponse,
  BetweennessPathMode,
} from "./betweennessTypes";

const DEFAULT_REQUEST: BetweennessCentralityRequest = {
  pathMode: "battle-path",
  weightedMode: true,
  minEdgeSupport: 20,
  maxTopNodes: 20,
  parallel: true,
  runSerialBaseline: true,
  includeFullResults: false,
};

const COLORS = {
  ink: "#f7f8f8",
  muted: "#8a8f98",
  line: "rgba(255, 255, 255, 0.07)",
  lineStrong: "rgba(255, 255, 255, 0.10)",
  accent: "#91d8c5",
  amber: "#efc06f",
  coral: "#f0947f",
  steel: "#9fc9ee",
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

function softPanelStyle(): React.CSSProperties {
  return {
    borderRadius: "8px",
    border: `1px solid ${COLORS.line}`,
    background: "rgba(255,255,255,0.02)",
  };
}

function labelStyle(): React.CSSProperties {
  return { ...sectionLabelStyle(), color: COLORS.muted };
}

function formatNumber(value: number, language: "en" | "hu", digits = 0) {
  return value.toLocaleString(language === "hu" ? "hu-HU" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatMs(value: number | null | undefined, language: "en" | "hu") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  if (value >= 1000) {
    return `${formatNumber(value / 1000, language, 2)} s`;
  }
  return `${formatNumber(value, language, 2)} ms`;
}

function graphModeLabel(mode: BetweennessPathMode) {
  return mode === "social-path" ? "Social path" : "Battle path";
}

function speedupReading(response: BetweennessCentralityResponse | null, isHu: boolean) {
  const speedup = response?.runtime.speedup;
  if (speedup === null || speedup === undefined) {
    return isHu
      ? "Nincs serial baseline ebben a futasban, ezert nincs gyorsulasi arany."
      : "No serial baseline was run, so there is no speedup ratio for this run.";
  }
  if (speedup > 1.2) {
    return isHu
      ? "A parhuzamos futas itt mar gyorsabb, tehat a projekcio eleg nagy ahhoz, hogy a Rayon hasznos legyen."
      : "The parallel run is faster here, so this projection is large enough for Rayon to pay off.";
  }
  if (speedup < 0.9) {
    return isHu
      ? "A parhuzamos futas itt lassabb; a graf tul kicsi vagy tul ritka, es a thread overhead dominans."
      : "The parallel run is slower here; the graph is too small or sparse, so thread overhead dominates.";
  }
  return isHu
    ? "A ket futas nagyjabol hasonlo. Ez a kuszob a parhuzamositas hataran van."
    : "The two runs are roughly comparable. This threshold is near the break-even point.";
}

function projectionReading(response: BetweennessCentralityResponse | null, isHu: boolean) {
  if (!response) {
    return isHu
      ? "Meg nincs futas. A support kuszob donti el, hogy eros-kapcsolati broker elemzest vagy nagyobb globalis grafot vizsgalsz."
      : "No run yet. The support threshold decides whether this is a strong-tie broker study or a larger global graph study.";
  }
  const summary = response.graphSummary;
  const keptRatio = summary.candidateEdges > 0 ? summary.analyzedEdges / summary.candidateEdges : 0;
  if (keptRatio < 0.01) {
    return isHu
      ? "Ez eros-kapcsolati centralitas: a legtobb kapcsolat kiesett, a maradek broker szerep nagyon konzervativ."
      : "This is strong-tie centrality: most relationships were filtered out, so the remaining broker signal is conservative.";
  }
  if (keptRatio < 0.1) {
    return isHu
      ? "Ez meg mindig szurt graf, de mar eleg kapcsolat marad a broker mintakhoz."
      : "This is still a filtered graph, but enough relationships remain for broker patterns to emerge.";
  }
  return isHu
    ? "Ez mar kozelebb all a teljes graf broker elemzesehez, es varhatoan dragabb futas."
    : "This is closer to a whole-graph broker analysis and should be treated as the expensive run.";
}

function MetricTile({
  icon,
  label,
  value,
  tone = COLORS.steel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div style={{ ...softPanelStyle(), padding: "0.9rem", display: "grid", gap: "0.45rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
        <span style={labelStyle()}>{label}</span>
        <span style={{ color: tone }}>{icon}</span>
      </div>
      <div style={{ fontSize: "1.35rem", fontWeight: 800, color: tone }}>{value}</div>
    </div>
  );
}

function NodeRankCard({
  node,
  maxRaw,
  language,
}: {
  node: BetweennessCentralityNodeResult;
  maxRaw: number;
  language: "en" | "hu";
}) {
  const width = maxRaw > 0 ? Math.max(3, (node.rawBetweenness / maxRaw) * 100) : 0;
  return (
    <div style={{ ...softPanelStyle(), padding: "0.95rem", display: "grid", gap: "0.7rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: COLORS.amber, fontWeight: 800 }}>#{node.rank}</div>
          <div style={{ fontWeight: 800, wordBreak: "break-word" }}>{node.label}</div>
          <div style={{ color: COLORS.muted, fontSize: "0.82rem", wordBreak: "break-all" }}>
            {node.clusterId ?? "unclustered"}
          </div>
        </div>
        <div style={{ textAlign: "right", color: COLORS.accent, fontWeight: 800 }}>
          {formatNumber(node.rawBetweenness, language, 2)}
        </div>
      </div>
      <div style={{ height: "10px", borderRadius: "999px", overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
        <div
          style={{
            width: `${width}%`,
            height: "100%",
            borderRadius: "999px",
            background: `linear-gradient(90deg, ${COLORS.accent} 0%, ${COLORS.steel} 100%)`,
          }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", color: COLORS.muted, fontSize: "0.82rem" }}>
        <span>Degree {node.degree}</span>
        <span>Strength {node.weightedStrength}</span>
        <span>Norm {formatNumber(node.normalizedBetweenness, language, 6)}</span>
      </div>
    </div>
  );
}

export default function BetweennessCentralityPage() {
  const { language } = useI18n();
  const isHu = language === "hu";
  const [request, setRequest] = useState<BetweennessCentralityRequest>(DEFAULT_REQUEST);
  const [result, setResult] = useState<BetweennessCentralityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxRaw = useMemo(
    () => Math.max(0, ...(result?.topNodes ?? []).map((node) => node.rawBetweenness)),
    [result?.topNodes],
  );
  const keptEdgeRatio = result && result.graphSummary.candidateEdges > 0
    ? result.graphSummary.analyzedEdges / result.graphSummary.candidateEdges
    : 0;

  const runAnalysis = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await runRustBetweennessCentrality(request);
      setResult(response);
    } catch (runError) {
      console.error("Betweenness centrality failed:", runError);
      setError(
        runError instanceof Error
          ? runError.message
          : isHu
            ? "Nem sikerult lefuttatni a Brandes centralitast."
            : "Failed to run Brandes centrality.",
      );
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (minEdgeSupport: number, runSerialBaseline: boolean) => {
    setRequest((current) => ({
      ...current,
      minEdgeSupport,
      runSerialBaseline,
      maxTopNodes: minEdgeSupport <= 1 ? Math.max(current.maxTopNodes, 30) : current.maxTopNodes,
    }));
  };

  return (
    <div style={shellStyle()}>
      <div style={{ display: "grid", gap: "1.05rem" }}>
        <section style={{ ...panelStyle(), padding: "1.35rem", display: "grid", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: "0.45rem", maxWidth: "68rem" }}>
              <div style={labelStyle()}>{isHu ? "Brandes broker kiserlet" : "Brandes Broker Experiment"}</div>
              <h1 style={{ margin: 0, fontSize: "clamp(2.1rem, 4vw, 3.8rem)", lineHeight: 1 }}>
                {isHu ? "Kik tartjak ossze a grafot?" : "Who holds the graph together?"}
              </h1>
              <div style={{ color: COLORS.muted, lineHeight: 1.65 }}>
                {isHu
                  ? "A betweenness centrality azokat a jatekosokat emeli ki, akik sok legrövidebb ut kozepen allnak. Ez broker- vagy hid-szerep, nem egyszeru nepszerusegi rangsor."
                  : "Betweenness centrality highlights players that sit on many shortest paths. This is a broker or bridge signal, not a simple popularity ranking."}
              </div>
            </div>
            <button
              type="button"
              onClick={runAnalysis}
              disabled={loading}
              style={{ ...buttonStyle("primary"), opacity: loading ? 0.68 : 1 }}
            >
              {loading ? (isHu ? "Brandes fut..." : "Running Brandes...") : (isHu ? "Centralitas futtatasa" : "Run Centrality")}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.8rem" }}>
            <MetricTile
              icon={<FaNetworkWired />}
              label={isHu ? "Graf olvasat" : "Graph reading"}
              value={graphModeLabel(request.pathMode)}
              tone={COLORS.steel}
            />
            <MetricTile
              icon={<FaBolt />}
              label={isHu ? "Elkoltseg" : "Edge cost"}
              value={request.weightedMode ? "1 / strength" : "uniform"}
              tone={COLORS.accent}
            />
            <MetricTile
              icon={<FaStopwatch />}
              label={isHu ? "Baseline" : "Baseline"}
              value={request.runSerialBaseline ? "serial + parallel" : request.parallel ? "parallel only" : "serial only"}
              tone={COLORS.amber}
            />
          </div>
        </section>

        <section style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.95rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={labelStyle()}>{isHu ? "Futasi parameterek" : "Run Parameters"}</div>
              <div style={{ color: COLORS.muted, marginTop: "0.25rem" }}>
                {isHu ? "A kuszob a legerosebb modszertani dontes." : "The threshold is the most important methodological choice."}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
              {[
                { label: "Strong 20", support: 20, baseline: true },
                { label: "Medium 10", support: 10, baseline: false },
                { label: "Wide 5", support: 5, baseline: false },
                { label: "Full 1", support: 1, baseline: false },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.support, preset.baseline)}
                  style={{
                    ...buttonStyle(request.minEdgeSupport === preset.support ? "secondary" : "ghost"),
                    minHeight: "38px",
                    padding: "0.55rem 0.75rem",
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.85rem" }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 700 }}>{isHu ? "Graf mod" : "Graph mode"}</span>
              <select
                value={request.pathMode}
                onChange={(event) => setRequest((current) => ({ ...current, pathMode: event.target.value as BetweennessPathMode }))}
                style={inputStyle()}
              >
                <option value="battle-path">Battle path</option>
                <option value="social-path">Social path</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 700 }}>{isHu ? "Minimum eltamogatas" : "Minimum edge support"}</span>
              <input
                type="number"
                min={1}
                value={request.minEdgeSupport}
                onChange={(event) => setRequest((current) => ({ ...current, minEdgeSupport: Math.max(1, Number(event.target.value) || 1) }))}
                style={inputStyle()}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 700 }}>{isHu ? "Top jatekosok" : "Top players"}</span>
              <input
                type="number"
                min={1}
                max={200}
                value={request.maxTopNodes}
                onChange={(event) => setRequest((current) => ({ ...current, maxTopNodes: Math.max(1, Number(event.target.value) || 1) }))}
                style={inputStyle()}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
            {[
              {
                key: "weightedMode",
                label: isHu ? "Sulyozott 1 / strength" : "Weighted 1 / strength",
                checked: request.weightedMode,
              },
              {
                key: "parallel",
                label: isHu ? "Rayon parhuzamositas" : "Rayon parallel",
                checked: request.parallel,
              },
              {
                key: "runSerialBaseline",
                label: isHu ? "Serial baseline meres" : "Serial baseline",
                checked: request.runSerialBaseline,
              },
              {
                key: "includeFullResults",
                label: isHu ? "Teljes rangsor JSON" : "Full result JSON",
                checked: request.includeFullResults,
              },
            ].map((toggle) => (
              <label
                key={toggle.key}
                style={{
                  ...softPanelStyle(),
                  padding: "0.7rem 0.85rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.55rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={toggle.checked}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setRequest((current) => ({ ...current, [toggle.key]: checked }));
                  }}
                />
                <span style={{ fontWeight: 700 }}>{toggle.label}</span>
              </label>
            ))}
          </div>
        </section>

        {error ? (
          <section style={{ ...panelStyle(), padding: "1rem", color: COLORS.coral, display: "flex", gap: "0.65rem", alignItems: "center" }}>
            <FaExclamationTriangle />
            <span>{error}</span>
          </section>
        ) : null}

        {result ? (
          <>
            <section style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.95rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", flexWrap: "wrap" }}>
                <div>
                  <div style={labelStyle()}>{isHu ? "Kiserleti kimenet" : "Experiment Output"}</div>
                  <h2 style={{ margin: "0.25rem 0 0", fontSize: "clamp(1.45rem, 2.4vw, 2.1rem)" }}>
                    {result.status === "ok" ? (isHu ? "Eredmeny kesz" : "Results ready") : (isHu ? "Nincs eleg adat" : "Insufficient data")}
                  </h2>
                </div>
                <div style={{ color: result.status === "ok" ? COLORS.accent : COLORS.amber, fontWeight: 800 }}>
                  {result.status}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.8rem" }}>
                <MetricTile icon={<FaNetworkWired />} label={isHu ? "Runtime node-ok" : "Runtime nodes"} value={formatNumber(result.graphSummary.runtimeNodes, language)} />
                <MetricTile icon={<FaNetworkWired />} label={isHu ? "Projected node-ok" : "Projected nodes"} value={formatNumber(result.graphSummary.projectedNodes, language)} tone={COLORS.accent} />
                <MetricTile icon={<FaNetworkWired />} label={isHu ? "Elemzett elek" : "Analyzed edges"} value={formatNumber(result.graphSummary.analyzedEdges, language)} tone={COLORS.amber} />
                <MetricTile icon={<FaCheckCircle />} label={isHu ? "Megtartott elarany" : "Kept edge ratio"} value={`${formatNumber(keptEdgeRatio * 100, language, 2)}%`} tone={COLORS.steel} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.85rem" }}>
                <div style={{ ...softPanelStyle(), padding: "0.95rem", display: "grid", gap: "0.45rem" }}>
                  <div style={{ fontWeight: 800 }}>{isHu ? "Mit jelent a projekcio?" : "Projection reading"}</div>
                  <div style={{ color: COLORS.muted, lineHeight: 1.65 }}>{projectionReading(result, isHu)}</div>
                </div>
                <div style={{ ...softPanelStyle(), padding: "0.95rem", display: "grid", gap: "0.45rem" }}>
                  <div style={{ fontWeight: 800 }}>{isHu ? "Megerte a parhuzamositas?" : "Was parallelism worth it?"}</div>
                  <div style={{ color: COLORS.muted, lineHeight: 1.65 }}>{speedupReading(result, isHu)}</div>
                </div>
              </div>
            </section>

            <section style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.9rem" }}>
              <div style={labelStyle()}>{isHu ? "Idozites es validacio" : "Timing And Validation"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.8rem" }}>
                <MetricTile icon={<FaStopwatch />} label={isHu ? "Algoritmus ido" : "Algorithm time"} value={formatMs(result.runtime.algorithmRuntimeMs, language)} tone={COLORS.accent} />
                <MetricTile icon={<FaStopwatch />} label="Serial" value={formatMs(result.runtime.serialRuntimeMs, language)} tone={COLORS.amber} />
                <MetricTile icon={<FaStopwatch />} label="Parallel" value={formatMs(result.runtime.parallelRuntimeMs, language)} tone={COLORS.steel} />
                <MetricTile
                  icon={<FaBolt />}
                  label="Speedup"
                  value={result.runtime.speedup === null ? "n/a" : `${formatNumber(result.runtime.speedup, language, 2)}x`}
                  tone={result.runtime.speedup !== null && result.runtime.speedup > 1 ? COLORS.accent : COLORS.coral}
                />
                <MetricTile icon={<FaNetworkWired />} label="Rayon threads" value={String(result.runtime.rayonThreads)} tone={COLORS.steel} />
                <MetricTile
                  icon={<FaCheckCircle />}
                  label="Serial delta"
                  value={result.runtime.serialParallelMaxAbsDelta === null ? "n/a" : formatNumber(result.runtime.serialParallelMaxAbsDelta, language, 6)}
                  tone={result.runtime.serialParallelMaxAbsDelta === 0 ? COLORS.accent : COLORS.amber}
                />
              </div>
            </section>

            {result.warnings.length > 0 ? (
              <section style={{ ...panelStyle(), padding: "1rem", display: "grid", gap: "0.55rem" }}>
                <div style={{ color: COLORS.amber, fontWeight: 800 }}>{isHu ? "Figyelmeztetesek" : "Warnings"}</div>
                {result.warnings.map((warning) => (
                  <div key={warning} style={{ color: COLORS.muted, lineHeight: 1.6 }}>{warning}</div>
                ))}
              </section>
            ) : null}

            <section style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", flexWrap: "wrap" }}>
                <div>
                  <div style={labelStyle()}>{isHu ? "Legfontosabb hid jatekosok" : "Top Bridge Players"}</div>
                  <h2 style={{ margin: "0.2rem 0 0", fontSize: "clamp(1.45rem, 2.4vw, 2.1rem)" }}>
                    {isHu ? "Broker rangsor" : "Broker ranking"}
                  </h2>
                </div>
                <div style={{ color: COLORS.muted }}>
                  {result.topNodes.length} {isHu ? "sor" : "rows"}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.85rem" }}>
                {result.topNodes.slice(0, 6).map((node) => (
                  <NodeRankCard key={node.playerId} node={node} maxRaw={maxRaw} language={language} />
                ))}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "880px" }}>
                  <thead>
                    <tr style={{ color: COLORS.muted, textAlign: "left" }}>
                      <th style={{ padding: "0.65rem 0.5rem" }}>Rank</th>
                      <th style={{ padding: "0.65rem 0.5rem" }}>{isHu ? "Jatekos" : "Player"}</th>
                      <th style={{ padding: "0.65rem 0.5rem" }}>Cluster</th>
                      <th style={{ padding: "0.65rem 0.5rem" }}>Degree</th>
                      <th style={{ padding: "0.65rem 0.5rem" }}>Strength</th>
                      <th style={{ padding: "0.65rem 0.5rem" }}>Raw BC</th>
                      <th style={{ padding: "0.65rem 0.5rem" }}>Normalized BC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.topNodes.map((node) => (
                      <tr key={node.playerId} style={{ borderTop: `1px solid ${COLORS.line}` }}>
                        <td style={{ padding: "0.72rem 0.5rem", color: COLORS.amber, fontWeight: 800 }}>{node.rank}</td>
                        <td style={{ padding: "0.72rem 0.5rem", fontWeight: 800, wordBreak: "break-word" }}>{node.label}</td>
                        <td style={{ padding: "0.72rem 0.5rem", color: COLORS.muted }}>{node.clusterId ?? "unclustered"}</td>
                        <td style={{ padding: "0.72rem 0.5rem" }}>{formatNumber(node.degree, language)}</td>
                        <td style={{ padding: "0.72rem 0.5rem" }}>{formatNumber(node.weightedStrength, language)}</td>
                        <td style={{ padding: "0.72rem 0.5rem", color: COLORS.accent }}>{formatNumber(node.rawBetweenness, language, 4)}</td>
                        <td style={{ padding: "0.72rem 0.5rem", color: COLORS.steel }}>{formatNumber(node.normalizedBetweenness, language, 8)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.75rem" }}>
              <div style={labelStyle()}>{isHu ? "Dokumentalt dontesek" : "Documented Decisions"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.8rem" }}>
                {[
                  ["Algorithm", result.decisions.algorithm],
                  ["Parallelization", result.decisions.parallelization],
                  ["Edge support", result.decisions.edgeSupportRule],
                  ["Edge cost", result.decisions.edgeCostRule],
                  ["Normalization", result.decisions.normalizationRule],
                  ["Graph scope", result.decisions.graphScope],
                ].map(([label, value]) => (
                  <div key={label} style={{ ...softPanelStyle(), padding: "0.9rem", display: "grid", gap: "0.35rem" }}>
                    <div style={{ fontWeight: 800 }}>{label}</div>
                    <div style={{ color: COLORS.muted, lineHeight: 1.55 }}>{value}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.55rem" }}>
            <div style={{ fontWeight: 800 }}>{isHu ? "Kezdd egy eros-kapcsolati futassal." : "Start with a strong-tie run."}</div>
            <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>{projectionReading(null, isHu)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
