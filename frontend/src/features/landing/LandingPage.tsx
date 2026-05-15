import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowDown,
  FaBookOpen,
  FaChartBar,
  FaCode,
  FaCogs,
  FaDatabase,
  FaExternalLinkAlt,
  FaFlag,
  FaGithub,
  FaProjectDiagram,
  FaScroll,
  FaSearch,
} from "react-icons/fa";
import "./LandingPage.css";

/* ─── Scroll-driven background stage math ─────────────────────────────────── */

interface BgOpacities {
  video: number;
  betweenImg: number;
  libraryImg: number;
}

function computeOpacities(scrollY: number, heroH: number): BgOpacities {
  // Each section = heroH (100vh)
  // Stage 0 (0 to heroH): video visible, between fades in near end
  // Stage 1 (heroH to heroH*2): between visible, library fades in near end
  // Stage 2+ (heroH*2 onward): library stable

  const sectionH = heroH;

  // Video: full until 70% of hero, then fade by hero end
  const videoFadeStart = sectionH * 0.7;
  const videoFadeEnd = sectionH;
  const video = clamp01(1 - (scrollY - videoFadeStart) / (videoFadeEnd - videoFadeStart));

  // between.png: fade in while the video fades out, then hold through section 1.
  const betweenFadeInStart = videoFadeStart;
  const betweenFadeInEnd = sectionH;
  const betweenFadeOutStart = sectionH * 1.75;
  const betweenFadeOutEnd = sectionH * 2;
  const betweenImg =
    clamp01((scrollY - betweenFadeInStart) / (betweenFadeInEnd - betweenFadeInStart)) *
    (1 - clamp01((scrollY - betweenFadeOutStart) / (betweenFadeOutEnd - betweenFadeOutStart)));

  // library.png: fade in during last 25% of section 1, then stay
  const libraryFadeInStart = sectionH * 1.75;
  const libraryFadeInEnd = sectionH * 2;
  const libraryImg = clamp01((scrollY - libraryFadeInStart) / (libraryFadeInEnd - libraryFadeInStart));

  return { video, betweenImg, libraryImg };
}

function clamp01(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

/* ─── Scroll progress hook ────────────────────────────────────────────────── */

function useScrollProgress() {
  const [scrollY, setScrollY] = useState(0);
  const [heroH, setHeroH] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 900,
  );

  useEffect(() => {
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrollY(window.scrollY);
      });
    }
    function onResize() {
      setHeroH(window.innerHeight);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  const opacities = useMemo(() => computeOpacities(scrollY, heroH), [scrollY, heroH]);

  const navbarVisible = scrollY > heroH * 0.85;

  return { scrollY, heroH, opacities, navbarVisible };
}

/* ─── Component ───────────────────────────────────────────────────────────── */

interface LandingPageProps {
  onOpenSidebar?: () => void;
}

export default function LandingPage({ onOpenSidebar }: LandingPageProps) {
  const navigate = useNavigate();
  const { opacities, navbarVisible } = useScrollProgress();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Break out of app-shell grid layout
  useEffect(() => {
    const shell = document.querySelector(".app-shell");
    if (shell) {
      shell.classList.add("app-shell--landing");
    }
    return () => {
      if (shell) {
        shell.classList.remove("app-shell--landing");
      }
    };
  }, []);

  // Attempt to play video
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.play().catch(() => {});
  }, []);

  const handleNavClick = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleOpenApp = useCallback(() => {
    if (onOpenSidebar) {
      onOpenSidebar();
    }
  }, [onOpenSidebar]);

  return (
    <div className="landing">
      {/* ── Fixed background stage ── */}
      <div className="landing__bg-stage">
        <div
          className="landing__bg-layer"
          style={{ opacity: opacities.video, zIndex: 0 }}
        >
          <div className="landing__bg-video">
            <video
              ref={videoRef}
              src="/hero-video.mp4"
              muted
              loop
              playsInline
              aria-hidden
            />
          </div>
        </div>

        <div
          className="landing__bg-layer"
          style={{ opacity: opacities.betweenImg, zIndex: 1 }}
        >
          <img src="/between.png" alt="" aria-hidden />
        </div>

        <div
          className="landing__bg-layer"
          style={{ opacity: opacities.libraryImg, zIndex: 2 }}
        >
          <img src="/library.png" alt="" aria-hidden />
        </div>
      </div>

      <div className="landing__bg-overlay" />

      {/* ── Landing navbar ── */}
      <nav
        className={`landing__navbar${navbarVisible ? " landing__navbar--visible" : " landing__navbar--hidden"}`}
        aria-label="Landing page navigation"
      >
        <div className="landing__navbar-inner">
          <a
            href="/"
            className="landing__navbar-brand"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            <img src="/mushroom-icon.png" alt="" className="landing__navbar-brand-icon" />
            PremadeGraph
          </a>
          <div className="landing__navbar-links">
            <button type="button" className="landing__navbar-link" onClick={() => handleNavClick("landing-what")}>About</button>
            <button type="button" className="landing__navbar-link" onClick={() => handleNavClick("landing-scope")}>Scope</button>
            <button type="button" className="landing__navbar-link" onClick={() => handleNavClick("landing-pipeline")}>Pipeline</button>
            <button type="button" className="landing__navbar-link" onClick={() => handleNavClick("landing-outputs")}>Outputs</button>
          </div>
          <button type="button" className="landing__navbar-cta" onClick={handleOpenApp}>
            Open App
          </button>
        </div>
      </nav>

      {/* ── Scroll content ── */}
      <div className="landing__sections">
        {/* 1. Hero — video background */}
        <section className="landing__section landing__hero" id="landing-hero">
          <div className="landing__hero-eyebrow">
            <span className="landing__hero-eyebrow-dot" />
            League of Legends Graph Analytics Research
          </div>
          <h1>
            Mapping the <em>hidden networks</em> of repeated player encounters
          </h1>
          <p className="landing__hero-subtitle">
            PremadeGraph collects match data, builds player relationship graphs,
            and analyzes how League players connect across games — a computational
            lens on interactive team sport networks.
          </p>
          <div className="landing__hero-hint">
            <FaArrowDown className="landing__hero-hint-arrow" aria-hidden />
            <span>Scroll to explore</span>
          </div>
        </section>

        {/* 2. What This Project Does — between.png background, transitions to library */}
        <section className="landing__section" id="landing-what">
          <div className="landing__section-inner">
            <div className="landing__section-label">What this project does</div>
            <h2>From match data to graph evidence</h2>
            <p>
              The project collects, structures, and analyzes repeated co-play and opponent
              encounters across thousands of League of Legends matches. Raw match logs become
              a weighted player graph. Structural metrics reveal how players cluster, connect,
              and perform together.
            </p>
            <div className="landing__blocks">
              <div className="landing__block">
                <div className="landing__block-icon"><FaDatabase /></div>
                <h3>Dataset Collection</h3>
                <p>
                  Automated Riot API pipelines gather Flex Queue and SoloQ matches into
                  versioned, queryable datasets with enriched player metadata.
                </p>
              </div>
              <div className="landing__block">
                <div className="landing__block-icon"><FaProjectDiagram /></div>
                <h3>Graph Construction</h3>
                <p>
                  Repeated co-presence is collapsed into weighted ally and enemy edges.
                  Relationship strength, not just contact.
                </p>
              </div>
              <div className="landing__block">
                <div className="landing__block-icon"><FaChartBar /></div>
                <h3>Graph Analytics</h3>
                <p>
                  A Rust runtime computes assortativity, betweenness centrality, and
                  core-periphery structure. Results surfaced through a web interface.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="landing__docs-link"
              onClick={() => navigate("/documentation")}
            >
              <FaBookOpen />
              Read the full documentation
              <FaExternalLinkAlt style={{ fontSize: "0.7rem" }} />
            </button>
          </div>
        </section>

        {/* 3. Current Thesis Scope — library.png background */}
        <section className="landing__section" id="landing-scope">
          <div className="landing__section-inner">
            <div className="landing__section-label">Current thesis scope</div>
            <h2>Focused, measurable research questions</h2>
            <p>
              The project maintains a clear research direction. Active work is separated
              from future-facing exploration.
            </p>
            <div className="landing__scope-grid">
              <div className="landing__scope-item">
                <div className="landing__scope-dot" />
                <div className="landing__scope-copy">
                  <strong>Flex Queue dataset expansion</strong>
                  <span>Systematic collection and versioning of Apex-tier Flex Queue matches across EUNE.</span>
                </div>
              </div>
              <div className="landing__scope-item">
                <div className="landing__scope-dot" />
                <div className="landing__scope-copy">
                  <strong>SoloQ control dataset</strong>
                  <span>Master-tier SoloQ data as a structured comparison point for Flex Queue patterns.</span>
                </div>
              </div>
              <div className="landing__scope-item">
                <div className="landing__scope-dot" />
                <div className="landing__scope-copy">
                  <strong>Associative core-periphery interpretation</strong>
                  <span>Understanding Flex Queue player graphs as associative core-periphery structures.</span>
                </div>
              </div>
              <div className="landing__scope-item">
                <div className="landing__scope-dot" />
                <div className="landing__scope-copy">
                  <strong>Flex vs SoloQ comparison</strong>
                  <span>Controlled comparison of graph topology and edge-weight distributions across queues.</span>
                </div>
              </div>
              <div className="landing__scope-item">
                <div className="landing__scope-dot" />
                <div className="landing__scope-copy">
                  <strong>Performance-metric assortativity</strong>
                  <span>Measuring opscore and feedscore assortativity on ally-weighted edges.</span>
                </div>
              </div>
              <div className="landing__scope-item">
                <div className="landing__scope-dot" />
                <div className="landing__scope-copy">
                  <strong>Weighted Brandes betweenness centrality</strong>
                  <span>Parallel Rust implementation with cost rule 1/strength and per-player output.</span>
                </div>
              </div>
              <div className="landing__scope-item landing__scope-item--future">
                <div className="landing__scope-dot" />
                <div className="landing__scope-copy">
                  <strong>Genetic NeuroSim v2</strong>
                  <span>Future-facing agent simulation seeded from validated graph profiles.</span>
                  <span className="landing__scope-tag">Future</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="landing__docs-link"
              onClick={() => navigate("/documentation")}
            >
              <FaBookOpen />
              Scope details in documentation
              <FaExternalLinkAlt style={{ fontSize: "0.7rem" }} />
            </button>
          </div>
        </section>

        {/* 4. System Pipeline */}
        <section className="landing__section" id="landing-pipeline">
          <div className="landing__section-inner">
            <div className="landing__section-label">System pipeline</div>
            <h2>How the data flows</h2>
            <p>
              A layered research instrument: data collection feeds graph construction,
              which feeds a Rust analytics runtime, exposed through a web interface.
            </p>
            <div className="landing__pipeline">
              <div className="landing__pipeline-step">
                <div className="landing__pipeline-step-icon"><FaDatabase /></div>
                <strong>Riot Match Data</strong>
                <span>Collected via Riot API into versioned datasets</span>
              </div>
              <div className="landing__pipeline-step">
                <div className="landing__pipeline-step-icon"><FaCogs /></div>
                <strong>Dataset Processing</strong>
                <span>Player normalization, score enrichment, SQLite storage</span>
              </div>
              <div className="landing__pipeline-step">
                <div className="landing__pipeline-step-icon"><FaProjectDiagram /></div>
                <strong>Player Graph</strong>
                <span>Weighted ally/enemy pair edges from repeated co-presence</span>
              </div>
              <div className="landing__pipeline-step">
                <div className="landing__pipeline-step-icon"><FaCode /></div>
                <strong>Rust Analytics</strong>
                <span>Assortativity, centrality, pathfinding, 3D exports</span>
              </div>
              <div className="landing__pipeline-step">
                <div className="landing__pipeline-step-icon"><FaSearch /></div>
                <strong>Frontend Evidence</strong>
                <span>Interactive graphs, metric readouts, replay playback</span>
              </div>
            </div>
            <button
              type="button"
              className="landing__docs-link"
              onClick={() => navigate("/documentation")}
            >
              <FaBookOpen />
              Architecture documentation
              <FaExternalLinkAlt style={{ fontSize: "0.7rem" }} />
            </button>
          </div>
        </section>

        {/* 5. Key Research Outputs */}
        <section className="landing__section" id="landing-outputs">
          <div className="landing__section-inner">
            <div className="landing__section-label">Key research outputs</div>
            <h2>Measured evidence, not marketing claims</h2>
            <p>
              Every output is backed by a specific dataset, a defined graph mode, and
              reproducible computation.
            </p>
            <div className="landing__stats">
              <div className="landing__stat">
                <span className="landing__stat-value">Multi-dataset</span>
                <span className="landing__stat-label">Flex + SoloQ collections</span>
              </div>
              <div className="landing__stat">
                <span className="landing__stat-value">Thousands</span>
                <span className="landing__stat-label">Players in refined database</span>
              </div>
              <div className="landing__stat">
                <span className="landing__stat-value">Weighted</span>
                <span className="landing__stat-label">Ally &amp; enemy graph edges</span>
              </div>
              <div className="landing__stat">
                <span className="landing__stat-value">Parallel Rust</span>
                <span className="landing__stat-label">Brandes centrality with Rayon</span>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Selected Interface / Screenshots */}
        <section className="landing__section" id="landing-screenshots">
          <div className="landing__section-inner">
            <div className="landing__section-label">Interface</div>
            <h2>A working research instrument</h2>
            <p>
              Not just data and algorithms — a usable application with interactive
              visualizations, search, and analytic replay.
            </p>
            <div className="landing__gallery">
              <div className="landing__gallery-item">
                <div className="landing__gallery-placeholder">
                  <FaProjectDiagram style={{ fontSize: "2.2rem", marginBottom: "0.5rem", opacity: 0.35 }} />
                  Graph View
                </div>
                <div className="landing__gallery-caption">Interactive player graph with filtering and layout controls.</div>
              </div>
              <div className="landing__gallery-item">
                <div className="landing__gallery-placeholder">
                  <FaChartBar style={{ fontSize: "2.2rem", marginBottom: "0.5rem", opacity: 0.35 }} />
                  Assortativity Readout
                </div>
                <div className="landing__gallery-caption">Performance-metric assortativity with statistical baselines.</div>
              </div>
              <div className="landing__gallery-item">
                <div className="landing__gallery-placeholder">
                  <FaCode style={{ fontSize: "2.2rem", marginBottom: "0.5rem", opacity: 0.35 }} />
                  Brandes Centrality
                </div>
                <div className="landing__gallery-caption">Parallel betweenness centrality with per-player rankings.</div>
              </div>
            </div>
            <button
              type="button"
              className="landing__docs-link"
              onClick={() => navigate("/matchanalysis")}
            >
              <FaScroll />
              Explore the application
              <FaExternalLinkAlt style={{ fontSize: "0.7rem" }} />
            </button>
          </div>
        </section>

        {/* 7. Methodological Boundaries */}
        <section className="landing__section" id="landing-boundaries">
          <div className="landing__section-inner">
            <div className="landing__section-label">Methodological boundaries</div>
            <h2>What this project does not claim</h2>
            <p>
              Academic credibility requires honesty about scope. These boundaries
              are deliberate and documented.
            </p>
            <div className="landing__boundaries">
              <div className="landing__boundary">
                <FaFlag className="landing__boundary-icon" />
                <span>
                  The project avoids unsupported causal claims about social behavior.
                  Graph metrics are structural evidence, not psychological or
                  sociological truth statements.
                </span>
              </div>
              <div className="landing__boundary">
                <FaFlag className="landing__boundary-icon" />
                <span>
                  Flex Queue and SoloQ datasets are interpreted separately.
                  Differences are reported as dataset characteristics,
                  not generalized to all League play.
                </span>
              </div>
              <div className="landing__boundary">
                <FaFlag className="landing__boundary-icon" />
                <span>
                  Retired directions (such as Signed Balance) are not foregrounded
                  as active thesis contributions.
                </span>
              </div>
              <div className="landing__boundary">
                <FaFlag className="landing__boundary-icon" />
                <span>
                  All analytics are graph-theoretic evidence. No claims about
                  real-world social networks or player identity beyond in-game
                  co-occurrence patterns.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="landing__docs-link"
              onClick={() => navigate("/documentation")}
            >
              <FaBookOpen />
              Methodological notes in documentation
              <FaExternalLinkAlt style={{ fontSize: "0.7rem" }} />
            </button>
          </div>
        </section>

        {/* 8. Footer / Resources */}
        <footer className="landing__section landing__footer" id="landing-footer">
          <div className="landing__footer-inner">
            <div className="landing__footer-brand">
              <strong>PremadeGraph</strong>
              <span>
                A League of Legends graph analytics thesis project. Built with
                React, Node/Express, Rust, and SQLite.
              </span>
              <div className="landing__footer-stack">
                <span>React</span>
                <span>Node/Express</span>
                <span>Rust</span>
                <span>SQLite</span>
                <span>Rayon</span>
                <span>Three.js</span>
              </div>
            </div>
            <div className="landing__footer-links">
              <a href="https://github.com/wpowertech/premadegraph" target="_blank" rel="noopener noreferrer">
                <FaGithub style={{ marginRight: "0.35rem" }} />
                Repository
              </a>
              <button
                type="button"
                className="landing__docs-link"
                onClick={() => navigate("/documentation")}
                style={{ marginTop: 0 }}
              >
                <FaBookOpen style={{ marginRight: "0.35rem" }} />
                Documentation
              </button>
              <button
                type="button"
                className="landing__docs-link"
                onClick={handleOpenApp}
                style={{ marginTop: 0 }}
              >
                <FaScroll style={{ marginRight: "0.35rem" }} />
                Open App
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
