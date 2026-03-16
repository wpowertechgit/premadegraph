import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AlgorithmId, PathMode, RunStatus, TracePhase } from "./pathfinderTypes";

export type Language = "en" | "hu";

type TranslationTree = {
  app: {
    title: string;
    nav: {
      matchAnalysis: string;
      graph: string;
      pathfinderLab: string;
      generateGraph: string;
      normalizePlayers: string;
      language: string;
      hungarian: string;
      english: string;
    };
    alerts: {
      errorPrefix: string;
      unknown: string;
      normalizationSuccess: string;
      normalizationError: string;
      graphGenerationFailed: string;
      graphGenerated: string;
      refreshGraph: string;
      genericError: string;
    };
  };
  common: {
    na: string;
    yes: string;
    no: string;
    loading: string;
    fit: string;
    center: string;
    enabled: string;
    disabled: string;
  };
  matchAnalysis: {
    title: string;
    riotId: string;
    tag: string;
    matchCount: string;
    startIndex: string;
    submit: string;
    queueAll: string;
    queueSolo: string;
    queueFlex: string;
    queueNormal: string;
    matchId: string;
    blueTeam: string;
    redTeam: string;
    kda: string;
    gold: string;
    feedScore: string;
    usefulScore: string;
    countrySummary: string;
    unknownCountry: string;
    errors: {
      riotIdNotFound: string;
      matchIdsFailed: string;
      matchFetchFailed: string;
      generic: string;
    };
  };
  graph: {
    loading: string;
    unavailable: string;
    iframeTitle: string;
    openPathfinder: string;
    panelTitle: string;
    panelHeading: string;
    panelDescription: string;
    sourcePlayer: string;
    targetPlayer: string;
    algorithm: string;
    pathMode: string;
    weightedMode: string;
    openAnimatedRoute: string;
    minimizePanel: string;
    backendErrorPrefix: string;
  };
  pathfinder: {
    execution: string;
    rustBackend: string;
    nodeBackend: string;
    browserReplay: string;
    reloadPlayers: string;
    loadingPlayers: string;
    sourcePlayer: string;
    targetPlayer: string;
    typePlayerName: string;
    loadingPlayerList: string;
    typeAtLeastThreeLetters: string;
    algorithm: string;
    pathMode: string;
    weightedMode: string;
    weightedEnabled: string;
    weightedUnavailable: string;
    weightedOff: string;
    weightedTitleEnabled: string;
    weightedTitleDisabled: string;
    runSearch: string;
    running: string;
    reset: string;
    pageLabel: string;
    pageTitle: string;
    pageDescription: string;
    availablePlayers: string;
    relationships: string;
    renderer: string;
    canvasOverlay: string;
    whatGraphShows: string;
    whatGraphShowsText: string;
    pathModes: string;
    pathModesText: string;
    algorithmsPlayback: string;
    algorithmsPlaybackText: string;
    activeExecution: string;
    activeExecutionTextWithSpec: string;
    activeExecutionTextWithoutSpec: string;
    graphPreview: string;
    graphPreviewText: string;
    openOverlay: string;
    overviewMode: string;
    stepLabel: string;
    canvasNote1: string;
    canvasNote2: string;
    canvasNote3: string;
    canvasNote4: string;
    runSummary: string;
    runSummaryEmpty: string;
    status: string;
    pathLength: string;
    nodesVisited: string;
    edgesConsidered: string;
    runtime: string;
    traceSteps: string;
    comparisonNote: string;
    playback: string;
    play: string;
    pause: string;
    stepBack: string;
    stepForward: string;
    restart: string;
    speed: string;
    algorithmComparison: string;
    available: string;
    pathFound: string;
    relativeNote: string;
    comingLater: string;
    graphExplorer: string;
    fullGraphView: string;
    searchControls: string;
    applySearch: string;
    updating: string;
    runStatus: string;
    source: string;
    target: string;
    phase: string;
    revealedEdges: string;
    graphSummary: string;
    players: string;
    allyEdges: string;
    enemyEdges: string;
    overlayExplanation: string;
    currentStep: string;
    metadataRustFailed: string;
    metadataFailed: string;
    comparisonUnavailable: string;
    defaultComparison: string;
    routeThroughGraph: string;
    currentModePrefix: string;
  };
};

const translations: Record<Language, TranslationTree> = {
  en: {
    app: {
      title: "League of Legends Feed Analyzer",
      nav: {
        matchAnalysis: "Match Analysis",
        graph: "Association Graph",
        pathfinderLab: "Pathfinder Lab",
        generateGraph: "Generate Graph",
        normalizePlayers: "Normalize Players",
        language: "Language",
        hungarian: "Hungarian",
        english: "English",
      },
      alerts: {
        errorPrefix: "Error",
        unknown: "Unknown",
        normalizationSuccess: "Player normalization completed successfully.",
        normalizationError: "Player normalization failed.",
        graphGenerationFailed: "Graph generation failed.",
        graphGenerated: "Graph generated successfully.",
        refreshGraph: "Refresh the page to view it.",
        genericError: "Something went wrong",
      },
    },
    common: {
      na: "N/A",
      yes: "Yes",
      no: "No",
      loading: "Loading...",
      fit: "Fit",
      center: "Center",
      enabled: "Enabled",
      disabled: "Disabled",
    },
    matchAnalysis: {
      title: "League of Legends Feed Analyzer",
      riotId: "Riot ID",
      tag: "Tag",
      matchCount: "Match Count",
      startIndex: "Start Index",
      submit: "Submit",
      queueAll: "All",
      queueSolo: "SoloQ (Ranked Solo/Duo)",
      queueFlex: "Flex (Ranked Flex)",
      queueNormal: "Normal",
      matchId: "Match ID",
      blueTeam: "Blue Team",
      redTeam: "Red Team",
      kda: "KDA",
      gold: "Gold",
      feedScore: "FeedScore",
      usefulScore: "UsefulScore",
      countrySummary: "Feeder summary by country:",
      unknownCountry: "Unknown",
      errors: {
        riotIdNotFound: "Riot ID not found.",
        matchIdsFailed: "Failed to fetch match IDs.",
        matchFetchFailed: "Failed to fetch match",
        generic: "An error occurred.",
      },
    },
    graph: {
      loading: "Loading...",
      unavailable: "The graph is not available.",
      iframeTitle: "Association Graph",
      openPathfinder: "Open Pathfinder",
      panelTitle: "Pathfinder",
      panelHeading: "Find a route through the live Rust graph",
      panelDescription: "Use the population graph as your overview, then jump straight into the animated pathfinder for any two players you want to connect.",
      sourcePlayer: "Source Player",
      targetPlayer: "Target Player",
      algorithm: "Algorithm",
      pathMode: "Path Mode",
      weightedMode: "Weighted Mode",
      openAnimatedRoute: "Open Animated Route",
      minimizePanel: "Minimize pathfinder panel",
      backendErrorPrefix: "Backend API error",
    },
    pathfinder: {
      execution: "Execution",
      rustBackend: "Rust Backend",
      nodeBackend: "Node Backend",
      browserReplay: "Browser Replay",
      reloadPlayers: "Reload Players",
      loadingPlayers: "Loading players...",
      sourcePlayer: "Source Player",
      targetPlayer: "Target Player",
      typePlayerName: "Type player name",
      loadingPlayerList: "Loading player list...",
      typeAtLeastThreeLetters: "Type at least 3 letters",
      algorithm: "Algorithm",
      pathMode: "Path Mode",
      weightedMode: "Weighted Mode",
      weightedEnabled: "Enabled: prioritize stronger edges",
      weightedUnavailable: "Unavailable for this algorithm",
      weightedOff: "Off: treat every edge as the same cost",
      weightedTitleEnabled: "Prioritize stronger match-history edges",
      weightedTitleDisabled: "Switch to Dijkstra or A* to use weighted mode",
      runSearch: "Run Search",
      running: "Running...",
      reset: "Reset",
      pageLabel: "Pathfinder Lab",
      pageTitle: "Explore player connections and search routes through the graph",
      pageDescription: "Choose two players, select a search algorithm, and compare how social-only versus battle-enabled traversal changes the route. Weighted Dijkstra uses match-count strength so repeated connections become cheaper to traverse. The playback view shows how the frontier grows, which nodes were visited, and when the final path resolves.",
      availablePlayers: "Available Players",
      relationships: "Relationships",
      renderer: "Renderer",
      canvasOverlay: "Canvas overlay",
      whatGraphShows: "What the graph shows",
      whatGraphShowsText: "Each node is a player. Edges represent repeated relationships. Ally edges reflect cooperative matches, while enemy edges represent repeated opposition that can still connect the graph.",
      pathModes: "Path modes",
      pathModesText: "Social path searches through ally links only. Battle path also includes enemy links, which can uncover shorter or otherwise unreachable routes between players.",
      algorithmsPlayback: "Algorithms and playback",
      algorithmsPlaybackText: "BFS gives an intuitive breadth-first expansion, Bidirectional grows from both ends, and Dijkstra can optionally weight edges by repeated match history. In weighted mode, stronger ties become cheaper, so the route favors more established connections instead of treating every hop equally.",
      activeExecution: "Active execution",
      activeExecutionTextWithSpec: "The response contract stays consistent across the available execution paths.",
      activeExecutionTextWithoutSpec: "Search results still use the same route and trace format across the interface.",
      graphPreview: "Graph Preview",
      graphPreviewText: "The search controls on this page drive this preview directly. Open the full overlay when you want a larger scene, but the selected route and playback stay in sync here as well.",
      openOverlay: "Open Overlay",
      overviewMode: "Overview mode",
      stepLabel: "Step",
      canvasNote1: "Canvas renderer for larger networks",
      canvasNote2: "Playback highlights frontier growth and final route resolution",
      canvasNote3: "Drag to pan, wheel to zoom",
      canvasNote4: "Overlay keeps its state when closed",
      runSummary: "Run Summary",
      runSummaryEmpty: "Choose players, path mode, and algorithm to populate the live route metrics.",
      status: "Status",
      pathLength: "Path Length",
      nodesVisited: "Nodes Visited",
      edgesConsidered: "Edges Considered",
      runtime: "Runtime",
      traceSteps: "Trace Steps",
      comparisonNote: "Comparison Note",
      playback: "Playback",
      play: "Play",
      pause: "Pause",
      stepBack: "Step Back",
      stepForward: "Step Forward",
      restart: "Restart",
      speed: "Speed",
      algorithmComparison: "Algorithm Comparison",
      available: "Available",
      pathFound: "Path Found?",
      relativeNote: "Relative Note",
      comingLater: "Coming later",
      graphExplorer: "Graph Explorer",
      fullGraphView: "Full graph view with live controls",
      searchControls: "Search Controls",
      applySearch: "Apply Search",
      updating: "Updating...",
      runStatus: "Run Status",
      source: "Source",
      target: "Target",
      phase: "Phase",
      revealedEdges: "Revealed edges",
      graphSummary: "Graph Summary",
      players: "players",
      allyEdges: "ally edges",
      enemyEdges: "enemy edges",
      overlayExplanation: "Social path limits traversal to ally links. Battle path also allows enemy links, which can expose shorter or otherwise unreachable routes. When weighted search is enabled, repeated connections are cheaper, so stronger match-history edges are favored during the search. Playback reveals the visited frontier and then resolves the final route when the search finishes.",
      currentStep: "Current step",
      metadataRustFailed: "Rust backend is selected, but its metadata could not be loaded.",
      metadataFailed: "Backend metadata failed to load.",
      comparisonUnavailable: "Comparison data unavailable.",
      defaultComparison: "Run a search to compare path modes.",
      routeThroughGraph: "Find a route through the live Rust graph",
      currentModePrefix: "Current mode",
    },
  },
  hu: {
    app: {
      title: "League of Legends Feeder Elemző",
      nav: {
        matchAnalysis: "Meccselemzés",
        graph: "Asszociációs Gráf",
        pathfinderLab: "Pathfinder Labor",
        generateGraph: "Gráf generálása",
        normalizePlayers: "Játékosok normalizálása",
        language: "Nyelv",
        hungarian: "Magyar",
        english: "Angol",
      },
      alerts: {
        errorPrefix: "Hiba",
        unknown: "Ismeretlen",
        normalizationSuccess: "A játékosok normalizálása sikeresen befejeződött.",
        normalizationError: "Nem sikerült normalizálni a játékosokat.",
        graphGenerationFailed: "Nem sikerült generálni a gráfot.",
        graphGenerated: "A gráf sikeresen elkészült.",
        refreshGraph: "Frissítsd az oldalt a megtekintéshez.",
        genericError: "Hiba történt",
      },
    },
    common: {
      na: "N/A",
      yes: "Igen",
      no: "Nem",
      loading: "Betöltés...",
      fit: "Illesztés",
      center: "Középre",
      enabled: "Bekapcsolva",
      disabled: "Kikapcsolva",
    },
    matchAnalysis: {
      title: "League of Legends Feeder Elemző",
      riotId: "Riot ID",
      tag: "Tag",
      matchCount: "Meccsek száma",
      startIndex: "Kezdő index",
      submit: "Küldés",
      queueAll: "Összes",
      queueSolo: "SoloQ (Ranked Solo/Duo)",
      queueFlex: "Flex (Ranked Flex)",
      queueNormal: "Normal",
      matchId: "Meccs ID",
      blueTeam: "Kék csapat",
      redTeam: "Piros Csapat",
      kda: "KDA",
      gold: "Arany",
      feedScore: "FeedScore",
      usefulScore: "HasznosScore",
      countrySummary: "Feederek ország szerinti összesítése:",
      unknownCountry: "Ismeretlen",
      errors: {
        riotIdNotFound: "A Riot ID nem található.",
        matchIdsFailed: "Nem sikerült lekérdezni a meccsazonosítókat.",
        matchFetchFailed: "Nem sikerült lekérdezni a meccset",
        generic: "Hiba történt.",
      },
    },
    graph: {
      loading: "Betöltés...",
      unavailable: "A gráf nem érhető el.",
      iframeTitle: "Asszociációs Gráf",
      openPathfinder: "Pathfinder megnyitása",
      panelTitle: "Pathfinder",
      panelHeading: "Útkeresés az élő Rust-gráfban",
      panelDescription: "Használd a populációs gráfot áttekintésnek, majd ugorj az animált útkeresőbe bármelyik két játékos között.",
      sourcePlayer: "Forrás játékos",
      targetPlayer: "Céljátékos",
      algorithm: "Algoritmus",
      pathMode: "Útvonalmód",
      weightedMode: "Súlyozott mód",
      openAnimatedRoute: "Animált útvonal megnyitása",
      minimizePanel: "Pathfinder panel kicsinyítése",
      backendErrorPrefix: "Backend API hiba",
    },
    pathfinder: {
      execution: "Végrehajtás",
      rustBackend: "Rust Backend",
      nodeBackend: "Node Backend",
      browserReplay: "Böngészős demo",
      reloadPlayers: "Játékosok újratöltése",
      loadingPlayers: "Játékosok betöltése...",
      sourcePlayer: "Forrás játékos",
      targetPlayer: "Céljátékos",
      typePlayerName: "Írd be a játékos nevét",
      loadingPlayerList: "Játékoslista betöltése...",
      typeAtLeastThreeLetters: "Írj be legalább 3 betűt",
      algorithm: "Algoritmus",
      pathMode: "Útvonalmód",
      weightedMode: "Súlyozott mód",
      weightedEnabled: "Bekapcsolva: az erősebb éleket részesíti előnyben",
      weightedUnavailable: "Ehhez az algoritmushoz nem érhető el",
      weightedOff: "Kikapcsolva: minden él azonos költségű",
      weightedTitleEnabled: "Az erősebb meccstörténeti kapcsolatokat részesíti előnyben",
      weightedTitleDisabled: "Válts Dijkstra vagy A* algoritmusra a súlyozott módhoz",
      runSearch: "Keresés indítása",
      running: "Futás...",
      reset: "Visszaállítás",
      pageLabel: "Pathfinder Labor",
      pageTitle: "Játékoskapcsolatok és gráfos útvonalak felfedezése",
      pageDescription: "Válassz ki két játékost, egy keresési algoritmust, majd hasonlítsd össze, hogyan változik az útvonal csak szövetséges vagy harci kapcsolatokkal. A súlyozott Dijkstra a meccsek számát használja az élek erősségének mérésére. A visszajátszás megmutatja, hogyan nő a frontier, mely csomópontokat látogatta meg a keresés, és mikor áll össze a végső útvonal.",
      availablePlayers: "Elérhető játékosok",
      relationships: "Kapcsolatok",
      renderer: "Megjelenítő",
      canvasOverlay: "Canvas réteg",
      whatGraphShows: "Mit mutat a gráf",
      whatGraphShowsText: "Minden csomópont egy játékost jelöl. Az élek ismétlődő kapcsolatokat jelentenek. A szövetséges élek közös meccseket, az ellenséges élek pedig ismétlődő ellenfeleket mutatnak, amelyek szintén összeköthetik a gráfot.",
      pathModes: "Útvonalmódok",
      pathModesText: "A social path csak szövetséges kapcsolatokon keres. A battle path az ellenséges kapcsolatokat is bevonja, így rövidebb vagy egyébként elérhetetlen útvonalakat is feltárhat.",
      algorithmsPlayback: "Algoritmusok és visszajátszás",
      algorithmsPlaybackText: "A BFS jól követhető réteges terjeszkedést ad, a kétirányú keresés mindkét vég felől indul, a Dijkstra pedig súlyozhatja az éleket az ismétlődő meccsek alapján. Súlyozott módban az erősebb kapcsolatok olcsóbbak, így az útvonal az összeszokottabb kapcsolatok felé hajlik.",
      activeExecution: "Aktív végrehajtás",
      activeExecutionTextWithSpec: "A válaszszerződés minden elérhető végrehajtási módban konzisztens marad.",
      activeExecutionTextWithoutSpec: "A keresési eredmények ugyanazt az útvonal- és trace-formátumot használják a felületen.",
      graphPreview: "Gráf előnézet",
      graphPreviewText: "Az oldal keresési beállításai közvetlenül ezt az előnézetet vezérlik. Nyisd meg a teljes réteget nagyobb nézethez, de a kijelölt útvonal és visszajátszás itt is szinkronban marad.",
      openOverlay: "Réteg megnyitása",
      overviewMode: "Áttekintő mód",
      stepLabel: "Lépés",
      canvasNote1: "Canvas megjelenítő nagyobb hálózatokhoz",
      canvasNote2: "A visszajátszás kiemeli a frontier növekedését és a végső útvonalat",
      canvasNote3: "Húzással mozgatni, görgetéssel nagyítani",
      canvasNote4: "A réteg bezárás után is megőrzi az állapotát",
      runSummary: "Futás összegzés",
      runSummaryEmpty: "Válassz játékosokat, útvonalmódot és algoritmust az élő metrikák feltöltéséhez.",
      status: "Állapot",
      pathLength: "Útvonal hossza",
      nodesVisited: "Bejárt csomópontok",
      edgesConsidered: "Vizsgált élek",
      runtime: "Futási idő",
      traceSteps: "Trace lépések",
      comparisonNote: "Összehasonlítási megjegyzés",
      playback: "Visszajátszás",
      play: "Lejátszás",
      pause: "Szünet",
      stepBack: "Vissza lépés",
      stepForward: "Előre lépés",
      restart: "Újraindítás",
      speed: "Sebesség",
      algorithmComparison: "Algoritmus összehasonlítás",
      available: "Elérhető",
      pathFound: "Van útvonal?",
      relativeNote: "Relatív megjegyzés",
      comingLater: "Később érkezik",
      graphExplorer: "Gráf felfedező",
      fullGraphView: "Teljes gráfnézet élő vezérlőkkel",
      searchControls: "Keresési vezérlők",
      applySearch: "Keresés alkalmazása",
      updating: "Frissítés...",
      runStatus: "Futás állapota",
      source: "Forrás",
      target: "Cél",
      phase: "Fázis",
      revealedEdges: "Feltárt élek",
      graphSummary: "Gráf összegzés",
      players: "játékos",
      allyEdges: "szövetséges él",
      enemyEdges: "ellenséges él",
      overlayExplanation: "A social path a bejárást a szövetséges kapcsolatokra korlátozza. A battle path az ellenséges kapcsolatokat is engedi, ami rövidebb vagy különben elérhetetlen útvonalakat nyithat meg. Ha a súlyozott keresés be van kapcsolva, az ismétlődő kapcsolatok olcsóbbnak számítanak, így a keresést az erősebb meccstörténeti kapcsolatok irányítják. A visszajátszás megmutatja a bejárt frontiert, majd a keresés végén feloldja a végső útvonalat.",
      currentStep: "Aktuális lépés",
      metadataRustFailed: "A Rust backend van kiválasztva, de a metaadatai nem töltődtek be.",
      metadataFailed: "Nem sikerült betölteni a backend metaadatait.",
      comparisonUnavailable: "Az összehasonlítási adatok nem érhetők el.",
      defaultComparison: "Indíts egy keresést az útvonalmódok összehasonlításához.",
      routeThroughGraph: "Útkeresés az élő Rust-gráfban",
      currentModePrefix: "Aktuális mód",
    },
  },
};

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: TranslationTree;
};

const STORAGE_KEY = "premadegraph-language";

const I18nContext = createContext<I18nContextValue | null>(null);

export function getAlgorithmLabel(language: Language, algorithm: AlgorithmId) {
  const labels: Record<AlgorithmId, string> = {
    bfs: "BFS",
    dijkstra: "Dijkstra",
    bidirectional: language === "hu" ? "Kétirányú" : "Bidirectional",
    astar: "A*",
  };
  return labels[algorithm];
}

export function getPathModeLabel(language: Language, pathMode: PathMode) {
  if (language === "hu") {
    return pathMode === "social-path" ? "Social Path" : "Battle Path";
  }
  return pathMode === "social-path" ? "Social Path" : "Battle Path";
}

export function getStatusLabel(language: Language, status: RunStatus) {
  const labels: Record<Language, Record<RunStatus, string>> = {
    en: {
      found: "Found",
      not_found: "No path found",
      same_source_target: "Same source and target",
      invalid_input: "Invalid input",
    },
    hu: {
      found: "Találat",
      not_found: "Nincs útvonal",
      same_source_target: "Azonos forrás és cél",
      invalid_input: "Érvénytelen bemenet",
    },
  };
  return labels[language][status];
}

export function getPhaseLabel(language: Language, phase: TracePhase | null) {
  if (!phase) {
    return language === "hu" ? "üresjárat" : "idle";
  }
  const labels: Record<Language, Record<TracePhase, string>> = {
    en: {
      discover: "discover",
      expand: "expand",
      resolve: "resolve",
      complete: "complete",
    },
    hu: {
      discover: "felfedezés",
      expand: "kibővítés",
      resolve: "feloldás",
      complete: "befejezve",
    },
  };
  return labels[language][phase];
}

const backendTextMap: Record<string, { en: string; hu: string }> = {
  "enemy edges create connectivity": {
    en: "enemy edges create connectivity",
    hu: "az ellenséges élek összeköttetést teremtenek",
  },
  "shorter with enemy edges": {
    en: "shorter with enemy edges",
    hu: "rövidebb ellenséges élekkel",
  },
  "no gain from enemy edges": {
    en: "no gain from enemy edges",
    hu: "nincs nyereség az ellenséges élektől",
  },
  "battle-path mirrors social-path here": {
    en: "battle-path mirrors social-path here",
    hu: "itt a battle-path megegyezik a social-path eredményével",
  },
  "social-only route is the current baseline": {
    en: "social-only route is the current baseline",
    hu: "a csak social útvonal a jelenlegi alapvonal",
  },
  "coming later, pending heuristic": {
    en: "coming later, pending heuristic",
    hu: "később érkezik, heurisztikára vár",
  },
  "The selected player does not exist in the current dataset.": {
    en: "The selected player does not exist in the current dataset.",
    hu: "A kiválasztott játékos nem szerepel a jelenlegi adathalmazban.",
  },
  "The selected player does not exist in the current Rust dataset.": {
    en: "The selected player does not exist in the current Rust dataset.",
    hu: "A kiválasztott játékos nem szerepel a jelenlegi Rust adathalmazban.",
  },
  "A* is not enabled yet for this search view.": {
    en: "A* is not enabled yet for this search view.",
    hu: "Az A* ebben a keresési nézetben még nincs engedélyezve.",
  },
  "A* is not enabled yet because it still needs a valid heuristic.": {
    en: "A* is not enabled yet because it still needs a valid heuristic.",
    hu: "Az A* még nincs engedélyezve, mert még hiányzik egy érvényes heurisztika.",
  },
  "No friend-only route is available in the current graph.": {
    en: "No friend-only route is available in the current graph.",
    hu: "A jelenlegi gráfban nincs csak baráti kapcsolatokat használó útvonal.",
  },
  "No friend-only route is available in the current Rust graph.": {
    en: "No friend-only route is available in the current Rust graph.",
    hu: "A jelenlegi Rust-gráfban nincs csak baráti kapcsolatokat használó útvonal.",
  },
  "Try battle-path to include enemy edges.": {
    en: "Try battle-path to include enemy edges.",
    hu: "Próbáld ki a battle-path módot az ellenséges élek bevonásához.",
  },
  "Enemy edges are enabled in this run and may shorten the route.": {
    en: "Enemy edges are enabled in this run and may shorten the route.",
    hu: "Ebben a futásban az ellenséges élek engedélyezve vannak, és rövidíthetik az útvonalat.",
  },
  "Enemy edges are enabled in this run.": {
    en: "Enemy edges are enabled in this run.",
    hu: "Ebben a futásban az ellenséges élek engedélyezve vannak.",
  },
  "Weighted Dijkstra treats stronger repeated connections as cheaper edges.": {
    en: "Weighted Dijkstra treats stronger repeated connections as cheaper edges.",
    hu: "A súlyozott Dijkstra az erősebb, ismétlődő kapcsolatokat olcsóbb élekként kezeli.",
  },
  "A* uses landmark and cluster lower bounds while preserving exact shortest-path results.": {
    en: "A* uses landmark and cluster lower bounds while preserving exact shortest-path results.",
    hu: "Az A* landmark- és klaszteralapú alsó korlátokat használ, miközben megőrzi a pontos legrövidebb út eredményét.",
  },
  "Pathfinder backend request failed.": {
    en: "Pathfinder backend request failed.",
    hu: "A Pathfinder backend kérése sikertelen volt.",
  },
  "Rust pathfinder binary not found. Build backend/pathfinder-rust first or set PATHFINDER_RUST_BIN.": {
    en: "Rust pathfinder binary not found. Build backend/pathfinder-rust first or set PATHFINDER_RUST_BIN.",
    hu: "A Rust pathfinder bináris nem található. Előbb buildeld a backend/pathfinder-rust projektet, vagy állítsd be a PATHFINDER_RUST_BIN változót.",
  },
};

export function translateBackendText(language: Language, text: string) {
  return backendTextMap[text]?.[language] ?? text;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") {
      return "en";
    }
    const storedLanguage = window.localStorage.getItem(STORAGE_KEY);
    return storedLanguage === "hu" || storedLanguage === "en" ? storedLanguage : "en";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: translations[language],
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return value;
}
