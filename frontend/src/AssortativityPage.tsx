import React, { useMemo, useState } from "react";
import { runRustAssortativity } from "./pathfinderApi";
import { useI18n } from "./i18n";
import { buttonStyle, inputStyle, pageShellStyle, sectionLabelStyle } from "./theme";
import { runAssortativityMock } from "./assortativityMock";
import type {
  AssortativityMetricResult,
  AssortativityRequest,
  AssortativityResponse,
  AssortativitySample,
} from "./assortativityTypes";

const DEFAULT_REQUEST: AssortativityRequest = {
  minEdgeSupport: 1,
  minPlayerMatchCount: 1,
  strongTieThreshold: 3,
  includeClusterBreakdown: true,
};

const OCHRE = {
  ink: "#f7f0e5",
  muted: "#cfbfa5",
  accent: "#f4b56d",
  accentSoft: "#f8d1a3",
  line: "rgba(244, 210, 168, 0.18)",
  card: "linear-gradient(155deg, rgba(49, 30, 18, 0.94) 0%, rgba(79, 45, 24, 0.88) 48%, rgba(33, 20, 13, 0.96) 100%)",
  soft: "linear-gradient(160deg, rgba(27, 39, 36, 0.78) 0%, rgba(18, 28, 33, 0.86) 100%)",
};

type PageCopy = {
  pageLabel: string;
  pageTitle: string;
  pageDescription: string;
  controls: string;
  datasetMode: string;
  datasetModeHelp: string;
  fullDataset: string;
  mockDataset: string;
  mockModeBadge: string;
  minEdgeSupport: string;
  minEdgeSupportHelp: string;
  minPlayerMatchCount: string;
  minPlayerMatchCountHelp: string;
  strongTieThreshold: string;
  strongTieThresholdHelp: string;
  runAnalysis: string;
  running: string;
  idleHint: string;
  loadFailed: string;
  warnings: string;
  researchQuestion: string;
  researchQuestionText: string;
  methodology: string;
  methodologyText: string;
  globalView: string;
  globalViewText: string;
  chartTitle: string;
  chartText: string;
  axisNegative: string;
  axisZero: string;
  axisPositive: string;
  results: string;
  noResults: string;
  socialPath: string;
  battlePath: string;
  opscore: string;
  feedscore: string;
  eligibleNodes: string;
  candidateEdges: string;
  analyzedEdges: string;
  skippedLowSupport: string;
  skippedMissingMetric: string;
  skippedLowMatchCount: string;
  global: string;
  withinCluster: string;
  crossCluster: string;
  strongTies: string;
  weakTies: string;
  sampleSize: string;
  coefficient: string;
  positive: string;
  negative: string;
  neutral: string;
  undefinedValue: string;
  interpretation: string;
  decisions: string;
  graphModes: string;
  metrics: string;
  graphModeRule: string;
  nodeEligibilityRule: string;
  assortativityFormula: string;
};

const COPY: Record<"en" | "hu", PageCopy> = {
  en: {
    pageLabel: "Assortativity Experiment",
    pageTitle: "Assortativity of player performance metrics",
    pageDescription:
      "This page measures whether connected players show similar or dissimilar `opscore` and `feedscore` values across the live graph. The result is descriptive graph statistics, not a social-causality claim.",
    controls: "Experiment controls",
    datasetMode: "Dataset mode",
    datasetModeHelp: "Switch between the real Rust-backed dataset and a smaller deterministic mock dataset for demos and explanation.",
    fullDataset: "Full dataset",
    mockDataset: "Mock dataset",
    mockModeBadge: "Mock mode is active, so this page is reading from the smaller demo graph rather than the full player network.",
    minEdgeSupport: "Minimum edge support",
    minEdgeSupportHelp:
      "Filter out weak relationships before correlation is measured. Social-path uses ally support, while battle-path uses total match co-occurrence.",
    minPlayerMatchCount: "Minimum player match count",
    minPlayerMatchCountHelp:
      "Require enough match history before a player's metric value is allowed into the analysis.",
    strongTieThreshold: "Strong-tie threshold",
    strongTieThresholdHelp:
      "Split eligible edges into strong and weak ties so the page can compare whether repeated relationships behave differently.",
    runAnalysis: "Run assortativity analysis",
    running: "Running...",
    idleHint:
      "This is a separate experiment page. Adjust the thresholds, then run the backend analysis when you want a fresh readout.",
    loadFailed: "Failed to load assortativity analysis.",
    warnings: "Warnings",
    researchQuestion: "Research question",
    researchQuestionText:
      "Do connected players have positively or negatively correlated `opscore` and `feedscore` values under ally-only versus battle-path graph projections?",
    methodology: "Method summary",
    methodologyText:
      "The backend computes numeric assortativity as Pearson correlation across both endpoint orientations of each eligible undirected edge, which avoids ordering bias in the undirected graph.",
    globalView: "How to read this page",
    globalViewText:
      "Positive coefficients mean connected players tend to have more similar measured values. Negative coefficients mean dissimilar values are more common across connected endpoints. Values close to zero suggest weak or no linear assortative structure.",
    chartTitle: "Pearson coefficient chart",
    chartText:
      "This chart shows the assortativity coefficients on a shared -1 to +1 axis, so the direction and strength of each split can be compared visually before reading the detailed counts.",
    axisNegative: "Negative",
    axisZero: "Zero",
    axisPositive: "Positive",
    results: "Results",
    noResults: "Run the analysis to populate the live assortativity report.",
    socialPath: "Social path",
    battlePath: "Battle path",
    opscore: "Opscore",
    feedscore: "Feedscore",
    eligibleNodes: "Eligible nodes",
    candidateEdges: "Candidate edges",
    analyzedEdges: "Analyzed edges",
    skippedLowSupport: "Skipped for low support",
    skippedMissingMetric: "Skipped for missing metric",
    skippedLowMatchCount: "Skipped for low match count",
    global: "Global",
    withinCluster: "Within cluster",
    crossCluster: "Cross cluster",
    strongTies: "Strong ties",
    weakTies: "Weak ties",
    sampleSize: "Sample size",
    coefficient: "Coefficient",
    positive: "positive assortativity",
    negative: "negative assortativity",
    neutral: "near-neutral assortativity",
    undefinedValue: "undefined",
    interpretation: "Interpretation",
    decisions: "Documented decisions",
    graphModes: "Graph modes",
    metrics: "Metrics",
    graphModeRule: "Graph mode rule",
    nodeEligibilityRule: "Node eligibility rule",
    assortativityFormula: "Assortativity formula",
  },
  hu: {
    pageLabel: "Asszortativitási kísérlet",
    pageTitle: "Játékosmutatók asszortativitása",
    pageDescription:
      "Ez az oldal azt méri, hogy az összekapcsolt játékosok `opscore` és `feedscore` értékei mennyire hasonlóak vagy eltérőek az élő gráfban. Az eredmény leíró gráfstatisztika, nem társas oksági állítás.",
    controls: "Kísérleti vezérlők",
    datasetMode: "Adathalmaz mód",
    datasetModeHelp: "Váltás a valódi Rust-hátterű adathalmaz és egy kisebb determinisztikus mock adathalmaz között demóhoz és magyarázathoz.",
    fullDataset: "Teljes adathalmaz",
    mockDataset: "Mock adathalmaz",
    mockModeBadge: "A mock mód aktív, ezért ez az oldal a kisebb demo gráfot használja a teljes játékoshálózat helyett.",
    minEdgeSupport: "Minimum éltámogatás",
    minEdgeSupportHelp:
      "A korreláció mérése előtt kiszűri a gyenge kapcsolatokat. Social-path esetén ally támogatást, battle-path esetén teljes együtt-előfordulást használ.",
    minPlayerMatchCount: "Minimum játékos meccsszám",
    minPlayerMatchCountHelp:
      "Csak azok a játékosok maradnak bent, akiknél elég meccstörténet áll rendelkezésre ahhoz, hogy a mutatójuk bekerüljön az elemzésbe.",
    strongTieThreshold: "Erős kapcsolat küszöb",
    strongTieThresholdHelp:
      "Az éleket erős és gyenge kapcsolatokra bontja, így külön látható, hogy az ismétlődő kapcsolatok másként viselkednek-e.",
    runAnalysis: "Asszortativitás futtatása",
    running: "Futás...",
    idleHint:
      "Ez egy külön kísérleti oldal. Állítsd be a küszöböket, majd futtasd a háttérelemzést, amikor friss eredményt szeretnél.",
    loadFailed: "Nem sikerült betölteni az asszortativitási elemzést.",
    warnings: "Figyelmeztetések",
    researchQuestion: "Kutatási kérdés",
    researchQuestionText:
      "Az összekapcsolt játékosok `opscore` és `feedscore` értékei pozitív vagy negatív korrelációt mutatnak-e ally-only és battle-path gráfprojekciók mellett?",
    methodology: "Módszertani összegzés",
    methodologyText:
      "A backend a numerikus asszortativitást Pearson-korrelációként számolja az egyes élek mindkét végponti irányításán, így az irányítatlan gráfban nincs sorrendtorzítás.",
    globalView: "Hogyan olvasd ezt az oldalt",
    globalViewText:
      "A pozitív együttható azt jelzi, hogy a kapcsolt játékosok mért értékei inkább hasonlóak. A negatív együttható azt jelzi, hogy inkább eltérő értékek kapcsolódnak össze. A nullához közeli érték gyenge vagy hiányzó lineáris asszortatív szerkezetre utal.",
    chartTitle: "Pearson-együttható diagram",
    chartText:
      "Ez a diagram közös -1 és +1 tengelyen mutatja az asszortativitási együtthatókat, így az egyes bontások iránya és erőssége vizuálisan is összevethető, mielőtt a részletes számokat olvasnád.",
    axisNegative: "Negatív",
    axisZero: "Nulla",
    axisPositive: "Pozitív",
    results: "Eredmények",
    noResults: "Futtasd le az elemzést, hogy feltöltődjön az élő asszortativitási riport.",
    socialPath: "Social path",
    battlePath: "Battle path",
    opscore: "Opscore",
    feedscore: "Feedscore",
    eligibleNodes: "Alkalmas csomópontok",
    candidateEdges: "Jelölt élek",
    analyzedEdges: "Elemzett élek",
    skippedLowSupport: "Gyenge támogatás miatt kihagyva",
    skippedMissingMetric: "Hiányzó mutató miatt kihagyva",
    skippedLowMatchCount: "Kevés meccs miatt kihagyva",
    global: "Globális",
    withinCluster: "Klaszteren belül",
    crossCluster: "Klaszterek között",
    strongTies: "Erős kapcsolatok",
    weakTies: "Gyenge kapcsolatok",
    sampleSize: "Mintanagyság",
    coefficient: "Együttható",
    positive: "pozitív asszortativitás",
    negative: "negatív asszortativitás",
    neutral: "közel semleges asszortativitás",
    undefinedValue: "nem definiált",
    interpretation: "Értelmezés",
    decisions: "Dokumentált döntések",
    graphModes: "Gráfmódok",
    metrics: "Mutatók",
    graphModeRule: "Gráfmód szabály",
    nodeEligibilityRule: "Csomópont jogosultsági szabály",
    assortativityFormula: "Asszortativitási képlet",
  },
};

function shellStyle(): React.CSSProperties {
  return {
    ...pageShellStyle(),
    color: OCHRE.ink,
    background: `
      radial-gradient(circle at 12% 14%, rgba(244, 181, 109, 0.16) 0%, rgba(244, 181, 109, 0) 32%),
      radial-gradient(circle at 88% 12%, rgba(72, 180, 169, 0.14) 0%, rgba(72, 180, 169, 0) 28%),
      linear-gradient(180deg, rgba(14, 11, 8, 0.98) 0%, rgba(19, 14, 10, 0.98) 100%)
    `,
  };
}

function panelStyle(): React.CSSProperties {
  return {
    borderRadius: "28px",
    border: `1px solid ${OCHRE.line}`,
    background: OCHRE.card,
    boxShadow: "0 28px 70px rgba(0, 0, 0, 0.28)",
  };
}

function softCardStyle(): React.CSSProperties {
  return {
    borderRadius: "22px",
    border: `1px solid ${OCHRE.line}`,
    background: OCHRE.soft,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  };
}

function infoLabelStyle(): React.CSSProperties {
  return {
    ...sectionLabelStyle(),
    color: OCHRE.muted,
  };
}

function formatCoefficient(value: number | null, language: "en" | "hu", fallback: string) {
  if (value === null || Number.isNaN(value)) {
    return fallback;
  }
  return value.toLocaleString(language === "hu" ? "hu-HU" : "en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function metricTone(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "#bfa58a";
  }
  if (value > 0.1) {
    return "#6fd6c4";
  }
  if (value < -0.1) {
    return "#f09a77";
  }
  return "#f0ca81";
}

function coefficientLabel(value: number | null, copy: PageCopy) {
  if (value === null || Number.isNaN(value)) {
    return copy.undefinedValue;
  }
  if (value > 0.1) {
    return copy.positive;
  }
  if (value < -0.1) {
    return copy.negative;
  }
  return copy.neutral;
}

function graphModeLabel(graphMode: AssortativityMetricResult["graphMode"], copy: PageCopy) {
  return graphMode === "social-path" ? copy.socialPath : copy.battlePath;
}

function metricLabel(metric: AssortativityMetricResult["metric"], copy: PageCopy) {
  return metric === "opscore" ? copy.opscore : copy.feedscore;
}

function sampleForKey(
  result: AssortativityMetricResult,
  key: "global" | "withinCluster" | "crossCluster" | "strongTies" | "weakTies",
) {
  return result[key];
}

function DivergingBar({
  value,
  color,
}: {
  value: number | null;
  color: string;
}) {
  const width = value === null ? 0 : Math.min(50, Math.abs(value) * 50);
  const left = value !== null && value < 0 ? 50 - width : 50;

  return (
    <div
      style={{
        position: "relative",
        height: "12px",
        borderRadius: "999px",
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "0 auto 0 50%",
          width: "1px",
          background: "rgba(255,255,255,0.26)",
          transform: "translateX(-0.5px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "0",
          bottom: "0",
          left: `${left}%`,
          width: `${width}%`,
          borderRadius: "999px",
          background: color,
        }}
      />
    </div>
  );
}

function CoefficientChart({
  results,
  language,
  copy,
}: {
  results: AssortativityMetricResult[];
  language: "en" | "hu";
  copy: PageCopy;
}) {
  const opscore = results.find((item) => item.metric === "opscore") ?? null;
  const feedscore = results.find((item) => item.metric === "feedscore") ?? null;
  const rows = [
    { key: "global", label: copy.global },
    { key: "withinCluster", label: copy.withinCluster },
    { key: "crossCluster", label: copy.crossCluster },
    { key: "strongTies", label: copy.strongTies },
    { key: "weakTies", label: copy.weakTies },
  ] as const;

  return (
    <section
      style={{
        ...panelStyle(),
        padding: "1.1rem",
        display: "grid",
        gap: "0.9rem",
      }}
    >
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <div style={infoLabelStyle()}>{copy.chartTitle}</div>
        <div style={{ color: OCHRE.muted, lineHeight: 1.6 }}>{copy.chartText}</div>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", color: OCHRE.muted, fontSize: "0.84rem" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
          <span style={{ width: "0.85rem", height: "0.85rem", borderRadius: "999px", background: "#6fd6c4", display: "inline-block" }} />
          {copy.opscore}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
          <span style={{ width: "0.85rem", height: "0.85rem", borderRadius: "999px", background: "#f4b56d", display: "inline-block" }} />
          {copy.feedscore}
        </span>
      </div>

      <div style={{ display: "grid", gap: "0.55rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 180px) minmax(260px, 1fr)",
            gap: "0.8rem",
            color: OCHRE.muted,
            fontSize: "0.8rem",
          }}
        >
          <div />
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ textAlign: "left" }}>{copy.axisNegative}</span>
            <span>{copy.axisZero}</span>
            <span style={{ textAlign: "right" }}>{copy.axisPositive}</span>
          </div>
        </div>

        {rows.map((row) => {
          const opscoreSample = opscore ? sampleForKey(opscore, row.key) : null;
          const feedscoreSample = feedscore ? sampleForKey(feedscore, row.key) : null;

          return (
            <div
              key={row.key}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 180px) minmax(260px, 1fr)",
                gap: "0.8rem",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700 }}>{row.label}</div>
              <div style={{ display: "grid", gap: "0.35rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem", alignItems: "center" }}>
                  <DivergingBar value={opscoreSample?.coefficient ?? null} color="linear-gradient(90deg, rgba(68, 186, 171, 0.9) 0%, rgba(111, 214, 196, 1) 100%)" />
                  <span style={{ color: "#89ddd0", fontSize: "0.82rem", minWidth: "3.2rem", textAlign: "right" }}>
                    {formatCoefficient(opscoreSample?.coefficient ?? null, language, copy.undefinedValue)}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem", alignItems: "center" }}>
                  <DivergingBar value={feedscoreSample?.coefficient ?? null} color="linear-gradient(90deg, rgba(220, 151, 83, 0.88) 0%, rgba(244, 181, 109, 1) 100%)" />
                  <span style={{ color: OCHRE.accentSoft, fontSize: "0.82rem", minWidth: "3.2rem", textAlign: "right" }}>
                    {formatCoefficient(feedscoreSample?.coefficient ?? null, language, copy.undefinedValue)}
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

function SampleChip({
  label,
  sample,
  language,
  copy,
}: {
  label: string;
  sample: AssortativitySample;
  language: "en" | "hu";
  copy: PageCopy;
}) {
  const tone = metricTone(sample.coefficient);
  const width = sample.coefficient === null ? 0 : Math.min(100, Math.abs(sample.coefficient) * 100);

  return (
    <div
      style={{
        ...softCardStyle(),
        padding: "0.85rem",
        display: "grid",
        gap: "0.45rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
        <strong>{label}</strong>
        <span style={{ color: OCHRE.muted, fontSize: "0.82rem" }}>
          {copy.sampleSize}: {sample.sampleSize.toLocaleString(language === "hu" ? "hu-HU" : "en-US")}
        </span>
      </div>
      <div style={{ fontSize: "1.2rem", fontWeight: 800, color: tone }}>
        {formatCoefficient(sample.coefficient, language, copy.undefinedValue)}
      </div>
      <div style={{ color: OCHRE.muted, fontSize: "0.82rem" }}>
        {coefficientLabel(sample.coefficient, copy)}
      </div>
      <div style={{ height: "10px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div
          style={{
            width: `${width}%`,
            height: "100%",
            borderRadius: "999px",
            background: `linear-gradient(90deg, ${tone} 0%, rgba(255,255,255,0.92) 100%)`,
          }}
        />
      </div>
    </div>
  );
}

function ResultCard({
  result,
  language,
  copy,
}: {
  result: AssortativityMetricResult;
  language: "en" | "hu";
  copy: PageCopy;
}) {
  return (
    <section
      style={{
        ...panelStyle(),
        padding: "1.15rem",
        display: "grid",
        gap: "0.95rem",
      }}
    >
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <div style={infoLabelStyle()}>{graphModeLabel(result.graphMode, copy)}</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: "1.35rem" }}>{metricLabel(result.metric, copy)}</h3>
          <div style={{ color: metricTone(result.global.coefficient), fontWeight: 700 }}>
            {copy.coefficient}: {formatCoefficient(result.global.coefficient, language, copy.undefinedValue)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
        {[
          [copy.eligibleNodes, result.eligibleNodes],
          [copy.candidateEdges, result.candidateEdges],
          [copy.analyzedEdges, result.analyzedEdges],
          [copy.skippedLowSupport, result.skippedLowEdgeSupportEdges],
          [copy.skippedMissingMetric, result.skippedMissingMetricEdges],
          [copy.skippedLowMatchCount, result.skippedLowMatchCountEdges],
        ].map(([label, value]) => (
          <div key={label} style={{ ...softCardStyle(), padding: "0.8rem", display: "grid", gap: "0.25rem" }}>
            <div style={infoLabelStyle()}>{label}</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>
              {Number(value).toLocaleString(language === "hu" ? "hu-HU" : "en-US")}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.75rem" }}>
        <SampleChip label={copy.global} sample={result.global} language={language} copy={copy} />
        <SampleChip label={copy.withinCluster} sample={result.withinCluster} language={language} copy={copy} />
        <SampleChip label={copy.crossCluster} sample={result.crossCluster} language={language} copy={copy} />
        <SampleChip label={copy.strongTies} sample={result.strongTies} language={language} copy={copy} />
        <SampleChip label={copy.weakTies} sample={result.weakTies} language={language} copy={copy} />
      </div>
    </section>
  );
}

export default function AssortativityPage() {
  const { language } = useI18n();
  const copy = COPY[language];
  const [datasetMode, setDatasetMode] = useState<"full" | "mock">("full");
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

  const runAnalysis = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    setError(null);
    setHasRun(true);
    try {
      const response = datasetMode === "mock"
        ? await runAssortativityMock(request)
        : await runRustAssortativity(request);
      setResult(response);
    } catch (runError) {
      console.error("Assortativity analysis failed:", runError);
      setError(runError instanceof Error ? runError.message : copy.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={shellStyle()}>
      <div style={{ display: "grid", gap: "1.2rem" }}>
        <section
          style={{
            ...panelStyle(),
            padding: "1.6rem",
            display: "grid",
            gap: "1.1rem",
          }}
        >
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <div style={infoLabelStyle()}>{copy.pageLabel}</div>
            <h1 style={{ margin: 0, fontSize: "clamp(2rem, 3vw, 3.1rem)", lineHeight: 1.02 }}>{copy.pageTitle}</h1>
            <div style={{ color: OCHRE.muted, lineHeight: 1.7, maxWidth: "72rem" }}>{copy.pageDescription}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.9rem" }}>
            {[
              [copy.researchQuestion, copy.researchQuestionText],
              [copy.methodology, copy.methodologyText],
              [copy.globalView, copy.globalViewText],
            ].map(([title, text]) => (
              <div key={title} style={{ ...softCardStyle(), padding: "1rem", display: "grid", gap: "0.45rem" }}>
                <div style={{ fontWeight: 700 }}>{title}</div>
                <div style={{ color: OCHRE.muted, lineHeight: 1.65 }}>{text}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            ...panelStyle(),
            padding: "1.15rem",
            display: "grid",
            gap: "0.9rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={infoLabelStyle()}>{copy.controls}</div>
              <div style={{ color: OCHRE.muted, marginTop: "0.2rem" }}>{copy.idleHint}</div>
            </div>
            <button type="button" onClick={runAnalysis} disabled={loading} style={buttonStyle("primary")}>
              {loading ? copy.running : copy.runAnalysis}
            </button>
          </div>

          <div
            style={{
              ...softCardStyle(),
              padding: "0.95rem",
              display: "grid",
              gap: "0.65rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{copy.datasetMode}</div>
                <div style={{ color: OCHRE.muted, fontSize: "0.84rem", lineHeight: 1.5 }}>{copy.datasetModeHelp}</div>
              </div>
              <div
                style={{
                  borderRadius: "999px",
                  padding: "0.28rem 0.7rem",
                  background: datasetMode === "mock" ? "rgba(120, 198, 183, 0.16)" : "rgba(244, 181, 109, 0.14)",
                  color: datasetMode === "mock" ? "#86d8ca" : OCHRE.accentSoft,
                  fontSize: "0.82rem",
                  fontWeight: 700,
                }}
              >
                {datasetMode === "mock" ? copy.mockModeBadge : copy.fullDataset}
              </div>
            </div>

            <div style={{ display: "inline-flex", gap: "0.55rem", flexWrap: "wrap" }}>
              {[
                { id: "full" as const, label: copy.fullDataset },
                { id: "mock" as const, label: copy.mockDataset },
              ].map((option) => {
                const active = datasetMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDatasetMode(option.id)}
                    style={{
                      ...buttonStyle(active ? "primary" : "secondary"),
                      minWidth: "140px",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem" }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 700 }}>{copy.minEdgeSupport}</span>
              <input
                type="number"
                min={1}
                value={request.minEdgeSupport}
                onChange={(event) =>
                  setRequest((current) => ({
                    ...current,
                    minEdgeSupport: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
                style={inputStyle()}
              />
              <span style={{ color: OCHRE.muted, fontSize: "0.84rem", lineHeight: 1.5 }}>{copy.minEdgeSupportHelp}</span>
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 700 }}>{copy.minPlayerMatchCount}</span>
              <input
                type="number"
                min={1}
                value={request.minPlayerMatchCount}
                onChange={(event) =>
                  setRequest((current) => ({
                    ...current,
                    minPlayerMatchCount: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
                style={inputStyle()}
              />
              <span style={{ color: OCHRE.muted, fontSize: "0.84rem", lineHeight: 1.5 }}>{copy.minPlayerMatchCountHelp}</span>
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 700 }}>{copy.strongTieThreshold}</span>
              <input
                type="number"
                min={1}
                value={request.strongTieThreshold}
                onChange={(event) =>
                  setRequest((current) => ({
                    ...current,
                    strongTieThreshold: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
                style={inputStyle()}
              />
              <span style={{ color: OCHRE.muted, fontSize: "0.84rem", lineHeight: 1.5 }}>{copy.strongTieThresholdHelp}</span>
            </label>
          </div>
        </section>

        {error ? (
          <section style={{ ...panelStyle(), padding: "1rem", color: "#ffb39b" }}>
            {copy.loadFailed} {error}
          </section>
        ) : null}

        {result?.warnings.length ? (
          <section style={{ ...panelStyle(), padding: "1rem", display: "grid", gap: "0.55rem" }}>
            <div style={{ fontWeight: 700 }}>{copy.warnings}</div>
            {result.warnings.map((warning) => (
              <div key={warning} style={{ color: OCHRE.muted, lineHeight: 1.6 }}>
                {warning}
              </div>
            ))}
          </section>
        ) : null}

        <section style={{ display: "grid", gap: "0.95rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", flexWrap: "wrap" }}>
            <div style={infoLabelStyle()}>{copy.results}</div>
            {result ? (
              <div style={{ color: OCHRE.muted }}>
                {result.status}
              </div>
            ) : null}
          </div>

          {!hasRun && !result ? (
            <section style={{ ...panelStyle(), padding: "1.1rem", color: OCHRE.muted }}>{copy.noResults}</section>
          ) : null}

          {(["social-path", "battle-path"] as const).map((graphMode) => {
            const modeResults = groupedResults.get(graphMode) ?? [];
            if (!modeResults.length) {
              return null;
            }

            return (
              <div key={graphMode} style={{ display: "grid", gap: "0.8rem" }}>
                <div style={infoLabelStyle()}>{graphModeLabel(graphMode, copy)}</div>
                <CoefficientChart results={modeResults} language={language} copy={copy} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0.9rem" }}>
                  {modeResults.map((item) => (
                    <ResultCard key={`${item.graphMode}-${item.metric}`} result={item} language={language} copy={copy} />
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {result ? (
          <section
            style={{
              ...panelStyle(),
              padding: "1.1rem",
              display: "grid",
              gap: "0.8rem",
            }}
          >
            <div style={infoLabelStyle()}>{copy.decisions}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.8rem" }}>
              {[
                [copy.graphModes, result.decisions.graphModes.join(", ")],
                [copy.metrics, result.decisions.metrics.join(", ")],
                [copy.graphModeRule, result.decisions.graphModeRule],
                [copy.nodeEligibilityRule, result.decisions.nodeEligibilityRule],
                [copy.assortativityFormula, result.decisions.assortativityFormula],
              ].map(([label, value]) => (
                <div key={label} style={{ ...softCardStyle(), padding: "0.9rem", display: "grid", gap: "0.35rem" }}>
                  <div style={{ fontWeight: 700 }}>{label}</div>
                  <div style={{ color: OCHRE.muted, lineHeight: 1.6 }}>{value}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
