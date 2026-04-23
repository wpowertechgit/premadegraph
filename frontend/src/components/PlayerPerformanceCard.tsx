import React, { useEffect, useMemo, useState } from "react";
import "./PlayerPerformanceCard.css";
import { fetchPlayerScores, fetchScoresConfig } from "../pathfinderApi";

type ArtifactKey =
  | "kda"
  | "economy"
  | "map_awareness"
  | "utility"
  | "damage"
  | "tanking"
  | "objectives"
  | "early_game";

type GroupKey = "combat" | "map_control" | "resource_utility";

type ArtifactBenchmark = {
  key: ArtifactKey;
  label: string;
  playerValue: number;
  averageValue: number;
  percentile: number;
};

type ScoreResponse = {
  puuid: string;
  names: string[];
  country: string | null;
  scores: {
    opscore: number;
    feedscore: number;
    detectedRole: string;
    roleConfidence: number;
    matchesProcessed: number;
    computedAt: string | null;
    artifacts: Record<ArtifactKey, number>;
  };
  benchmarks: {
    sampleSize: number;
    opscore: {
      average: number;
      percentile: number;
    };
    feedscore: {
      average: number;
      percentile: number;
    };
    kda: {
      playerAverage: number;
      datasetAverage: number;
      matchesSampled: number;
      datasetSamples: number;
    };
    groups: Record<
      GroupKey,
      {
        percentile: number;
        components: ArtifactBenchmark[];
      }
    >;
  };
};

type ConfigResponse = {
  artifacts: Record<ArtifactKey, string>;
};

const ROLE_COLORS: Record<string, string> = {
  TOP: "#b98952",
  JUNGLE: "#2f9e77",
  MIDDLE: "#2f6df6",
  BOTTOM: "#ef8f21",
  UTILITY: "#a56bb4",
  UNKNOWN: "#6b7280",
};

const IMPACT_GROUPS: Array<{
  key: GroupKey;
  title: string;
  subtitle: string;
}> = [
  {
    key: "combat",
    title: "Combat Impact",
    subtitle: "KDA, damage dealt, and damage absorbed",
  },
  {
    key: "map_control",
    title: "Map Control",
    subtitle: "Vision, objectives, and early pressure",
  },
  {
    key: "resource_utility",
    title: "Resource & Utility",
    subtitle: "Economy, farming value, and team utility",
  },
];

const CIRCUMFERENCE = 2 * Math.PI * 54;

function formatDate(value: string | null) {
  if (!value) {
    return "Not computed";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function scoreColor(value: number) {
  if (value >= 8) return "#23b26d";
  if (value >= 6) return "#78c850";
  if (value >= 5) return "#e6b422";
  if (value >= 3) return "#f28c28";
  return "#d9534f";
}

function ordinalPercentile(value: number) {
  const rounded = Math.round(value);
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;

  let suffix = "th";
  if (mod10 === 1 && mod100 !== 11) suffix = "st";
  else if (mod10 === 2 && mod100 !== 12) suffix = "nd";
  else if (mod10 === 3 && mod100 !== 13) suffix = "rd";

  return `${rounded}${suffix} percentile`;
}

function relativeBand(playerValue: number, averageValue: number, lowerIsBetter = false) {
  const adjustedPlayer = lowerIsBetter ? -playerValue : playerValue;
  const adjustedAverage = lowerIsBetter ? -averageValue : averageValue;
  const denominator = Math.max(Math.abs(adjustedAverage), 0.01);
  const deltaRatio = (adjustedPlayer - adjustedAverage) / denominator;

  if (deltaRatio >= 0.15) return "well above the dataset average";
  if (deltaRatio >= 0.05) return "above the dataset average";
  if (deltaRatio <= -0.15) return "well below the dataset average";
  if (deltaRatio <= -0.05) return "below the dataset average";
  return "around the dataset average";
}

function buildGroupNarrative(group: ScoreResponse["benchmarks"]["groups"][GroupKey], title: string) {
  const sorted = [...group.components].sort(
    (left, right) => Math.abs(right.playerValue - right.averageValue) - Math.abs(left.playerValue - left.averageValue),
  );
  const strongestAbove = sorted.find((entry) => entry.playerValue > entry.averageValue * 1.05);
  const strongestBelow = sorted.find((entry) => entry.playerValue < entry.averageValue * 0.95);
  const stance = relativeBand(group.percentile, 50);

  if (strongestAbove && strongestBelow) {
    return `${title} sits ${stance}; ${strongestAbove.label.toLowerCase()} is a strength, while ${strongestBelow.label.toLowerCase()} trails the field.`;
  }

  if (strongestAbove) {
    return `${title} sits ${stance}, led by ${strongestAbove.label.toLowerCase()}.`;
  }

  if (strongestBelow) {
    return `${title} sits ${stance}, with the biggest drag coming from ${strongestBelow.label.toLowerCase()}.`;
  }

  return `${title} is broadly in line with the dataset average across its component stats.`;
}

function CircularGauge({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent: string;
}) {
  const clamped = Math.max(0, Math.min(10, value));
  const percent = clamped * 10;
  const dashOffset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;

  return (
    <div className="performance-gauge">
      <svg viewBox="0 0 140 140" className="performance-gauge__svg" aria-hidden="true">
        <defs>
          <linearGradient id={`gauge-${label.replace(/\s+/g, "-")}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <circle className="performance-gauge__track" cx="70" cy="70" r="54" />
        <circle
          className="performance-gauge__progress"
          cx="70"
          cy="70"
          r="54"
          stroke={`url(#gauge-${label.replace(/\s+/g, "-")})`}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="performance-gauge__center">
        <div className="performance-gauge__value">{clamped.toFixed(1)}</div>
        <div className="performance-gauge__max">/10</div>
        <div className="performance-gauge__label">{label}</div>
      </div>
    </div>
  );
}

export default function PlayerPerformanceCard({ puuid }: { puuid: string }) {
  const [scoreData, setScoreData] = useState<ScoreResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [scoreResponse, configResponse] = await Promise.all([fetchPlayerScores(puuid), fetchScoresConfig()]);

        if (!cancelled) {
          setScoreData(scoreResponse as ScoreResponse);
          setConfig(configResponse as ConfigResponse);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to fetch performance data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [puuid]);

  const impactCards = useMemo(() => {
    if (!scoreData) {
      return [];
    }

    return IMPACT_GROUPS.map((group) => {
      const benchmark = scoreData.benchmarks.groups[group.key];
      const percentile = benchmark?.percentile ?? 0;

      let headline = ordinalPercentile(percentile);
      let subline = group.subtitle;

      if (group.key === "combat") {
        headline = `Avg KDA ${scoreData.benchmarks.kda.playerAverage.toFixed(2)}`;
        subline = `Dataset avg ${scoreData.benchmarks.kda.datasetAverage.toFixed(2)} across ${scoreData.benchmarks.kda.datasetSamples} player-games`;
      } else if (group.key === "map_control") {
        subline = `${ordinalPercentile(percentile)} for vision, objective work, and early pressure`;
      } else if (group.key === "resource_utility") {
        subline = `${ordinalPercentile(percentile)} for economy and utility output`;
      }

      return {
        ...group,
        benchmark,
        headline,
        subline,
        narrative: buildGroupNarrative(benchmark, group.title),
      };
    });
  }, [scoreData]);

  if (loading) {
    return <div className="player-performance-card is-loading">Loading performance data...</div>;
  }

  if (error || !scoreData) {
    return <div className="player-performance-card is-error">{error || "No performance data available."}</div>;
  }

  const primaryName = scoreData.names[0] || "Unknown player";
  const role = scoreData.scores.detectedRole || "UNKNOWN";
  const roleColor = ROLE_COLORS[role] || ROLE_COLORS.UNKNOWN;
  const feedRisk = Math.max(0, Math.min(10, scoreData.scores.feedscore));
  const feedDisplay = Math.max(0, 10 - feedRisk);
  const averageFeedDisplay = Math.max(0, 10 - scoreData.benchmarks.feedscore.average);

  return (
    <section className="player-performance-card">
      <div className="player-performance-card__header">
        <div>
          <div className="player-performance-card__eyebrow">Player Performance</div>
          <h3>{primaryName}</h3>
          <div className="player-performance-card__meta">
            {scoreData.country ? <span>{scoreData.country}</span> : null}
            <span>{scoreData.scores.matchesProcessed} matches</span>
          </div>
        </div>
        <div className="player-performance-card__role" style={{ ["--role-color" as string]: roleColor }}>
          <span>{role}</span>
          <small>{(scoreData.scores.roleConfidence * 100).toFixed(0)}% role share</small>
        </div>
      </div>

      <div className="player-performance-card__hero">
        <CircularGauge value={scoreData.scores.opscore} label="Opscore" accent={scoreColor(scoreData.scores.opscore)} />
        <div className="player-performance-card__summary">
          <div className="player-performance-card__summary-item">
            <span>Performance Index</span>
            <strong>{Math.round(scoreData.scores.opscore * 10)} / 100</strong>
            <small>
              {ordinalPercentile(scoreData.benchmarks.opscore.percentile)}. Dataset avg {scoreData.benchmarks.opscore.average.toFixed(2)}.
            </small>
          </div>
          <div className="player-performance-card__summary-item">
            <span>Feed Discipline</span>
            <strong style={{ color: scoreColor(feedDisplay) }}>{feedDisplay.toFixed(1)} / 10</strong>
            <small>
              {ordinalPercentile(scoreData.benchmarks.feedscore.percentile)}. Dataset avg {averageFeedDisplay.toFixed(1)} / 10.
            </small>
          </div>
          <div className="player-performance-card__summary-item">
            <span>Feedscore</span>
            <strong>{scoreData.scores.feedscore.toFixed(2)}</strong>
            <small>Lower is better. This score is benchmarked against {scoreData.benchmarks.sampleSize} players.</small>
          </div>
          <p>
            These comparisons are dataset-grounded and role-aware for <strong>{role}</strong>. The percent rings below
            show percentile versus the stored player pool, not share of this player&apos;s own stats.
          </p>
        </div>
      </div>

      <div className="player-performance-card__artifacts">
        <div className="player-performance-card__section-title">Impact Breakdown</div>
        <div className="player-performance-card__context-note">
          Each ring shows where this player lands against the dataset on that impact dimension.
        </div>
        <div className="player-performance-card__artifact-grid">
          {impactCards.map((card) => {
            const percent = Math.max(0, Math.min(100, card.benchmark.percentile));
            const dashOffset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;

            return (
              <div className="player-performance-card__artifact" key={card.key}>
                <div className="player-performance-card__artifact-ring">
                  <svg viewBox="0 0 140 140" aria-hidden="true">
                    <circle className="player-performance-card__artifact-track" cx="70" cy="70" r="54" />
                    <circle
                      className="player-performance-card__artifact-progress"
                      cx="70"
                      cy="70"
                      r="54"
                      stroke={roleColor}
                      strokeDasharray={CIRCUMFERENCE}
                      strokeDashoffset={dashOffset}
                    />
                  </svg>
                  <div className="player-performance-card__artifact-center">
                    <strong>{Math.round(percent)}</strong>
                    <span>%</span>
                  </div>
                </div>
                <div className="player-performance-card__artifact-copy">
                  <div>{card.title}</div>
                  <small>{card.headline}</small>
                  <small>{card.subline}</small>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="player-performance-card__insights">
        <div className="player-performance-card__section-title">What This Means</div>
        <div className="player-performance-card__insight-grid">
          <article className="player-performance-card__insight">
            <h4>Performance Index</h4>
            <p>
              Opscore is the role-adjusted composite score. This player sits{" "}
              {relativeBand(scoreData.scores.opscore, scoreData.benchmarks.opscore.average)} and ranks in the{" "}
              {ordinalPercentile(scoreData.benchmarks.opscore.percentile)}.
            </p>
          </article>

          <article className="player-performance-card__insight">
            <h4>Feed Discipline</h4>
            <p>
              Feed discipline reads deaths against contribution, so lower feedscore is better. This player is{" "}
              {relativeBand(scoreData.scores.feedscore, scoreData.benchmarks.feedscore.average, true)} and sits in the{" "}
              {ordinalPercentile(scoreData.benchmarks.feedscore.percentile)} for survivability versus contribution.
            </p>
          </article>

          {impactCards.map((card) => (
            <article className="player-performance-card__insight" key={card.key}>
              <h4>{card.title}</h4>
              <p>{card.narrative}</p>
              <ul className="player-performance-card__component-list">
                {card.benchmark.components.map((component) => (
                  <li key={component.key}>
                    <strong>{component.label}:</strong> {component.playerValue.toFixed(2)} vs {component.averageValue.toFixed(2)} dataset avg.{" "}
                    {config?.artifacts?.[component.key] || ""}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      <div className="player-performance-card__footer">
        <span>Computed {formatDate(scoreData.scores.computedAt)}</span>
        <span>PUUID: {scoreData.puuid}</span>
      </div>
    </section>
  );
}
