import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { Location } from "react-router-dom";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useI18n } from "./i18n";
import AppNavbar from "./AppNavbar";
import GraphSpherePage from "./GraphSpherePage";
import RouteTransitionOverlay from "./RouteTransitionOverlay";

const MatchAnalysisPage = lazy(() => import("./MatchAnalysisForm"));
const GraphPage = lazy(() => import("./GraphPage"));
const SignedBalancePage = lazy(() => import("./SignedBalancePage"));
const AssortativityPage = lazy(() => import("./AssortativityPage"));
const PathfinderLabPage = lazy(() => import("./PathfinderLabPage"));

const TRANSITION_TOTAL_MS = 3000;
const TRANSITION_SWAP_MS = 1500;
const INSTANT_ROUTE_PATHS = new Set(["/graph-sphere"]);

function AppRoutes({ navCollapsed }: { navCollapsed: boolean }) {
  const { t } = useI18n();
  const location = useLocation();
  const [displayedLocation, setDisplayedLocation] = useState<Location>(location);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "outro" | "intro">("idle");
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    if (location.key === displayedLocation.key && location.pathname === displayedLocation.pathname) {
      return;
    }

    const useInstantSwap = INSTANT_ROUTE_PATHS.has(location.pathname) || INSTANT_ROUTE_PATHS.has(displayedLocation.pathname);

    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];

    if (useInstantSwap) {
      setDisplayedLocation(location);
      setTransitionPhase("idle");
      return;
    }

    setTransitionPhase("outro");

    const swapTimeout = window.setTimeout(() => {
      setDisplayedLocation(location);
      setTransitionPhase("intro");
    }, TRANSITION_SWAP_MS);

    const finishTimeout = window.setTimeout(() => {
      setTransitionPhase("idle");
    }, TRANSITION_TOTAL_MS);

    timeoutsRef.current = [swapTimeout, finishTimeout];

    return () => {
      timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutsRef.current = [];
    };
  }, [displayedLocation.key, displayedLocation.pathname, location]);

  return (
    <main className={`app-main${navCollapsed ? " is-collapsed" : ""}`}>
      <div className={`app-route-stage route-phase-${transitionPhase}`}>
        <RouteTransitionOverlay
          routeKey={`${displayedLocation.key || displayedLocation.pathname}:${location.key || location.pathname}`}
          phase={transitionPhase}
          durationMs={TRANSITION_TOTAL_MS}
        />
        <div className={`app-route-content${transitionPhase !== "idle" ? ` is-${transitionPhase}` : ""}`}>
          <Routes location={displayedLocation}>
          <Route path="/" element={<Navigate to="/matchanalysis" replace />} />
          <Route
            path="/matchanalysis"
            element={(
              <Suspense fallback={<div className="app-route-fallback">{t.common.loading}</div>}>
                <MatchAnalysisPage />
              </Suspense>
            )}
          />
          <Route
            path="/graph"
            element={(
              <Suspense fallback={<div className="app-route-fallback">{t.common.loading}</div>}>
                <GraphPage />
              </Suspense>
            )}
          />
          <Route
            path="/graph-sphere"
            element={<GraphSpherePage />}
          />
          <Route
            path="/signed-balance"
            element={(
              <Suspense fallback={<div className="app-route-fallback">{t.common.loading}</div>}>
                <SignedBalancePage />
              </Suspense>
            )}
          />
          <Route
            path="/assortativity"
            element={(
              <Suspense fallback={<div className="app-route-fallback">{t.common.loading}</div>}>
                <AssortativityPage />
              </Suspense>
            )}
          />
          <Route
            path="/pathfinder-lab"
            element={(
              <Suspense fallback={<div className="app-route-fallback">{t.common.loading}</div>}>
                <PathfinderLabPage />
              </Suspense>
            )}
          />
        </Routes>
        </div>
      </div>
    </main>
  );
}

function App() {
  const { t } = useI18n();
  const [navCollapsed, setNavCollapsed] = useState(false);

  React.useEffect(() => {
    document.title = t.app.title;
  }, [t.app.title]);

  const normalizePlayers = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/normalize-players", {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t.app.alerts.normalizationError);
      }

      alert(t.app.alerts.normalizationSuccess);
    } catch (error) {
      console.error("Normalization request failed:", error);
      alert(error instanceof Error ? `${t.app.alerts.errorPrefix}: ${error.message}` : t.app.alerts.normalizationError);
    }
  };

  const generateGraph = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/generate-graph", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(t.app.alerts.graphGenerationFailed);
      }

      alert(`${t.app.alerts.graphGenerated} ${t.app.alerts.refreshGraph}`);
    } catch (error) {
      console.error("Graph generation failed:", error);
      alert(error instanceof Error ? `${t.app.alerts.genericError}: ${error.message}` : t.app.alerts.graphGenerationFailed);
    }
  };

  return (
    <BrowserRouter>
      <div className={`app-shell${navCollapsed ? " is-collapsed" : ""}`}>
        <AppNavbar
          collapsed={navCollapsed}
          onToggleCollapsed={() => setNavCollapsed((current) => !current)}
          onGenerateGraph={generateGraph}
          onNormalizePlayers={normalizePlayers}
        />
        <AppRoutes navCollapsed={navCollapsed} />
      </div>
    </BrowserRouter>
  );
}

export default App;
