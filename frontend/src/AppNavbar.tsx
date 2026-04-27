import React, { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  FaBars,
  FaChartLine,
  FaChevronLeft,
  FaChevronRight,
  FaChevronUp,
  FaChevronDown,
  FaDatabase,
  FaFireAlt,
  FaGlobe,
  FaKey,
  FaPlus,
  FaProjectDiagram,
  FaRoute,
  FaSatelliteDish,
  FaSearch,
  FaSyncAlt,
  FaTimes,
} from "react-icons/fa";
import { useI18n } from "./i18n";
import type { DatasetRecord, RuntimeKeyRecord } from "./App";

type AppNavbarProps = {
  collapsed: boolean;
  isMobileLayout: boolean;
  mobileOpen: boolean;
  desktopWidth: number;
  onToggleCollapsed: () => void;
  onGenerateGraph: () => Promise<void>;
  onOpenMobileNav: () => void;
  onCloseMobileNav: () => void;
  onNormalizePlayers: () => Promise<void>;
  datasets: DatasetRecord[];
  currentDatasetId: string | null;
  datasetLoading: boolean;
  onRefreshDatasets: () => Promise<void>;
  onSelectDataset: (datasetId: string) => Promise<void>;
  onCreateDataset: (payload: { id: string; name: string; description: string }) => Promise<void>;
  runtimeKeys: RuntimeKeyRecord[];
  runtimeKeysLoading: boolean;
  onSaveRuntimeKey: (keyName: RuntimeKeyRecord["keyName"], value: string) => Promise<void>;
  onStartResize: () => void;
};

type NavItem = {
  to: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  external?: boolean;
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
  if (item.external) {
    return (
      <a
        href={item.to}
        title={collapsed ? item.label : item.description}
        className="app-sidebar__link"
        onClick={onNavigate}
      >
        <span className="app-sidebar__link-icon">{item.icon}</span>
        {!collapsed ? (
          <span className="app-sidebar__link-copy">
            <span className="app-sidebar__link-label">{item.label}</span>
            <span className="app-sidebar__link-meta">{item.description}</span>
          </span>
        ) : null}
      </a>
    );
  }

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
    <div className={`app-sidebar__action-card${collapsed ? " is-collapsed" : ""}`} title={collapsed ? (caption ? `${title}: ${caption}` : title) : undefined}>
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
  desktopWidth,
  onToggleCollapsed,
  onGenerateGraph,
  onOpenMobileNav,
  onCloseMobileNav,
  onNormalizePlayers,
  datasets,
  currentDatasetId,
  datasetLoading,
  onRefreshDatasets,
  onSelectDataset,
  onCreateDataset,
  runtimeKeys,
  runtimeKeysLoading,
  onSaveRuntimeKey,
  onStartResize,
}: AppNavbarProps) {
  const { language, setLanguage, t } = useI18n();
  const [generateLoading, setGenerateLoading] = useState(false);
  const [normalizeLoading, setNormalizeLoading] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollCue, setShowScrollCue] = useState(false);
  const [datasetForm, setDatasetForm] = useState({ id: "", name: "", description: "" });
  const [createDatasetLoading, setCreateDatasetLoading] = useState(false);
  const [switchingDatasetId, setSwitchingDatasetId] = useState<string | null>(null);
  const [runtimeKeyDrafts, setRuntimeKeyDrafts] = useState<Record<string, string>>({});
  const [savingRuntimeKey, setSavingRuntimeKey] = useState<string | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  const navCopy = language === "hu"
    ? {
        datasetTitle: "Aktiv adathalmaz",
        datasetCaption: "Válts az aktív adathalmazok között, vagy hozz létre újat.",
        datasetLabel: "Adathalmaz",
        datasetPlayers: "játékos",
        datasetMatches: "meccs",
        refreshDatasets: "Frissítés",
        createDataset: "Új adathalmaz",
        datasetId: "Adathalmaz azonosító",
        datasetName: "Név",
        datasetDescription: "Leírás",
        create: "Létrehozás",
        runtimeKeysTitle: "API kulcsok",
        runtimeKeysCaption: "Riot és OpenRouter kulcsok kezelése.",
        saveKey: "Mentés",
        clearKey: "Törlés",
        notSet: "Nincs beállítva",
        setStatus: "Beállítva",
      }
    : {
        datasetTitle: "Active dataset",
        datasetCaption: "Switch between datasets or create a new one.",
        datasetLabel: "Dataset",
        datasetPlayers: "players",
        datasetMatches: "matches",
        refreshDatasets: "Refresh",
        createDataset: "New dataset",
        datasetId: "Dataset ID",
        datasetName: "Name",
        datasetDescription: "Description",
        create: "Create",
        runtimeKeysTitle: "API keys",
        runtimeKeysCaption: "Manage Riot and OpenRouter keys.",
        saveKey: "Save",
        clearKey: "Clear",
        notSet: "Not set",
        setStatus: "Configured",
      };

  const navItems: NavItem[] = [
    {
      to: "/matchanalysis",
      label: t.app.nav.matchAnalysis,
      description: t.app.nav.matchAnalysisDescription,
      icon: <FaSearch />,
    },
    {
      to: "/match-collector",
      label: language === "hu" ? "Match Collector" : "Match Collector",
      description: language === "hu"
        ? "Collector oldal standard és strengthen-graph futásokhoz"
        : "Collector page for standard and strengthen-graph runs",
      icon: <FaSatelliteDish />,
    },
    {
      to: "/graph",
      label: t.app.nav.graph,
      description: t.app.nav.graphDescription,
      icon: <FaProjectDiagram />,
    },
    {
      to: "/player-detail",
      label: language === "hu" ? "Játékos Részletei" : "Player Detail",
      description: language === "hu"
        ? "Játékos teljesítményelemzés"
        : "Player performance analysis",
      icon: <FaChartLine />,
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
    {
      to: "http://localhost:3001/db-explorer/",
      label: language === "hu" ? "DB Explorer" : "DB Explorer",
      description: language === "hu"
        ? "ASP.NET Core adatbázis-böngésző datasetválasztóval"
        : "ASP.NET Core database browser with dataset selection",
      icon: <FaDatabase />,
      external: true,
    },
  ];

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }

    const updateCue = () => {
      setShowScrollUp(viewport.scrollTop > 24);
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

      <aside
        className={`app-sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
        aria-label={`Sidebar navigation width ${desktopWidth}px`}
      >
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
                title={navCopy.datasetTitle}
                caption={navCopy.datasetCaption}
                collapsed={collapsed}
              >
                {!collapsed ? (
                  <>
                    <label className="app-sidebar__field">
                      <span className="app-sidebar__field-label">
                        <span className="app-sidebar__action-icon"><FaDatabase /></span>
                        <span>{navCopy.datasetLabel}</span>
                      </span>
                      <div className="app-sidebar__field-row">
                        <select
                          value={currentDatasetId || ""}
                          onChange={async (event) => {
                            const nextId = event.target.value;
                            if (!nextId || nextId === currentDatasetId) {
                              return;
                            }
                            setSwitchingDatasetId(nextId);
                            try {
                              await onSelectDataset(nextId);
                            } finally {
                              setSwitchingDatasetId(null);
                            }
                          }}
                          disabled={datasetLoading || Boolean(switchingDatasetId)}
                        >
                          {datasets.map((dataset) => (
                            <option key={dataset.id} value={dataset.id}>
                              {dataset.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="app-sidebar__mini-button"
                          onClick={() => void onRefreshDatasets()}
                          disabled={datasetLoading}
                        >
                          {navCopy.refreshDatasets}
                        </button>
                      </div>
                    </label>

                    {datasets.find((dataset) => dataset.id === currentDatasetId) ? (
                      <div className="app-sidebar__dataset-summary">
                        <div>{datasets.find((dataset) => dataset.id === currentDatasetId)?.refinedPlayerCount} {navCopy.datasetPlayers}</div>
                        <div>{datasets.find((dataset) => dataset.id === currentDatasetId)?.matchCount} {navCopy.datasetMatches}</div>
                      </div>
                    ) : null}

                    <div className="app-sidebar__field-grid">
                      <label className="app-sidebar__field">
                        <span className="app-sidebar__field-label">{navCopy.datasetId}</span>
                        <input
                          value={datasetForm.id}
                          onChange={(event) => setDatasetForm((current) => ({ ...current, id: event.target.value.toLowerCase() }))}
                          placeholder="default-2"
                        />
                      </label>
                      <label className="app-sidebar__field">
                        <span className="app-sidebar__field-label">{navCopy.datasetName}</span>
                        <input
                          value={datasetForm.name}
                          onChange={(event) => setDatasetForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Friends Group"
                        />
                      </label>
                    </div>
                    <label className="app-sidebar__field">
                      <span className="app-sidebar__field-label">{navCopy.datasetDescription}</span>
                      <textarea
                        rows={2}
                        value={datasetForm.description}
                        onChange={(event) => setDatasetForm((current) => ({ ...current, description: event.target.value }))}
                        placeholder="Optional dataset notes"
                      />
                    </label>
                    <button
                      type="button"
                      className="app-sidebar__action-button app-sidebar__action-button--ghost"
                      onClick={async () => {
                        setCreateDatasetLoading(true);
                        try {
                          await onCreateDataset(datasetForm);
                          setDatasetForm({ id: "", name: "", description: "" });
                        } finally {
                          setCreateDatasetLoading(false);
                        }
                      }}
                      disabled={createDatasetLoading || !datasetForm.id.trim() || !datasetForm.name.trim()}
                    >
                      <span className="app-sidebar__action-icon"><FaPlus /></span>
                      <span>{createDatasetLoading ? t.common.loading : navCopy.create}</span>
                    </button>
                  </>
                ) : (
                  <span className="app-sidebar__action-icon"><FaDatabase /></span>
                )}
              </ActionCard>

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
                title={navCopy.runtimeKeysTitle}
                caption={navCopy.runtimeKeysCaption}
                collapsed={collapsed}
              >
                {!collapsed ? runtimeKeys.map((runtimeKey) => (
                    <div key={runtimeKey.keyName} className="app-sidebar__key-card">
                    <div className="app-sidebar__key-header">
                      <div className="app-sidebar__key-name">
                        <span className="app-sidebar__action-icon"><FaKey /></span>
                        <span>{runtimeKey.keyName}</span>
                      </div>
                      <span className={`app-sidebar__key-badge${runtimeKey.isSet ? " is-set" : ""}`}>
                        {runtimeKey.isSet ? runtimeKey.maskedPreview || navCopy.setStatus : navCopy.notSet}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={runtimeKeyDrafts[runtimeKey.keyName] ?? ""}
                      onChange={(event) => setRuntimeKeyDrafts((current) => ({
                        ...current,
                        [runtimeKey.keyName]: event.target.value,
                      }))}
                      placeholder={runtimeKey.isSet ? runtimeKey.maskedPreview || navCopy.setStatus : runtimeKey.keyName}
                    />
                    <div className="app-sidebar__field-row">
                      <button
                        type="button"
                        className="app-sidebar__mini-button"
                        onClick={async () => {
                          setSavingRuntimeKey(runtimeKey.keyName);
                          try {
                            await onSaveRuntimeKey(runtimeKey.keyName, runtimeKeyDrafts[runtimeKey.keyName] ?? "");
                            setRuntimeKeyDrafts((current) => ({ ...current, [runtimeKey.keyName]: "" }));
                          } finally {
                            setSavingRuntimeKey(null);
                          }
                        }}
                        disabled={runtimeKeysLoading || savingRuntimeKey === runtimeKey.keyName}
                      >
                        {savingRuntimeKey === runtimeKey.keyName ? t.common.loading : navCopy.saveKey}
                      </button>
                      <button
                        type="button"
                        className="app-sidebar__mini-button app-sidebar__mini-button--ghost"
                        onClick={async () => {
                          setSavingRuntimeKey(runtimeKey.keyName);
                          try {
                            await onSaveRuntimeKey(runtimeKey.keyName, "");
                            setRuntimeKeyDrafts((current) => ({ ...current, [runtimeKey.keyName]: "" }));
                          } finally {
                            setSavingRuntimeKey(null);
                          }
                        }}
                        disabled={runtimeKeysLoading || savingRuntimeKey === runtimeKey.keyName || !runtimeKey.isSet}
                      >
                        {navCopy.clearKey}
                      </button>
                    </div>
                  </div>
                )) : <span className="app-sidebar__action-icon"><FaKey /></span>}
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

        {!collapsed && showScrollUp ? (
          <button
            type="button"
            className="app-sidebar__scroll-button app-sidebar__scroll-button--up"
            aria-label="Scroll navigation up"
            onClick={() => scrollViewportRef.current?.scrollBy({ top: -320, behavior: "smooth" })}
          >
            <FaChevronUp />
          </button>
        ) : null}

        {!collapsed && showScrollCue ? (
          <div className="app-sidebar__scroll-cue">
            <div className="app-sidebar__scroll-fade" />
            <button
              type="button"
              className="app-sidebar__scroll-button app-sidebar__scroll-button--down"
              aria-label="Scroll navigation down"
              onClick={() => scrollViewportRef.current?.scrollBy({ top: 320, behavior: "smooth" })}
            >
              <FaChevronDown />
            </button>
          </div>
        ) : null}

        {!collapsed && !isMobileLayout ? (
          <button
            type="button"
            className="app-sidebar__resize-handle"
            aria-label="Resize navigation"
            title="Resize navigation"
            onPointerDown={(event) => {
              event.preventDefault();
              onStartResize();
            }}
          />
        ) : null}
      </aside>
    </>
  );
}
