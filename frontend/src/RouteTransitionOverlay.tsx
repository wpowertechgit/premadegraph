import React, { useEffect, useMemo, useRef, useState } from "react";

type TransitionKind = "scarlet-breach" | "ethereal-morph" | "monolith-descent" | "neural-dissolve" | "minimal";

type RouteTransitionOverlayProps = {
  routeKey: string;
  phase: "idle" | "outro" | "intro";
  durationMs: number;
};

type TransitionState = {
  id: number;
  kind: TransitionKind;
};

const WEIGHTED_TRANSITIONS: TransitionKind[] = [
  "ethereal-morph",
  "ethereal-morph",
  "ethereal-morph",
  "neural-dissolve",
  "neural-dissolve",
  "scarlet-breach",
  "scarlet-breach",
  "monolith-descent",
];

function pickWeightedTransition(reducedMotion: boolean) {
  if (reducedMotion) {
    return "minimal";
  }
  return WEIGHTED_TRANSITIONS[Math.floor(Math.random() * WEIGHTED_TRANSITIONS.length)] ?? "ethereal-morph";
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setReducedMotion(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return reducedMotion;
}

export default function RouteTransitionOverlay({
  routeKey,
  phase,
  durationMs,
}: RouteTransitionOverlayProps) {
  const reducedMotion = useReducedMotion();
  const [transitionState, setTransitionState] = useState<TransitionState | null>(null);
  const initialRouteRef = useRef(true);
  const timeoutRef = useRef<number | null>(null);

  const dissolveParticles = useMemo(
    () => Array.from({ length: 32 }).map((_, index) => ({
      left: `${6 + (index % 8) * 11.5}%`,
      top: `${12 + Math.floor(index / 8) * 18}%`,
      delay: `${index * 22}ms`,
    })),
    [],
  );

  useEffect(() => {
    if (phase === "idle") {
      return;
    }

    if (initialRouteRef.current) {
      initialRouteRef.current = false;
      return;
    }

    const nextTransition: TransitionState = {
      id: Date.now(),
      kind: pickWeightedTransition(reducedMotion),
    };
    setTransitionState(nextTransition);

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setTransitionState((current) => (current?.id === nextTransition.id ? null : current));
    }, reducedMotion ? 220 : durationMs);

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [durationMs, phase, reducedMotion, routeKey]);

  if (!transitionState) {
    return null;
  }

  return (
    <div
      className={`route-transition-overlay route-transition-overlay--${transitionState.kind} route-transition-overlay--${phase}`}
      aria-hidden="true"
    >
      <div className="route-transition-overlay__backdrop" />

      {transitionState.kind === "scarlet-breach" ? (
        <div className="route-transition-overlay__scarlet">
          <div className="route-transition-overlay__scarlet-half route-transition-overlay__scarlet-half--left" />
          <div className="route-transition-overlay__scarlet-half route-transition-overlay__scarlet-half--right" />
          <div className="route-transition-overlay__scarlet-line" />
          <div className="route-transition-overlay__scarlet-sparks">
            {Array.from({ length: 14 }).map((_, index) => (
              <span
                key={index}
                className="route-transition-overlay__scarlet-spark"
                style={{
                  left: `${28 + (index % 5) * 10}%`,
                  top: `${22 + Math.floor(index / 5) * 15}%`,
                  animationDelay: `${index * 18}ms`,
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {transitionState.kind === "ethereal-morph" ? (
        <div className="route-transition-overlay__morph">
          <div className="route-transition-overlay__glass-veil" />
          <span className="route-transition-overlay__blob route-transition-overlay__blob--one" />
          <span className="route-transition-overlay__blob route-transition-overlay__blob--two" />
          <span className="route-transition-overlay__blob route-transition-overlay__blob--three" />
        </div>
      ) : null}

      {transitionState.kind === "monolith-descent" ? (
        <div className="route-transition-overlay__monolith">
          <div className="route-transition-overlay__monolith-slab" />
          <div className="route-transition-overlay__shockwave route-transition-overlay__shockwave--one" />
          <div className="route-transition-overlay__shockwave route-transition-overlay__shockwave--two" />
        </div>
      ) : null}

      {transitionState.kind === "neural-dissolve" ? (
        <div className="route-transition-overlay__dissolve">
          <div className="route-transition-overlay__singularity" />
          {dissolveParticles.map((particle, index) => (
            <span
              key={index}
              className="route-transition-overlay__particle"
              style={{
                left: particle.left,
                top: particle.top,
                animationDelay: particle.delay,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
