import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AlgorithmId, PathMode, RunStatus, TracePhase } from "./pathfinderTypes";

export type Language = "en" | "hu";

type TranslationTree = {
  app: {
    title: string;
    nav: {
      matchAnalysis: string;
      matchAnalysisDescription: string;
      graph: string;
      graphDescription: string;
      graphSphere: string;
      graphSphereDescription: string;
      signedBalance: string;
      signedBalanceDescription: string;
      assortativity: string;
      assortativityDescription: string;
      pathfinderLab: string;
      pathfinderLabDescription: string;
      generateGraph: string;
      normalizePlayers: string;
      language: string;
      hungarian: string;
      english: string;
      brandSubtitle: string;
      navigateSection: string;
      actionsSection: string;
      expandNavigation: string;
      collapseNavigation: string;
      graphPipelineTitle: string;
      graphPipelineCaption: string;
      playerHygieneTitle: string;
      playerHygieneCaption: string;
      interfaceLanguageTitle: string;
      interfaceLanguageCaption: string;
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
    jumpToEnd: string;
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
    replayTitle: string;
    cachedReplays: string;
    loadReplay: string;
    loadedFromMemory: string;
    deleteReplay: string;
    openReplayLibrary: string;
    replayLibraryTitle: string;
    replayLibraryDescription: string;
    closeReplayLibrary: string;
    noSavedReplays: string;
    savedAt: string;
    replayCountSingle: string;
    replayCountPlural: string;
    selectedNode: string;
    selectedNodeHint: string;
    useAsSource: string;
    useAsTarget: string;
    nodeAlreadySelected: string;
    clickNodePrompt: string;
    };
    graphSphere: {
      pageLabel: string;
      pageTitle: string;
      pageDescription: string;
      datasetMode: string;
      datasetModeHelp: string;
      datasetModeEffect: string;
      fullDataset: string;
      mockDataset: string;
      mockDatasetActiveEffect: string;
      mockModeBadge: string;
      showPanel: string;
      hidePanel: string;
      renderer: string;
      loading: string;
      loadingDetail: string;
      loadFailed: string;
      controlsTitle: string;
      searchLabel: string;
      searchPlaceholder: string;
      searchResults: string;
      summary: string;
      nodes: string;
      edges: string;
      clusters: string;
      allyEdges: string;
      enemyEdges: string;
      generationTime: string;
      inspectTitle: string;
      inspectPreview: string;
      inspectPinned: string;
      hoverHint: string;
      noSelection: string;
      playerId: string;
      playerName: string;
      clusterId: string;
      totalDegree: string;
      allyDegree: string;
      enemyDegree: string;
      totalSupport: string;
      focusNode: string;
      sceneTitle: string;
      zoomHint: string;
      edgeMode: string;
      selectedNeighborhood: string;
    };
    signedBalance: {
      pageLabel: string;
      pageTitle: string;
      pageDescription: string;
      controls: string;
      datasetMode: string;
      datasetModeHelp: string;
      datasetModeEffect: string;
      fullDataset: string;
      mockDataset: string;
      mockDatasetActiveEffect: string;
      mockModeBadge: string;
      minEdgeSupport: string;
      minEdgeSupportHelp: string;
      minEdgeSupportEffect: string;
      tiePolicy: string;
      tiePolicyHelp: string;
      tiePolicyEffect: string;
      tieExclude: string;
      tieAlly: string;
      tieEnemy: string;
      maxTopNodes: string;
      maxTopNodesHelp: string;
      maxTopNodesEffect: string;
      clusterSummaries: string;
      clusterSummariesHelp: string;
      clusterSummariesEffect: string;
      runAnalysis: string;
      running: string;
      runHint: string;
      runHintMock: string;
      waitingToRun: string;
      readOnly: string;
      loadFailed: string;
      warnings: string;
      totalTriads: string;
      balancedCount: string;
      unbalancedCount: string;
      balancedRatio: string;
      balanced: string;
      unbalanced: string;
      triads: string;
      triadDistribution: string;
      graphSummary: string;
      filteredNodes: string;
      projectedNodes: string;
      candidateEdges: string;
      analyzedEdges: string;
      excludedLowSupport: string;
      excludedTied: string;
      graphSummaryText: string;
      balanceSplitChart: string;
      balanceSplitChartText: string;
      balanceSplitAllBalanced: string;
      balanceSplitMixed: string;
      edgePipelineChart: string;
      edgePipelineChartText: string;
      decisions: string;
      decisionsText: string;
      graphScope: string;
      edgeProjection: string;
      supportMeasure: string;
      signRule: string;
      validTriadRule: string;
      researchReading: string;
      researchReadingText: string;
      researchInterpretation: string;
      researchNoTriads: string;
      triadDistributionText: string;
      instabilityChart: string;
      instabilityChartText: string;
      topUnbalancedNodes: string;
      topUnbalancedNodesText: string;
      player: string;
      playerId: string;
      instabilityScore: string;
      clusterId: string;
      clusterSize: string;
      localTriads: string;
      clusterSummariesText: string;
      triadExamples: string;
      triadExamplesText: string;
      triadLegendPositive: string;
      triadLegendNegative: string;
      triadTypeAllPositive: string;
      triadTypeTwoPositive: string;
      triadTypeOnePositive: string;
      triadTypeAllNegative: string;
      triadMeaningAllPositive: string;
      triadMeaningTwoPositive: string;
      triadMeaningOnePositive: string;
      triadMeaningAllNegative: string;
      documentationTitle: string;
      documentationIntro: string;
      docWhatTitle: string;
      docWhatText: string;
      docBalancedTitle: string;
      docBalancedText: string;
      docUnbalancedTitle: string;
      docUnbalancedText: string;
      parameterGuideTitle: string;
      howToReadTitle: string;
      howToReadText: string;
      documentationImplementationNote: string;
    };
  };

const translations: Record<Language, TranslationTree> = {
  en: {
    app: {
      title: "League of Legends Feed Analyzer",
      nav: {
        matchAnalysis: "Match Analysis",
        matchAnalysisDescription: "Collect recent matches, inspect player metrics, and ground later graph analysis in raw game evidence",
        graph: "Association Graph",
        graphDescription: "View the association graph and launch route exploration from the current player network",
        graphSphere: "3D Graph Sphere",
        graphSphereDescription: "Explore the full player network spatially through clusters, neighborhoods, and node inspection",
        signedBalance: "Signed Balance",
        signedBalanceDescription: "Research-facing signed-network experiment for testing local structural balance in the player graph",
        assortativity: "Assortativity",
        assortativityDescription: "Experiment page for checking whether connected players stay similar on key performance signals",
        pathfinderLab: "Pathfinder Lab",
        pathfinderLabDescription: "Route-search experiment for comparing algorithms, traversal modes, and replay traces on the graph",
        generateGraph: "Generate Graph",
        normalizePlayers: "Normalize Players",
        language: "Language",
        hungarian: "Hungarian",
        english: "English",
        brandSubtitle: "Thesis interface for match evidence, player graphs, route search, and signed-network experiments.",
        navigateSection: "Navigate",
        actionsSection: "Actions",
        expandNavigation: "Expand navigation",
        collapseNavigation: "Collapse navigation",
        graphPipelineTitle: "Graph Pipeline",
        graphPipelineCaption: "Rebuild the association graph from the current processed dataset state.",
        playerHygieneTitle: "Player Hygiene",
        playerHygieneCaption: "Normalize stored player records so later graph views and summaries stay readable and consistent.",
        interfaceLanguageTitle: "Interface Language",
        interfaceLanguageCaption: "Switch the thesis UI copy between English and Hungarian.",
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
      panelHeading: "Find a route through the live graph",
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
      rustBackend: "Backend",
      nodeBackend: "Node Backend",
      browserReplay: "Mock Mode",
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
      pageTitle: "Trace how routes emerge through the player graph",
      pageDescription: "Choose two players and compare how different search strategies move through the same network. This page is the route-finding experiment for the thesis: it shows what each path mode exposes, how weighting changes the route, and how the search frontier grows before the final path is resolved.",
      availablePlayers: "Available Players",
      relationships: "Relationships",
      renderer: "Renderer",
      canvasOverlay: "Canvas overlay",
      whatGraphShows: "What the graph shows",
      whatGraphShowsText: "Each node is a player in the observed network. Edges represent repeated match relationships: ally edges come from cooperative play, while enemy edges capture repeated opposition that can still connect distant parts of the graph.",
      pathModes: "Path modes",
      pathModesText: "Social path limits the route to ally links only. Battle path also allows enemy links, which often changes what counts as reachable and can expose shorter or more surprising routes.",
      algorithmsPlayback: "Algorithms and playback",
      algorithmsPlaybackText: "BFS gives the clearest breadth-first expansion, Bidirectional shows how meeting in the middle changes the search, and Dijkstra or A* can weight edges by repeated match history. In weighted mode, stronger ties become cheaper, so the route leans toward more established connections instead of treating every hop equally.",
      activeExecution: "Active execution",
      activeExecutionTextWithSpec: "The route and trace contract stays consistent across the available execution paths, so comparisons remain readable.",
      activeExecutionTextWithoutSpec: "Search results still follow the same route and trace format across the interface.",
      graphPreview: "Graph Preview",
      graphPreviewText: "The controls on this page drive this preview directly. Open the full overlay when you want a larger scene, but the selected route and playback stay synchronized here as well.",
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
      jumpToEnd: "Jump to End",
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
      overlayExplanation: "Social path limits traversal to ally links. Battle path also allows enemy links, which can expose shorter or otherwise unreachable routes. When weighted search is enabled, repeated connections become cheaper, so stronger match-history edges are favored. Playback first reveals the explored frontier and then resolves the final route.",
      currentStep: "Current step",
      metadataRustFailed: "The backend is selected, but its metadata could not be loaded.",
      metadataFailed: "Backend metadata failed to load.",
      comparisonUnavailable: "Comparison data unavailable.",
      defaultComparison: "Run a search to compare how the route changes across path modes.",
      routeThroughGraph: "Find a route through the live graph",
      currentModePrefix: "Current mode",
      replayTitle: "Replay Title",
      cachedReplays: "Saved Replays",
      loadReplay: "Load Replay",
      loadedFromMemory: "Loaded from saved replay.",
      deleteReplay: "Delete replay",
      openReplayLibrary: "Open replay library",
      replayLibraryTitle: "Saved pathfinder replays",
      replayLibraryDescription: "Browse saved pathfinder runs, then load any of them back into the canvas and playback controls for side-by-side thesis discussion or demo playback.",
      closeReplayLibrary: "Close replay library",
      noSavedReplays: "No saved pathfinder replays yet.",
      savedAt: "Saved at",
      replayCountSingle: "saved replay",
      replayCountPlural: "saved replays",
      selectedNode: "Selected Node",
      selectedNodeHint: "Use the clicked graph node to populate either endpoint in the search controls.",
      useAsSource: "Use as Source",
      useAsTarget: "Use as Target",
      nodeAlreadySelected: "Already selected",
      clickNodePrompt: "Click a graph node to map it into the route inputs.",
    },
    graphSphere: {
      pageLabel: "Experimental Graph",
      pageTitle: "Full 3D graph sphere",
      pageDescription: "Explore the full named-player network like a static star map. The layout is precomputed so clusters stay tighter locally and the browser can stay focused on navigation instead of physics.",
      datasetMode: "Dataset mode",
      datasetModeHelp: "Switch between the full exported birdseye graph and the smaller built-in mock dataset for demos and fresh clones.",
      datasetModeEffect: "Mock mode gives the 3D sphere an instant demo dataset, while full mode loads the exported real-player graph.",
      fullDataset: "Full dataset",
      mockDataset: "Mock dataset",
      mockDatasetActiveEffect: "Mock mode is active, so this sphere is rendered from the smaller built-in demo graph and should load instantly on any clone.",
      mockModeBadge: "Mock sphere mode is enabled for a faster demo-friendly 3D graph.",
      showPanel: "Show controls",
      hidePanel: "Hide controls",
      renderer: "Three.js WebGL",
      loading: "Loading 3D graph...",
      loadingDetail: "Preparing manifest, metadata, and binary buffers for the 3D graph view.",
      loadFailed: "The 3D graph data could not be loaded.",
      controlsTitle: "Flight controls",
      searchLabel: "Search players",
      searchPlaceholder: "Search by name or puuid",
      searchResults: "Search results",
      summary: "Dataset summary",
      nodes: "nodes",
      edges: "edges",
      clusters: "layout groups",
      allyEdges: "ally edges",
      enemyEdges: "enemy edges",
      generationTime: "generation time",
      inspectTitle: "Node inspect",
      inspectPreview: "Hover preview",
      inspectPinned: "Pinned node",
      hoverHint: "Middle mouse rotates, arrow keys move the camera target, wheel zooms, and picking only activates when you are close enough.",
      noSelection: "No node selected yet.",
      playerId: "Player ID",
      playerName: "Player name",
      clusterId: "Cluster ID",
      totalDegree: "Total degree",
      allyDegree: "Ally degree",
      enemyDegree: "Enemy degree",
      totalSupport: "Total support",
      focusNode: "Focus node",
      sceneTitle: "Sphere renderer",
      zoomHint: "Left drag pans, middle drag rotates, right drag dollies, arrow keys shift the view, and wheel zooms.",
      edgeMode: "All edges stay loaded, but they stay faint until you move closer or pin a neighborhood.",
      selectedNeighborhood: "Selected neighborhood",
    },
    signedBalance: {
      pageLabel: "Signed network experiment",
      pageTitle: "Structural balance in the player graph",
      pageDescription: "This page tests whether the observed player graph looks locally stable once repeated ally and enemy evidence are projected into signed ties. It is the structural-balance experiment of the thesis: run it with different thresholds, then read how much of the signed graph resolves into balanced versus unbalanced triads.",
      controls: "Experiment controls",
      datasetMode: "Dataset mode",
      datasetModeHelp: "Switch between the full player graph and the smaller mock dataset used for fast local demos.",
      datasetModeEffect: "Mock mode is easier to explain step by step, while full mode reflects the real experimental graph.",
      fullDataset: "Full dataset",
      mockDataset: "Mock dataset",
      mockDatasetActiveEffect: "Mock mode is active, so the experiment runs on the smaller demo graph and should be easier to explain in a presentation setting.",
      mockModeBadge: "Mock dataset mode is enabled for a smaller, presentation-friendly network.",
      minEdgeSupport: "Minimum edge support",
      minEdgeSupportHelp: "Only keep projected edges with at least this much evidence from repeated match history.",
      minEdgeSupportEffect: "Higher values make the graph stricter and usually reduce the number of analyzed triads.",
      tiePolicy: "Tie policy",
      tiePolicyHelp: "Choose what happens when ally and enemy evidence are exactly equal for one edge.",
      tiePolicyEffect: "Excluding ties gives a cleaner but smaller graph, while forcing ally or enemy changes the final triad mix.",
      tieExclude: "Exclude tied edges",
      tieAlly: "Resolve ties as ally",
      tieEnemy: "Resolve ties as enemy",
      maxTopNodes: "Top unstable nodes",
      maxTopNodesHelp: "Select how many players appear in the instability ranking and chart.",
      maxTopNodesEffect: "Higher values expose more local problem cases, but make the ranking panels denser.",
      clusterSummaries: "Cluster summaries",
      clusterSummariesHelp: "Toggle the optional cluster-level balance table.",
      clusterSummariesEffect: "Enabling it adds local balance summaries, but the core global analysis stays the same.",
      runAnalysis: "Run analysis",
      running: "Running...",
      runHint: "The analysis runs only when you press the button, so the current settings stay explicit and easy to discuss.",
      runHintMock: "Mock mode is selected, so this run will use the smaller demo graph instead of the full player network.",
      waitingToRun: "The signed-balance experiment is ready. Adjust the projection settings, then run the analysis when you want a fresh readout.",
      readOnly: "Observational signed-network analysis over the selected graph projection.",
      loadFailed: "Signed balance analysis could not be loaded.",
      warnings: "Warnings",
      totalTriads: "Total signed triads",
      balancedCount: "Balanced triads",
      unbalancedCount: "Unbalanced triads",
      balancedRatio: "Balanced ratio",
      balanced: "Balanced",
      unbalanced: "Unbalanced",
      triads: "triads",
      triadDistribution: "Triad type distribution",
      graphSummary: "Projection summary",
      filteredNodes: "Filtered nodes",
      projectedNodes: "Projected nodes",
      candidateEdges: "Candidate edges",
      analyzedEdges: "Analyzed edges",
      excludedLowSupport: "Excluded low-support edges",
      excludedTied: "Excluded tied edges",
      graphSummaryText: "This shows how much of the player graph survives the current projection choices before triads are counted.",
      balanceSplitChart: "Balanced versus unbalanced",
      balanceSplitChartText: "Use this as the fast read: does local social consistency dominate the valid signed triads in this run, or does visible tension remain?",
      balanceSplitAllBalanced: "Every analyzed triad in this run ended up balanced under the current projection choices.",
      balanceSplitMixed: "The graph still leans one way or the other, but the unbalanced share shows where local tension survives the projection.",
      edgePipelineChart: "Edge filtering pipeline",
      edgePipelineChartText: "This chart shows how the candidate graph is narrowed by support threshold and tie policy before triads are counted.",
      decisions: "Design decisions",
      decisionsText: "These are the exact projection rules behind the current run, which keeps the experiment explicit, discussable, and reproducible.",
      graphScope: "Graph scope",
      edgeProjection: "Edge projection",
      supportMeasure: "Support measure",
      signRule: "Sign rule",
      validTriadRule: "Valid triad rule",
      researchReading: "Research reading",
      researchReadingText: "This turns the raw counts into a short interpretation, but it should still be read as descriptive graph analysis rather than causal proof.",
      researchInterpretation: "The current run suggests a balanced ratio of {ratio}, with {balanced} balanced triads versus {unbalanced} unbalanced triads in the analyzed signed graph.",
      researchNoTriads: "No valid signed triads survived the current support threshold and tie policy.",
      triadDistributionText: "Each triad type captures a different local signed pattern. Balanced theory expects `+++` and `+--` to be the stable families.",
      instabilityChart: "Player instability snapshot",
      instabilityChartText: "These bars highlight the players who appear most often in unbalanced triads under the current settings.",
      topUnbalancedNodes: "Players in the most unbalanced triads",
      topUnbalancedNodesText: "The table ranks players by how often they participate in structurally inconsistent local patterns.",
      player: "Player",
      playerId: "Player ID",
      instabilityScore: "Instability score",
      clusterId: "Cluster ID",
      clusterSize: "Cluster size",
      localTriads: "Local triads",
      clusterSummariesText: "Cluster summaries are optional local views that help show whether imbalance concentrates in a few communities or appears more broadly.",
      triadExamples: "Visual triad examples",
      triadExamplesText: "These mini signed graphs make the four triad families visible before you interpret the counts. Green edges are ally ties and red edges are enemy ties.",
      triadLegendPositive: "positive ally edge",
      triadLegendNegative: "negative enemy edge",
      triadTypeAllPositive: "friend of my friend is my friend",
      triadTypeTwoPositive: "friend of my friend is my enemy",
      triadTypeOnePositive: "enemy of my enemy is my friend",
      triadTypeAllNegative: "enemy of my enemy is still my enemy",
      triadMeaningAllPositive: "All three relationships are positive, so the local structure reads as mutually friendly and balanced.",
      triadMeaningTwoPositive: "Two positive edges and one negative edge create a local contradiction, so this family is treated as unbalanced.",
      triadMeaningOnePositive: "One positive edge and two negative edges resolve into the classic enemy-of-enemy-is-friend pattern, so this family is balanced.",
      triadMeaningAllNegative: "All three relationships are negative, which leaves the triad fully hostile and structurally unbalanced in this interpretation.",
      documentationTitle: "What this experiment means",
      documentationIntro: "This section is the short thesis-facing explanation of what is being measured, why the controls matter, and how to read the output.",
      docWhatTitle: "What is a signed triad?",
      docWhatText: "A signed triad is a fully connected triple of players where each edge is assigned a positive ally sign or a negative enemy sign after projection.",
      docBalancedTitle: "What counts as balanced?",
      docBalancedText: "Structural Balance Theory treats `+++` and `+--` as balanced. In plain language: friend-of-friend stays friendly, and enemy-of-enemy resolves into friendship.",
      docUnbalancedTitle: "What counts as unbalanced?",
      docUnbalancedText: "Patterns like `++-` are unbalanced because local relationships pull in conflicting directions. They can be read as small pockets of social inconsistency.",
      parameterGuideTitle: "Parameter guide",
      howToReadTitle: "How to read the output",
      howToReadText: "Start with the balanced ratio and the balanced-versus-unbalanced chart. Then inspect the triad distribution to see which signed patterns dominate, and finally use the instability and cluster panels to locate where imbalance concentrates. If one parameter sharply changes the counts, the result is sensitive to projection choices and should be interpreted carefully.",
      documentationImplementationNote: "Implementation note: this page visualizes a deterministic backend experiment over a projected signed player graph, so rerunning the same settings should reproduce the same result.",
    },
  },
  hu: {
    app: {
      title: "League of Legends Feeder Elemző",
      nav: {
        matchAnalysis: "Meccselemzés",
        matchAnalysisDescription: "Meccsbetöltés, játékosmutatók és összegzések",
        graph: "Asszociációs Gráf",
        graphDescription: "Asszociációs gráf és útvonalindító panel",
        graphSphere: "3D Gráfgömb",
        graphSphereDescription: "Magával ragadó 3D klaszter- és csomópontfelfedezés",
        signedBalance: "Strukturális egyensúly",
        signedBalanceDescription: "Előjeles hálózati egyensúlykísérlet munkaterület",
        assortativity: "Asszortativitás",
        assortativityDescription: "Teljesítménymutató-korrelációs kísérleti oldal",
        pathfinderLab: "Pathfinder Labor",
        pathfinderLabDescription: "Algoritmus-összehasonlítás és visszajátszás",
        generateGraph: "Gráf generálása",
        normalizePlayers: "Játékosok normalizálása",
        language: "Nyelv",
        hungarian: "Magyar",
        english: "Angol",
        brandSubtitle: "Kutatási vezérlőpult gráf-, útkeresési és előjeles hálózati államvizsga szakdolgozathoz.",
        navigateSection: "Navigáció",
        actionsSection: "Műveletek",
        expandNavigation: "Navigáció kinyitása",
        collapseNavigation: "Navigáció összecsukása",
        graphPipelineTitle: "Gráf pipeline",
        graphPipelineCaption: "Az asszociációs gráf újraépítése a jelenlegi backend állapotból.",
        playerHygieneTitle: "Játékos karbantartás",
        playerHygieneCaption: "A mentett játékosrekordok normalizálása és a származtatott nevek frissítése.",
        interfaceLanguageTitle: "Felület nyelve",
        interfaceLanguageCaption: "A thesis felületszövegének váltása angol és magyar között.",
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
      panelHeading: "Útkeresés az élő gráfban",
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
      rustBackend: "Backend",
      nodeBackend: "Node Backend",
      browserReplay: "Mock mód",
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
      jumpToEnd: "Ugrás a végére",
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
      metadataRustFailed: "A backend van kiválasztva, de a metaadatai nem töltődtek be.",
      metadataFailed: "Nem sikerült betölteni a backend metaadatait.",
      comparisonUnavailable: "Az összehasonlítási adatok nem érhetők el.",
      defaultComparison: "Indíts egy keresést az útvonalmódok összehasonlításához.",
      routeThroughGraph: "Útkeresés az élő gráfban",
      currentModePrefix: "Aktuális mód",
      replayTitle: "Visszajátszás címe",
      cachedReplays: "Mentett visszajátszások",
      loadReplay: "Visszajátszás betöltése",
      loadedFromMemory: "Mentett visszajátszásból betöltve.",
      deleteReplay: "Visszajátszás törlése",
      openReplayLibrary: "Visszajátszás könyvtár megnyitása",
      replayLibraryTitle: "Mentett pathfinder visszajátszások",
      replayLibraryDescription: "Itt böngészhetők a pathfinder futások után elmentett visszajátszások, és bármelyik közvetlenül visszatölthető a vászonra és a lejátszásvezérlőkbe.",
      closeReplayLibrary: "Visszajátszás könyvtár bezárása",
      noSavedReplays: "Még nincs mentett pathfinder visszajátszás.",
      savedAt: "Mentve",
      replayCountSingle: "mentett visszajátszás",
      replayCountPlural: "mentett visszajátszás",
      selectedNode: "Kijelölt csomópont",
      selectedNodeHint: "A kattintott gráfcsomóponttal közvetlenül kitöltheted bármelyik útvégpont mezőt.",
      useAsSource: "Beállítás forrásként",
      useAsTarget: "Beállítás célként",
      nodeAlreadySelected: "Már be van állítva",
      clickNodePrompt: "Kattints egy gráfcsomópontra, hogy beemeld az útvonal mezőibe.",
    },
    graphSphere: {
      pageLabel: "Kísérleti gráf",
      pageTitle: "Teljes 3D gráfgömb",
      pageDescription: "A teljes névvel rendelkező játékoshálózat itt egy statikus csillagtérként böngészhető. Az elrendezés előre ki van számolva, így a klaszterek lokálisan közelebb maradnak egymáshoz, a böngésző pedig a navigációra koncentrálhat fizika helyett.",
      datasetMode: "Adathalmaz mód",
      datasetModeHelp: "Váltás a teljes exportált birdseye gráf és a kisebb beépített mock adathalmaz között demohoz és friss klónozásokhoz.",
      datasetModeEffect: "A mock mód azonnali demo adathalmazt ad a 3D gömbhöz, míg a teljes mód az exportált valódi játékosgráfot tölti be.",
      fullDataset: "Teljes adathalmaz",
      mockDataset: "Mock adathalmaz",
      mockDatasetActiveEffect: "A mock mód aktív, ezért ez a gömb a kisebb beépített demo gráfból renderelődik, és bármelyik klónon azonnal betöltődik.",
      mockModeBadge: "Mock gömb mód aktív egy gyorsabban bemutatható 3D gráfhoz.",
      showPanel: "Vezérlők mutatása",
      hidePanel: "Vezérlők elrejtése",
      renderer: "Three.js WebGL",
      loading: "3D gráf betöltése...",
      loadingDetail: "Manifest, metaadatok és bináris pufferek előkészítése a 3D gráfnézethez.",
      loadFailed: "Nem sikerült betölteni a 3D gráf adatait.",
      controlsTitle: "Repülési vezérlők",
      searchLabel: "Játékos keresése",
      searchPlaceholder: "Keresés név vagy puuid alapján",
      searchResults: "Keresési találatok",
      summary: "Adathalmaz összegzés",
      nodes: "csomópont",
      edges: "él",
      clusters: "elrendezési csoport",
      allyEdges: "szövetséges él",
      enemyEdges: "ellenséges él",
      generationTime: "generálási idő",
      inspectTitle: "Csomópont vizsgálata",
      inspectPreview: "Lebegő előnézet",
      inspectPinned: "Rögzített csomópont",
      hoverHint: "A középső egérgomb forgat, a nyilak mozgatják a nézet célpontját, a görgő nagyít, és kijelölni csak kellően közelről lehet.",
      noSelection: "Még nincs kijelölt csomópont.",
      playerId: "Játékos azonosító",
      playerName: "Játékosnév",
      clusterId: "Klaszter azonosító",
      totalDegree: "Teljes fokszám",
      allyDegree: "Szövetséges fokszám",
      enemyDegree: "Ellenséges fokszám",
      totalSupport: "Összes támogatás",
      focusNode: "Csomópont fókuszálása",
      sceneTitle: "Gömb renderelő",
      zoomHint: "Bal húzás pásztáz, középső húzás forgat, jobb húzás dolly-zik, a nyilak arrébb viszik a nézetet, a görgő zoomol.",
      edgeMode: "Minden él betöltve marad, de csak közelebbről vagy kijelölt környezetnél erősödik fel.",
      selectedNeighborhood: "Kijelölt szomszédság",
    },
    signedBalance: {
      pageLabel: "Előjeles hálózati kísérlet",
      pageTitle: "Strukturális egyensúly a játékosgráfban",
      pageDescription: "Ez az oldal kutatásra szabott nézetet ad a signed-triad kísérlethez. Újrafuttathatóvá teszi a megfigyeléses elemzést állítható küszöbökkel, és megmutatja, hogy a kiegyensúlyozott lokális struktúrák dominálják-e a megfigyelt előjeles gráfot.",
      controls: "Kísérleti vezérlők",
      datasetMode: "Adathalmaz mód",
      datasetModeHelp: "Váltás a teljes játékosgráf és a Pathfinder Laborból ismert kisebb mock adathalmaz között.",
      datasetModeEffect: "A mock mód könnyebben magyarázható és átlátható, míg a teljes mód a valódi kísérleti gráfot mutatja.",
      fullDataset: "Teljes adathalmaz",
      mockDataset: "Mock adathalmaz",
      mockDatasetActiveEffect: "A mock mód aktív, ezért a kísérlet a kisebb demo gráfon fut, amit sokkal könnyebb lépésről lépésre elmagyarázni.",
      mockModeBadge: "Mock adathalmaz mód aktív egy kisebb, könnyebben bemutatható hálózathoz.",
      minEdgeSupport: "Minimum éltámogatás",
      minEdgeSupportHelp: "Csak azok az élek maradnak bent, amelyek mögött legalább ennyi ismétlődő meccstörténeti bizonyíték áll.",
      minEdgeSupportEffect: "Nagyobb érték szigorúbb gráfot ad, és általában csökkenti az elemzett triádok számát.",
      tiePolicy: "Döntetlenkezelés",
      tiePolicyHelp: "Ez szabályozza, mi történjen akkor, ha egy élhez pontosan ugyanannyi ally és enemy bizonyíték tartozik.",
      tiePolicyEffect: "A kizárás tisztább, de kisebb gráfot ad, míg a szövetséges vagy ellenség feloldás megváltoztatja a végső triádösszetételt.",
      tieExclude: "Döntetlen élek kizárása",
      tieAlly: "Döntetlen szövetségesként",
      tieEnemy: "Döntetlen ellenségként",
      maxTopNodes: "Top instabil játékosok",
      maxTopNodesHelp: "Ez adja meg, hány játékos jelenjen meg az instabilitási rangsorban és a mini diagramon.",
      maxTopNodesEffect: "Nagyobb értéknél több lokális problémás eset látszik, de zsúfoltabbak lesznek a rangsor panelek.",
      clusterSummaries: "Klaszter összegzések",
      clusterSummariesHelp: "Kapcsolja be vagy ki az opcionális klaszterszintű egyensúly táblát.",
      clusterSummariesEffect: "Bekapcsolva lokális klaszterösszegzéseket ad hozzá, de a globális elemzés magja nem változik.",
      runAnalysis: "Elemzés futtatása",
      running: "Futás...",
      runHint: "Itt semmi sem indul el magától. A kísérlet csak a gomb megnyomására fut le.",
      runHintMock: "A mock mód van kiválasztva, ezért ez a futás a kisebb demo gráfot használja a teljes játékoshálózat helyett.",
      waitingToRun: "A signed-balance kísérlet most tétlen. Állítsd be a küszöböket, majd nyomd meg az Elemzés futtatása gombot, amikor el akarod indítani.",
      readOnly: "Csak olvasható, megfigyeléses modul előjeles hálózatelemzéshez.",
      loadFailed: "Nem sikerült betölteni a strukturális egyensúly elemzést.",
      warnings: "Figyelmeztetések",
      totalTriads: "Összes előjeles triád",
      balancedCount: "Kiegyensúlyozott triádok",
      unbalancedCount: "Kiegyensúlyozatlan triádok",
      balancedRatio: "Kiegyensúlyozottsági arány",
      balanced: "Kiegyensúlyozott",
      unbalanced: "Kiegyensúlyozatlan",
      triads: "triád",
      triadDistribution: "Triádtípus eloszlás",
      graphSummary: "Projekció összegzés",
      filteredNodes: "Szűrt csomópontok",
      projectedNodes: "Leképezett csomópontok",
      candidateEdges: "Jelölt élek",
      analyzedEdges: "Elemzett élek",
      excludedLowSupport: "Kizárt gyenge élek",
      excludedTied: "Kizárt döntetlen élek",
      graphSummaryText: "Ez mutatja meg, a játékosgráf mekkora része maradt bent az aktuális projekció és küszöbök mellett.",
      balanceSplitChart: "Kiegyensúlyozott vs kiegyensúlyozatlan",
      balanceSplitChartText: "Gyors áttekintés arról, hogy a valid előjeles triádok között a társas konzisztencia dominál-e ebben a futásban.",
      balanceSplitAllBalanced: "Ebben a futásban minden elemzett triád kiegyensúlyozottnak bizonyult a jelenlegi projekciós döntések mellett.",
      balanceSplitMixed: "A gráf valamelyik irányba továbbra is eltolódik, de a kiegyensúlyozatlan arány megmutatja, hol marad fenn lokális feszültség.",
      edgePipelineChart: "Élszűrési pipeline",
      edgePipelineChartText: "Ez a diagram megmutatja, hány jelölt él marad bent a támogatási küszöb és a döntetlenkezelés után, mielőtt a triádok számolása megtörténik.",
      decisions: "Tervezési döntések",
      decisionsText: "Ezek a futás mögötti pontos projekciós szabályok, hogy a kísérlet egyértelmű és reprodukálható maradjon.",
      graphScope: "Gráf hatókör",
      edgeProjection: "Élprojekció",
      supportMeasure: "Támogatási mérőszám",
      signRule: "Előjel szabály",
      validTriadRule: "Érvényes triád szabály",
      researchReading: "Kutatási olvasat",
      researchReadingText: "Ez a nyers számokból rövid értelmezést ad, de továbbra is leíró elemzésként kell olvasni, nem oksági bizonyítékként.",
      researchInterpretation: "Az aktuális futás {ratio} kiegyensúlyozottsági arányt jelez, {balanced} kiegyensúlyozott és {unbalanced} kiegyensúlyozatlan triáddal az elemzett előjeles gráfban.",
      researchNoTriads: "Az aktuális küszöb és döntetlenkezelés mellett nem maradt érvényes előjeles triád.",
      triadDistributionText: "Minden triádtípus más lokális előjeles mintát ír le. Az egyensúlyelmélet szerint a `+++` és a `+--` a stabil családok.",
      instabilityChart: "Játékos instabilitási pillanatkép",
      instabilityChartText: "Ezek az oszlopok azokat a játékosokat emelik ki, akik a jelenlegi beállítások mellett a legtöbbször szerepelnek kiegyensúlyozatlan triádokban.",
      topUnbalancedNodes: "A legtöbb kiegyensúlyozatlan triádban szereplő játékosok",
      topUnbalancedNodesText: "A tábla azt rangsorolja, hogy a játékosok milyen gyakran vesznek részt strukturálisan inkonzisztens lokális mintákban.",
      player: "Játékos",
      playerId: "Játékos azonosító",
      instabilityScore: "Instabilitási pontszám",
      clusterId: "Klaszter azonosító",
      clusterSize: "Klaszter méret",
      localTriads: "Lokális triádok",
      clusterSummariesText: "A klaszterösszegzések opcionális lokális nézetek, hasznosak annak ellenőrzésére, hogy az egyensúlytalanság néhány közösségben sűrűsödik-e.",
      triadExamples: "Vizuális triád példák",
      triadExamplesText: "Ezek a mini előjeles gráfok láthatóvá teszik a négy triádcsaládot, mielőtt a számlálásokat értelmeznéd. A zöld élek ally kapcsolatokat, a piros élek enemy kapcsolatokat jelentenek.",
      triadLegendPositive: "pozitív ally él",
      triadLegendNegative: "negatív enemy él",
      triadTypeAllPositive: "a barátom barátja a barátom",
      triadTypeTwoPositive: "a barátom barátja az ellenségem",
      triadTypeOnePositive: "az ellenségem ellensége a barátom",
      triadTypeAllNegative: "az ellenségem ellensége is ellenség marad",
      triadMeaningAllPositive: "Mindhárom kapcsolat pozitív, ezért a lokális szerkezet kölcsönösen barátinak és kiegyensúlyozottnak olvasható.",
      triadMeaningTwoPositive: "Két pozitív és egy negatív él lokális ellentmondást hoz létre, ezért ezt a családot kiegyensúlyozatlannak kezeljük.",
      triadMeaningOnePositive: "Egy pozitív és két negatív él a klasszikus ellenségem ellensége a barátom mintát adja, ezért ez a család kiegyensúlyozott.",
      triadMeaningAllNegative: "Mindhárom kapcsolat negatív, így a triád teljesen ellenséges marad, ami ebben az értelmezésben strukturálisan kiegyensúlyozatlan.",
      documentationTitle: "Mit jelent ez a kísérlet?",
      documentationIntro: "Ez a rész a gyors thesis/demo magyarázat arra, hogy mit látsz, és hogyan módosítják a vezérlők a kimenetet.",
      docWhatTitle: "Mi az az előjeles triád?",
      docWhatText: "Az előjeles triád egy teljesen összekötött játékoshármas, ahol minden él egy projekció után pozitív ally vagy negatív enemy előjelet kap.",
      docBalancedTitle: "Mi számít kiegyensúlyozottnak?",
      docBalancedText: "A Strukturális Egyensúly Elmélet a `+++` és a `+--` mintákat tekinti kiegyensúlyozottnak. Egyszerűbben: a barátom barátja barát marad, az ellenségem ellensége pedig baráttá oldódik.",
      docUnbalancedTitle: "Mi számít kiegyensúlyozatlannak?",
      docUnbalancedText: "Az olyan minták, mint a `++-`, kiegyensúlyozatlanok, mert a lokális kapcsolatok ellentétes irányba húznak. Ezek kis társas inkonzisztencia-zsebekként olvashatók.",
      parameterGuideTitle: "Paraméter útmutató",
      howToReadTitle: "Hogyan olvasd az eredményt",
      howToReadText: "Kezdd a kiegyensúlyozottsági aránnyal és a balanced-vs-unbalanced diagrammal. Ezután nézd meg a triádeloszlást, hogy mely előjeles minták dominálnak, végül használd az instabilitási és klaszter paneleket annak feltárására, hol sűrűsödik az egyensúlytalanság. Ha egyetlen paraméter módosítása erősen átrendezi a számokat, az arra utal, hogy az eredmény érzékeny a projekciós döntésekre, ezért óvatosan kell értelmezni.",
      documentationImplementationNote: "Implementációs megjegyzés: ez az oldal egy determinisztikus háttérelemzés eredményét jeleníti meg egy projekciózott előjeles játékosgráfon, ezért ugyanazokkal a beállításokkal ugyanazt az eredményt kell kapni.",
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
  "available in the backend": {
    en: "available in the backend",
    hu: "elérhető a backendben",
  },
  "The selected player does not exist in the current dataset.": {
    en: "The selected player does not exist in the current dataset.",
    hu: "A kiválasztott játékos nem szerepel a jelenlegi adathalmazban.",
  },
  "A* is not enabled yet for this search view.": {
    en: "A* is not enabled yet for this search view.",
    hu: "Az A* ebben a keresési nézetben még nincs engedélyezve.",
  },
  "A* is not enabled yet because it still needs a valid heuristic.": {
    en: "A* is not enabled yet because it still needs a valid heuristic.",
    hu: "Az A* még nincs engedélyezve, mert még hiányzik egy érvényes heurisztika.",
  },
  "A* is available in the backend pathfinder.": {
    en: "A* is available in the backend pathfinder.",
    hu: "Az A* elérhető a backendes útkeresőben.",
  },
  "No friend-only route is available in the current graph.": {
    en: "No friend-only route is available in the current graph.",
    hu: "A jelenlegi gráfban nincs csak baráti kapcsolatokat használó útvonal.",
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
