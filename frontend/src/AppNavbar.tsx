import React, { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  FaBars,
  FaChartLine,
  FaChevronLeft,
  FaChevronRight,
  FaFireAlt,
  FaGlobe,
  FaProjectDiagram,
  FaRoute,
  FaSearch,
  FaSyncAlt,
  FaTimes,
} from "react-icons/fa";
import { useI18n } from "./i18n";

type AppNavbarProps = {
  collapsed: boolean;
  isMobileLayout: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onGenerateGraph: () => Promise<void>;
  onOpenMobileNav: () => void;
  onCloseMobileNav: () => void;
  onNormalizePlayers: () => Promise<void>;
};

type NavItem = {
  to: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

type ActionCardProps = {
  title: string;
  caption: string;
  children: React.ReactNode;
  collapsed: boolean;
};

function SidebarSection({
  title,
  collapsed,
  children,
}: {
  title: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="app-sidebar__section">
      {!collapsed ? <div className="app-sidebar__section-label">{title}</div> : null}
      <div className="app-sidebar__section-body">{children}</div>
    </section>
  );
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : item.description}
      className={({ isActive }) => `app-sidebar__link${isActive ? " is-active" : ""}`}
      onClick={onNavigate}
    >
      <span className="app-sidebar__link-icon">{item.icon}</span>
      {!collapsed ? (
        <span className="app-sidebar__link-copy">
          <span className="app-sidebar__link-label">{item.label}</span>
          <span className="app-sidebar__link-meta">{item.description}</span>
        </span>
      ) : null}
    </NavLink>
  );
}

function ActionCard({
  title,
  caption,
  children,
  collapsed,
}: ActionCardProps) {
  return (
    <div className={`app-sidebar__action-card${collapsed ? " is-collapsed" : ""}`} title={collapsed ? `${title}: ${caption}` : undefined}>
      {!collapsed ? (
        <>
          <div className="app-sidebar__action-title">{title}</div>
          <div className="app-sidebar__action-caption">{caption}</div>
        </>
      ) : null}
      {children}
    </div>
  );
}

export default function AppNavbar({
  collapsed,
  isMobileLayout,
  mobileOpen,
  onToggleCollapsed,
  onGenerateGraph,
  onOpenMobileNav,
  onCloseMobileNav,
  onNormalizePlayers,
}: AppNavbarProps) {
  const { language, setLanguage, t } = useI18n();
  const [generateLoading, setGenerateLoading] = useState(false);
  const [normalizeLoading, setNormalizeLoading] = useState(false);
  const [showScrollCue, setShowScrollCue] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  const navItems: NavItem[] = [
    {
      to: "/matchanalysis",
      label: t.app.nav.matchAnalysis,
      description: t.app.nav.matchAnalysisDescription,
      icon: <FaSearch />,
    },
    {
      to: "/graph",
      label: t.app.nav.graph,
      description: t.app.nav.graphDescription,
      icon: <FaProjectDiagram />,
    },
    {
      to: "/graph-sphere",
      label: t.app.nav.graphSphere,
      description: t.app.nav.graphSphereDescription,
      icon: <FaGlobe />,
    },
    {
      to: "/signed-balance",
      label: t.app.nav.signedBalance,
      description: t.app.nav.signedBalanceDescription,
      icon: <FaFireAlt />,
    },
    {
      to: "/assortativity",
      label: t.app.nav.assortativity,
      description: t.app.nav.assortativityDescription,
      icon: <FaChartLine />,
    },
    {
      to: "/pathfinder-lab",
      label: t.app.nav.pathfinderLab,
      description: t.app.nav.pathfinderLabDescription,
      icon: <FaRoute />,
    },
  ];

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }

    const updateCue = () => {
      const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setShowScrollCue(remaining > 24);
    };

    updateCue();
    viewport.addEventListener("scroll", updateCue);
    window.addEventListener("resize", updateCue);

    return () => {
      viewport.removeEventListener("scroll", updateCue);
      window.removeEventListener("resize", updateCue);
    };
  }, [collapsed, isMobileLayout, mobileOpen]);

  return (
    <>
      {isMobileLayout ? (
        <div className="app-mobile-bar">
          <button
            type="button"
            className="app-mobile-bar__menu"
            onClick={onOpenMobileNav}
            aria-label={t.app.nav.expandNavigation}
          >
            <FaBars />
          </button>
          <div className="app-mobile-bar__brand">
            <img src="/mushroom-icon.png" alt="" className="app-mobile-bar__brand-image" />
            <div className="app-mobile-bar__brand-copy">
              <div className="app-mobile-bar__eyebrow">PremadeGraph</div>
              <div className="app-mobile-bar__title">{t.app.title}</div>
            </div>
          </div>
        </div>
      ) : null}

      {isMobileLayout && mobileOpen ? (
        <button
          type="button"
          className="app-sidebar__backdrop"
          aria-label={t.app.nav.collapseNavigation}
          onClick={onCloseMobileNav}
        />
      ) : null}

      <aside className={`app-sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}>
        <div className="app-sidebar__top">
          <div className="app-sidebar__brand">
            <div className="app-sidebar__badge">
              <img src="/mushroom-icon.png" alt="PremadeGraph mushroom icon" className="app-sidebar__badge-image" />
            </div>
            {!collapsed ? (
              <div className="app-sidebar__brand-copy">
                <div className="app-sidebar__eyebrow">PremadeGraph</div>
                <div className="app-sidebar__title">{t.app.title}</div>
                <div className="app-sidebar__subtitle">{t.app.nav.brandSubtitle}</div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="app-sidebar__collapse"
            onClick={isMobileLayout ? onCloseMobileNav : onToggleCollapsed}
            title={
              isMobileLayout
                ? t.app.nav.collapseNavigation
                : collapsed
                  ? t.app.nav.expandNavigation
                  : t.app.nav.collapseNavigation
            }
            aria-label={
              isMobileLayout
                ? t.app.nav.collapseNavigation
                : collapsed
                  ? t.app.nav.expandNavigation
                  : t.app.nav.collapseNavigation
            }
          >
            {isMobileLayout ? <FaTimes /> : collapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
        </div>

        <div ref={scrollViewportRef} className="app-sidebar__scroll">
          <SidebarSection title={t.app.nav.navigateSection} collapsed={collapsed}>
            <nav className="app-sidebar__nav">
              {navItems.map((item) => (
                <SidebarLink
                  key={item.to}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={isMobileLayout ? onCloseMobileNav : undefined}
                />
              ))}
            </nav>
          </SidebarSection>

          <SidebarSection title={t.app.nav.actionsSection} collapsed={collapsed}>
            <div className="app-sidebar__actions">
              <ActionCard
                title={t.app.nav.graphPipelineTitle}
                caption={t.app.nav.graphPipelineCaption}
                collapsed={collapsed}
              >
                <button
                  type="button"
                  className="app-sidebar__action-button app-sidebar__action-button--primary"
                  onClick={async () => {
                    setGenerateLoading(true);
                    try {
                      await onGenerateGraph();
                    } finally {
                      setGenerateLoading(false);
                    }
                  }}
                  disabled={generateLoading}
                >
                  <span className="app-sidebar__action-icon"><FaProjectDiagram /></span>
                  {!collapsed ? <span>{generateLoading ? t.common.loading : t.app.nav.generateGraph}</span> : null}
                </button>
              </ActionCard>

              <ActionCard
                title={t.app.nav.playerHygieneTitle}
                caption={t.app.nav.playerHygieneCaption}
                collapsed={collapsed}
              >
                <button
                  type="button"
                  className="app-sidebar__action-button app-sidebar__action-button--ghost"
                  onClick={async () => {
                    setNormalizeLoading(true);
                    try {
                      await onNormalizePlayers();
                    } finally {
                      setNormalizeLoading(false);
                    }
                  }}
                  disabled={normalizeLoading}
                >
                  <span className="app-sidebar__action-icon">{normalizeLoading ? <span className="spinner" /> : <FaSyncAlt />}</span>
                  {!collapsed ? <span>{t.app.nav.normalizePlayers}</span> : null}
                </button>
              </ActionCard>

              <ActionCard
                title={t.app.nav.interfaceLanguageTitle}
                caption={t.app.nav.interfaceLanguageCaption}
                collapsed={collapsed}
              >
                <label className={`app-sidebar__language${collapsed ? " is-collapsed" : ""}`}>
                  <span className="app-sidebar__action-icon"><FaGlobe /></span>
                  {!collapsed ? <span className="app-sidebar__language-label">{t.app.nav.language}</span> : null}
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as "en" | "hu")}
                    aria-label={t.app.nav.language}
                  >
                    <option value="en">{t.app.nav.english}</option>
                    <option value="hu">{t.app.nav.hungarian}</option>
                  </select>
                </label>
              </ActionCard>
            </div>
          </SidebarSection>
        </div>

        {!collapsed && showScrollCue ? (
          <div className="app-sidebar__scroll-cue" aria-hidden="true">
            <div className="app-sidebar__scroll-fade" />
            <div className="app-sidebar__scroll-arrow">↓</div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
