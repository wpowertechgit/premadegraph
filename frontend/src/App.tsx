import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { Location } from "react-router-dom";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Alert, Snackbar } from "@mui/material";
import { useI18n } from "./i18n";
import AppNavbar from "./AppNavbar";
import GraphSpherePage from "./GraphSpherePage";
import RouteTransitionOverlay from "./RouteTransitionOverlay";

const MatchAnalysisPage = lazy(() => import("./MatchAnalysisForm"));
const GraphPage = lazy(() => import("./GraphPage"));
const SignedBalancePage = lazy(() => import("./SignedBalancePage"));
const AssortativityPage = lazy(() => import("./AssortativityPage"));
const PathfinderLabPage = lazy(() => import("./PathfinderLabPage"));

const TRANSITION_TOTAL_MS = 320;
const TRANSITION_SWAP_MS = 160;
const INSTANT_ROUTE_PATHS = new Set(["/graph-sphere"]);

type FeedbackState = {
  message: string;
  severity: "success" | "error" | "info";
};

export type DatasetRecord = {
  id: string;
  name: string;
  description: string;
  matchCount: number;
  refinedPlayerCount: number;
};

export type RuntimeKeyRecord = {
  keyName: "RIOT_API_KEY" | "OPENROUTER_API_KEY";
  isSet: boolean;
  maskedPreview: string | null;
  storage: string;
};

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
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1200px)").matches : false,
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [currentDatasetId, setCurrentDatasetId] = useState<string | null>(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [runtimeKeys, setRuntimeKeys] = useState<RuntimeKeyRecord[]>([]);
  const [runtimeKeysLoading, setRuntimeKeysLoading] = useState(false);

  React.useEffect(() => {
    document.title = t.app.title;
  }, [t.app.title]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1200px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches);
      if (!event.matches) {
        setMobileNavOpen(false);
      }
    };

    setIsMobileLayout(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isMobileLayout) {
      return;
    }

    setMobileNavOpen(false);
  }, [isMobileLayout]);

  const showFeedback = (message: string, severity: FeedbackState["severity"]) => {
    setFeedback({ message, severity });
  };

  const refreshDatasets = async () => {
    setDatasetLoading(true);
    try {
      const response = await fetch("http://localhost:3001/api/datasets");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load datasets.");
      }
      setDatasets(Array.isArray(payload.datasets) ? payload.datasets : []);
      setCurrentDatasetId(payload.current || null);
    } finally {
      setDatasetLoading(false);
    }
  };

  const refreshRuntimeKeys = async () => {
    setRuntimeKeysLoading(true);
    try {
      const response = await fetch("http://localhost:3001/api/runtime-keys");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load runtime key metadata.");
      }
      setRuntimeKeys(Array.isArray(payload.keys) ? payload.keys : []);
    } finally {
      setRuntimeKeysLoading(false);
    }
  };

  useEffect(() => {
    void refreshDatasets().catch((error) => {
      console.error("Dataset load failed:", error);
      showFeedback(error instanceof Error ? error.message : "Failed to load datasets.", "error");
    });
    void refreshRuntimeKeys().catch((error) => {
      console.error("Runtime key metadata load failed:", error);
      showFeedback(error instanceof Error ? error.message : "Failed to load runtime key metadata.", "error");
    });
  }, []);

  const createDataset = async (payload: { id: string; name: string; description: string }) => {
    const response = await fetch("http://localhost:3001/api/datasets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to create dataset.");
    }
    await refreshDatasets();
    showFeedback(`Dataset "${payload.name || payload.id}" created.`, "success");
  };

  const selectDataset = async (datasetId: string) => {
    const response = await fetch(`http://localhost:3001/api/datasets/${encodeURIComponent(datasetId)}/select`, {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to switch dataset.");
    }
    setCurrentDatasetId(result.current || datasetId);
    showFeedback(`Dataset switched to ${result.dataset?.name || datasetId}.`, "success");
    window.location.reload();
  };

  const saveRuntimeKey = async (keyName: RuntimeKeyRecord["keyName"], value: string) => {
    const response = await fetch(`http://localhost:3001/api/runtime-keys/${encodeURIComponent(keyName)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to update runtime key.");
    }
    await refreshRuntimeKeys();
    showFeedback(`${keyName} ${value.trim() ? "updated" : "cleared"}.`, "success");
  };

  const normalizePlayers = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/normalize-players", {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t.app.alerts.normalizationError);
      }

      showFeedback(t.app.alerts.normalizationSuccess, "success");
    } catch (error) {
      console.error("Normalization request failed:", error);
      showFeedback(
        error instanceof Error ? `${t.app.alerts.errorPrefix}: ${error.message}` : t.app.alerts.normalizationError,
        "error",
      );
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

      showFeedback(`${t.app.alerts.graphGenerated} ${t.app.alerts.refreshGraph}`, "success");
    } catch (error) {
      console.error("Graph generation failed:", error);
      showFeedback(
        error instanceof Error ? `${t.app.alerts.genericError}: ${error.message}` : t.app.alerts.graphGenerationFailed,
        "error",
      );
    }
  };

  return (
    <BrowserRouter>
      <div
        className={`app-shell${navCollapsed ? " is-collapsed" : ""}${isMobileLayout ? " is-mobile-layout" : ""}${mobileNavOpen ? " is-mobile-nav-open" : ""}`}
      >
        <AppNavbar
          collapsed={isMobileLayout ? false : navCollapsed}
          onToggleCollapsed={() => setNavCollapsed((current) => !current)}
          onGenerateGraph={generateGraph}
          onNormalizePlayers={normalizePlayers}
          isMobileLayout={isMobileLayout}
          mobileOpen={mobileNavOpen}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onCloseMobileNav={() => setMobileNavOpen(false)}
          datasets={datasets}
          currentDatasetId={currentDatasetId}
          datasetLoading={datasetLoading}
          onRefreshDatasets={refreshDatasets}
          onSelectDataset={selectDataset}
          onCreateDataset={createDataset}
          runtimeKeys={runtimeKeys}
          runtimeKeysLoading={runtimeKeysLoading}
          onSaveRuntimeKey={saveRuntimeKey}
        />
        <AppRoutes navCollapsed={isMobileLayout ? false : navCollapsed} />
        <Snackbar
          open={Boolean(feedback)}
          autoHideDuration={4200}
          onClose={() => setFeedback(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={() => setFeedback(null)}
            severity={feedback?.severity ?? "info"}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {feedback?.message ?? ""}
          </Alert>
        </Snackbar>
      </div>
    </BrowserRouter>
  );
}

export default App;
