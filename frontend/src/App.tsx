import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import MatchAnalysisForm from "./MatchAnalysisForm";
import GraphPage from "./GraphPage";
import PathfinderLabPage from "./PathfinderLabPage";
import { FaSyncAlt } from "react-icons/fa";
import { useI18n } from "./i18n";

function Navbar() {
  const { language, setLanguage, t } = useI18n();
  const [loading, setLoading] = useState(false);

  const normalizePlayers = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/api/normalize-players", {
        method: "POST"
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Normalization failed:", result);
        alert(`${t.app.alerts.errorPrefix}: ${result.error}`);
      } else {
        console.log("Normalization successful:", result.message);
        alert(t.app.alerts.normalizationSuccess);
      }
    } catch (error) {
      console.error("Request error:", error);
      alert(t.app.alerts.normalizationError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <nav style={{
      backgroundColor: "#222",
      padding: "1rem 2rem",
      display: "flex",
      gap: "1.5rem",
      alignItems: "center"
    }}>
      <Link to="/matchanalysis" style={{ color: "white", textDecoration: "none", fontWeight: "bold" }}>
        {t.app.nav.matchAnalysis}
      </Link>
      <Link to="/graph" style={{ color: "white", textDecoration: "none", fontWeight: "bold" }}>
        {t.app.nav.graph}
      </Link>
      <Link to="/pathfinder-lab" style={{ color: "white", textDecoration: "none", fontWeight: "bold" }}>
        {t.app.nav.pathfinderLab}
      </Link>
      <button onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch("http://localhost:3001/api/generate-graph", {
            method: "POST",
          });
          if (!res.ok) throw new Error(t.app.alerts.graphGenerationFailed);
          alert(`${t.app.alerts.graphGenerated} ${t.app.alerts.refreshGraph}`);
        } catch (e: any) {
          alert(`${t.app.alerts.genericError}: ${e.message || t.app.alerts.unknown}`);
        } finally {
          setLoading(false);
        }
      }}>
        {t.app.nav.generateGraph}
      </button>

      <label style={{ color: "white", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span>{t.app.nav.language}</span>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as "en" | "hu")}
          style={{ borderRadius: "8px", padding: "0.35rem 0.5rem" }}
        >
          <option value="en">{t.app.nav.english}</option>
          <option value="hu">{t.app.nav.hungarian}</option>
        </select>
      </label>

      <button
        onClick={normalizePlayers}
        title={t.app.nav.normalizePlayers}
        disabled={loading}
        style={{
          background: "none",
          border: "none",
          color: "white",
          cursor: loading ? "not-allowed" : "pointer",
          marginLeft: "auto",
          fontSize: "1.2rem",
          display: "flex",
          alignItems: "center"
        }}
      >
        {loading ? (
          <span className="spinner" style={{
            width: "1rem",
            height: "1rem",
            border: "2px solid white",
            borderTop: "2px solid transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }} />
        ) : (
          <FaSyncAlt />
        )}
      </button>
    </nav>
  );
}

// Add CSS for spinner animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

function App() {
  const { t } = useI18n();

  React.useEffect(() => {
    document.title = t.app.title;
  }, [t.app.title]);

  return (
    <Router>
      <div style={{ background: "rgba(118, 118, 118, 0.8)" }}>
        <Navbar />
        <Routes>
          <Route path="/matchanalysis" element={<MatchAnalysisForm />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/pathfinder-lab" element={<PathfinderLabPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
