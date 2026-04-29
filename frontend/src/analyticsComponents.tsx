import React, { useId, useState } from "react";
import { INTERPRETATION_PALETTE, buttonStyle, sectionLabelStyle } from "./theme";
import {
  classifyAssortativityFinding,
  classifyBalanceFinding,
  coefficientTone,
  explainAssortativityFinding,
  explainBalanceFinding,
  formatCoefficient,
  formatSignedPercent,
} from "./analyticsState";

export type InterpretationFinding =
  | "high-balance"
  | "low-balance"
  | "high-assortativity"
  | "low-assortativity"
  | "neutral";

type ToneKind = "balanced" | "unbalanced" | "neutral";

function toneForFinding(finding: InterpretationFinding): ToneKind {
  if (finding === "high-balance" || finding === "high-assortativity") {
    return "balanced";
  }
  if (finding === "low-balance" || finding === "low-assortativity") {
    return "unbalanced";
  }
  return "neutral";
}

function toneColor(tone: ToneKind) {
  return INTERPRETATION_PALETTE[tone];
}

function softBackground(tone: ToneKind) {
  const color = toneColor(tone);
  return `linear-gradient(135deg, ${color}22 0%, rgba(14, 18, 26, 0.88) 100%)`;
}

function cardStyle(tone: ToneKind): React.CSSProperties {
  return {
    borderRadius: "12px",
    border: `1px solid ${toneColor(tone)}55`,
    background: softBackground(tone),
    boxShadow: "0 4px 16px rgba(0,0,0,0.32)",
  };
}

export interface InterpretationBannerProps {
  finding: InterpretationFinding;
  title?: string;
  description?: string;
  context?: "global" | "within-cluster" | "cross-cluster" | "strong-ties" | "weak-ties";
}

export function InterpretationBanner({
  finding,
  title,
  description,
  context,
}: InterpretationBannerProps) {
  const tone = toneForFinding(finding);
  const defaultTitle = finding === "high-balance"
    ? "Most local patterns are coherent"
    : finding === "low-balance"
      ? "Local patterns contain substantial contradictions"
      : finding === "high-assortativity"
        ? "Connected players tend to have similar performance"
        : finding === "low-assortativity"
          ? "Connected players tend to have dissimilar performance"
          : "Performance largely uncorrelated with connection";

  const defaultDescription = finding === "high-balance"
    ? "Balanced triads dominate, which suggests repeated ally and enemy relations fit together more often than they conflict."
    : finding === "low-balance"
      ? "Unbalanced triads are common, so local ally and enemy patterns frequently pull in contradictory directions."
      : finding === "high-assortativity"
        ? "Performance similarity is visible across connected players, so the graph preserves measurable clustering by player quality."
        : finding === "low-assortativity"
          ? "Connected players often differ on the chosen performance signal, which points to anti-correlated pairing."
          : "This run does not show a strong relationship between connection and the selected performance metric.";

  return (
    <section aria-live="polite" style={{ ...cardStyle(tone), padding: "1rem 1.1rem", display: "grid", gap: "0.45rem" }}>
      <div style={{ ...sectionLabelStyle(), color: toneColor(tone) }}>
        {context ? `${context.replace("-", " ")} interpretation` : "interpretation"}
      </div>
      <h2 style={{ margin: 0, fontSize: "clamp(1.1rem, 2vw, 1.45rem)", color: "#f7f8f8" }}>{title ?? defaultTitle}</h2>
      <p style={{ margin: 0, color: "#d0d6e0", lineHeight: 1.65 }}>{description ?? defaultDescription}</p>
    </section>
  );
}

export interface ParameterGuideProps {
  title?: string;
  parameters: Array<{ key: string; label: string; explanation: string; impact: string }>;
}

export function ParameterGuide({ title = "Parameter guide", parameters }: ParameterGuideProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section style={{ ...cardStyle("neutral"), padding: "1rem", display: "grid", gap: "0.8rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: "0.2rem" }}>
          <div style={{ ...sectionLabelStyle(), color: INTERPRETATION_PALETTE.neutral }}>methodology support</div>
          <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#f7f8f8" }}>{title}</h3>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={panelId}
          style={buttonStyle(open ? "secondary" : "ghost")}
        >
          {open ? "Hide details" : "Show details"}
        </button>
      </div>
      {open ? (
        <div id={panelId} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          {parameters.map((parameter) => (
            <article key={parameter.key} style={{ borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.07)", background: "rgba(9, 13, 18, 0.42)", padding: "0.9rem", display: "grid", gap: "0.35rem" }}>
              <div style={{ fontWeight: 800, color: "#f7f8f8" }}>{parameter.label}</div>
              <div style={{ color: "#d0d6e0", lineHeight: 1.6 }}>{parameter.explanation}</div>
              <div style={{ color: "#f0bb74", lineHeight: 1.55 }}>{parameter.impact}</div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export interface EdgeCategoryLegendProps {
  categories: Array<{ name: string; count: number; sampleSize: number; coefficient?: number | null }>;
}

export function EdgeCategoryLegend({ categories }: EdgeCategoryLegendProps) {
  return (
    <section style={{ ...cardStyle("neutral"), padding: "1rem", display: "grid", gap: "0.8rem" }}>
      <div style={{ ...sectionLabelStyle(), color: INTERPRETATION_PALETTE.neutral }}>category legend</div>
      <div style={{ display: "grid", gap: "0.65rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {categories.map((category) => (
          <article key={category.name} style={{ borderRadius: "8px", padding: "0.9rem", border: "1px solid rgba(255, 255, 255, 0.07)", background: "rgba(11, 15, 22, 0.42)", display: "grid", gap: "0.3rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
              <strong style={{ color: "#f7f8f8" }}>{category.name}</strong>
              {category.coefficient !== undefined ? (
                <CoefficientBadge value={category.coefficient} metric="assortativity" size="sm" />
              ) : null}
            </div>
            <div style={{ color: "#d0d6e0", lineHeight: 1.55 }}>
              {category.name === "Within cluster" && "Endpoints belong to the same discovered cluster."}
              {category.name === "Cross cluster" && "Endpoints connect across cluster boundaries."}
              {category.name === "Strong ties" && "Edges meet or exceed the repeated co-play threshold."}
              {category.name === "Weak ties" && "Edges pass the minimum filter but stay below the strong-tie threshold."}
            </div>
            <div style={{ color: "#8a8f98", fontSize: "0.92rem" }}>
              {category.count.toLocaleString()} edges, {category.sampleSize.toLocaleString()} sampled pairs
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export interface MethodologyCardProps {
  title: string;
  description: string;
  ruleText: string;
  impact: "high" | "medium" | "low";
}

export function MethodologyCard({ title, description, ruleText, impact }: MethodologyCardProps) {
  const tone: ToneKind = impact === "high" ? "unbalanced" : impact === "medium" ? "neutral" : "balanced";
  return (
    <article style={{ ...cardStyle(tone), padding: "1rem", display: "grid", gap: "0.35rem", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <strong style={{ color: "#f7f8f8" }}>{title}</strong>
        <span style={{ color: toneColor(tone), fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {impact} impact
        </span>
      </div>
      <div style={{ color: "#d0d6e0", lineHeight: 1.6 }}>{description}</div>
      <div style={{ color: toneColor(tone), lineHeight: 1.55 }}>{ruleText}</div>
    </article>
  );
}

export interface CoefficientBadgeProps {
  value: number | null;
  metric: "balance" | "assortativity";
  size?: "sm" | "md" | "lg";
}

export function CoefficientBadge({ value, metric, size = "md" }: CoefficientBadgeProps) {
  const tone = metric === "balance"
    ? toneForFinding(classifyBalanceFinding(value))
    : coefficientTone(value);
  const padding = size === "sm" ? "0.18rem 0.45rem" : size === "lg" ? "0.35rem 0.7rem" : "0.24rem 0.55rem";
  const fontSize = size === "sm" ? "0.75rem" : size === "lg" ? "0.95rem" : "0.82rem";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "999px",
        padding,
        fontSize,
        fontWeight: 800,
        color: toneColor(tone),
        background: `${toneColor(tone)}20`,
        border: `1px solid ${toneColor(tone)}55`,
        whiteSpace: "nowrap",
      }}
    >
      {metric === "balance" ? formatSignedPercent(value ?? 0) : formatCoefficient(value)}
    </span>
  );
}

export function buildBalanceBanner(balanceRatio: number | null | undefined) {
  return {
    finding: classifyBalanceFinding(balanceRatio),
    title: explainBalanceFinding(balanceRatio),
  };
}

export function buildAssortativityBanner(value: number | null | undefined) {
  return {
    finding: classifyAssortativityFinding(value),
    title: explainAssortativityFinding(value),
  };
}
