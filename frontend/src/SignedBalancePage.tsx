import React, { useMemo, useState } from "react";
import { runRustSignedBalance } from "./pathfinderApi";
import { useI18n } from "./i18n";
import { runSignedBalanceMock } from "./signedBalanceMock";
import { buttonStyle, inputStyle, metricCardStyle, pageShellStyle, sectionLabelStyle, surfaceCardStyle } from "./theme";
import type {
  SignedBalanceRequest,
  SignedBalanceResponse,
  SignedTiePolicy,
  SignedTriadTypeCount,
} from "./signedBalanceTypes";

const DEFAULT_REQUEST: SignedBalanceRequest = {
  minEdgeSupport: 2,
  tiePolicy: "exclude",
  maxTopNodes: 10,
  includeClusterSummaries: true,
};

function pageCardStyle() {
  return surfaceCardStyle();
}

function miniLabelStyle() {
  return sectionLabelStyle();
}

function triadDescription(triadType: string) {
  if (triadType === "+++") {
    return "friend of my friend is my friend";
  }
  if (triadType === "++-") {
    return "friend of my friend is my enemy";
  }
  if (triadType === "+--") {
    return "enemy of my enemy is my friend";
  }
  return "enemy of my enemy is still my enemy";
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function countMax(distribution: SignedTriadTypeCount[]) {
  return distribution.reduce((max, item) => Math.max(max, item.count), 1);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function InfoDot({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      style={{
        width: "1.15rem",
        height: "1.15rem",
        borderRadius: "999px",
        border: "1px solid rgba(124, 156, 190, 0.45)",
        background: "rgba(38, 52, 68, 0.88)",
        color: "#bfd4ea",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.72rem",
        fontWeight: 800,
        cursor: "help",
        flexShrink: 0,
      }}
    >
      i
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ ...pageCardStyle(), padding: "1rem 1.1rem", display: "grid", gap: "0.8rem" }}>
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        {subtitle ? <div style={{ color: "#92a8bd", lineHeight: 1.6 }}>{subtitle}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ControlField({
  label,
  help,
  effect,
  children,
}: {
  label: string;
  help: string;
  effect: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: "0.4rem" }}>
      <span style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 600 }}>
        <span>{label}</span>
        <InfoDot text={`${help} ${effect}`} />
      </span>
      {children}
      <span style={{ color: "#89a1b8", fontSize: "0.84rem", lineHeight: 1.45 }}>{help}</span>
      <span style={{ color: "#6fb8c9", fontSize: "0.8rem", lineHeight: 1.45 }}>{effect}</span>
    </label>
  );
}

function BarMeter({
  value,
  maxValue,
  color,
}: {
  value: number;
  maxValue: number;
  color: string;
}) {
  return (
    <div style={{ height: "12px", borderRadius: "999px", background: "#10151b", overflow: "hidden" }}>
      <div
        style={{
          width: `${(value / maxValue) * 100}%`,
          height: "100%",
          borderRadius: "999px",
          background: color,
        }}
      />
    </div>
  );
}

function DonutChart({
  ratio,
  centerLabel,
  centerValue,
}: {
  ratio: number;
  centerLabel: string;
  centerValue: string;
}) {
  const fill = clampPercent(ratio * 100);
  return (
    <div
      style={{
        width: "200px",
        height: "200px",
        borderRadius: "50%",
        background: `conic-gradient(#73c58f 0% ${fill}%, #d98774 ${fill}% 100%)`,
        display: "grid",
        placeItems: "center",
        justifySelf: "center",
      }}
    >
      <div
        style={{
          width: "124px",
          height: "124px",
          borderRadius: "50%",
          background: "#0f141b",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: "0.8rem",
          boxSizing: "border-box",
        }}
      >
        <div>
          <div style={{ color: "#88a0b7", fontSize: "0.78rem" }}>{centerLabel}</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{centerValue}</div>
        </div>
      </div>
    </div>
  );
}

export default function SignedBalancePage() {
  const { t } = useI18n();
  const [request, setRequest] = useState<SignedBalanceRequest>(DEFAULT_REQUEST);
  const [datasetMode, setDatasetMode] = useState<"full" | "mock">("full");
  const [result, setResult] = useState<SignedBalanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const runAnalysis = async (nextRequest: SignedBalanceRequest) => {
    if (loading) {
      return;
    }
    setLoading(true);
    setError(null);
    setHasRun(true);
    try {
      const response = datasetMode === "mock"
        ? await runSignedBalanceMock(nextRequest)
        : await runRustSignedBalance(nextRequest);
      setResult(response);
    } catch (runError) {
      console.error("Signed balance analysis failed:", runError);
      setError(runError instanceof Error ? runError.message : t.signedBalance.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  const triadMax = useMemo(
    () => countMax(result?.triadTypeDistribution ?? []),
    [result?.triadTypeDistribution],
  );

  const triadTotal = result?.triads.totalAnalyzed ?? 0;

  const triadShares = useMemo(
    () =>
      (result?.triadTypeDistribution ?? []).map((item) => ({
        ...item,
        share: triadTotal > 0 ? item.count / triadTotal : 0,
      })),
    [result?.triadTypeDistribution, triadTotal],
  );

  const topInstabilityMax = useMemo(
    () => (result?.topUnbalancedNodes ?? []).reduce((max, node) => Math.max(max, node.instabilityScore), 0.01),
    [result?.topUnbalancedNodes],
  );

  const graphPipeline = useMemo(() => {
    if (!result) {
      return [];
    }
    const summary = result.graphSummary;
    const maxValue = Math.max(
      summary.candidateEdges,
      summary.analyzedEdges,
      summary.excludedLowSupportEdges,
      summary.excludedTiedEdges,
      1,
    );

    return [
      { label: t.signedBalance.candidateEdges, value: summary.candidateEdges, color: "linear-gradient(90deg, #5f85be 0%, #8bb8e3 100%)", maxValue },
      { label: t.signedBalance.analyzedEdges, value: summary.analyzedEdges, color: "linear-gradient(90deg, #4a8e60 0%, #7ad29b 100%)", maxValue },
      { label: t.signedBalance.excludedLowSupport, value: summary.excludedLowSupportEdges, color: "linear-gradient(90deg, #997a43 0%, #e2b56d 100%)", maxValue },
      { label: t.signedBalance.excludedTied, value: summary.excludedTiedEdges, color: "linear-gradient(90deg, #8f574c 0%, #e29583 100%)", maxValue },
    ];
  }, [result, t.signedBalance.analyzedEdges, t.signedBalance.candidateEdges, t.signedBalance.excludedLowSupport, t.signedBalance.excludedTied]);

  const updateTiePolicy = (value: string) => {
    setRequest((current) => ({
      ...current,
      tiePolicy: value as SignedTiePolicy,
    }));
  };

  return (
    <div
      style={{
        ...pageShellStyle(),
        color: "#eef2f7",
      }}
    >
      <div style={{ display: "grid", gap: "1rem" }}>
        <section
          style={{
            ...pageCardStyle(),
            padding: "1.25rem 1.35rem",
            display: "grid",
            gap: "0.55rem",
          }}
        >
          <div style={miniLabelStyle()}>{t.signedBalance.pageLabel}</div>
          <div style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800 }}>{t.signedBalance.pageTitle}</div>
          <div style={{ color: "#9db0c4", maxWidth: "980px", lineHeight: 1.6 }}>{t.signedBalance.pageDescription}</div>
        </section>

        <section
          style={{
            ...pageCardStyle(),
            padding: "1rem 1.1rem",
            display: "grid",
            gap: "0.85rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>{t.signedBalance.controls}</div>
            <div style={{ color: "#8fa3b8", fontSize: "0.92rem" }}>
              {datasetMode === "mock" ? t.signedBalance.mockModeBadge : t.signedBalance.readOnly}
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.55rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 600 }}>
              <span>{t.signedBalance.datasetMode}</span>
              <InfoDot text={`${t.signedBalance.datasetModeHelp} ${t.signedBalance.datasetModeEffect}`} />
            </div>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              {([
                { id: "full", label: t.signedBalance.fullDataset },
                { id: "mock", label: t.signedBalance.mockDataset },
              ] as const).map((option) => {
                const active = datasetMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setDatasetMode(option.id);
                      setResult(null);
                      setError(null);
                      setHasRun(false);
                    }}
                    style={{
                      ...buttonStyle(active ? "primary" : "secondary"),
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div style={{ color: "#89a1b8", fontSize: "0.84rem", lineHeight: 1.45 }}>
              {t.signedBalance.datasetModeHelp}
            </div>
            <div style={{ color: "#6fb8c9", fontSize: "0.8rem", lineHeight: 1.45 }}>
              {datasetMode === "mock" ? t.signedBalance.mockDatasetActiveEffect : t.signedBalance.datasetModeEffect}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "0.95rem",
            }}
          >
            <ControlField
              label={t.signedBalance.minEdgeSupport}
              help={t.signedBalance.minEdgeSupportHelp}
              effect={t.signedBalance.minEdgeSupportEffect}
            >
              <input
                type="number"
                min={1}
                max={20}
                value={request.minEdgeSupport}
                onChange={(event) => setRequest((current) => ({
                  ...current,
                  minEdgeSupport: Math.max(1, Number(event.target.value) || 1),
                }))}
                style={inputStyle()}
              />
            </ControlField>

            <ControlField
              label={t.signedBalance.tiePolicy}
              help={t.signedBalance.tiePolicyHelp}
              effect={t.signedBalance.tiePolicyEffect}
            >
              <select
                value={request.tiePolicy}
                onChange={(event) => updateTiePolicy(event.target.value)}
                style={inputStyle()}
              >
                <option value="exclude">{t.signedBalance.tieExclude}</option>
                <option value="ally">{t.signedBalance.tieAlly}</option>
                <option value="enemy">{t.signedBalance.tieEnemy}</option>
              </select>
            </ControlField>

            <ControlField
              label={t.signedBalance.maxTopNodes}
              help={t.signedBalance.maxTopNodesHelp}
              effect={t.signedBalance.maxTopNodesEffect}
            >
              <input
                type="number"
                min={3}
                max={50}
                value={request.maxTopNodes}
                onChange={(event) => setRequest((current) => ({
                  ...current,
                  maxTopNodes: Math.max(3, Number(event.target.value) || 3),
                }))}
                style={inputStyle()}
              />
            </ControlField>

            <ControlField
              label={t.signedBalance.clusterSummaries}
              help={t.signedBalance.clusterSummariesHelp}
              effect={t.signedBalance.clusterSummariesEffect}
            >
              <button
                type="button"
                onClick={() => setRequest((current) => ({
                  ...current,
                  includeClusterSummaries: !current.includeClusterSummaries,
                }))}
                style={{
                  ...buttonStyle(request.includeClusterSummaries ? "primary" : "ghost"),
                }}
              >
                {request.includeClusterSummaries ? t.common.enabled : t.common.disabled}
              </button>
            </ControlField>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => void runAnalysis(request)}
              disabled={loading}
              style={{
                ...buttonStyle("primary"),
                borderRadius: "999px",
                padding: "0.82rem 1.2rem",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? t.signedBalance.running : t.signedBalance.runAnalysis}
            </button>
            <div style={{ color: "#8fa3b8" }}>
              {datasetMode === "mock" ? t.signedBalance.runHintMock : t.signedBalance.runHint}
            </div>
          </div>
        </section>

        {error ? (
          <section style={{ ...pageCardStyle(), padding: "1rem 1.1rem", color: "#efb095" }}>{error}</section>
        ) : null}

        {!hasRun && !result && !error ? (
          <section style={{ ...pageCardStyle(), padding: "1rem 1.1rem", color: "#9db0c4" }}>
            {t.signedBalance.waitingToRun}
          </section>
        ) : null}

        {result ? (
          <>
            {result.warnings.length > 0 ? (
              <section style={{ ...pageCardStyle(), padding: "1rem 1.1rem", display: "grid", gap: "0.45rem" }}>
                <div style={{ fontWeight: 700 }}>{t.signedBalance.warnings}</div>
                {result.warnings.map((warning) => (
                  <div key={warning} style={{ color: "#d9b385" }}>{warning}</div>
                ))}
              </section>
            ) : null}

            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "0.85rem",
              }}
            >
              {[
                { label: t.signedBalance.totalTriads, value: result.triads.totalAnalyzed.toLocaleString(), accent: "#7aa7d5" },
                { label: t.signedBalance.balancedCount, value: result.triads.balancedCount.toLocaleString(), accent: "#6bc18b" },
                { label: t.signedBalance.unbalancedCount, value: result.triads.unbalancedCount.toLocaleString(), accent: "#d7846f" },
                { label: t.signedBalance.balancedRatio, value: percent(result.triads.balancedRatio), accent: "#ebd08b" },
              ].map((card) => (
                <div key={card.label} style={{ ...metricCardStyle(), padding: "1rem 1.05rem", display: "grid", gap: "0.35rem" }}>
                  <div style={{ color: "#93a6bb", fontSize: "0.84rem" }}>{card.label}</div>
                  <div style={{ fontSize: "1.85rem", fontWeight: 800, color: card.accent }}>{card.value}</div>
                </div>
              ))}
            </section>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
                gap: "1rem",
              }}
            >
              <SectionCard title={t.signedBalance.balanceSplitChart} subtitle={t.signedBalance.balanceSplitChartText}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px, 260px) minmax(0, 1fr)",
                    gap: "1rem",
                    alignItems: "center",
                  }}
                >
                  <DonutChart
                    ratio={result.triads.balancedRatio}
                    centerLabel={t.signedBalance.balancedRatio}
                    centerValue={percent(result.triads.balancedRatio)}
                  />
                  <div style={{ display: "grid", gap: "0.9rem" }}>
                    <div style={{ display: "grid", gap: "0.45rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", color: "#a4b6c8", fontSize: "0.88rem" }}>
                        <span>{t.signedBalance.balancedCount}: {result.triads.balancedCount.toLocaleString()}</span>
                        <span>{t.signedBalance.unbalancedCount}: {result.triads.unbalancedCount.toLocaleString()}</span>
                      </div>
                      <div style={{ height: "16px", borderRadius: "999px", overflow: "hidden", background: "#10151b", display: "flex" }}>
                        <div
                          style={{
                            width: `${(result.triads.balancedCount / Math.max(result.triads.totalAnalyzed, 1)) * 100}%`,
                            background: "linear-gradient(90deg, #3f7e54 0%, #75cb90 100%)",
                          }}
                        />
                        <div
                          style={{
                            width: `${(result.triads.unbalancedCount / Math.max(result.triads.totalAnalyzed, 1)) * 100}%`,
                            background: "linear-gradient(90deg, #7d4b43 0%, #db8777 100%)",
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ color: "#96a9bc", lineHeight: 1.6 }}>
                      {result.triads.unbalancedCount === 0
                        ? t.signedBalance.balanceSplitAllBalanced
                        : t.signedBalance.balanceSplitMixed}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title={t.signedBalance.graphSummary} subtitle={t.signedBalance.graphSummaryText}>
                <div>{t.signedBalance.filteredNodes}: {result.graphSummary.filteredNodes.toLocaleString()}</div>
                <div>{t.signedBalance.projectedNodes}: {result.graphSummary.projectedNodes.toLocaleString()}</div>
                <div>{t.signedBalance.candidateEdges}: {result.graphSummary.candidateEdges.toLocaleString()}</div>
                <div>{t.signedBalance.analyzedEdges}: {result.graphSummary.analyzedEdges.toLocaleString()}</div>
                <div>{t.signedBalance.excludedLowSupport}: {result.graphSummary.excludedLowSupportEdges.toLocaleString()}</div>
                <div>{t.signedBalance.excludedTied}: {result.graphSummary.excludedTiedEdges.toLocaleString()}</div>
              </SectionCard>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
                gap: "1rem",
              }}
            >
              <SectionCard title={t.signedBalance.triadDistribution} subtitle={t.signedBalance.triadDistributionText}>
                {triadShares.map((item) => (
                  <div key={item.triadType} style={{ display: "grid", gap: "0.35rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: "0.7rem", alignItems: "baseline", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "1.1rem" }}>{item.triadType}</strong>
                        <span style={{ color: "#97aabc" }}>{triadDescription(item.triadType)}</span>
                      </div>
                      <div
                        style={{
                          borderRadius: "999px",
                          padding: "0.2rem 0.55rem",
                          background: item.balanced ? "rgba(71, 132, 92, 0.22)" : "rgba(153, 91, 79, 0.24)",
                          color: item.balanced ? "#84d29c" : "#eea38f",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                        }}
                      >
                        {item.balanced ? t.signedBalance.balanced : t.signedBalance.unbalanced}
                      </div>
                    </div>
                    <BarMeter
                      value={item.count}
                      maxValue={triadMax}
                      color={item.balanced
                        ? "linear-gradient(90deg, #3f7e54 0%, #75cb90 100%)"
                        : "linear-gradient(90deg, #7d4b43 0%, #db8777 100%)"}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", color: "#91a3b6" }}>
                      <span>{item.count.toLocaleString()} {t.signedBalance.triads}</span>
                      <span>{percent(item.share)}</span>
                    </div>
                  </div>
                ))}
              </SectionCard>

              <SectionCard title={t.signedBalance.edgePipelineChart} subtitle={t.signedBalance.edgePipelineChartText}>
                {graphPipeline.map((item) => (
                  <div key={item.label} style={{ display: "grid", gap: "0.35rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", color: "#a4b6c8" }}>
                      <span>{item.label}</span>
                      <strong style={{ color: "#eef2f7" }}>{item.value.toLocaleString()}</strong>
                    </div>
                    <BarMeter value={item.value} maxValue={item.maxValue} color={item.color} />
                  </div>
                ))}
              </SectionCard>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "1rem",
              }}
            >
              <SectionCard title={t.signedBalance.decisions} subtitle={t.signedBalance.decisionsText}>
                <div><strong>{t.signedBalance.graphScope}:</strong> {result.decisions.graphScope}</div>
                <div><strong>{t.signedBalance.edgeProjection}:</strong> {result.decisions.edgeProjection}</div>
                <div><strong>{t.signedBalance.supportMeasure}:</strong> {result.decisions.supportMeasure}</div>
                <div><strong>{t.signedBalance.signRule}:</strong> {result.decisions.signRule}</div>
                <div><strong>{t.signedBalance.tiePolicy}:</strong> {result.decisions.tiePolicy}</div>
                <div><strong>{t.signedBalance.validTriadRule}:</strong> {result.decisions.validTriadRule}</div>
              </SectionCard>

              <SectionCard title={t.signedBalance.researchReading} subtitle={t.signedBalance.researchReadingText}>
                <div style={{ color: "#9db0c4", lineHeight: 1.6 }}>
                  {result.triads.totalAnalyzed > 0
                    ? t.signedBalance.researchInterpretation
                        .replace("{ratio}", percent(result.triads.balancedRatio))
                        .replace("{balanced}", result.triads.balancedCount.toLocaleString())
                        .replace("{unbalanced}", result.triads.unbalancedCount.toLocaleString())
                    : t.signedBalance.researchNoTriads}
                </div>
              </SectionCard>
            </div>

            <SectionCard title={t.signedBalance.instabilityChart} subtitle={t.signedBalance.instabilityChartText}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.8rem" }}>
                {result.topUnbalancedNodes.slice(0, Math.min(request.maxTopNodes, 8)).map((node) => (
                  <div
                    key={node.playerId}
                    style={{
                      borderRadius: "16px",
                      padding: "0.85rem",
                      background: "rgba(9, 14, 20, 0.62)",
                      border: "1px solid rgba(84, 103, 122, 0.18)",
                      display: "grid",
                      gap: "0.55rem",
                    }}
                  >
                    <div style={{ fontWeight: 700, wordBreak: "break-word" }}>{node.label}</div>
                    <div style={{ color: "#8aa0b5", fontSize: "0.84rem" }}>{node.totalTriads.toLocaleString()} {t.signedBalance.localTriads}</div>
                    <div style={{ height: "82px", display: "grid", alignItems: "end" }}>
                      <div
                        style={{
                          width: "100%",
                          height: `${Math.max(10, (node.instabilityScore / topInstabilityMax) * 100)}%`,
                          borderRadius: "14px 14px 6px 6px",
                          background: "linear-gradient(180deg, #f2ba74 0%, #d97d63 100%)",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", color: "#d8c18d" }}>
                      <span>{t.signedBalance.instabilityScore}</span>
                      <strong>{percent(node.instabilityScore)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title={t.signedBalance.topUnbalancedNodes} subtitle={t.signedBalance.topUnbalancedNodesText}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
                  <thead>
                    <tr style={{ color: "#8fa4ba", textAlign: "left" }}>
                      <th style={{ padding: "0.65rem 0.5rem" }}>{t.signedBalance.player}</th>
                      <th style={{ padding: "0.65rem 0.5rem" }}>{t.signedBalance.playerId}</th>
                      <th style={{ padding: "0.65rem 0.5rem" }}>{t.signedBalance.totalTriads}</th>
                      <th style={{ padding: "0.65rem 0.5rem" }}>{t.signedBalance.unbalancedCount}</th>
                      <th style={{ padding: "0.65rem 0.5rem" }}>{t.signedBalance.instabilityScore}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.topUnbalancedNodes.map((node) => (
                      <tr key={node.playerId} style={{ borderTop: "1px solid rgba(79, 96, 115, 0.22)" }}>
                        <td style={{ padding: "0.75rem 0.5rem", fontWeight: 700 }}>{node.label}</td>
                        <td style={{ padding: "0.75rem 0.5rem", color: "#8ca0b5", wordBreak: "break-all" }}>{node.playerId}</td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>{node.totalTriads.toLocaleString()}</td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>{node.unbalancedTriads.toLocaleString()}</td>
                        <td style={{ padding: "0.75rem 0.5rem", color: "#ebc97e" }}>{percent(node.instabilityScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {request.includeClusterSummaries && result.clusterSummaries.length > 0 ? (
              <SectionCard title={t.signedBalance.clusterSummaries} subtitle={t.signedBalance.clusterSummariesText}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                    <thead>
                      <tr style={{ color: "#8fa4ba", textAlign: "left" }}>
                        <th style={{ padding: "0.65rem 0.5rem" }}>{t.signedBalance.clusterId}</th>
                        <th style={{ padding: "0.65rem 0.5rem" }}>{t.signedBalance.clusterSize}</th>
                        <th style={{ padding: "0.65rem 0.5rem" }}>{t.signedBalance.localTriads}</th>
                        <th style={{ padding: "0.65rem 0.5rem" }}>{t.signedBalance.balancedCount}</th>
                        <th style={{ padding: "0.65rem 0.5rem" }}>{t.signedBalance.unbalancedCount}</th>
                        <th style={{ padding: "0.65rem 0.5rem" }}>{t.signedBalance.balancedRatio}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.clusterSummaries.slice(0, 12).map((cluster) => (
                        <tr key={cluster.clusterId} style={{ borderTop: "1px solid rgba(79, 96, 115, 0.22)" }}>
                          <td style={{ padding: "0.75rem 0.5rem", fontWeight: 700 }}>{cluster.clusterId}</td>
                          <td style={{ padding: "0.75rem 0.5rem" }}>{cluster.size.toLocaleString()}</td>
                          <td style={{ padding: "0.75rem 0.5rem" }}>{cluster.localTriads.toLocaleString()}</td>
                          <td style={{ padding: "0.75rem 0.5rem" }}>{cluster.balancedCount.toLocaleString()}</td>
                          <td style={{ padding: "0.75rem 0.5rem" }}>{cluster.unbalancedCount.toLocaleString()}</td>
                          <td style={{ padding: "0.75rem 0.5rem", color: "#9dd6a9" }}>{percent(cluster.balancedRatio)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            ) : null}
          </>
        ) : null}

        <SectionCard title={t.signedBalance.documentationTitle} subtitle={t.signedBalance.documentationIntro}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.85rem",
            }}
          >
            {[
              { title: t.signedBalance.docWhatTitle, text: t.signedBalance.docWhatText },
              { title: t.signedBalance.docBalancedTitle, text: t.signedBalance.docBalancedText },
              { title: t.signedBalance.docUnbalancedTitle, text: t.signedBalance.docUnbalancedText },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  borderRadius: "16px",
                  padding: "0.95rem",
                  background: "rgba(9, 14, 20, 0.62)",
                  border: "1px solid rgba(84, 103, 122, 0.18)",
                  display: "grid",
                  gap: "0.45rem",
                }}
              >
                <div style={{ fontWeight: 700 }}>{item.title}</div>
                <div style={{ color: "#9db0c4", lineHeight: 1.6 }}>{item.text}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gap: "0.8rem" }}>
            <div style={{ fontWeight: 700 }}>{t.signedBalance.parameterGuideTitle}</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "0.85rem",
              }}
            >
              {[
                { title: t.signedBalance.minEdgeSupport, text: `${t.signedBalance.minEdgeSupportHelp} ${t.signedBalance.minEdgeSupportEffect}` },
                { title: t.signedBalance.tiePolicy, text: `${t.signedBalance.tiePolicyHelp} ${t.signedBalance.tiePolicyEffect}` },
                { title: t.signedBalance.maxTopNodes, text: `${t.signedBalance.maxTopNodesHelp} ${t.signedBalance.maxTopNodesEffect}` },
                { title: t.signedBalance.clusterSummaries, text: `${t.signedBalance.clusterSummariesHelp} ${t.signedBalance.clusterSummariesEffect}` },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    borderRadius: "16px",
                    padding: "0.95rem",
                    background: "rgba(9, 14, 20, 0.62)",
                    border: "1px solid rgba(84, 103, 122, 0.18)",
                    display: "grid",
                    gap: "0.45rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    <InfoDot text={item.text} />
                  </div>
                  <div style={{ color: "#9db0c4", lineHeight: 1.6 }}>{item.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ fontWeight: 700 }}>{t.signedBalance.howToReadTitle}</div>
            <div style={{ color: "#9db0c4", lineHeight: 1.7 }}>{t.signedBalance.howToReadText}</div>
            <div style={{ color: "#82acc8", lineHeight: 1.7 }}>{t.signedBalance.documentationImplementationNote}</div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
