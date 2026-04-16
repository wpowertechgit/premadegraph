import React, { useMemo, useState } from "react";
import { runRustSignedBalance } from "./pathfinderApi";
import { useI18n } from "./i18n";
import { runSignedBalanceMock } from "./signedBalanceMock";
import { buttonStyle, inputStyle, pageShellStyle, sectionLabelStyle } from "./theme";
import type {
  SignedBalanceRequest,
  SignedBalanceResponse,
  SignedTiePolicy,
  SignedTriadExample,
  SignedTriadTypeCount,
} from "./signedBalanceTypes";

type TriadPattern = {
  triadType: "+++" | "++-" | "+--" | "---";
  signs: [1 | -1, 1 | -1, 1 | -1];
  balanced: boolean;
  description: string;
  interpretation: string;
};

const DEFAULT_REQUEST: SignedBalanceRequest = {
  minEdgeSupport: 2,
  tiePolicy: "exclude",
  maxTopNodes: 10,
  includeClusterSummaries: true,
};

const AMETHYST = {
  ink: "#f5efff",
  muted: "#c6badf",
  soft: "#a595ca",
  line: "rgba(213, 196, 255, 0.16)",
  lineStrong: "rgba(226, 212, 255, 0.3)",
  paper: "linear-gradient(145deg, rgba(34, 21, 58, 0.96) 0%, rgba(58, 33, 86, 0.92) 48%, rgba(30, 16, 46, 0.94) 100%)",
  paperSoft: "linear-gradient(155deg, rgba(27, 18, 45, 0.72) 0%, rgba(53, 29, 79, 0.62) 58%, rgba(18, 11, 31, 0.78) 100%)",
  shadow: "0 28px 80px rgba(10, 4, 18, 0.45)",
};

function miniLabelStyle() {
  return sectionLabelStyle();
}

function origamiPanelStyle(): React.CSSProperties {
  return {
    borderRadius: "32px",
    border: `1px solid ${AMETHYST.line}`,
    background: AMETHYST.paper,
    boxShadow: AMETHYST.shadow,
    position: "relative",
    overflow: "hidden",
    color: AMETHYST.ink,
  };
}

function foldedPaperStyle(): React.CSSProperties {
  return {
    borderRadius: "24px",
    border: `1px solid ${AMETHYST.line}`,
    background: AMETHYST.paperSoft,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 16px 40px rgba(11, 5, 18, 0.28)",
    clipPath: "polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px))",
  };
}

function dividerThreadStyle(): React.CSSProperties {
  return {
    height: "1px",
    background: "linear-gradient(90deg, rgba(224, 209, 255, 0) 0%, rgba(224, 209, 255, 0.42) 18%, rgba(224, 209, 255, 0.42) 82%, rgba(224, 209, 255, 0) 100%)",
  };
}

function triadDescription(
  triadType: string,
  labels: {
    allPositive: string;
    twoPositive: string;
    onePositive: string;
    allNegative: string;
  },
) {
  if (triadType === "+++") {
    return labels.allPositive;
  }
  if (triadType === "++-") {
    return labels.twoPositive;
  }
  if (triadType === "+--") {
    return labels.onePositive;
  }
  return labels.allNegative;
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
        border: `1px solid ${AMETHYST.lineStrong}`,
        background: "rgba(77, 49, 112, 0.88)",
        color: "#f3e9ff",
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
    <section
      style={{
        ...foldedPaperStyle(),
        padding: "1.15rem 1.2rem",
        display: "grid",
        gap: "0.85rem",
      }}
    >
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        {subtitle ? <div style={{ color: AMETHYST.muted, lineHeight: 1.7 }}>{subtitle}</div> : null}
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

function TriadExampleFigure({
  triadType,
  signs,
}: {
  triadType: string;
  signs: [1 | -1, 1 | -1, 1 | -1];
}) {
  const nodes = {
    a: { x: 44, y: 132, label: "A" },
    b: { x: 100, y: 34, label: "B" },
    c: { x: 156, y: 132, label: "C" },
  };
  const edges = [
    {
      key: "ab",
      sign: signs[0],
      x1: nodes.a.x,
      y1: nodes.a.y,
      x2: nodes.b.x,
      y2: nodes.b.y,
      labelX: 68,
      labelY: 77,
    },
    {
      key: "bc",
      sign: signs[1],
      x1: nodes.b.x,
      y1: nodes.b.y,
      x2: nodes.c.x,
      y2: nodes.c.y,
      labelX: 132,
      labelY: 77,
    },
    {
      key: "ac",
      sign: signs[2],
      x1: nodes.a.x,
      y1: nodes.a.y,
      x2: nodes.c.x,
      y2: nodes.c.y,
      labelX: 100,
      labelY: 142,
    },
  ] as const;

  return (
    <div
      style={{
        borderRadius: "18px",
        padding: "0.9rem",
        background: "radial-gradient(circle at top, rgba(168, 117, 255, 0.2), rgba(24, 14, 38, 0.96))",
        border: `1px solid ${AMETHYST.line}`,
        display: "grid",
        gap: "0.65rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
        <strong style={{ fontSize: "1.15rem" }}>{triadType}</strong>
        <span style={{ color: AMETHYST.soft, fontSize: "0.84rem" }}>A-B-C</span>
      </div>
      <svg viewBox="0 0 200 170" role="img" aria-label={`Signed triad example ${triadType}`} style={{ width: "100%", maxWidth: "220px", justifySelf: "center" }}>
        {edges.map((edge) => {
          const positive = edge.sign > 0;
          return (
            <g key={edge.key}>
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke={positive ? "#6fcb8d" : "#e38a76"}
                strokeWidth={8}
                strokeLinecap="round"
              />
              <text
                x={edge.labelX}
                y={edge.labelY}
                textAnchor="middle"
                fill={positive ? "#c8f4d4" : "#ffd0c2"}
                fontSize="18"
                fontWeight="700"
              >
                {positive ? "+" : "-"}
              </text>
            </g>
          );
        })}
        {Object.values(nodes).map((node) => (
          <g key={node.label}>
            <circle cx={node.x} cy={node.y} r={19} fill="#0f141b" stroke="rgba(186, 207, 228, 0.5)" strokeWidth={2} />
            <text x={node.x} y={node.y + 5} textAnchor="middle" fill="#eef2f7" fontSize="16" fontWeight="700">
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function ObservedTriadFigure({
  example,
}: {
  example: SignedTriadExample;
}) {
  const nodes = [
    { x: 44, y: 132, fallback: "A" },
    { x: 100, y: 34, fallback: "B" },
    { x: 156, y: 132, fallback: "C" },
  ];
  const nodeById = new Map(example.nodes.map((node) => [node.playerId, node] as const));
  const edges = example.edges.map((edge) => {
    const fromIndex = example.nodes.findIndex((node) => node.playerId === edge.from);
    const toIndex = example.nodes.findIndex((node) => node.playerId === edge.to);
    return {
      ...edge,
      fromPoint: nodes[Math.max(0, fromIndex)],
      toPoint: nodes[Math.max(0, toIndex)],
      labelX: ((nodes[Math.max(0, fromIndex)]?.x ?? 0) + (nodes[Math.max(0, toIndex)]?.x ?? 0)) / 2,
      labelY: ((nodes[Math.max(0, fromIndex)]?.y ?? 0) + (nodes[Math.max(0, toIndex)]?.y ?? 0)) / 2 + (edge.from === example.nodes[0]?.playerId && edge.to === example.nodes[2]?.playerId ? 12 : -6),
    };
  });

  return (
    <div
      style={{
        ...foldedPaperStyle(),
        padding: "1rem",
        display: "grid",
        gap: "0.7rem",
        background: "linear-gradient(155deg, rgba(47, 28, 71, 0.78) 0%, rgba(22, 14, 34, 0.82) 100%)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: "1.05rem" }}>{example.triadType}</strong>
        <div
          style={{
            borderRadius: "999px",
            padding: "0.22rem 0.55rem",
            background: example.balanced ? "rgba(71, 132, 92, 0.22)" : "rgba(153, 91, 79, 0.24)",
            color: example.balanced ? "#84d29c" : "#eea38f",
            fontSize: "0.78rem",
            fontWeight: 700,
          }}
        >
          {example.balanced ? "Observed balanced" : "Observed unbalanced"}
        </div>
      </div>
      <svg viewBox="0 0 200 178" role="img" aria-label={`Observed signed triad ${example.triadType}`} style={{ width: "100%", maxWidth: "230px", justifySelf: "center" }}>
        {edges.map((edge) => {
          const positive = edge.sign > 0;
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <line
                x1={edge.fromPoint.x}
                y1={edge.fromPoint.y}
                x2={edge.toPoint.x}
                y2={edge.toPoint.y}
                stroke={positive ? "#6fcb8d" : "#e38a76"}
                strokeWidth={8}
                strokeLinecap="round"
              />
              <text x={edge.labelX} y={edge.labelY} textAnchor="middle" fill={positive ? "#c8f4d4" : "#ffd0c2"} fontSize="17" fontWeight="700">
                {positive ? "+" : "-"}
              </text>
            </g>
          );
        })}
        {example.nodes.map((node, index) => (
          <g key={node.playerId}>
            <circle cx={nodes[index].x} cy={nodes[index].y} r={19} fill="#120d1c" stroke="rgba(223, 207, 255, 0.45)" strokeWidth={2} />
            <text x={nodes[index].x} y={nodes[index].y + 5} textAnchor="middle" fill="#f6f0ff" fontSize="16" fontWeight="700">
              {nodes[index].fallback}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        {example.nodes.map((node, index) => (
          <div key={node.playerId} style={{ color: AMETHYST.muted, fontSize: "0.84rem", lineHeight: 1.45 }}>
            <strong style={{ color: "#f1e8ff" }}>{nodes[index].fallback}</strong> {nodeById.get(node.playerId)?.label ?? node.label}
          </div>
        ))}
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

  const exampleTriads = useMemo(
    () => (Array.isArray(result?.exampleTriads) ? result.exampleTriads : []),
    [result?.exampleTriads],
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

  const triadExamples = useMemo<TriadPattern[]>(
    () => [
      {
        triadType: "+++",
        signs: [1, 1, 1],
        balanced: true,
        description: triadDescription("+++", {
          allPositive: t.signedBalance.triadTypeAllPositive,
          twoPositive: t.signedBalance.triadTypeTwoPositive,
          onePositive: t.signedBalance.triadTypeOnePositive,
          allNegative: t.signedBalance.triadTypeAllNegative,
        }),
        interpretation: t.signedBalance.triadMeaningAllPositive,
      },
      {
        triadType: "++-",
        signs: [1, 1, -1],
        balanced: false,
        description: triadDescription("++-", {
          allPositive: t.signedBalance.triadTypeAllPositive,
          twoPositive: t.signedBalance.triadTypeTwoPositive,
          onePositive: t.signedBalance.triadTypeOnePositive,
          allNegative: t.signedBalance.triadTypeAllNegative,
        }),
        interpretation: t.signedBalance.triadMeaningTwoPositive,
      },
      {
        triadType: "+--",
        signs: [1, -1, -1],
        balanced: true,
        description: triadDescription("+--", {
          allPositive: t.signedBalance.triadTypeAllPositive,
          twoPositive: t.signedBalance.triadTypeTwoPositive,
          onePositive: t.signedBalance.triadTypeOnePositive,
          allNegative: t.signedBalance.triadTypeAllNegative,
        }),
        interpretation: t.signedBalance.triadMeaningOnePositive,
      },
      {
        triadType: "---",
        signs: [-1, -1, -1],
        balanced: false,
        description: triadDescription("---", {
          allPositive: t.signedBalance.triadTypeAllPositive,
          twoPositive: t.signedBalance.triadTypeTwoPositive,
          onePositive: t.signedBalance.triadTypeOnePositive,
          allNegative: t.signedBalance.triadTypeAllNegative,
        }),
        interpretation: t.signedBalance.triadMeaningAllNegative,
      },
    ],
    [t.signedBalance.triadMeaningAllNegative, t.signedBalance.triadMeaningAllPositive, t.signedBalance.triadMeaningOnePositive, t.signedBalance.triadMeaningTwoPositive, t.signedBalance.triadTypeAllNegative, t.signedBalance.triadTypeAllPositive, t.signedBalance.triadTypeOnePositive, t.signedBalance.triadTypeTwoPositive],
  );

  const triadDescriptionLabels = useMemo(
    () => ({
      allPositive: t.signedBalance.triadTypeAllPositive,
      twoPositive: t.signedBalance.triadTypeTwoPositive,
      onePositive: t.signedBalance.triadTypeOnePositive,
      allNegative: t.signedBalance.triadTypeAllNegative,
    }),
    [t.signedBalance.triadTypeAllNegative, t.signedBalance.triadTypeAllPositive, t.signedBalance.triadTypeOnePositive, t.signedBalance.triadTypeTwoPositive],
  );

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
        color: AMETHYST.ink,
        background: `
          radial-gradient(circle at 12% 10%, rgba(152, 112, 226, 0.16) 0%, rgba(152, 112, 226, 0) 30%),
          radial-gradient(circle at 88% 18%, rgba(120, 74, 196, 0.14) 0%, rgba(120, 74, 196, 0) 28%),
          linear-gradient(180deg, rgba(11, 7, 18, 0.98) 0%, rgba(17, 11, 27, 0.98) 100%)
        `,
      }}
    >
      <div style={{ display: "grid", gap: "1.4rem" }}>
        <section
          style={{
            ...origamiPanelStyle(),
            padding: "2rem",
            display: "grid",
            gap: "1.2rem",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "0 auto auto 0",
              width: "320px",
              height: "190px",
              background: "linear-gradient(135deg, rgba(214, 192, 255, 0.16) 0%, rgba(214, 192, 255, 0) 100%)",
              clipPath: "polygon(0 0, 100% 0, 72% 100%, 0 80%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(250px, 0.8fr)",
              gap: "1.4rem",
              position: "relative",
            }}
          >
            <div style={{ display: "grid", gap: "0.7rem" }}>
              <div style={{ ...miniLabelStyle(), color: "#eadcff" }}>{t.signedBalance.pageLabel}</div>
              <div style={{ fontSize: "clamp(2.4rem, 4.8vw, 4.2rem)", fontWeight: 800, lineHeight: 0.95, maxWidth: "10ch" }}>{t.signedBalance.pageTitle}</div>
              <div style={{ color: AMETHYST.muted, maxWidth: "760px", lineHeight: 1.85, fontSize: "1.02rem" }}>{t.signedBalance.pageDescription}</div>
            </div>
          </div>
        </section>

        <section
          style={{
            ...origamiPanelStyle(),
            padding: "1.5rem",
            display: "grid",
            gap: "1rem",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(260px, 0.74fr) minmax(0, 1.26fr)",
              gap: "1.3rem",
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: "0.8rem" }}>
              <div style={{ ...miniLabelStyle(), color: "#dcc7ff" }}>{t.signedBalance.controls}</div>
              <div style={{ fontSize: "1.7rem", fontWeight: 750, lineHeight: 1.05 }}>
                {t.signedBalance.documentationTitle}
              </div>
              <div style={{ color: AMETHYST.muted, lineHeight: 1.75 }}>
                {t.signedBalance.documentationIntro}
              </div>
              <div style={{ display: "grid", gap: "0.7rem" }}>
                <div style={{ ...foldedPaperStyle(), padding: "0.9rem 1rem", display: "grid", gap: "0.3rem" }}>
                  <div style={{ fontWeight: 700 }}>{t.signedBalance.docWhatTitle}</div>
                  <div style={{ color: AMETHYST.muted, lineHeight: 1.6 }}>{t.signedBalance.docWhatText}</div>
                </div>
                <div style={{ ...foldedPaperStyle(), padding: "0.9rem 1rem", display: "grid", gap: "0.3rem" }}>
                  <div style={{ fontWeight: 700 }}>{t.signedBalance.docBalancedTitle}</div>
                  <div style={{ color: AMETHYST.muted, lineHeight: 1.6 }}>{t.signedBalance.docBalancedText}</div>
                </div>
                <div style={{ ...foldedPaperStyle(), padding: "0.9rem 1rem", display: "grid", gap: "0.3rem" }}>
                  <div style={{ fontWeight: 700 }}>{t.signedBalance.howToReadTitle}</div>
                  <div style={{ color: AMETHYST.muted, lineHeight: 1.6 }}>{t.signedBalance.howToReadText}</div>
                </div>
              </div>
              <div
                style={{
                  ...foldedPaperStyle(),
                  padding: "0.95rem 1rem",
                  color: "#e7dbff",
                  background: datasetMode === "mock"
                    ? "linear-gradient(145deg, rgba(88, 56, 129, 0.78) 0%, rgba(46, 26, 70, 0.82) 100%)"
                    : "linear-gradient(145deg, rgba(41, 25, 66, 0.68) 0%, rgba(23, 14, 36, 0.76) 100%)",
                }}
              >
                {datasetMode === "mock" ? t.signedBalance.mockModeBadge : t.signedBalance.readOnly}
              </div>
            </div>

            <div
              style={{
                ...foldedPaperStyle(),
                padding: "1.1rem",
                display: "grid",
                gap: "1rem",
              }}
            >
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
                          background: active
                            ? "linear-gradient(135deg, rgba(233, 220, 255, 0.96) 0%, rgba(190, 151, 255, 0.92) 100%)"
                            : "rgba(39, 23, 63, 0.82)",
                          color: active ? "#1f1232" : "#f3ebff",
                          border: active ? "1px solid rgba(255,255,255,0.4)" : `1px solid ${AMETHYST.lineStrong}`,
                          boxShadow: active ? "0 18px 32px rgba(79, 43, 128, 0.24)" : "none",
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ color: AMETHYST.muted, fontSize: "0.84rem", lineHeight: 1.55 }}>
                  {t.signedBalance.datasetModeHelp}
                </div>
                <div style={{ color: "#dcc8ff", fontSize: "0.84rem", lineHeight: 1.55 }}>
                  {datasetMode === "mock" ? t.signedBalance.mockDatasetActiveEffect : t.signedBalance.datasetModeEffect}
                </div>
              </div>

              <div style={dividerThreadStyle()} />

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
                    style={{ ...inputStyle(), background: "rgba(23, 14, 36, 0.9)", border: `1px solid ${AMETHYST.lineStrong}` }}
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
                    style={{ ...inputStyle(), background: "rgba(23, 14, 36, 0.9)", border: `1px solid ${AMETHYST.lineStrong}` }}
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
                    style={{ ...inputStyle(), background: "rgba(23, 14, 36, 0.9)", border: `1px solid ${AMETHYST.lineStrong}` }}
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
                      background: request.includeClusterSummaries
                        ? "linear-gradient(135deg, rgba(233, 220, 255, 0.96) 0%, rgba(190, 151, 255, 0.92) 100%)"
                        : "rgba(23, 14, 36, 0.82)",
                      color: request.includeClusterSummaries ? "#231337" : "#f3ebff",
                      border: `1px solid ${request.includeClusterSummaries ? "rgba(255,255,255,0.4)" : AMETHYST.lineStrong}`,
                    }}
                  >
                    {request.includeClusterSummaries ? t.common.enabled : t.common.disabled}
                  </button>
                </ControlField>
              </div>

              <div style={dividerThreadStyle()} />

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
                    background: "linear-gradient(135deg, rgba(233, 220, 255, 0.96) 0%, rgba(190, 151, 255, 0.92) 100%)",
                    color: "#1c1130",
                    border: "1px solid rgba(255,255,255,0.4)",
                    boxShadow: "0 18px 36px rgba(91, 51, 146, 0.34)",
                  }}
                >
                  {loading ? t.signedBalance.running : t.signedBalance.runAnalysis}
                </button>
                <div style={{ color: AMETHYST.muted, lineHeight: 1.55 }}>
                  {datasetMode === "mock" ? t.signedBalance.runHintMock : t.signedBalance.runHint}
                </div>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <section style={{ ...foldedPaperStyle(), padding: "1rem 1.1rem", color: "#ffd4cc" }}>{error}</section>
        ) : null}

        {!hasRun && !result && !error ? (
          <section style={{ ...foldedPaperStyle(), padding: "1rem 1.1rem", color: AMETHYST.muted }}>
            {t.signedBalance.waitingToRun}
          </section>
        ) : null}

        {result ? (
          <>
            {result.warnings.length > 0 ? (
              <section style={{ ...foldedPaperStyle(), padding: "1rem 1.1rem", display: "grid", gap: "0.45rem" }}>
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
                <div
                  key={card.label}
                  style={{
                    ...foldedPaperStyle(),
                    padding: "1rem 1.05rem",
                    display: "grid",
                    gap: "0.35rem",
                    background: "linear-gradient(155deg, rgba(63, 39, 95, 0.78) 0%, rgba(28, 16, 43, 0.82) 100%)",
                  }}
                >
                  <div style={{ color: AMETHYST.muted, fontSize: "0.84rem" }}>{card.label}</div>
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
                        <span style={{ color: "#97aabc" }}>{triadDescription(item.triadType, triadDescriptionLabels)}</span>
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

            {exampleTriads.length > 0 ? (
              <SectionCard
                title="Observed Triads From This Run"
                subtitle="These are real balanced and unbalanced triples sampled from the current dataset mode and parameter settings, so the symbols map back to actual player relationships."
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "0.9rem",
                  }}
                >
                  {exampleTriads.map((example) => (
                    <ObservedTriadFigure key={`${example.triadType}-${example.nodes.map((node) => node.playerId).join("|")}`} example={example} />
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {exampleTriads.length === 0 && datasetMode === "full" ? (
              <SectionCard
                title="Observed Triads From This Run"
                subtitle="No sampled real-data triads were returned by the backend for this run. The aggregate analysis is valid, but the live Rust backend needs to be rebuilt and restarted to expose real balanced and unbalanced example triples to the UI."
              >
                <div style={{ color: AMETHYST.muted, lineHeight: 1.7 }}>
                  Mock mode can already render observed examples locally. Full dataset mode needs the newer Rust signed-balance response shape with `exampleTriads` enabled.
                </div>
              </SectionCard>
            ) : null}
          </>
        ) : null}

        <SectionCard title={t.signedBalance.documentationTitle} subtitle={t.signedBalance.documentationIntro}>
          <div style={{ display: "grid", gap: "0.8rem" }}>
            <div style={{ fontWeight: 700 }}>{t.signedBalance.triadExamples}</div>
            <div style={{ color: "#9db0c4", lineHeight: 1.7 }}>{t.signedBalance.triadExamplesText}</div>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", color: "#94aabc", fontSize: "0.88rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
                <span style={{ width: "0.9rem", height: "0.9rem", borderRadius: "999px", background: "#6fcb8d", display: "inline-block" }} />
                {t.signedBalance.triadLegendPositive}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
                <span style={{ width: "0.9rem", height: "0.9rem", borderRadius: "999px", background: "#e38a76", display: "inline-block" }} />
                {t.signedBalance.triadLegendNegative}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "0.9rem",
              }}
            >
              {triadExamples.map((example) => (
                <div
                  key={example.triadType}
                  style={{
                    borderRadius: "18px",
                    padding: "0.95rem",
                    background: "rgba(9, 14, 20, 0.62)",
                    border: "1px solid rgba(84, 103, 122, 0.18)",
                    display: "grid",
                    gap: "0.8rem",
                  }}
                >
                  <TriadExampleFigure triadType={example.triadType} signs={example.signs} />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ color: "#97aabc" }}>{example.description}</div>
                    <div
                      style={{
                        borderRadius: "999px",
                        padding: "0.24rem 0.6rem",
                        background: example.balanced ? "rgba(71, 132, 92, 0.22)" : "rgba(153, 91, 79, 0.24)",
                        color: example.balanced ? "#84d29c" : "#eea38f",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                      }}
                    >
                      {example.balanced ? t.signedBalance.balanced : t.signedBalance.unbalanced}
                    </div>
                  </div>
                  <div style={{ color: "#9db0c4", lineHeight: 1.65 }}>{example.interpretation}</div>
                </div>
              ))}
            </div>
          </div>

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
