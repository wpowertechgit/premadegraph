import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { InterpretationBanner, MethodologyCard, ParameterGuide, CoefficientBadge } from "./analyticsComponents";
import {
  RECOMMENDED_ASSORTATIVITY_REQUEST,
  RECOMMENDED_SIGNED_BALANCE_REQUEST,
  explainAssortativityFinding,
  explainBalanceFinding,
  findAssortativityMetric,
  formatCoefficient,
  formatSignedPercent,
  loadPersistedAssortativity,
  loadPersistedSignedBalance,
  persistAssortativityRun,
  persistSignedBalanceRun,
} from "./analyticsState";
import { runAssortativityMock } from "./assortativityMock";
import { runRustAssortativity, runRustSignedBalance } from "./pathfinderApi";
import { runSignedBalanceMock } from "./signedBalanceMock";
import { buttonStyle, pageShellStyle, sectionLabelStyle } from "./theme";
import type { AssortativityResponse } from "./assortativityTypes";
import type { SignedBalanceResponse } from "./signedBalanceTypes";

const COLORS = {
  ink: "#f7f2e8",
  muted: "#c8bea8",
  panel: "linear-gradient(160deg, rgba(30, 22, 15, 0.94) 0%, rgba(18, 15, 11, 0.98) 100%)",
  border: "rgba(240, 198, 132, 0.18)",
  hero:
    "radial-gradient(circle at 18% 10%, rgba(127, 210, 195, 0.14) 0%, rgba(127, 210, 195, 0) 28%), radial-gradient(circle at 82% 18%, rgba(239, 155, 125, 0.14) 0%, rgba(239, 155, 125, 0) 26%), linear-gradient(180deg, rgba(10, 10, 11, 0.98) 0%, rgba(16, 14, 12, 0.98) 100%)",
};

function panelStyle(): React.CSSProperties {
  return {
    borderRadius: "28px",
    border: `1px solid ${COLORS.border}`,
    background: COLORS.panel,
    boxShadow: "0 30px 80px rgba(0, 0, 0, 0.28)",
  };
}

function bestAssortativityMetric(response: AssortativityResponse | null) {
  if (!response) {
    return null;
  }
  const socialOps = findAssortativityMetric(response, "social-path", "opscore");
  return socialOps ?? response.results.find((item) => item.global.coefficient !== null) ?? response.results[0] ?? null;
}

function combinedNarrative(balance: SignedBalanceResponse | null, assortativity: AssortativityResponse | null) {
  const ratio = balance?.triads.balancedRatio ?? null;
  const featured = bestAssortativityMetric(assortativity)?.global.coefficient ?? null;

  if (ratio !== null && ratio > 0.65 && featured !== null && featured > 0.2) {
    return "This network shows both structural coherence and performance clustering. Together, that supports a thesis reading of intentional, skill-aware team formation.";
  }
  if (ratio !== null && ratio > 0.65 && (featured === null || featured <= 0.2 && featured >= -0.2)) {
    return "Local relationship patterns look coherent, but performance similarity is weak. Teams appear structurally stable without being strongly sorted by the chosen metric.";
  }
  if (ratio !== null && ratio < 0.4 && featured !== null && featured > 0.2) {
    return "Players still cluster by performance, but the local signed structure is contradictory. Similar skill does not automatically produce coherent ally-enemy triads.";
  }
  if (ratio !== null && ratio < 0.4 && featured !== null && featured < -0.2) {
    return "Neither experiment points toward a clean, stable structure. The graph looks locally tense and performance-sorted in opposite directions.";
  }
  return "These experiments answer different questions: signed balance reads local coherence, while assortativity reads performance similarity across edges.";
}

export default function DualAnalyticsView() {
  const [signedBalance, setSignedBalance] = useState<SignedBalanceResponse | null>(null);
  const [assortativity, setAssortativity] = useState<AssortativityResponse | null>(null);
  const [datasetMode, setDatasetMode] = useState<"full" | "mock">("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const signed = loadPersistedSignedBalance();
    const assort = loadPersistedAssortativity();
    setSignedBalance(signed?.result ?? null);
    setAssortativity(assort?.result ?? null);
    setDatasetMode(signed?.datasetMode ?? assort?.datasetMode ?? "mock");
  }, []);

  const featuredAssortativity = useMemo(() => bestAssortativityMetric(assortativity), [assortativity]);
  const narrative = useMemo(() => combinedNarrative(signedBalance, assortativity), [assortativity, signedBalance]);

  const runBoth = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextSignedBalance, nextAssortativity] = await Promise.all([
        datasetMode === "mock"
          ? runSignedBalanceMock(RECOMMENDED_SIGNED_BALANCE_REQUEST)
          : runRustSignedBalance(RECOMMENDED_SIGNED_BALANCE_REQUEST),
        datasetMode === "mock"
          ? runAssortativityMock(RECOMMENDED_ASSORTATIVITY_REQUEST)
          : runRustAssortativity(RECOMMENDED_ASSORTATIVITY_REQUEST),
      ]);

      setSignedBalance(nextSignedBalance);
      setAssortativity(nextAssortativity);
      persistSignedBalanceRun(RECOMMENDED_SIGNED_BALANCE_REQUEST, nextSignedBalance, datasetMode);
      persistAssortativityRun(RECOMMENDED_ASSORTATIVITY_REQUEST, nextAssortativity, datasetMode);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to run the combined analytics set.");
    } finally {
      setLoading(false);
    }
  };

  const parameterItems = [
    {
      key: "signed-min-support",
      label: "Signed balance edge support",
      explanation: `Minimum edge support = ${RECOMMENDED_SIGNED_BALANCE_REQUEST.minEdgeSupport}.`,
      impact: "This keeps the signed projection strict enough to reduce one-off noise.",
    },
    {
      key: "signed-tie-policy",
      label: "Signed balance tie policy",
      explanation: `Tie policy = ${RECOMMENDED_SIGNED_BALANCE_REQUEST.tiePolicy}.`,
      impact: "Equal ally-enemy evidence is excluded so the sign assignment stays conservative.",
    },
    {
      key: "assort-min-match",
      label: "Assortativity minimum match count",
      explanation: `Minimum player match count = ${RECOMMENDED_ASSORTATIVITY_REQUEST.minPlayerMatchCount}.`,
      impact: "This limits how much very small histories can distort endpoint metrics.",
    },
    {
      key: "assort-strong-tie",
      label: "Assortativity strong-tie threshold",
      explanation: `Strong-tie threshold = ${RECOMMENDED_ASSORTATIVITY_REQUEST.strongTieThreshold}.`,
      impact: "Breakdowns can test whether repeated partnerships are more sorted than weak ties.",
    },
  ];

  const matrixCells = [
    {
      title: "High Balance + High Assortativity",
      description: "Stable, skill-intentional network.",
      active: (signedBalance?.triads.balancedRatio ?? 0) > 0.65 && (featuredAssortativity?.global.coefficient ?? 0) > 0.2,
    },
    {
      title: "High Balance + Low or Neutral Assortativity",
      description: "Coherent social structure without strong performance sorting.",
      active: (signedBalance?.triads.balancedRatio ?? 0) > 0.65 && ((featuredAssortativity?.global.coefficient ?? 0) <= 0.2),
    },
    {
      title: "Low Balance + High Assortativity",
      description: "Skill similarity exists even though local signed patterns contradict one another.",
      active: (signedBalance?.triads.balancedRatio ?? 1) < 0.4 && (featuredAssortativity?.global.coefficient ?? 0) > 0.2,
    },
    {
      title: "Low Balance + Low or Neutral Assortativity",
      description: "Little evidence of coherent structure on either dimension.",
      active: (signedBalance?.triads.balancedRatio ?? 1) < 0.4 && ((featuredAssortativity?.global.coefficient ?? 1) <= 0.2),
    },
  ];

  return (
    <div style={{ ...pageShellStyle(), color: COLORS.ink, background: COLORS.hero }}>
      <div style={{ display: "grid", gap: "1rem" }}>
        <section style={{ ...panelStyle(), padding: "1.5rem", display: "grid", gap: "0.9rem" }}>
          <div style={{ ...sectionLabelStyle(), color: COLORS.muted }}>combined analytics</div>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3.4rem)", lineHeight: 0.98, maxWidth: "14ch" }}>
            Signed balance and assortativity together
          </h1>
          <p style={{ margin: 0, color: COLORS.muted, lineHeight: 1.7, maxWidth: "68rem" }}>
            This view combines the local coherence question from signed balance with the skill-similarity question from assortativity so thesis reviewers can read both findings in one narrative frame.
          </p>
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={() => setDatasetMode("mock")} style={buttonStyle(datasetMode === "mock" ? "primary" : "secondary")}>Mock mode</button>
            <button type="button" onClick={() => setDatasetMode("full")} style={buttonStyle(datasetMode === "full" ? "primary" : "secondary")}>Full dataset</button>
            <button type="button" onClick={() => void runBoth()} disabled={loading} style={buttonStyle("primary")}>
              {loading ? "Running both..." : "Run both with recommended params"}
            </button>
          </div>
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
            <Link to="/signed-balance" style={{ textDecoration: "none" }}><span style={{ ...buttonStyle("ghost"), display: "inline-flex", alignItems: "center" }}>Signed Balance Page</span></Link>
            <Link to="/assortativity" style={{ textDecoration: "none" }}><span style={{ ...buttonStyle("ghost"), display: "inline-flex", alignItems: "center" }}>Assortativity Page</span></Link>
          </div>
        </section>

        {error ? <section style={{ ...panelStyle(), padding: "1rem", color: "#ffb39b" }}>{error}</section> : null}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          <div style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.55rem" }}>
            <div style={{ ...sectionLabelStyle(), color: COLORS.muted }}>executive summary</div>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Signed balance</h2>
            <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>{signedBalance ? formatSignedPercent(signedBalance.triads.balancedRatio) : "Not run yet"}</div>
            <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>{signedBalance ? explainBalanceFinding(signedBalance.triads.balancedRatio) : "Run the signed-balance experiment or revisit the individual page."}</div>
            {signedBalance ? <CoefficientBadge value={signedBalance.triads.balancedRatio} metric="balance" size="lg" /> : null}
          </div>

          <div style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.55rem" }}>
            <div style={{ ...sectionLabelStyle(), color: COLORS.muted }}>executive summary</div>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Featured assortativity</h2>
            <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>
              {featuredAssortativity ? formatCoefficient(featuredAssortativity.global.coefficient) : "Not run yet"}
            </div>
            <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
              {featuredAssortativity
                ? `${featuredAssortativity.metric} on ${featuredAssortativity.graphMode}: ${explainAssortativityFinding(featuredAssortativity.global.coefficient)}`
                : "Run the assortativity experiment or revisit the individual page."}
            </div>
            {featuredAssortativity ? <CoefficientBadge value={featuredAssortativity.global.coefficient} metric="assortativity" size="lg" /> : null}
          </div>
        </section>

        <InterpretationBanner
          finding={signedBalance && featuredAssortativity
            ? signedBalance.triads.balancedRatio > 0.65 && (featuredAssortativity.global.coefficient ?? 0) > 0.2
              ? "high-balance"
              : signedBalance.triads.balancedRatio < 0.4 || (featuredAssortativity.global.coefficient ?? 0) < -0.2
                ? "low-balance"
                : "neutral"
            : "neutral"}
          title="What this means together"
          description={narrative}
        />

        <section style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.85rem" }}>
          <div style={{ ...sectionLabelStyle(), color: COLORS.muted }}>interpretation matrix</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.85rem" }}>
            {matrixCells.map((cell) => (
              <article
                key={cell.title}
                style={{
                  borderRadius: "20px",
                  border: `1px solid ${cell.active ? "rgba(127, 210, 195, 0.42)" : "rgba(240, 198, 132, 0.18)"}`,
                  background: cell.active ? "rgba(127, 210, 195, 0.10)" : "rgba(10, 12, 16, 0.46)",
                  padding: "1rem",
                  display: "grid",
                  gap: "0.35rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
                  <strong>{cell.title}</strong>
                  {cell.active ? <span style={{ color: "#7fd2c3", fontWeight: 800 }}>Your result</span> : null}
                </div>
                <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>{cell.description}</div>
              </article>
            ))}
          </div>
        </section>

        <ParameterGuide title="Parameters and methodology" parameters={parameterItems} />

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.9rem" }}>
          <MethodologyCard
            title="Signed balance question"
            description="Do ally and enemy relationships form coherent local triads more often than contradictory ones?"
            ruleText={signedBalance?.decisions.validTriadRule ?? "Requires a fully connected signed triad."}
            impact="high"
          />
          <MethodologyCard
            title="Assortativity question"
            description="Do connected players have similar performance values across the chosen metric?"
            ruleText={assortativity?.decisions.assortativityFormula ?? "Pearson correlation across eligible edges."}
            impact="high"
          />
        </section>

        <section style={{ ...panelStyle(), padding: "1.1rem", display: "grid", gap: "0.8rem" }}>
          <div style={{ ...sectionLabelStyle(), color: COLORS.muted }}>next steps</div>
          <div style={{ color: COLORS.muted, lineHeight: 1.7 }}>
            Use the individual pages for deeper inspection, keep this page for the thesis narrative, and add export wiring later once the schema and copy are finalized.
          </div>
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
            <Link to="/signed-balance" style={{ textDecoration: "none" }}><span style={{ ...buttonStyle("secondary"), display: "inline-flex", alignItems: "center" }}>Inspect signed balance</span></Link>
            <Link to="/assortativity" style={{ textDecoration: "none" }}><span style={{ ...buttonStyle("secondary"), display: "inline-flex", alignItems: "center" }}>Inspect assortativity</span></Link>
            <span style={{ ...buttonStyle("ghost"), display: "inline-flex", alignItems: "center", opacity: 0.7 }}>Export report placeholder</span>
            <button type="button" onClick={() => void runBoth()} disabled={loading} style={buttonStyle("primary")}>
              {loading ? "Running..." : "Run both"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
