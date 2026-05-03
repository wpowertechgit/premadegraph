const express = require("express");
const fs = require("fs");
const http = require("http");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3001;
const DB_EXPLORER_ORIGIN = process.env.DB_EXPLORER_ORIGIN || "http://localhost:5088";
const { execFile, spawn } = require("child_process");
const { normalizePlayersByPuuid } = require("./normalize_players_by_puuid");
const {
  runSearch: runPrototypePathfinderSearch,
  compareAlgorithms: comparePrototypeAlgorithms,
  getOptions: getPrototypePathfinderOptions,
  getEngineSpec: getPrototypeEngineSpec,
} = require("./pathfinder/prototypeEngine");
const { executeRustCommand, executeRustCommandRaw, shutdownDaemon } = require("./pathfinder/rustBridge");
const neurosimBridge = require("./neurosim-bridge");

const DATA_ROOT = path.resolve(__dirname, "data");
const DATASET_REGISTRY_PATH = path.join(DATA_ROOT, "datasets.json");
const DATASET_DATABASES_ROOT = path.join(DATA_ROOT, "databases");
const DATASET_MATCHES_ROOT = path.join(DATA_ROOT, "matches");
const DATASET_CACHE_ROOT = path.join(DATA_ROOT, "cache");
const LEGACY_MATCHES_DIR = DATA_ROOT;
const LEGACY_RAW_DB_PATH = path.resolve(__dirname, "players.db");
const LEGACY_REFINED_DB_PATH = path.resolve(__dirname, "..", "playersrefined.db");
const LEGACY_CACHE_ROOT = path.resolve(__dirname, "pathfinder-rust", "cache");
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DOCUMENTATION_ROOT = path.join(PROJECT_ROOT, "docs");
const DOCUMENTATION_TMP_ROOT = path.join(PROJECT_ROOT, "tmp", "documentation-viewer");
const DOCUMENTATION_ROOT_MARKDOWN = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "README.hu.md",
  "DESIGN.md",
  "TERMS_OF_USE.md",
  "CODE_OF_CONDUCT.md",
]);
const ENV_FILE_PATH = path.join(__dirname, ".env");
const COLLECTOR_CONFIGS_DIR = path.join(__dirname, "collector_configs");
const DATASET_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MANAGED_RUNTIME_KEYS = new Set([
  "RIOT_API_KEY",
  "OPENROUTER_API_KEY",
]);
const MATCH_COLLECTOR_EVENT_PREFIX = "@@MATCH_COLLECTOR@@";
const MATCH_COLLECTOR_LOG_LIMIT = 80;

const rustResponseCache = {
  options: null,
  spec: null,
  "global-view": null,
};
const rustInFlightRequests = new Map();
let signedBalanceQueue = Promise.resolve();
let signedBalanceActivePromise = null;
let signedBalanceActiveKey = null;
let birdseyeCachePromise = null;
let graphV2CachePromises = new Map();
const SQLITE_BUSY_TIMEOUT_MS = 5000;
const GRAPH_V2_EXPECTED_VERSIONS = {
  graphBuilderVersion: "graph-builder-v2.2",
  clusteringAlgorithmVersion: "bounded-ally-groups-v2",
  layoutVersion: "bridge-orbit-layout-v1",
};
let activeDatasetRegistry = null;
let activeDataset = null;
let matchCollectorJob = null;

function getBirdseyeArtifactPaths(cacheDir) {
  return {
    manifest: path.join(cacheDir, "manifest.json"),
    nodeMeta: path.join(cacheDir, "node_meta.json"),
    nodePositions: path.join(cacheDir, "node_positions.f32"),
    nodeMetrics: path.join(cacheDir, "node_metrics.u32"),
    edgePairs: path.join(cacheDir, "edge_pairs.u32"),
    edgeProps: path.join(cacheDir, "edge_props.u32"),
  };
}

function getGraphV2ArtifactPaths(cacheDir) {
  return {
    manifest: path.join(cacheDir, "manifest.json"),
    summary: path.join(cacheDir, "summary.md"),
    nodeMeta: path.join(cacheDir, "node_meta.json"),
    nodePositions: path.join(cacheDir, "node_positions.f32"),
    nodeMetrics: path.join(cacheDir, "node_metrics.u32"),
    edgePairs: path.join(cacheDir, "edge_pairs.u32"),
    edgeProps: path.join(cacheDir, "edge_props.u32"),
    clusterMeta: path.join(cacheDir, "cluster_meta.json"),
  };
}

function clearRustRuntimeState() {
  rustResponseCache.options = null;
  rustResponseCache.spec = null;
  rustResponseCache["global-view"] = null;
  rustInFlightRequests.clear();
  signedBalanceQueue = Promise.resolve();
  signedBalanceActivePromise = null;
  signedBalanceActiveKey = null;
  birdseyeCachePromise = null;
  graphV2CachePromises.clear();
  shutdownDaemon();
}

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function readEnvLines() {
  if (!fs.existsSync(ENV_FILE_PATH)) {
    return [];
  }
  return fs.readFileSync(ENV_FILE_PATH, "utf-8").split(/\r?\n/);
}

function parseEnvValue(keyName) {
  for (const line of readEnvLines()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const currentKey = trimmed.slice(0, separatorIndex).trim();
    if (currentKey !== keyName) {
      continue;
    }
    return trimmed.slice(separatorIndex + 1);
  }
  return process.env[keyName] || "";
}

function maskSecret(value) {
  if (!value) {
    return null;
  }
  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function runtimeKeyMetadata(keyName) {
  const value = parseEnvValue(keyName);
  return {
    keyName,
    isSet: Boolean(value),
    maskedPreview: maskSecret(value),
    storage: "backend/.env",
  };
}

function sanitizeEnvValue(value) {
  const normalized = String(value ?? "").trim();
  if (normalized.includes("\n") || normalized.includes("\r")) {
    throw new Error("Environment values must be single-line.");
  }
  return normalized;
}

function updateManagedEnvKey(keyName, nextValue) {
  if (!MANAGED_RUNTIME_KEYS.has(keyName)) {
    throw new Error("Key is not writable.");
  }

  const lines = readEnvLines();
  const sanitizedValue = sanitizeEnvValue(nextValue);
  const nextLine = sanitizedValue ? `${keyName}=${sanitizedValue}` : null;
  let replaced = false;
  const nextLines = lines
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) {
        return line;
      }
      const currentKey = line.slice(0, separatorIndex).trim();
      if (currentKey !== keyName) {
        return line;
      }
      replaced = true;
      return nextLine;
    })
    .filter((line) => line !== null);

  if (!replaced && nextLine) {
    nextLines.push(nextLine);
  }

  const encoded = nextLines.join("\n").replace(/\n+$/u, "");
  fs.writeFileSync(ENV_FILE_PATH, encoded ? `${encoded}\n` : "");

  if (sanitizedValue) {
    process.env[keyName] = sanitizedValue;
  } else {
    delete process.env[keyName];
  }

  return runtimeKeyMetadata(keyName);
}

function legacyTopLevelMatchFiles() {
  if (!fs.existsSync(LEGACY_MATCHES_DIR)) {
    return [];
  }
  return fs.readdirSync(LEGACY_MATCHES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name);
}

function warnAboutLegacyMatchFiles() {
  const legacyFiles = legacyTopLevelMatchFiles();
  if (!legacyFiles.length) {
    return;
  }
  console.warn(
    `[datasets] Found ${legacyFiles.length} legacy match JSON files directly under backend/data. ` +
    "Active dataset matches now live under backend/data/matches/<dataset-id>/; the top-level files are legacy migration leftovers.",
  );
}

function ensureRiotApiKey() {
  const key = parseEnvValue("RIOT_API_KEY");
  if (!key) {
    const error = new Error("RIOT_API_KEY is not configured in backend/.env.");
    error.statusCode = 400;
    throw error;
  }
  return key;
}

function collectorDefaultConfig() {
  return {
    collectorMode: "standard",
    mode: "random",
    specificPuuid: "",
    matchesPerPlayer: 10,
    maxIterations: 1,
    queueType: "",
    requestsPerSecond: 15,
    requestsPer2Min: 90,
    probeMatchCount: 5,
    minimumPremadeRepeats: 2,
    platformRouting: "eun1",
    regionalRouting: "europe",
    seedPlayers: [],
    seedCount: 1,
    initialMatchesPerSeed: 10,
    maxPlayers: 1,
    maxMatches: 1000,
    constraints: {},
    discovery: {},
    persistMetadata: true,
    resumeFromCheckpoint: true,
    checkpointEveryMatches: 5,
  };
}

function createCollectorSnapshot(overrides = {}) {
  return {
    status: "idle",
    jobId: null,
    datasetId: null,
    config: null,
    currentStage: "idle",
    progress: {
      playersProcessed: 0,
      maxIterations: 0,
      matchesSaved: 0,
      apiCallsMade: 0,
      currentPlayerName: null,
      currentPlayerPuuid: null,
      currentMatchId: null,
      startedAt: null,
      stopRequested: false,
    },
    summary: null,
    logs: [],
    selectionSummary: {
      candidatesTried: 0,
      candidatesSkippedNoPremade: 0,
      candidatesPromoted: 0,
      currentCandidatePuuid: null,
      currentCandidateProbeSummary: null,
    },
    error: null,
    pid: null,
    ...overrides,
  };
}

function getCollectorStatusSnapshot() {
  if (!matchCollectorJob) {
    return createCollectorSnapshot();
  }
  const { childProcess, stopSignalPath, configPath, ...snapshot } = matchCollectorJob;
  return {
    ...snapshot,
    logs: Array.isArray(snapshot.logs) ? snapshot.logs : [],
  };
}

function appendCollectorLog(message, level = "info", timestamp = new Date().toISOString()) {
  if (!matchCollectorJob) {
    return;
  }
  matchCollectorJob.logs = [
    ...(Array.isArray(matchCollectorJob.logs) ? matchCollectorJob.logs : []),
    { timestamp, level, message },
  ].slice(-MATCH_COLLECTOR_LOG_LIMIT);
}

async function countPlayersInDatabase(databasePath) {
  if (!fs.existsSync(databasePath)) {
    return 0;
  }
  return await new Promise((resolve) => {
    const database = new sqlite3.Database(databasePath, sqlite3.OPEN_READONLY, (openError) => {
      if (openError) {
        resolve(0);
        return;
      }
      database.get("SELECT COUNT(*) AS count FROM players", [], (error, row) => {
        database.close();
        if (error) {
          resolve(0);
          return;
        }
        resolve(row?.count ?? 0);
      });
    });
  });
}

async function buildCollectorDatasetSummary(dataset = getActiveDataset()) {
  const details = await buildDatasetInfo(dataset);
  const rawPlayerCount = await countPlayersInDatabase(dataset.rawDbAbsolutePath);
  return {
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    matchCount: details.matchCount,
    refinedPlayerCount: details.refinedPlayerCount,
    rawPlayerCount,
    canUseStrengthenMode: rawPlayerCount > 0,
  };
}

function normalizeCollectorStartPayload(payload = {}) {
  const defaults = collectorDefaultConfig();
  const collectorModes = new Set(["standard", "strengthen-graph", "seed-expansion", "soloq-radial"]);
  const modes = new Set(["random", "specific-puuid", "seed-based", "radial-random"]);
  const collectorMode = collectorModes.has(payload.collectorMode) ? payload.collectorMode : "standard";
  const requestedMode = modes.has(payload.mode) ? payload.mode : "random";
  const mode = collectorMode === "strengthen-graph"
    ? "random"
    : collectorMode === "seed-expansion"
      ? "seed-based"
      : collectorMode === "soloq-radial"
        ? "radial-random"
        : requestedMode;
  const queueType = ["", "420", "430", "440"].includes(String(payload.queueType ?? "")) ? String(payload.queueType ?? "") : "";

  return {
    datasetId: payload.datasetId ? String(payload.datasetId).trim() : null,
    collectorMode,
    mode,
    specificPuuid: String(payload.specificPuuid || "").trim(),
    matchesPerPlayer: Math.max(1, Math.min(20, Number(payload.matchesPerPlayer ?? defaults.matchesPerPlayer) || defaults.matchesPerPlayer)),
    maxIterations: Math.max(1, Math.min(500, Number(payload.maxIterations ?? defaults.maxIterations) || defaults.maxIterations)),
    queueType,
    requestsPerSecond: Math.max(1, Math.min(19, Number(payload.requestsPerSecond ?? defaults.requestsPerSecond) || defaults.requestsPerSecond)),
    requestsPer2Min: Math.max(1, Math.min(99, Number(payload.requestsPer2Min ?? defaults.requestsPer2Min) || defaults.requestsPer2Min)),
    probeMatchCount: Math.max(1, Math.min(5, Number(payload.probeMatchCount ?? defaults.probeMatchCount) || defaults.probeMatchCount)),
    minimumPremadeRepeats: Math.max(2, Math.min(5, Number(payload.minimumPremadeRepeats ?? defaults.minimumPremadeRepeats) || defaults.minimumPremadeRepeats)),
    platformRouting: String(payload.platformRouting || defaults.platformRouting).trim().toLowerCase(),
    regionalRouting: String(payload.regionalRouting || defaults.regionalRouting).trim().toLowerCase(),
    seedPlayers: Array.isArray(payload.seedPlayers) ? payload.seedPlayers.map((value) => String(value).trim()).filter(Boolean) : [],
    seedCount: Math.max(1, Math.min(50, Number(payload.seedCount ?? defaults.seedCount) || defaults.seedCount)),
    initialMatchesPerSeed: Math.max(1, Math.min(20, Number(payload.initialMatchesPerSeed ?? payload.matchesPerPlayer ?? defaults.initialMatchesPerSeed) || defaults.initialMatchesPerSeed)),
    maxPlayers: Math.max(1, Math.min(1000, Number(payload.maxPlayers ?? payload.maxIterations ?? defaults.maxPlayers) || defaults.maxPlayers)),
    maxMatches: Math.max(1, Math.min(10000, Number(payload.maxMatches ?? defaults.maxMatches) || defaults.maxMatches)),
    constraints: payload.constraints && typeof payload.constraints === "object" ? payload.constraints : {},
    discovery: payload.discovery && typeof payload.discovery === "object" ? payload.discovery : {},
    persistMetadata: payload.persistMetadata !== false,
    resumeFromCheckpoint: payload.resumeFromCheckpoint !== false,
    checkpointEveryMatches: Math.max(1, Math.min(100, Number(payload.checkpointEveryMatches ?? defaults.checkpointEveryMatches) || defaults.checkpointEveryMatches)),
    randomSeed: payload.randomSeed,
  };
}

function loadCollectorPresets() {
  if (!fs.existsSync(COLLECTOR_CONFIGS_DIR)) {
    return [];
  }
  return fs.readdirSync(COLLECTOR_CONFIGS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const filePath = path.join(COLLECTOR_CONFIGS_DIR, entry.name);
      const config = readJsonFile(filePath);
      const presetName = entry.name.replace(/\.json$/u, "");
      return {
        id: presetName,
        fileName: entry.name,
        label: config.notes?.purpose || config.datasetId || presetName,
        datasetId: config.datasetId || null,
        collectorMode: config.collectorMode || "standard",
        queueType: String(config.queueType || ""),
        matchesPerPlayer: config.matchesPerPlayer,
        maxPlayers: config.maxPlayers,
        maxMatches: config.maxMatches,
        constraints: config.constraints || {},
        discovery: config.discovery || {},
        notes: config.notes || {},
        config,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildRiotApiKeyList() {
  const key = parseEnvValue("RIOT_API_KEY");
  return key ? [{ id: "riot", value: key }] : [];
}

function applyCollectorEvent(event) {
  if (!matchCollectorJob || !event || typeof event !== "object") {
    return;
  }

  if (event.type === "log") {
    appendCollectorLog(event.message || "", event.level || "info", event.timestamp || new Date().toISOString());
    return;
  }

  if (event.type === "progress") {
    matchCollectorJob.currentStage = event.currentStage || matchCollectorJob.currentStage;
    matchCollectorJob.progress = {
      ...matchCollectorJob.progress,
      ...(event.progress || {}),
    };
    matchCollectorJob.selectionSummary = {
      ...matchCollectorJob.selectionSummary,
      ...(event.selectionSummary || {}),
    };
    if (event.summary) {
      matchCollectorJob.summary = {
        ...(matchCollectorJob.summary || {}),
        ...event.summary,
      };
    }
    return;
  }

  if (event.type === "status") {
    matchCollectorJob.status = event.status || matchCollectorJob.status;
    matchCollectorJob.currentStage = event.currentStage || matchCollectorJob.currentStage;
    matchCollectorJob.summary = {
      ...(matchCollectorJob.summary || {}),
      ...(event.summary || {}),
    };
    matchCollectorJob.error = event.error || null;
  }
}

function attachCollectorStream(stream, onLine) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      onLine(line);
    }
  });
  stream.on("end", () => {
    const finalLine = buffer.trim();
    if (finalLine) {
      onLine(finalLine);
    }
  });
}

async function relayRiotRequest(url) {
  const response = await fetch(url, {
    headers: {
      "X-Riot-Token": ensureRiotApiKey(),
    },
  });

  const rawText = await response.text();
  let payload = {};
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { message: rawText };
    }
  }

  if (!response.ok) {
    const message = payload?.status?.message || payload?.message || "Riot API request failed.";
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function toPortablePath(value) {
  return value.split(path.sep).join("/");
}

function safeCopyFile(sourcePath, destinationPath) {
  if (!fs.existsSync(sourcePath) || fs.existsSync(destinationPath)) {
    return;
  }
  ensureDirectory(path.dirname(destinationPath));
  fs.copyFileSync(sourcePath, destinationPath);
}

function safeCopyJsonMatches(sourceDir, destinationDir) {
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    return;
  }
  ensureDirectory(destinationDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    if (!fs.existsSync(destinationPath)) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function resolveRegistryPath(relativePath, rootPath) {
  const normalized = path.resolve(__dirname, relativePath);
  const normalizedRoot = path.resolve(rootPath);
  if (normalized !== normalizedRoot && !normalized.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error(`Dataset path escapes allowed root: ${relativePath}`);
  }
  return normalized;
}

function materializeDatasetConfig(dataset) {
  return {
    ...dataset,
    rawDbAbsolutePath: resolveRegistryPath(dataset.rawDbPath, DATASET_DATABASES_ROOT),
    refinedDbAbsolutePath: resolveRegistryPath(dataset.refinedDbPath, DATASET_DATABASES_ROOT),
    matchesAbsolutePath: resolveRegistryPath(dataset.matchesPath, DATASET_MATCHES_ROOT),
    cacheAbsolutePath: resolveRegistryPath(dataset.cachePath, DATASET_CACHE_ROOT),
  };
}

function createDatasetRecord(id, name = "Default Dataset", description = "Migrated from existing installation") {
  const rawDbPath = toPortablePath(path.join("data", "databases", id, "players.db"));
  const refinedDbPath = toPortablePath(path.join("data", "databases", id, "playersrefined.db"));
  const matchesPath = toPortablePath(path.join("data", "matches", id));
  const cachePath = toPortablePath(path.join("data", "cache", id));
  return {
    id,
    name,
    description,
    rawDbPath,
    refinedDbPath,
    matchesPath,
    cachePath,
    tags: [],
    created: new Date().toISOString(),
    metadata: {},
  };
}

function upgradeDatasetRecord(dataset) {
  const upgraded = {
    ...dataset,
    id: dataset.id,
    name: dataset.name || dataset.id,
    description: dataset.description || "",
    rawDbPath: dataset.rawDbPath || toPortablePath(path.join("data", "databases", dataset.id, "players.db")),
    refinedDbPath: dataset.refinedDbPath || dataset.dbPath || toPortablePath(path.join("data", "databases", dataset.id, "playersrefined.db")),
    matchesPath: dataset.matchesPath || toPortablePath(path.join("data", "matches", dataset.id)),
    cachePath: dataset.cachePath || toPortablePath(path.join("data", "cache", dataset.id)),
    tags: Array.isArray(dataset.tags) ? dataset.tags : [],
    metadata: dataset.metadata || {},
  };
  delete upgraded.dbPath;
  return upgraded;
}

function initializeRawDatabase(dbPath) {
  const database = new sqlite3.Database(
    dbPath,
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX,
  );
  database.serialize(() => {
    database.run(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`, (error) => {
      if (error) {
        console.warn(`Raw database initialization busy_timeout failed for ${dbPath}:`, error.message);
      }
    });
    database.run(`PRAGMA foreign_keys = ON`, (error) => {
      if (error) {
        console.warn(`Raw database initialization foreign_keys failed for ${dbPath}:`, error.message);
      }
    });
    database.run(`PRAGMA journal_mode = WAL`, (error) => {
      if (error) {
        console.warn(`Raw database initialization journal_mode failed for ${dbPath}:`, error.message);
      }
    });
    database.run(`
      CREATE TABLE IF NOT EXISTS players (
        puuid TEXT PRIMARY KEY,
        names TEXT,
        feedscore REAL,
        opscore REAL,
        country TEXT,
        match_count INTEGER DEFAULT 1
      )
    `, (error) => {
      if (error) {
        console.warn(`Raw database initialization schema setup failed for ${dbPath}:`, error.message);
      }
    });
  });
  database.close();
}

function ensureDatasetStorage(dataset) {
  const config = materializeDatasetConfig(dataset);
  ensureDirectory(path.dirname(config.rawDbAbsolutePath));
  ensureDirectory(path.dirname(config.refinedDbAbsolutePath));
  ensureDirectory(config.matchesAbsolutePath);
  ensureDirectory(config.cacheAbsolutePath);
  if (!fs.existsSync(config.rawDbAbsolutePath)) {
    initializeRawDatabase(config.rawDbAbsolutePath);
  }
}

async function buildDatasetInfo(dataset) {
  const config = materializeDatasetConfig(dataset);
  const matches = fs.existsSync(config.matchesAbsolutePath)
    ? fs.readdirSync(config.matchesAbsolutePath).filter((entry) => entry.endsWith(".json"))
    : [];
  const refinedPlayerCount = await new Promise((resolve) => {
    if (!fs.existsSync(config.refinedDbAbsolutePath)) {
      resolve(0);
      return;
    }
    const database = new sqlite3.Database(config.refinedDbAbsolutePath, sqlite3.OPEN_READONLY, (openError) => {
      if (openError) {
        resolve(0);
        return;
      }
      database.get("SELECT COUNT(*) AS count FROM players", [], (error, row) => {
        database.close();
        if (error) {
          resolve(0);
          return;
        }
        resolve(row?.count ?? 0);
      });
    });
  });

  return {
    ...dataset,
    matchCount: matches.length,
    refinedPlayerCount,
  };
}

function migrateLegacyDataIntoDataset(dataset) {
  const config = materializeDatasetConfig(dataset);
  ensureDatasetStorage(dataset);
  safeCopyFile(LEGACY_RAW_DB_PATH, config.rawDbAbsolutePath);
  safeCopyFile(LEGACY_REFINED_DB_PATH, config.refinedDbAbsolutePath);
  safeCopyJsonMatches(LEGACY_MATCHES_DIR, config.matchesAbsolutePath);
}

function ensureDefaultDatasetExists() {
  ensureDirectory(DATA_ROOT);
  ensureDirectory(DATASET_DATABASES_ROOT);
  ensureDirectory(DATASET_MATCHES_ROOT);
  ensureDirectory(DATASET_CACHE_ROOT);

  if (!fs.existsSync(DATASET_REGISTRY_PATH)) {
    const defaultDataset = createDatasetRecord("default");
    migrateLegacyDataIntoDataset(defaultDataset);
    writeJsonFile(DATASET_REGISTRY_PATH, {
      datasets: [defaultDataset],
      currentDatasetId: defaultDataset.id,
    });
    return;
  }

  const registry = readJsonFile(DATASET_REGISTRY_PATH);
  if (!Array.isArray(registry.datasets) || registry.datasets.length === 0) {
    const defaultDataset = createDatasetRecord("default");
    migrateLegacyDataIntoDataset(defaultDataset);
    registry.datasets = [defaultDataset];
    registry.currentDatasetId = defaultDataset.id;
    writeJsonFile(DATASET_REGISTRY_PATH, registry);
    return;
  }

  let changed = false;
  registry.datasets = registry.datasets.map((dataset) => {
    const upgraded = upgradeDatasetRecord(dataset);
    if (JSON.stringify(upgraded) !== JSON.stringify(dataset)) {
      changed = true;
    }
    return upgraded;
  });

  for (const dataset of registry.datasets) {
    ensureDatasetStorage(dataset);
  }
  if (changed) {
    writeJsonFile(DATASET_REGISTRY_PATH, registry);
  }
}

function loadDatasetRegistry() {
  ensureDefaultDatasetExists();
  const registry = readJsonFile(DATASET_REGISTRY_PATH);
  const currentDatasetId = registry.currentDatasetId || registry.datasets[0]?.id;
  const currentDataset = registry.datasets.find((dataset) => dataset.id === currentDatasetId) || registry.datasets[0];
  if (!currentDataset) {
    throw new Error("No datasets are configured.");
  }
  activeDatasetRegistry = registry;
  activeDataset = materializeDatasetConfig(currentDataset);
  return registry;
}

function persistDatasetRegistry(registry) {
  writeJsonFile(DATASET_REGISTRY_PATH, registry);
  activeDatasetRegistry = registry;
}

function getActiveDataset() {
  if (!activeDataset) {
    loadDatasetRegistry();
  }
  return activeDataset;
}

function getActiveRawDbPath() {
  return getActiveDataset().rawDbAbsolutePath;
}

function getActiveRefinedDbPath() {
  return getActiveDataset().refinedDbAbsolutePath;
}

function getActiveMatchesPath() {
  return getActiveDataset().matchesAbsolutePath;
}

function getActiveCachePath() {
  return getActiveDataset().cacheAbsolutePath;
}

function getActiveBirdseyeCacheDir() {
  return path.join(getActiveCachePath(), "birdseye-3d-v2");
}

function getActiveBirdseyeArtifactPaths() {
  return getBirdseyeArtifactPaths(getActiveBirdseyeCacheDir());
}

function getActiveGraphV2CacheDir() {
  return path.join(getActiveCachePath(), "graph-v2");
}

function getActiveGraphV2ArtifactPaths() {
  return getGraphV2ArtifactPaths(getActiveGraphV2CacheDir());
}

function getDatasetConfigById(datasetId) {
  const registry = activeDatasetRegistry || loadDatasetRegistry();
  const dataset = registry.datasets.find((entry) => entry.id === datasetId);
  if (!dataset) {
    return null;
  }
  ensureDatasetStorage(dataset);
  return materializeDatasetConfig(dataset);
}

function getGraphV2CacheDirForDataset(dataset) {
  return path.join(dataset.cacheAbsolutePath, "graph-v2");
}

function getGraphV2ArtifactPathsForDataset(dataset) {
  return getGraphV2ArtifactPaths(getGraphV2CacheDirForDataset(dataset));
}

function getActiveRustEnv() {
  const dataset = getActiveDataset();
  return getRustEnvForDataset(dataset);
}

function getRustEnvForDataset(dataset) {
  return {
    DATASET_ID: dataset.id,
    GRAPH_DB_PATH: dataset.refinedDbAbsolutePath,
    PATHFINDER_MATCH_DIR: dataset.matchesAbsolutePath,
    PATHFINDER_BIRDSEYE_CACHE_DIR: path.join(dataset.cacheAbsolutePath, "birdseye-3d-v2"),
    PATHFINDER_GRAPH_V2_CACHE_DIR: getGraphV2CacheDirForDataset(dataset),
  };
}

function selectActiveDataset(datasetId) {
  const registry = readJsonFile(DATASET_REGISTRY_PATH);
  const dataset = registry.datasets.find((entry) => entry.id === datasetId);
  if (!dataset) {
    return null;
  }
  ensureDatasetStorage(dataset);
  registry.currentDatasetId = datasetId;
  persistDatasetRegistry(registry);
  activeDataset = materializeDatasetConfig(dataset);
  clearRustRuntimeState();
  return activeDataset;
}

async function getCachedRustResponse(command, { forceRefresh = false } = {}) {
  if (!forceRefresh && rustResponseCache[command]) {
    return rustResponseCache[command];
  }

  if (!forceRefresh && rustInFlightRequests.has(command)) {
    return rustInFlightRequests.get(command);
  }

  const request = executeRustCommand(command, undefined, getActiveRustEnv())
    .then((response) => {
      rustResponseCache[command] = response;
      rustInFlightRequests.delete(command);
      return response;
    })
    .catch((error) => {
      rustInFlightRequests.delete(command);
      throw error;
    });

  rustInFlightRequests.set(command, request);
  return request;
}

async function prewarmRustMetadata() {
  if (process.env.PATHFINDER_PREWARM_METADATA === "0") {
    console.log("Rust pathfinder metadata prewarm disabled.");
    return;
  }

  try {
    console.log("Prewarming Rust pathfinder metadata...");
    await getCachedRustResponse("spec", { forceRefresh: true });
    console.log("Rust pathfinder metadata cached.");
  } catch (error) {
    console.warn("Rust pathfinder metadata prewarm failed:", error.message);
  }
}

function normalizeSignedBalancePayload(payload = {}) {
  return {
    minEdgeSupport: payload.minEdgeSupport,
    tiePolicy: payload.tiePolicy,
    maxTopNodes: payload.maxTopNodes,
    includeClusterSummaries: payload.includeClusterSummaries,
  };
}

function normalizeAssortativityPayload(payload = {}) {
  return {
    minEdgeSupport: payload.minEdgeSupport,
    minPlayerMatchCount: payload.minPlayerMatchCount,
    strongTieThreshold: payload.strongTieThreshold,
    includeClusterBreakdown: payload.includeClusterBreakdown,
  };
}

function normalizeBalanceSweepPayload(payload = {}) {
  return {
    minEdgeSupports: Array.isArray(payload.minEdgeSupports) ? payload.minEdgeSupports : undefined,
    tiePolicies: Array.isArray(payload.tiePolicies) ? payload.tiePolicies : undefined,
    maxTopNodes: payload.maxTopNodes,
    includeClusterSummaries: payload.includeClusterSummaries,
  };
}

function normalizeAssortativitySignificancePayload(payload = {}) {
  return {
    graphModes: Array.isArray(payload.graphModes) ? payload.graphModes : undefined,
    metrics: Array.isArray(payload.metrics) ? payload.metrics : undefined,
    minEdgeSupport: payload.minEdgeSupport,
    minPlayerMatchCount: payload.minPlayerMatchCount,
    strongTieThreshold: payload.strongTieThreshold,
    permutationCount: payload.permutationCount,
    seed: payload.seed,
    includeNullDistributionSamples: payload.includeNullDistributionSamples,
  };
}

function normalizeBetweennessPayload(payload = {}) {
  return {
    pathMode: payload.pathMode,
    weightedMode: payload.weightedMode,
    minEdgeSupport: payload.minEdgeSupport,
    maxTopNodes: payload.maxTopNodes,
    parallel: payload.parallel,
    runSerialBaseline: payload.runSerialBaseline,
    includeFullResults: payload.includeFullResults,
  };
}

function runSignedBalanceQueued(payload = {}) {
  const normalized = normalizeSignedBalancePayload(payload);
  const requestKey = JSON.stringify(normalized);

  if (signedBalanceActivePromise && signedBalanceActiveKey === requestKey) {
    return signedBalanceActivePromise;
  }

  const scheduled = signedBalanceQueue
    .catch(() => undefined)
    .then(async () => {
      if (signedBalanceActivePromise && signedBalanceActiveKey === requestKey) {
        return signedBalanceActivePromise;
      }

      const activePromise = executeRustCommand("signed-balance", normalized, getActiveRustEnv());
      signedBalanceActivePromise = activePromise;
      signedBalanceActiveKey = requestKey;

      try {
        return await activePromise;
      } finally {
        if (signedBalanceActivePromise === activePromise) {
          signedBalanceActivePromise = null;
          signedBalanceActiveKey = null;
        }
      }
    });

  signedBalanceQueue = scheduled.then(() => undefined, () => undefined);
  return scheduled;
}

function hasBirdseyeArtifacts() {
  return Object.values(getActiveBirdseyeArtifactPaths()).every((artifactPath) => fs.existsSync(artifactPath));
}

function startBirdseyeExportIfNeeded() {
  console.log(`[birdseye] ensure requested. cacheDir=${getActiveBirdseyeCacheDir()}`);

  if (birdseyeCachePromise) {
    console.log("[birdseye] cache build already in flight. Reusing active promise.");
    return birdseyeCachePromise;
  }

  const startedAt = Date.now();
  console.log("[birdseye] cache miss. Starting Rust export...");
  birdseyeCachePromise = executeRustCommandRaw("birdseye-3d-export", undefined, getActiveRustEnv())
    .then(() => {
      if (!hasBirdseyeArtifacts()) {
        throw new Error("Birdseye 3D artifact export completed, but required files are missing.");
      }
      console.log(`[birdseye] Rust export finished in ${Date.now() - startedAt}ms.`);
      return getActiveBirdseyeArtifactPaths();
    })
    .catch((error) => {
      console.error(`[birdseye] Rust export failed after ${Date.now() - startedAt}ms:`, error.message);
      throw error;
    })
    .finally(() => {
      birdseyeCachePromise = null;
    });

  return birdseyeCachePromise;
}

async function ensureBirdseyeArtifacts() {
  if (hasBirdseyeArtifacts()) {
    console.log("[birdseye] cache hit. Artifacts already exist on disk.");
    return getActiveBirdseyeArtifactPaths();
  }

  await startBirdseyeExportIfNeeded();
  return getActiveBirdseyeArtifactPaths();
}

async function streamBirdseyeArtifact(res, artifactKey, contentType) {
  const startedAt = Date.now();
  const artifactPaths = await ensureBirdseyeArtifacts();
  const artifactPath = artifactPaths[artifactKey];
  console.log(`[birdseye] request for ${path.basename(artifactPath)} started.`);
  const stats = fs.statSync(artifactPath);
  console.log(
    `[birdseye] streaming ${path.basename(artifactPath)} size=${stats.size} bytes contentType="${contentType}"`,
  );
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  const stream = fs.createReadStream(artifactPath);
  stream.on("error", (error) => {
    console.error(`[birdseye] stream error for ${path.basename(artifactPath)}:`, error.message);
  });
  stream.on("end", () => {
    console.log(`[birdseye] finished ${path.basename(artifactPath)} in ${Date.now() - startedAt}ms.`);
  });
  stream.pipe(res);
}

function hasGraphV2Artifacts(dataset = getActiveDataset()) {
  const artifactPaths = getGraphV2ArtifactPathsForDataset(dataset);
  if (!Object.values(artifactPaths).every((artifactPath) => fs.existsSync(artifactPath))) {
    return false;
  }

  try {
    const manifest = readJsonFile(artifactPaths.manifest);
    const datasetId = dataset.id;
    const summaryArchiveFile = typeof manifest.summaryArchiveFile === "string" ? manifest.summaryArchiveFile : "";
    const summaryArchivePath = summaryArchiveFile
      ? path.join(getGraphV2CacheDirForDataset(dataset), path.basename(summaryArchiveFile))
      : "";
    const isCurrent =
      manifest.datasetId === datasetId &&
      manifest.graphBuilderVersion === GRAPH_V2_EXPECTED_VERSIONS.graphBuilderVersion &&
      manifest.clusteringAlgorithmVersion === GRAPH_V2_EXPECTED_VERSIONS.clusteringAlgorithmVersion &&
      manifest.layoutVersion === GRAPH_V2_EXPECTED_VERSIONS.layoutVersion &&
      manifest.summaryFile === "summary.md" &&
      summaryArchiveFile.length > 0 &&
      fs.existsSync(summaryArchivePath);

    if (!isCurrent) {
      console.log(
        `[graph-v2] stale artifact manifest detected. dataset=${manifest.datasetId ?? "unknown"} builder=${manifest.graphBuilderVersion ?? "unknown"} clustering=${manifest.clusteringAlgorithmVersion ?? "unknown"} layout=${manifest.layoutVersion ?? "unknown"}`,
      );
    }

    return isCurrent;
  } catch (error) {
    console.warn("[graph-v2] failed to validate artifact manifest:", error.message);
    return false;
  }
}

function startGraphV2Export({ force = false } = {}) {
  return startGraphV2ExportForDataset(getActiveDataset(), { force });
}

function startGraphV2ExportForDataset(dataset, { force = false } = {}) {
  const cacheDir = getGraphV2CacheDirForDataset(dataset);
  console.log(`[graph-v2] ensure requested. dataset=${dataset.id} cacheDir=${cacheDir}`);

  if (graphV2CachePromises.has(dataset.id)) {
    console.log(`[graph-v2] cache build already in flight for dataset=${dataset.id}. Reusing active promise.`);
    return graphV2CachePromises.get(dataset.id);
  }

  if (!force && hasGraphV2Artifacts(dataset)) {
    console.log(`[graph-v2] cache hit for dataset=${dataset.id}. Artifacts already exist on disk.`);
    return Promise.resolve(getGraphV2ArtifactPathsForDataset(dataset));
  }

  const startedAt = Date.now();
  console.log(`[graph-v2] cache miss/rebuild for dataset=${dataset.id}. Starting Rust export...`);
  const promise = executeRustCommandRaw("graph-v2-export", undefined, getRustEnvForDataset(dataset))
    .then(() => {
      if (!hasGraphV2Artifacts(dataset)) {
        throw new Error("Graph Builder V2 artifact export completed, but required files are missing.");
      }
      console.log(`[graph-v2] Rust export finished for dataset=${dataset.id} in ${Date.now() - startedAt}ms.`);
      return getGraphV2ArtifactPathsForDataset(dataset);
    })
    .catch((error) => {
      console.error(`[graph-v2] Rust export failed for dataset=${dataset.id} after ${Date.now() - startedAt}ms:`, error.message);
      throw error;
    })
    .finally(() => {
      graphV2CachePromises.delete(dataset.id);
    });

  graphV2CachePromises.set(dataset.id, promise);
  return promise;
}

async function ensureGraphV2Artifacts() {
  return ensureGraphV2ArtifactsForDataset(getActiveDataset());
}

async function ensureGraphV2ArtifactsForDataset(dataset) {
  if (hasGraphV2Artifacts(dataset)) {
    console.log(`[graph-v2] cache hit for dataset=${dataset.id}. Artifacts already exist on disk.`);
    return getGraphV2ArtifactPathsForDataset(dataset);
  }

  await startGraphV2ExportForDataset(dataset);
  return getGraphV2ArtifactPathsForDataset(dataset);
}

async function streamGraphV2Artifact(res, artifactKey, contentType, dataset = getActiveDataset()) {
  const startedAt = Date.now();
  const artifactPaths = await ensureGraphV2ArtifactsForDataset(dataset);
  const artifactPath = artifactPaths[artifactKey];
  if (!artifactPath) {
    throw new Error(`Unknown Graph V2 artifact key: ${artifactKey}`);
  }
  console.log(`[graph-v2] request for ${path.basename(artifactPath)} started.`);
  const stats = fs.statSync(artifactPath);
  console.log(
    `[graph-v2] streaming ${path.basename(artifactPath)} size=${stats.size} bytes contentType="${contentType}"`,
  );
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  const stream = fs.createReadStream(artifactPath);
  stream.on("error", (error) => {
    console.error(`[graph-v2] stream error for ${path.basename(artifactPath)}:`, error.message);
  });
  stream.on("end", () => {
    console.log(`[graph-v2] finished ${path.basename(artifactPath)} in ${Date.now() - startedAt}ms.`);
  });
  stream.pipe(res);
}

function finalizeCollectorJob({ status, error, exitCode }) {
  if (!matchCollectorJob) {
    return;
  }

  matchCollectorJob.status = status;
  matchCollectorJob.currentStage = status;
  matchCollectorJob.error = error || null;
  matchCollectorJob.summary = {
    ...(matchCollectorJob.summary || {}),
    finishedAt: new Date().toISOString(),
    exitCode: exitCode ?? null,
  };
  matchCollectorJob.progress = {
    ...matchCollectorJob.progress,
    stopRequested: status === "stopped" ? true : matchCollectorJob.progress?.stopRequested,
  };
  matchCollectorJob.childProcess = null;
  matchCollectorJob.pid = null;
}

async function startMatchCollectorJob(payload) {
  if (matchCollectorJob?.childProcess) {
    const error = new Error("A collector run is already active.");
    error.statusCode = 409;
    throw error;
  }

  ensureRiotApiKey();

  const normalized = normalizeCollectorStartPayload(payload);
  const dataset = normalized.datasetId ? selectActiveDataset(normalized.datasetId) : getActiveDataset();
  if (!dataset) {
    const error = new Error(`Dataset "${normalized.datasetId}" does not exist.`);
    error.statusCode = 400;
    throw error;
  }
  const datasetSummary = await buildCollectorDatasetSummary(dataset);

  if (normalized.collectorMode === "strengthen-graph" && !datasetSummary.canUseStrengthenMode) {
    const error = new Error("Strengthen-graph mode requires an active dataset that already contains players.");
    error.statusCode = 400;
    throw error;
  }

  if (normalized.mode === "specific-puuid" && !normalized.specificPuuid) {
    const error = new Error("specific-puuid mode requires a specificPuuid.");
    error.statusCode = 400;
    throw error;
  }

  const jobId = `collector-${Date.now()}`;
  const jobsDir = path.join(dataset.cacheAbsolutePath, "collector-jobs");
  ensureDirectory(jobsDir);
  const configPath = path.join(jobsDir, `${jobId}.config.json`);
  const stopSignalPath = path.join(jobsDir, `${jobId}.stop`);
  if (fs.existsSync(stopSignalPath)) {
    fs.unlinkSync(stopSignalPath);
  }

  const pythonConfig = {
    ...normalized,
    datasetId: dataset.id,
    rawDbPath: dataset.rawDbAbsolutePath,
    matchesDir: dataset.matchesAbsolutePath,
    cacheDir: dataset.cacheAbsolutePath,
    apiKey: ensureRiotApiKey(),
    apiKeys: buildRiotApiKeyList(),
    stopSignalPath,
    randomSeed: Date.now(),
  };
  writeJsonFile(configPath, pythonConfig);

  const childProcess = spawn("python", ["match_collector.py", "--config-file", configPath], {
    cwd: backendDir,
    env: { ...process.env },
  });

  matchCollectorJob = createCollectorSnapshot({
    status: "running",
    jobId,
    datasetId: dataset.id,
    config: normalized,
    currentStage: "starting",
    summary: {
      datasetId: dataset.id,
      datasetName: dataset.name,
      startedAt: new Date().toISOString(),
    },
    pid: childProcess.pid ?? null,
    childProcess,
    stopSignalPath,
    configPath,
  });

  appendCollectorLog(`Collector job ${jobId} started for dataset ${dataset.id}.`);

  attachCollectorStream(childProcess.stdout, (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed.startsWith(MATCH_COLLECTOR_EVENT_PREFIX)) {
      try {
        const event = JSON.parse(trimmed.slice(MATCH_COLLECTOR_EVENT_PREFIX.length));
        applyCollectorEvent(event);
      } catch (error) {
        appendCollectorLog(`Failed to parse collector event: ${error.message}`, "error");
      }
      return;
    }
    appendCollectorLog(trimmed);
  });

  attachCollectorStream(childProcess.stderr, (line) => {
    if (line.trim()) {
      appendCollectorLog(line.trim(), "warning");
    }
  });

  childProcess.on("error", (error) => {
    appendCollectorLog(`Collector process error: ${error.message}`, "error");
    finalizeCollectorJob({ status: "failed", error: error.message, exitCode: null });
  });

  childProcess.on("exit", (code, signal) => {
    const requestedStop = Boolean(matchCollectorJob?.progress?.stopRequested) || Boolean(matchCollectorJob?.stopSignalPath && fs.existsSync(matchCollectorJob.stopSignalPath));
    const currentStatus = matchCollectorJob?.status;

    if (currentStatus === "completed" || currentStatus === "stopped" || currentStatus === "failed") {
      finalizeCollectorJob({
        status: currentStatus,
        error: matchCollectorJob?.error || null,
        exitCode: code,
      });
      appendCollectorLog(`Collector job ${jobId} exited with code ${code ?? "null"}${signal ? ` (${signal})` : ""}.`);
      return;
    }

    const nextStatus = requestedStop ? "stopped" : code === 0 ? "completed" : "failed";
    const nextError = nextStatus === "failed"
      ? `Collector process exited with code ${code ?? "null"}${signal ? ` (${signal})` : ""}.`
      : null;
    finalizeCollectorJob({ status: nextStatus, error: nextError, exitCode: code });
    appendCollectorLog(`Collector job ${jobId} exited with code ${code ?? "null"}${signal ? ` (${signal})` : ""}.`, nextStatus === "failed" ? "error" : "info");
  });

  return getCollectorStatusSnapshot();
}

function requestStopMatchCollectorJob() {
  if (!matchCollectorJob?.childProcess) {
    const error = new Error("No active collector run to stop.");
    error.statusCode = 404;
    throw error;
  }

  if (matchCollectorJob.stopSignalPath && !fs.existsSync(matchCollectorJob.stopSignalPath)) {
    fs.writeFileSync(matchCollectorJob.stopSignalPath, "stop\n");
  }
  matchCollectorJob.progress = {
    ...matchCollectorJob.progress,
    stopRequested: true,
  };
  matchCollectorJob.currentStage = "stopping";
  appendCollectorLog(`Stop requested for collector job ${matchCollectorJob.jobId}.`, "warning");
  return getCollectorStatusSnapshot();
}

function readMarkdownTitle(content, fallbackTitle) {
  const titleLine = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /^#\s+/.test(line));
  return titleLine ? titleLine.replace(/^#\s+/u, "").trim() : fallbackTitle;
}

function readMarkdownSummary(content) {
  const lines = content.split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("---") ||
      trimmed.startsWith("```") ||
      trimmed.startsWith("|")
    ) {
      continue;
    }
    return trimmed.replace(/^[-*]\s+/u, "").slice(0, 220);
  }
  return "";
}

function titleFromFileName(fileName) {
  return fileName
    .replace(/\.md$/iu, "")
    .replace(/[-_]+/gu, " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function collectMarkdownDocuments(rootDir, prefix, group) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const documents = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      documents.push(...collectMarkdownDocuments(absolutePath, path.posix.join(prefix, entry.name), entry.name));
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) {
      continue;
    }

    const content = fs.readFileSync(absolutePath, "utf-8");
    const stats = fs.statSync(absolutePath);
    const relativePath = path.posix.join(prefix, entry.name);
    documents.push({
      id: relativePath,
      path: relativePath,
      title: readMarkdownTitle(content, titleFromFileName(entry.name)),
      summary: readMarkdownSummary(content),
      group,
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
    });
  }

  return documents;
}

function buildDocumentationManifest() {
  const documents = [
    ...Array.from(DOCUMENTATION_ROOT_MARKDOWN)
      .filter((fileName) => fs.existsSync(path.join(PROJECT_ROOT, fileName)))
      .map((fileName) => {
        const absolutePath = path.join(PROJECT_ROOT, fileName);
        const content = fs.readFileSync(absolutePath, "utf-8");
        const stats = fs.statSync(absolutePath);
        return {
          id: fileName,
          path: fileName,
          title: readMarkdownTitle(content, titleFromFileName(fileName)),
          summary: readMarkdownSummary(content),
          group: "Project",
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
        };
      }),
    ...collectMarkdownDocuments(DOCUMENTATION_ROOT, "docs", "Research docs"),
  ].sort((a, b) => a.path.localeCompare(b.path));

  const thesisSourcePath = path.join(DOCUMENTATION_ROOT, "mainraw.pdf");
  const thesisStats = fs.existsSync(thesisSourcePath) ? fs.statSync(thesisSourcePath) : null;

  return {
    documents,
    thesisPdf: thesisStats
      ? {
          title: "Compiled Thesis PDF",
          sourcePath: "docs/mainraw.pdf",
          url: "http://localhost:3001/api/documentation/thesis.pdf",
          size: thesisStats.size,
          updatedAt: thesisStats.mtime.toISOString(),
        }
      : null,
  };
}

function resolveDocumentationMarkdownPath(portablePath) {
  const normalizedPath = String(portablePath || "").replace(/\\/gu, "/");
  if (DOCUMENTATION_ROOT_MARKDOWN.has(normalizedPath)) {
    return path.join(PROJECT_ROOT, normalizedPath);
  }

  if (!normalizedPath.startsWith("docs/") || !normalizedPath.toLowerCase().endsWith(".md")) {
    return null;
  }

  const resolvedPath = path.resolve(PROJECT_ROOT, normalizedPath);
  if (resolvedPath !== DOCUMENTATION_ROOT && !resolvedPath.startsWith(`${DOCUMENTATION_ROOT}${path.sep}`)) {
    return null;
  }
  return resolvedPath;
}

function getThesisPdfCopyPath() {
  const sourcePath = path.join(DOCUMENTATION_ROOT, "mainraw.pdf");
  if (!fs.existsSync(sourcePath)) {
    return null;
  }

  ensureDirectory(DOCUMENTATION_TMP_ROOT);
  const stats = fs.statSync(sourcePath);
  const revision = `${Math.round(stats.mtimeMs)}-${stats.size}`;
  const copyPath = path.join(DOCUMENTATION_TMP_ROOT, `thesis-${revision}.pdf`);
  if (!fs.existsSync(copyPath)) {
    fs.copyFileSync(sourcePath, copyPath);
  }
  return copyPath;
}

app.use(cors());
app.use("/db-explorer", (req, res) => {
  const target = new URL(req.originalUrl, DB_EXPLORER_ORIGIN);
  const proxyRequest = http.request(
    target,
    {
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
      },
    },
    (proxyResponse) => {
      res.status(proxyResponse.statusCode || 502);
      for (const [header, value] of Object.entries(proxyResponse.headers)) {
        if (typeof value !== "undefined") {
          res.setHeader(header, value);
        }
      }
      proxyResponse.pipe(res);
    },
  );

  proxyRequest.on("error", (error) => {
    console.error("Database explorer proxy failed:", error.message);
    if (!res.headersSent) {
      res.status(502).send("Database explorer service is unavailable.");
    } else {
      res.end();
    }
  });

  req.pipe(proxyRequest);
});
app.use(bodyParser.json({ limit: "100mb" }));
app.use('/graph-view', express.static(path.join(__dirname, 'output')));
const backendDir = __dirname;
const replayDbPath = path.resolve(__dirname, "pathfinder_replays.db");
let rawDb = null;
let refinedDb = null;

// Per-dataset caches — all cleared when the active dataset changes (invalidatePlayerCaches).
// datasetColumnStatsCache: one full-table scan per dataset; subsequent player lookups
// use cached sorted distributions and pre-computed averages (O(1) column access, O(log n)
// percentile via binary search).
const datasetColumnStatsCache = {
  dbPath: null,   // refined-DB path this was built from
  promise: null,  // in-flight load promise (deduplicates concurrent first-load requests)
  stats: null,    // { sampleSize, distributions: {col: sortedArray}, averages: {col: number} }
};

// datasetKdaCache: scans all match JSON files ONCE per dataset, builds per-player totals.
// Subsequent buildPlayerKdaBenchmark(puuid) calls are O(1) map lookups — no re-scan.
const datasetKdaCache = {
  matchDir: null,  // match directory this was built from
  promise: null,   // in-flight load promise
  data: null,      // { datasetTotal, datasetSamples, playerTotals: Map<puuid,{total,matches}> }
};

const playerScoreCache = new Map();  // "${datasetId}:${puuid}" → full /scores response
const playerOptionsCache = { promise: null, players: null, dbPath: null };

app.get("/api/documentation/manifest", (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(buildDocumentationManifest());
  } catch (error) {
    console.error("Documentation manifest failed:", error.message);
    res.status(500).json({ error: "Documentation manifest failed." });
  }
});

app.get("/api/documentation/markdown", (req, res) => {
  try {
    const markdownPath = resolveDocumentationMarkdownPath(req.query.path);
    if (!markdownPath || !fs.existsSync(markdownPath)) {
      return res.status(404).json({ error: "Markdown document not found." });
    }

    const content = fs.readFileSync(markdownPath, "utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.type("text/markdown; charset=utf-8").send(content);
  } catch (error) {
    console.error("Markdown document load failed:", error.message);
    res.status(500).json({ error: "Markdown document load failed." });
  }
});

app.get("/api/documentation/thesis.pdf", (req, res) => {
  try {
    const copyPath = getThesisPdfCopyPath();
    if (!copyPath) {
      return res.status(404).send("Compiled thesis PDF not found.");
    }

    res.setHeader("Cache-Control", "no-store");
    res.sendFile(copyPath);
  } catch (error) {
    console.error("Thesis PDF copy failed:", error.message);
    res.status(500).send("Thesis PDF copy failed.");
  }
});

function openConfiguredDatabase(databasePath, label) {
  return new sqlite3.Database(
    databasePath,
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX,
    (err) => {
      if (err) {
        console.error(`Failed to open ${label}:`, err.message);
      } else {
        console.log(`${label} opened at ${databasePath}.`);
      }
    },
  );
}

function logDatabaseSetupError(label, step, error) {
  if (!error) {
    return;
  }
  console.warn(`${label} ${step} failed:`, error.message);
}

const replayDb = new sqlite3.Database(
  replayDbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX,
  (err) => {
    if (err) {
      console.error("Failed to open replay database:", err.message);
    } else {
      console.log("Replay database opened.");
    }
  }
);

function configureDatabase(database) {
  database.configure("busyTimeout", SQLITE_BUSY_TIMEOUT_MS);
  database.serialize(() => {
    database.run(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`, (error) => {
      logDatabaseSetupError("Database", "busy_timeout pragma", error);
    });
    database.run(`PRAGMA foreign_keys = ON`, (error) => {
      logDatabaseSetupError("Database", "foreign_keys pragma", error);
    });
    database.run(`PRAGMA journal_mode = WAL`, (error) => {
      logDatabaseSetupError("Database", "journal_mode pragma", error);
    });
  });
}

function ensureRawDatabaseSchema() {
  if (!rawDb) {
    return;
  }
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS players (
      puuid TEXT PRIMARY KEY,
      names TEXT,
      feedscore REAL,
      opscore REAL,
      country TEXT,
      match_count INTEGER DEFAULT 1
    )
  `, (error) => {
    logDatabaseSetupError("Raw player database", "schema setup", error);
  });
}

function openActiveRawDatabase() {
  if (rawDb) {
    rawDb.close();
  }
  rawDb = openConfiguredDatabase(getActiveRawDbPath(), "Raw player database");
  configureDatabase(rawDb);
  ensureRawDatabaseSchema();
}

function invalidatePlayerCaches() {
  playerScoreCache.clear();
  datasetColumnStatsCache.dbPath = null;
  datasetColumnStatsCache.promise = null;
  datasetColumnStatsCache.stats = null;
  datasetKdaCache.matchDir = null;
  datasetKdaCache.promise = null;
  datasetKdaCache.data = null;
  playerOptionsCache.promise = null;
  playerOptionsCache.players = null;
  playerOptionsCache.dbPath = null;
  const dataset = getActiveDataset();
  console.log(`[player-caches] invalidated dataset=${dataset?.id}`);
}

function openActiveRefinedDatabase() {
  if (refinedDb) {
    refinedDb.close();
  }
  refinedDb = openConfiguredDatabase(getActiveRefinedDbPath(), "Refined player database");
  configureDatabase(refinedDb);
  invalidatePlayerCaches();
}

// Loads and caches the dataset-wide column distributions used for percentile/comparison
// calculations. One DB round-trip per dataset; all subsequent player lookups reuse this.
async function loadDatasetColumnStats() {
  const currentDbPath = getActiveRefinedDbPath();

  if (datasetColumnStatsCache.dbPath === currentDbPath && datasetColumnStatsCache.stats) {
    return { stats: datasetColumnStatsCache.stats, cacheHit: true };
  }

  if (datasetColumnStatsCache.dbPath === currentDbPath && datasetColumnStatsCache.promise) {
    const stats = await datasetColumnStatsCache.promise;
    return { stats, cacheHit: true };
  }

  // Cache miss — store promise immediately so concurrent requests share this one scan.
  datasetColumnStatsCache.dbPath = currentDbPath;
  const loadPromise = (async () => {
    const t0 = Date.now();
    try {
      const rows = await refinedDbAll(
         `SELECT
            opscore,
            feedscore,
            artifact_combat_impact,
            artifact_risk_discipline,
            artifact_resource_tempo,
            artifact_map_objective_control,
            artifact_team_enablement
          FROM players
          WHERE matches_processed > 0`,
      );
      const elapsed = Date.now() - t0;

      const distributions = {
        opscore:       rows.map((r) => safeNumber(r.opscore)).filter(Number.isFinite).sort((a, b) => a - b),
        feedscore:     rows.map((r) => safeNumber(r.feedscore)).filter(Number.isFinite).sort((a, b) => a - b),
        combat_impact: rows.map((r) => safeNumber(r.artifact_combat_impact)).filter(Number.isFinite).sort((a, b) => a - b),
        risk_discipline: rows.map((r) => safeNumber(r.artifact_risk_discipline)).filter(Number.isFinite).sort((a, b) => a - b),
        resource_tempo: rows.map((r) => safeNumber(r.artifact_resource_tempo)).filter(Number.isFinite).sort((a, b) => a - b),
        map_objective_control: rows.map((r) => safeNumber(r.artifact_map_objective_control)).filter(Number.isFinite).sort((a, b) => a - b),
        team_enablement: rows.map((r) => safeNumber(r.artifact_team_enablement)).filter(Number.isFinite).sort((a, b) => a - b),
      };

      const averages = {};
      for (const [key, dist] of Object.entries(distributions)) {
        averages[key] = dist.length > 0 ? dist.reduce((s, v) => s + v, 0) / dist.length : 0;
      }

      const stats = { sampleSize: rows.length, distributions, averages };
      datasetColumnStatsCache.stats = stats;
      datasetColumnStatsCache.promise = null;
      const dataset = getActiveDataset();
      console.log(`[player-detail] column-stats loaded dataset=${dataset?.id} rows=${rows.length} dbMs=${elapsed}`);
      return stats;
    } catch (err) {
      // Clear poisoned state so the next request can retry rather than re-throwing a
      // stale rejected promise forever.
      datasetColumnStatsCache.dbPath = null;
      datasetColumnStatsCache.promise = null;
      throw err;
    }
  })();

  datasetColumnStatsCache.promise = loadPromise;
  return { stats: await loadPromise, cacheHit: false };
}

replayDb.configure("busyTimeout", SQLITE_BUSY_TIMEOUT_MS);
replayDb.serialize(() => {
  replayDb.run(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`, (error) => {
    logDatabaseSetupError("Replay database", "busy_timeout pragma", error);
  });
  replayDb.run(`PRAGMA foreign_keys = ON`, (error) => {
    logDatabaseSetupError("Replay database", "foreign_keys pragma", error);
  });
  replayDb.run(`PRAGMA journal_mode = WAL`, (error) => {
    logDatabaseSetupError("Replay database", "journal_mode pragma", error);
  });
});

function sqliteRun(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function sqliteGet(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row ?? null);
    });
  });
}

function sqliteAll(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return sqliteRun(rawDb, sql, params);
}

function dbGet(sql, params = []) {
  return sqliteGet(rawDb, sql, params);
}

function dbAll(sql, params = []) {
  return sqliteAll(rawDb, sql, params);
}

function refinedDbGet(sql, params = []) {
  return sqliteGet(refinedDb, sql, params);
}

function refinedDbAll(sql, params = []) {
  return sqliteAll(refinedDb, sql, params);
}

function replayDbRun(sql, params = []) {
  return sqliteRun(replayDb, sql, params);
}

function replayDbGet(sql, params = []) {
  return sqliteGet(replayDb, sql, params);
}

function replayDbAll(sql, params = []) {
  return sqliteAll(replayDb, sql, params);
}
// POST /api/save-match
app.post("/api/save-match", (req, res) => {
  const match = req.body;
  const matchId = match?.metadata?.matchId;
  if (!matchId) {
    return res.status(400).json({ error: "Missing matchId" });
  }

  const matchesDir = getActiveMatchesPath();
  ensureDirectory(matchesDir);
  const matchFilePath = path.join(matchesDir, `${matchId}.json`);

  if (fs.existsSync(matchFilePath)) {
    return res.status(200).json({ message: "Match already exists" });
  }

  fs.writeFileSync(matchFilePath, JSON.stringify(match, null, 2));
  return res.status(201).json({ message: "Match saved" });
});

// GET /api/matches → összes meccs kilistázása
app.get("/api/matches", (req, res) => {
  const matchesDir = getActiveMatchesPath();
  ensureDirectory(matchesDir);
  const files = fs.readdirSync(matchesDir).filter(f => f.endsWith(".json"));
  const allMatches = files.map(f => {
    const content = fs.readFileSync(path.join(matchesDir, f), "utf-8");
    return JSON.parse(content);
  });
  res.json(allMatches);
});

app.get("/api/datasets", async (req, res) => {
  try {
    const registry = activeDatasetRegistry || loadDatasetRegistry();
    const datasets = await Promise.all(registry.datasets.map((dataset) => buildDatasetInfo(dataset)));
    res.json({
      current: getActiveDataset().id,
      datasets,
    });
  } catch (error) {
    console.error("Failed to load dataset registry:", error.message);
    res.status(500).json({ error: "Failed to load datasets." });
  }
});

app.post("/api/datasets", (req, res) => {
  try {
    const payload = req.body || {};
    const datasetId = String(payload.id || "").trim();
    if (!DATASET_ID_PATTERN.test(datasetId)) {
      return res.status(400).json({ error: "Dataset id must be lowercase letters, numbers, and hyphens only." });
    }

    const registry = activeDatasetRegistry || loadDatasetRegistry();
    if (registry.datasets.some((dataset) => dataset.id === datasetId)) {
      return res.status(400).json({ error: "Dataset already exists." });
    }

    const dataset = createDatasetRecord(
      datasetId,
      String(payload.name || datasetId),
      String(payload.description || ""),
    );
    ensureDatasetStorage(dataset);
    registry.datasets.push(dataset);
    persistDatasetRegistry(registry);
    res.status(201).json({ dataset });
  } catch (error) {
    console.error("Failed to create dataset:", error.message);
    res.status(500).json({ error: "Failed to create dataset." });
  }
});

app.post("/api/datasets/:datasetId/select", (req, res) => {
  try {
    const dataset = selectActiveDataset(req.params.datasetId);
    if (!dataset) {
      return res.status(404).json({ error: "Dataset not found." });
    }
    openActiveRawDatabase();
    openActiveRefinedDatabase();
    // Reinitialize neurosim tribes from new dataset's clusters
    neurosimBridge.triggerNeurosimRefresh().catch(() => {});
    res.json({
      current: dataset.id,
      dataset: {
        id: dataset.id,
        name: dataset.name,
        description: dataset.description,
      },
    });
  } catch (error) {
    console.error("Failed to select dataset:", error.message);
    res.status(500).json({ error: "Failed to select dataset." });
  }
});

app.get("/api/datasets/:datasetId/info", async (req, res) => {
  try {
    const registry = activeDatasetRegistry || loadDatasetRegistry();
    const dataset = registry.datasets.find((entry) => entry.id === req.params.datasetId);
    if (!dataset) {
      return res.status(404).json({ error: "Dataset not found." });
    }
    const details = await buildDatasetInfo(dataset);
    res.json(details);
  } catch (error) {
    console.error("Failed to load dataset info:", error.message);
    res.status(500).json({ error: "Failed to load dataset info." });
  }
});

app.get("/api/runtime-keys", (req, res) => {
  try {
    const keys = Array.from(MANAGED_RUNTIME_KEYS, (keyName) => runtimeKeyMetadata(keyName));
    res.json({ keys });
  } catch (error) {
    console.error("Failed to load runtime key metadata:", error.message);
    res.status(500).json({ error: "Failed to load runtime key metadata." });
  }
});

app.put("/api/runtime-keys/:keyName", (req, res) => {
  try {
    const keyName = String(req.params.keyName || "").trim();
    if (!MANAGED_RUNTIME_KEYS.has(keyName)) {
      return res.status(400).json({ error: "Key is not writable." });
    }
    const metadata = updateManagedEnvKey(keyName, req.body?.value ?? "");
    res.json({ key: metadata });
  } catch (error) {
    console.error("Failed to update runtime key:", error.message);
    res.status(400).json({ error: error.message || "Failed to update runtime key." });
  }
});

app.get("/api/match-collector/config", async (req, res) => {
  try {
    const dataset = await buildCollectorDatasetSummary();
    res.json({
      defaults: collectorDefaultConfig(),
      activeDataset: dataset,
    });
  } catch (error) {
    console.error("Failed to load match collector config:", error.message);
    res.status(500).json({ error: "Failed to load match collector config." });
  }
});

app.get("/api/match-collector/presets", (req, res) => {
  try {
    res.json({ presets: loadCollectorPresets() });
  } catch (error) {
    console.error("Failed to load match collector presets:", error.message);
    res.status(500).json({ error: "Failed to load match collector presets." });
  }
});

app.get("/api/match-collector/status", async (req, res) => {
  try {
    const activeDataset = await buildCollectorDatasetSummary();
    res.json({
      ...getCollectorStatusSnapshot(),
      activeDataset,
    });
  } catch (error) {
    console.error("Failed to load match collector status:", error.message);
    res.status(500).json({ error: "Failed to load match collector status." });
  }
});

app.post("/api/match-collector/start", async (req, res) => {
  try {
    const snapshot = await startMatchCollectorJob(req.body || {});
    res.status(202).json(snapshot);
  } catch (error) {
    console.error("Failed to start match collector:", error.message);
    res.status(error.statusCode || 500).json({ error: error.message || "Failed to start match collector." });
  }
});

app.post("/api/match-collector/stop", (req, res) => {
  try {
    const snapshot = requestStopMatchCollectorJob();
    res.status(202).json(snapshot);
  } catch (error) {
    console.error("Failed to stop match collector:", error.message);
    res.status(error.statusCode || 500).json({ error: error.message || "Failed to stop match collector." });
  }
});

app.get("/api/riot/account/by-riot-id/:name/:tag", async (req, res) => {
  try {
    const response = await relayRiotRequest(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(req.params.name)}/${encodeURIComponent(req.params.tag)}`,
    );
    res.json(response);
  } catch (error) {
    console.error("Riot account lookup failed:", error.message);
    res.status(error.statusCode || 500).json(error.payload || { error: error.message });
  }
});

app.get("/api/riot/matches/by-puuid/:puuid/ids", async (req, res) => {
  try {
    const url = new URL(`https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(req.params.puuid)}/ids`);
    for (const [key, value] of Object.entries(req.query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
    const response = await relayRiotRequest(url.toString());
    res.json(response);
  } catch (error) {
    console.error("Riot match id lookup failed:", error.message);
    res.status(error.statusCode || 500).json(error.payload || { error: error.message });
  }
});

app.get("/api/riot/matches/:matchId", async (req, res) => {
  try {
    const response = await relayRiotRequest(
      `https://europe.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(req.params.matchId)}`,
    );
    const activeMatchesPath = getActiveMatchesPath();
    ensureDirectory(activeMatchesPath);
    const matchId = response?.metadata?.matchId;
    if (matchId) {
      const targetPath = path.join(activeMatchesPath, `${matchId}.json`);
      if (!fs.existsSync(targetPath)) {
        fs.writeFileSync(targetPath, JSON.stringify(response, null, 2));
      }
    }
    res.json(response);
  } catch (error) {
    console.error("Riot match detail lookup failed:", error.message);
    res.status(error.statusCode || 500).json(error.payload || { error: error.message });
  }
});

replayDb.run(`
CREATE TABLE IF NOT EXISTS pathfinder_replays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT NOT NULL UNIQUE,
  dataset_id TEXT NOT NULL DEFAULT 'default',
  dataset_name TEXT,
  title TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  source_player_id TEXT NOT NULL,
  target_player_id TEXT NOT NULL,
  source_label TEXT NOT NULL,
  target_label TEXT NOT NULL,
  dataset_player_count INTEGER NOT NULL,
  path_mode TEXT NOT NULL,
  weighted_mode INTEGER NOT NULL,
  selected_algorithm TEXT NOT NULL,
  comparison_rows_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`);

replayDb.run(`
CREATE TABLE IF NOT EXISTS pathfinder_replay_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  replay_id INTEGER NOT NULL,
  algorithm TEXT NOT NULL,
  runtime_ms REAL NOT NULL,
  nodes_visited INTEGER NOT NULL,
  path_length INTEGER NOT NULL,
  run_json TEXT NOT NULL,
  FOREIGN KEY (replay_id) REFERENCES pathfinder_replays(id) ON DELETE CASCADE,
  UNIQUE(replay_id, algorithm)
)
`);

function ensureReplayColumn(columnName, definition) {
  replayDb.all(`PRAGMA table_info(pathfinder_replays)`, [], (error, rows) => {
    if (error) {
      console.error(`Failed to inspect replay schema for ${columnName}:`, error.message);
      return;
    }
    const hasColumn = rows.some((row) => row.name === columnName);
    if (hasColumn) {
      return;
    }
    replayDb.run(`ALTER TABLE pathfinder_replays ADD COLUMN ${columnName} ${definition}`, (alterError) => {
      if (alterError) {
        console.error(`Failed to add replay column ${columnName}:`, alterError.message);
      }
    });
  });
}

ensureReplayColumn("dataset_id", "TEXT NOT NULL DEFAULT 'default'");
ensureReplayColumn("dataset_name", "TEXT");

async function hydrateReplayRows(replayRows) {
  if (!replayRows.length) {
    return [];
  }

  const replayIds = replayRows.map((row) => row.id);
  const placeholders = replayIds.map(() => "?").join(", ");
  const runRows = await replayDbAll(
    `SELECT replay_id, algorithm, run_json
     FROM pathfinder_replay_runs
     WHERE replay_id IN (${placeholders})
     ORDER BY replay_id DESC, algorithm ASC`,
    replayIds,
  );

  const runsByReplayId = new Map();
  for (const runRow of runRows) {
    const current = runsByReplayId.get(runRow.replay_id) ?? [];
    current.push(JSON.parse(runRow.run_json));
    runsByReplayId.set(runRow.replay_id, current);
  }

  return replayRows.map((row) => ({
    id: row.id,
    cacheKey: row.cache_key,
    datasetId: row.dataset_id,
    datasetName: row.dataset_name,
    title: row.title,
    executionMode: row.execution_mode,
    sourcePlayerId: row.source_player_id,
    targetPlayerId: row.target_player_id,
    sourceLabel: row.source_label,
    targetLabel: row.target_label,
    datasetPlayerCount: row.dataset_player_count,
    pathMode: row.path_mode,
    weightedMode: Boolean(row.weighted_mode),
    selectedAlgorithm: row.selected_algorithm,
    createdAt: row.created_at,
    comparisonRows: JSON.parse(row.comparison_rows_json),
    algorithmRuns: runsByReplayId.get(row.id) ?? [],
  }));
}

async function loadReplayById(replayId) {
  const rows = await replayDbAll(
    `SELECT *
     FROM pathfinder_replays
     WHERE id = ?`,
    [replayId],
  );
  const hydrated = await hydrateReplayRows(rows);
  return hydrated[0] ?? null;
}

function parsePlayerNames(rawNames) {
  if (!rawNames) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawNames);
    return Array.isArray(parsed) ? parsed : [String(rawNames)];
  } catch {
    return [String(rawNames)];
  }
}

function parseScoreDetails(rawDetails) {
  if (!rawDetails) {
    return null;
  }
  try {
    return JSON.parse(rawDetails);
  } catch {
    return null;
  }
}

const PLAYER_DETAIL_ARTIFACT_LABELS = {
  combat_impact: "Combat impact",
  risk_discipline: "Risk discipline",
  resource_tempo: "Resource tempo",
  map_objective_control: "Map and objective control",
  team_enablement: "Team enablement",
};

const PLAYER_DETAIL_GROUPS = {
  combat: ["combat_impact"],
  risk: ["risk_discipline"],
  resource: ["resource_tempo"],
  map_objective: ["map_objective_control"],
  team: ["team_enablement"],
};

function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function averageNumbers(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + safeNumber(value), 0) / values.length;
}

function roundNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentileRank(values, targetValue, { descending = false } = {}) {
  const sorted = [...values].filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) {
    return 0;
  }

  const target = safeNumber(targetValue);
  let lessCount = 0;
  let equalCount = 0;

  for (const value of sorted) {
    if (value < target) {
      lessCount += 1;
      continue;
    }
    if (value === target) {
      equalCount += 1;
      continue;
    }
    break;
  }

  const ascendingPercentile = ((lessCount + equalCount * 0.5) / sorted.length) * 100;
  return roundNumber(descending ? 100 - ascendingPercentile : ascendingPercentile, 1);
}

// Like percentileRank but assumes sortedValues is already sorted ascending (as stored in
// datasetColumnStatsCache). Uses binary search: O(log n) vs O(n log n) for the general form.
function percentileRankSorted(sortedValues, targetValue, { descending = false } = {}) {
  if (!sortedValues.length) return 0;

  const target = safeNumber(targetValue);

  // Lower bound: first index where sortedValues[i] >= target
  let lo = 0;
  let hi = sortedValues.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedValues[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const lessCount = lo;

  // Upper bound: first index where sortedValues[i] > target
  lo = 0;
  hi = sortedValues.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedValues[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  const equalCount = lo - lessCount;

  const ascendingPercentile = ((lessCount + equalCount * 0.5) / sortedValues.length) * 100;
  return roundNumber(descending ? 100 - ascendingPercentile : ascendingPercentile, 1);
}

function computeAverageKda(kills, assists, deaths) {
  return (safeNumber(kills) + safeNumber(assists)) / Math.max(1, safeNumber(deaths));
}

// Scans all match JSON files ONCE per dataset, building per-player KDA totals and the
// dataset-wide total. Subsequent buildPlayerKdaBenchmark calls are O(1) map lookups.
async function loadDatasetKdaData() {
  const matchDir = getActiveMatchesPath();

  if (datasetKdaCache.matchDir === matchDir && datasetKdaCache.data) {
    return { data: datasetKdaCache.data, cacheHit: true };
  }

  if (datasetKdaCache.matchDir === matchDir && datasetKdaCache.promise) {
    const data = await datasetKdaCache.promise;
    return { data, cacheHit: true };
  }

  datasetKdaCache.matchDir = matchDir;
  const loadPromise = (async () => {
    const t0 = Date.now();
    const playerTotals = new Map();
    let datasetTotal = 0;
    let datasetSamples = 0;

    if (fs.existsSync(matchDir)) {
      const allFiles = (await fs.promises.readdir(matchDir))
        .filter((f) => f.endsWith(".json"))
        .sort();

      for (const file of allFiles) {
        try {
          const raw = JSON.parse(await fs.promises.readFile(path.join(matchDir, file), "utf-8"));
          const participants = Array.isArray(raw?.info?.participants) ? raw.info.participants : [];
          for (const p of participants) {
            const kda = computeAverageKda(p?.kills, p?.assists, p?.deaths);
            datasetTotal += kda;
            datasetSamples++;
            if (p?.puuid) {
              const entry = playerTotals.get(p.puuid) ?? { total: 0, matches: 0 };
              entry.total += kda;
              entry.matches++;
              playerTotals.set(p.puuid, entry);
            }
          }
        } catch (err) {
          console.warn(`[kda-cache] failed to parse ${file}: ${err.message}`);
        }
      }

      console.log(
        `[kda-cache] loaded matchDir=${matchDir} files=${allFiles.length} samples=${datasetSamples} ` +
        `uniquePlayers=${playerTotals.size} ms=${Date.now() - t0}`,
      );
    }

    const data = { datasetTotal, datasetSamples, playerTotals };
    datasetKdaCache.data = data;
    datasetKdaCache.promise = null;
    return data;
  })().catch((err) => {
    datasetKdaCache.matchDir = null;
    datasetKdaCache.promise = null;
    throw err;
  });

  datasetKdaCache.promise = loadPromise;
  return { data: await loadPromise, cacheHit: false };
}

// O(1) after the first call — data is from the dataset-level KDA cache.
async function buildPlayerKdaBenchmark(puuid) {
  const { data, cacheHit } = await loadDatasetKdaData();
  const { datasetTotal, datasetSamples, playerTotals } = data;
  const player = playerTotals.get(puuid) ?? { total: 0, matches: 0 };
  return {
    _cacheHit: cacheHit,  // stripped before sending to client; used only for logging
    playerAverage: roundNumber(player.matches > 0 ? player.total / player.matches : 0),
    datasetAverage: roundNumber(datasetSamples > 0 ? datasetTotal / datasetSamples : 0),
    matchesSampled: player.matches,
    datasetSamples,
  };
}

// Pure computation against pre-sorted cached distributions. Uses percentileRankSorted (binary
// search, O(log n)) instead of re-sorting on every call.
function buildPlayerScoreBenchmarks(playerRow, stats) {
  const { sampleSize, distributions, averages } = stats;

  const groups = Object.fromEntries(
    Object.entries(PLAYER_DETAIL_GROUPS).map(([groupKey, keys]) => {
      const components = keys.map((key) => {
        const playerValue = safeNumber(playerRow[`artifact_${key}`]);
        const averageValue = averages[key] ?? 0;
        const percentile = percentileRankSorted(distributions[key], playerValue);

        return {
          key,
          label: PLAYER_DETAIL_ARTIFACT_LABELS[key] || key,
          playerValue: roundNumber(playerValue),
          averageValue: roundNumber(averageValue),
          percentile,
        };
      });

      return [
        groupKey,
        {
          percentile: roundNumber(averageNumbers(components.map((entry) => entry.percentile)), 1),
          components,
        },
      ];
    }),
  );

  return {
    sampleSize,
    opscore: {
      average: roundNumber(averages.opscore ?? 0),
      percentile: percentileRankSorted(distributions.opscore, safeNumber(playerRow.opscore)),
    },
    feedscore: {
      average: roundNumber(averages.feedscore ?? 0),
      percentile: percentileRankSorted(distributions.feedscore, safeNumber(playerRow.feedscore), { descending: true }),
    },
    groups,
  };
}

app.get("/api/players/options", async (req, res) => {
  const currentDbPath = getActiveRefinedDbPath();
  const dataset = getActiveDataset();

  if (playerOptionsCache.dbPath === currentDbPath && playerOptionsCache.players) {
    console.log(`[players/options] cache=HIT dataset=${dataset?.id}`);
    return res.json({ players: playerOptionsCache.players });
  }

  if (playerOptionsCache.dbPath === currentDbPath && playerOptionsCache.promise) {
    console.log(`[players/options] cache=IN_FLIGHT dataset=${dataset?.id}`);
    try {
      const players = await playerOptionsCache.promise;
      return res.json({ players });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  try {
    playerOptionsCache.dbPath = currentDbPath;
    playerOptionsCache.promise = (async () => {
      const t0 = Date.now();
      const rows = await refinedDbAll(
        `SELECT puuid, names
         FROM players
         WHERE puuid IS NOT NULL
           AND TRIM(puuid) != ""`,
      );
      const players = rows
        .map((row) => {
          const allNames = parsePlayerNames(row.names);
          return { id: row.puuid, label: allNames[0] || row.puuid };
        })
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
      playerOptionsCache.players = players;
      playerOptionsCache.promise = null;
      console.log(`[players/options] cache=MISS dataset=${dataset?.id} rows=${rows.length} dbMs=${Date.now() - t0}`);
      return players;
    })();
    const players = await playerOptionsCache.promise;
    return res.json({ players });
  } catch (err) {
    playerOptionsCache.promise = null;
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/players/:puuid/scores", async (req, res) => {
  const t0 = Date.now();
  const { puuid } = req.params;
  const dataset = getActiveDataset();
  const datasetId = dataset?.id ?? "unknown";

  // Compound key keeps Flex and SoloQ caches independent even without a dataset switch.
  const scoreCacheKey = `${datasetId}:${puuid}`;

  try {
    // Full response cache — hit means zero DB/file work.
    if (playerScoreCache.has(scoreCacheKey)) {
      console.log(`[players/scores] dataset=${datasetId} puuid=${puuid.slice(0, 8)}... cache=HIT totalMs=0`);
      return res.json(playerScoreCache.get(scoreCacheKey));
    }

    console.log(`[players/scores] dataset=${datasetId} puuid=${puuid.slice(0, 8)}... cache=MISS start`);

    // Dataset-wide column stats — one DB scan per dataset lifetime.
    const t1 = Date.now();
    const { stats, cacheHit: statsCacheHit } = await loadDatasetColumnStats();
    console.log(
      `[players/scores] column-stats cacheHit=${statsCacheHit} statsMs=${Date.now() - t1} sampleSize=${stats.sampleSize}`,
    );

    // Single-row player fetch + dataset KDA lookup (file scan is dataset-level cached).
    const t2 = Date.now();
    const [row, kdaRaw] = await Promise.all([
      refinedDbGet(
         `SELECT
            puuid, names, opscore, feedscore,
            detected_role, role_confidence, matches_processed, score_computed_at, country,
            artifact_combat_impact, artifact_risk_discipline, artifact_resource_tempo,
            artifact_map_objective_control, artifact_team_enablement, score_detail_json
          FROM players
          WHERE puuid = ?`,
        [puuid],
      ),
      buildPlayerKdaBenchmark(puuid),
    ]);
    console.log(
      `[players/scores] playerRow=${row ? "found" : "not-found"} kda.cacheHit=${kdaRaw._cacheHit} fetchMs=${Date.now() - t2}`,
    );

    if (!row) {
      return res.status(404).json({ error: "Player not found" });
    }

    // Strip internal _cacheHit flag before sending to client.
    const { _cacheHit: _kdaCacheHit, ...kdaBenchmark } = kdaRaw;

    const benchmarks = buildPlayerScoreBenchmarks(row, stats);

    const response = {
      puuid: row.puuid,
      names: parsePlayerNames(row.names),
      scores: {
        opscore: Number(row.opscore) || 0,
        feedscore: Number(row.feedscore) || 0,
        detectedRole: row.detected_role || "UNKNOWN",
        roleConfidence: Number(row.role_confidence) || 0,
        matchesProcessed: row.matches_processed || 0,
        computedAt: row.score_computed_at,
        artifacts: {
          combat_impact: Number(row.artifact_combat_impact) || 0,
          risk_discipline: Number(row.artifact_risk_discipline) || 0,
          resource_tempo: Number(row.artifact_resource_tempo) || 0,
          map_objective_control: Number(row.artifact_map_objective_control) || 0,
          team_enablement: Number(row.artifact_team_enablement) || 0,
        },
        details: parseScoreDetails(row.score_detail_json),
      },
      benchmarks: { ...benchmarks, kda: kdaBenchmark },
      country: row.country || null,
    };

    playerScoreCache.set(scoreCacheKey, response);
    console.log(`[players/scores] dataset=${datasetId} puuid=${puuid.slice(0, 8)}... done totalMs=${Date.now() - t0}`);
    return res.json(response);
  } catch (err) {
    console.error(
      `[players/scores] dataset=${datasetId} puuid=${puuid.slice(0, 8)}... error="${err.message}" totalMs=${Date.now() - t0}`,
    );
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/scores/leaderboard", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const role = req.query.role ? String(req.query.role).toUpperCase() : null;

    let query = `
      SELECT
        puuid,
        names,
        opscore,
        feedscore,
        detected_role,
        role_confidence,
        matches_processed,
        country
      FROM players
      WHERE opscore > 0
    `;
    const params = [];

    if (role) {
      query += ` AND detected_role = ?`;
      params.push(role);
    }

    query += ` ORDER BY opscore DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await refinedDbAll(query, params);

    let countQuery = `SELECT COUNT(*) AS total FROM players WHERE opscore > 0`;
    const countParams = [];

    if (role) {
      countQuery += ` AND detected_role = ?`;
      countParams.push(role);
    }

    const countRow = await refinedDbGet(countQuery, countParams);
    const leaderboard = rows.map((row, index) => {
      const allNames = parsePlayerNames(row.names);
      return {
        rank: offset + index + 1,
        puuid: row.puuid,
        playerName: allNames[0] || "Unknown",
        allNames,
        opscore: Number(row.opscore) || 0,
        feedscore: Number(row.feedscore) || 0,
        detectedRole: row.detected_role || "UNKNOWN",
        roleConfidence: Number(row.role_confidence) || 0,
        matchesProcessed: row.matches_processed || 0,
        country: row.country || null,
      };
    });

    res.json({
      leaderboard,
      pagination: {
        total: countRow?.total || 0,
        limit,
        offset,
        hasMore: offset + limit < (countRow?.total || 0),
      },
      filter: { role: role || "ALL" },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/scores/leaderboard/by-role/:role", (req, res) => {
  const { role } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  res.redirect(
    `/api/scores/leaderboard?role=${encodeURIComponent(role.toUpperCase())}&limit=${limit}&offset=${offset}`,
  );
});

app.get("/api/scores/config", (req, res) => {
  const scoringConfig = require("./scoring_config");

  res.json({
    roleMultipliers: scoringConfig.roleMultipliers || {},
    deathTolerance: scoringConfig.deathTolerance || {},
    normalization: scoringConfig.normalization || {},
    opscoreV2: scoringConfig.opscoreV2 || {},
    artifacts: {
      combat_impact: "Fight conversion and damage pressure, with elite overflow for carry performances.",
      risk_discipline: "Contribution-aware death cost and survival quality. Feed risk is derived from this artifact.",
      resource_tempo: "Gold, CS, spending efficiency, and lane or jungle tempo.",
      map_objective_control: "Vision control plus objective and structure conversion with split-push dominance weighting.",
      team_enablement: "Crowd-control setup, ally protection, and save/enablement signals.",
    },
  });
});

app.post('/api/save-player', (req, res) => {
  const player = req.body;

  if (!player.name) {
    return res.status(400).json({ error: 'Missing player name' });
  }

  rawDb.get("SELECT * FROM players WHERE names = ?", [player.name], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    if (row) {
      // Update existing player with weighted average calculation
      const oldCount = row.match_count || 1;
      const newCount = oldCount + 1;

      const newFeedscore = (row.feedscore * oldCount + parseFloat(player.feedscore)) / newCount;
      const newOpscore = (row.opscore * oldCount + parseFloat(player.opscore)) / newCount;

      const sqlUpdate = `
        UPDATE players SET
          feedscore = ?,
          opscore = ?,
          match_count = ?
        WHERE names = ?
      `;

      rawDb.run(sqlUpdate, [newFeedscore, newOpscore, newCount, player.name], function (err) {
        if (err) {
          console.error('Update error:', err);
          return res.status(500).json({ error: 'Update failed', details: err.message });
        }
        res.json({
          message: 'Player updated successfully',
          player: {
            name: player.name,
            feedscore: newFeedscore,
            opscore: newOpscore,
            match_count: newCount
          }
        });
      });
    } else {
      // Insert new player
      const sqlInsert = `
        INSERT OR REPLACE INTO players (names, feedscore, opscore, match_count)
        VALUES (?, ?, ?, 1)
      `;

      rawDb.run(sqlInsert, [player.name, parseFloat(player.feedscore), parseFloat(player.opscore)], function (err) {
        if (err) {
          console.error('Insert error:', err);
          return res.status(500).json({ error: 'Insert failed', details: err.message });
        }
        res.json({
          message: 'Player inserted successfully',
          player: {
            name: player.name,
            feedscore: parseFloat(player.feedscore),
            opscore: parseFloat(player.opscore),
            match_count: 1
          }
        });
      });
    }
  });
});

app.post("/api/generate-graph", (req, res) => {
  execFile(
    "python",
    ["build_graph.py", "--connected-only", "--min-weight", "2"],
    { cwd: backendDir, env: { ...process.env, ...getActiveRustEnv() } },
    (error, stdout, stderr) => {
    if (error) {
      console.error("Python script error:", error);
      return res.status(500).json({ message: "Python script execution failed." });
    }
    if (stderr) {
      console.warn("Python script stderr:", stderr);
    }
    console.log("Graph generated successfully.");
    res.json({ message: "Graph generation completed." });
    },
  );
});

app.get("/api/graph", (req, res) => {
  res.json({
    url: "http://localhost:3001/graph-view/premade_network.html"
  });
});

app.post("/api/normalize-players", async (req, res) => {
  try {
    await normalizePlayersByPuuid({
      dbFile: getActiveRefinedDbPath(),
      matchDir: getActiveMatchesPath(),
    });
    res.status(200).json({ message: "Players normalized successfully." });
  } catch (err) {
    console.error("Normalization error:", err);
    res.status(500).json({ error: "Normalization failed.", details: err.message });
  }
});

app.get("/api/pathfinder/options", (req, res) => {
  res.json(getPrototypePathfinderOptions());
});

app.get("/api/pathfinder/engine-spec", (req, res) => {
  res.json(getPrototypeEngineSpec());
});

app.post("/api/pathfinder/run", (req, res) => {
  try {
    const payload = req.body || {};
    const response = runPrototypePathfinderSearch({
      sourcePlayerId: payload.sourcePlayerId,
      targetPlayerId: payload.targetPlayerId,
      algorithm: payload.algorithm,
      pathMode: payload.pathMode,
	      weightedMode: payload.weightedMode,
	      options: {
	        includeTrace: payload.options?.includeTrace === true,
	        maxSteps: payload.options?.maxSteps || 5000,
	      },
	    });
    res.json(response);
  } catch (error) {
    console.error("Pathfinder prototype run failed:", error);
    res.status(500).json({ error: "Pathfinder prototype run failed." });
  }
});

app.post("/api/pathfinder/compare", (req, res) => {
  try {
    const payload = req.body || {};
    res.json({
      rows: comparePrototypeAlgorithms(
        payload.sourcePlayerId,
        payload.targetPlayerId,
        payload.pathMode || "social-path",
        Boolean(payload.weightedMode),
      ),
    });
  } catch (error) {
    console.error("Pathfinder compare failed:", error);
    res.status(500).json({ error: "Pathfinder compare failed." });
  }
});

app.get("/api/pathfinder-rust/options", async (req, res) => {
  try {
    const response = await getCachedRustResponse("options");
    res.json(response);
  } catch (error) {
    console.error("Rust pathfinder options failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-rust/global-view", async (req, res) => {
  try {
    const response = await getCachedRustResponse("global-view");
    res.json(response);
  } catch (error) {
    console.error("Rust pathfinder global view failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-rust/engine-spec", async (req, res) => {
  try {
    const response = await getCachedRustResponse("spec");
    res.json(response);
  } catch (error) {
    console.error("Rust pathfinder engine spec failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pathfinder-rust/run", async (req, res) => {
  try {
    const payload = req.body || {};
    const response = await executeRustCommand("run", {
      sourcePlayerId: payload.sourcePlayerId,
      targetPlayerId: payload.targetPlayerId,
      algorithm: payload.algorithm,
      pathMode: payload.pathMode,
	      weightedMode: payload.weightedMode,
	      options: {
	        includeTrace: payload.options?.includeTrace === true,
	        maxSteps: payload.options?.maxSteps || 5000,
	      },
	    }, getActiveRustEnv());
    res.json(response);
  } catch (error) {
    console.error("Rust pathfinder run failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pathfinder-rust/compare", async (req, res) => {
  try {
    const payload = req.body || {};
    const response = await executeRustCommand("compare", {
      sourcePlayerId: payload.sourcePlayerId,
      targetPlayerId: payload.targetPlayerId,
      pathMode: payload.pathMode || "social-path",
      weightedMode: Boolean(payload.weightedMode),
    }, getActiveRustEnv());
    res.json(response);
  } catch (error) {
    console.error("Rust pathfinder compare failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pathfinder-rust/player-focus", async (req, res) => {
  try {
    const payload = req.body || {};
    const response = await executeRustCommand("player-focus", {
      playerId: payload.playerId,
    }, getActiveRustEnv());
    res.json(response);
  } catch (error) {
    console.error("Rust pathfinder player focus failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pathfinder-rust/signed-balance", async (req, res) => {
  try {
    const payload = req.body || {};
    const response = await runSignedBalanceQueued(payload);
    res.json(response);
  } catch (error) {
    console.error("Rust signed balance analysis failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pathfinder-rust/assortativity", async (req, res) => {
  try {
    const payload = normalizeAssortativityPayload(req.body || {});
    const response = await executeRustCommand("assortativity", payload, getActiveRustEnv());
    res.json(response);
  } catch (error) {
    console.error("Rust assortativity analysis failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pathfinder-rust/balance-sweep", async (req, res) => {
  try {
    const payload = normalizeBalanceSweepPayload(req.body || {});
    const response = await executeRustCommand("balance-sweep", payload, getActiveRustEnv());
    res.json(response);
  } catch (error) {
    console.error("Rust signed-balance sweep failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pathfinder-rust/assortativity-significance", async (req, res) => {
  try {
    const payload = normalizeAssortativitySignificancePayload(req.body || {});
    const response = await executeRustCommand(
      "assortativity-significance",
      payload,
      getActiveRustEnv(),
    );
    res.json(response);
  } catch (error) {
    console.error("Rust assortativity significance failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pathfinder-rust/betweenness-centrality", async (req, res) => {
  try {
    const payload = normalizeBetweennessPayload(req.body || {});
    const response = await executeRustCommand(
      "betweenness-centrality",
      payload,
      getActiveRustEnv(),
    );
    res.json(response);
  } catch (error) {
    console.error("Rust betweenness centrality failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-replays", async (req, res) => {
  try {
    const dataset = getActiveDataset();
    const replayRows = await replayDbAll(
      `SELECT *
       FROM pathfinder_replays
       WHERE dataset_id = ?
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT 24`,
      [dataset.id],
    );
    const replays = await hydrateReplayRows(replayRows);
    res.json({ replays });
  } catch (error) {
    console.error("Pathfinder replay load failed:", error.message);
    res.status(500).json({ error: "Pathfinder replay load failed." });
  }
});

app.post("/api/pathfinder-replays", async (req, res) => {
  const payload = req.body || {};
  const algorithmRuns = Array.isArray(payload.algorithmRuns) ? payload.algorithmRuns : [];
  const comparisonRows = Array.isArray(payload.comparisonRows) ? payload.comparisonRows : [];

  if (!payload.cacheKey || !payload.title || !payload.sourcePlayerId || !payload.targetPlayerId || !payload.pathMode) {
    return res.status(400).json({ error: "Missing required replay metadata." });
  }

  if (!algorithmRuns.length) {
    return res.status(400).json({ error: "Replay must include at least one algorithm run." });
  }

  try {
    const dataset = getActiveDataset();
    await replayDbRun("BEGIN IMMEDIATE TRANSACTION");

    const existingReplay = await replayDbGet(
      `SELECT id
       FROM pathfinder_replays
       WHERE cache_key = ?
         AND dataset_id = ?`,
      [payload.cacheKey, dataset.id],
    );

    let replayId = existingReplay?.id ?? null;
    if (replayId) {
      await replayDbRun(
        `UPDATE pathfinder_replays
         SET title = ?,
             dataset_id = ?,
             dataset_name = ?,
             execution_mode = ?,
             source_player_id = ?,
             target_player_id = ?,
             source_label = ?,
             target_label = ?,
             dataset_player_count = ?,
             path_mode = ?,
             weighted_mode = ?,
             selected_algorithm = ?,
             comparison_rows_json = ?,
             created_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          payload.title,
          dataset.id,
          dataset.name,
          payload.executionMode,
          payload.sourcePlayerId,
          payload.targetPlayerId,
          payload.sourceLabel,
          payload.targetLabel,
          payload.datasetPlayerCount,
          payload.pathMode,
          payload.weightedMode ? 1 : 0,
          payload.selectedAlgorithm,
          JSON.stringify(comparisonRows),
          replayId,
        ],
      );
      await replayDbRun(`DELETE FROM pathfinder_replay_runs WHERE replay_id = ?`, [replayId]);
    } else {
      const insertResult = await replayDbRun(
        `INSERT INTO pathfinder_replays (
          cache_key,
          dataset_id,
          dataset_name,
          title,
          execution_mode,
          source_player_id,
          target_player_id,
          source_label,
          target_label,
          dataset_player_count,
          path_mode,
          weighted_mode,
          selected_algorithm,
          comparison_rows_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.cacheKey,
          dataset.id,
          dataset.name,
          payload.title,
          payload.executionMode,
          payload.sourcePlayerId,
          payload.targetPlayerId,
          payload.sourceLabel,
          payload.targetLabel,
          payload.datasetPlayerCount,
          payload.pathMode,
          payload.weightedMode ? 1 : 0,
          payload.selectedAlgorithm,
          JSON.stringify(comparisonRows),
        ],
      );
      replayId = insertResult.lastID;
    }

    for (const algorithmRun of algorithmRuns) {
      await replayDbRun(
        `INSERT INTO pathfinder_replay_runs (
          replay_id,
          algorithm,
          runtime_ms,
          nodes_visited,
          path_length,
          run_json
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          replayId,
          algorithmRun.request?.algorithm,
          algorithmRun.summary?.runtimeMs ?? 0,
          algorithmRun.summary?.nodesVisited ?? 0,
          algorithmRun.summary?.pathLength ?? 0,
          JSON.stringify(algorithmRun),
        ],
      );
    }

    await replayDbRun("COMMIT");
    const savedReplay = await loadReplayById(replayId);
    res.json(savedReplay);
  } catch (error) {
    try {
      await replayDbRun("ROLLBACK");
    } catch {
      // Ignore rollback errors after the original failure.
    }
    console.error("Pathfinder replay save failed:", error.message);
    res.status(500).json({ error: "Pathfinder replay save failed." });
  }
});

app.delete("/api/pathfinder-replays/:id", async (req, res) => {
  try {
    await replayDbRun(`DELETE FROM pathfinder_replays WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    console.error("Pathfinder replay delete failed:", error.message);
    res.status(500).json({ error: "Pathfinder replay delete failed." });
  }
});

app.get("/api/pathfinder-rust/birdseye-3d/manifest", async (req, res) => {
  try {
    await streamBirdseyeArtifact(res, "manifest", "application/json; charset=utf-8");
  } catch (error) {
    console.error("Rust birdseye manifest failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-rust/birdseye-3d/node-meta", async (req, res) => {
  try {
    await streamBirdseyeArtifact(res, "nodeMeta", "application/json; charset=utf-8");
  } catch (error) {
    console.error("Rust birdseye node metadata failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-rust/birdseye-3d/node-positions", async (req, res) => {
  try {
    await streamBirdseyeArtifact(res, "nodePositions", "application/octet-stream");
  } catch (error) {
    console.error("Rust birdseye node positions failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-rust/birdseye-3d/node-metrics", async (req, res) => {
  try {
    await streamBirdseyeArtifact(res, "nodeMetrics", "application/octet-stream");
  } catch (error) {
    console.error("Rust birdseye node metrics failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-rust/birdseye-3d/edge-pairs", async (req, res) => {
  try {
    await streamBirdseyeArtifact(res, "edgePairs", "application/octet-stream");
  } catch (error) {
    console.error("Rust birdseye edge pairs failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-rust/birdseye-3d/edge-props", async (req, res) => {
  try {
    await streamBirdseyeArtifact(res, "edgeProps", "application/octet-stream");
  } catch (error) {
    console.error("Rust birdseye edge props failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

function resolveGraphV2RouteDataset(req) {
  if (!req.params.datasetId) {
    return getActiveDataset();
  }

  const dataset = getDatasetConfigById(req.params.datasetId);
  if (!dataset) {
    const error = new Error(`Unknown dataset: ${req.params.datasetId}`);
    error.statusCode = 404;
    throw error;
  }
  return dataset;
}

async function sendGraphV2RouteArtifact(req, res, artifactKey, contentType, label) {
  try {
    await streamGraphV2Artifact(res, artifactKey, contentType, resolveGraphV2RouteDataset(req));
  } catch (error) {
    console.error(`Rust graph v2 ${label} failed:`, error.message);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
}

app.get([
  "/api/pathfinder-rust/graph-v2/manifest",
  "/api/pathfinder-rust/datasets/:datasetId/graph-v2/manifest",
], async (req, res) => {
  await sendGraphV2RouteArtifact(req, res, "manifest", "application/json; charset=utf-8", "manifest");
});

app.get([
  "/api/pathfinder-rust/graph-v2/summary",
  "/api/pathfinder-rust/datasets/:datasetId/graph-v2/summary",
], async (req, res) => {
  await sendGraphV2RouteArtifact(req, res, "summary", "text/markdown; charset=utf-8", "analysis summary");
});

app.get([
  "/api/pathfinder-rust/graph-v2/node-meta",
  "/api/pathfinder-rust/datasets/:datasetId/graph-v2/node-meta",
], async (req, res) => {
  await sendGraphV2RouteArtifact(req, res, "nodeMeta", "application/json; charset=utf-8", "node metadata");
});

app.get([
  "/api/pathfinder-rust/graph-v2/node-positions",
  "/api/pathfinder-rust/datasets/:datasetId/graph-v2/node-positions",
], async (req, res) => {
  await sendGraphV2RouteArtifact(req, res, "nodePositions", "application/octet-stream", "node positions");
});

app.get([
  "/api/pathfinder-rust/graph-v2/node-metrics",
  "/api/pathfinder-rust/datasets/:datasetId/graph-v2/node-metrics",
], async (req, res) => {
  await sendGraphV2RouteArtifact(req, res, "nodeMetrics", "application/octet-stream", "node metrics");
});

app.get([
  "/api/pathfinder-rust/graph-v2/edge-pairs",
  "/api/pathfinder-rust/datasets/:datasetId/graph-v2/edge-pairs",
], async (req, res) => {
  await sendGraphV2RouteArtifact(req, res, "edgePairs", "application/octet-stream", "edge pairs");
});

app.get([
  "/api/pathfinder-rust/graph-v2/edge-props",
  "/api/pathfinder-rust/datasets/:datasetId/graph-v2/edge-props",
], async (req, res) => {
  await sendGraphV2RouteArtifact(req, res, "edgeProps", "application/octet-stream", "edge props");
});

app.get([
  "/api/pathfinder-rust/graph-v2/cluster-meta",
  "/api/pathfinder-rust/datasets/:datasetId/graph-v2/cluster-meta",
], async (req, res) => {
  await sendGraphV2RouteArtifact(req, res, "clusterMeta", "application/json; charset=utf-8", "cluster metadata");
});

app.post([
  "/api/pathfinder-rust/graph-v2/rebuild",
  "/api/pathfinder-rust/datasets/:datasetId/graph-v2/rebuild",
], async (req, res) => {
  try {
    const dataset = resolveGraphV2RouteDataset(req);
    await startGraphV2ExportForDataset(dataset, { force: true });
    const manifest = readJsonFile(getGraphV2ArtifactPathsForDataset(dataset).manifest);
    res.json({ ok: true, manifest });
  } catch (error) {
    console.error("Rust graph v2 rebuild failed:", error.message);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Neurosim cluster-export helpers
// ---------------------------------------------------------------------------

async function computeNeurosimClusterProfiles(dataset) {
  const db = new sqlite3.Database(
    dataset.refinedDbAbsolutePath,
    sqlite3.OPEN_READONLY,
    () => {},
  );
  try {
    const totalRow = await sqliteGet(db, "SELECT SUM(size) AS total FROM clusters");
    const total = totalRow?.total || 1;

    // Detect which artifact schema this DB has.
    const cols = await sqliteAll(db, "PRAGMA table_info(players)");
    const colNames = new Set(cols.map((c) => c.name));
    const hasV2 = colNames.has("artifact_combat_impact");
    const hasV1 = colNames.has("artifact_kda");

    // Build artifact SELECT fragment based on available columns.
    // V2: 5 aggregate columns (0–5 scale, cap 5.0)
    // V1: 8 raw columns (0–4.5 scale, cap 4.5)
    // Neither: return zeros
    const CAP = hasV2 ? 5.0 : 4.5;
    const wa = (col) =>
      hasV2 || hasV1
        ? `SUM(p.${col} * p.matches_processed) / NULLIF(SUM(p.matches_processed), 0)`
        : "0";

    const artifactSql = hasV2
      ? `${wa("artifact_combat_impact")}       AS a1_wa,
         ${wa("artifact_risk_discipline")}      AS a2_wa,
         ${wa("artifact_resource_tempo")}       AS a3_wa,
         ${wa("artifact_map_objective_control")} AS a4_wa,
         ${wa("artifact_team_enablement")}      AS a5_wa,`
      : hasV1
      ? `(${wa("artifact_kda")} + ${wa("artifact_damage")}) / 2.0         AS a1_wa,
         (${wa("artifact_tanking")})                                        AS a2_wa,
         (${wa("artifact_economy")} + ${wa("artifact_early_game")}) / 2.0  AS a3_wa,
         (${wa("artifact_map_awareness")} + ${wa("artifact_objectives")}) / 2.0 AS a4_wa,
         (${wa("artifact_utility")})                                        AS a5_wa,`
      : `0 AS a1_wa, 0 AS a2_wa, 0 AS a3_wa, 0 AS a4_wa, 0 AS a5_wa,`;

    const feedscoreSql = colNames.has("feedscore")
      ? `SUM(p.feedscore * p.matches_processed) / NULLIF(SUM(p.matches_processed), 0) AS feedscore_wa,`
      : `0 AS feedscore_wa,`;

    // SQLite GROUP_CONCAT ORDER BY requires SQLite >=3.38; use plain GROUP_CONCAT as fallback.
    const puuidSql = `GROUP_CONCAT(p.puuid) AS puuids_ordered`;

    const rows = await sqliteAll(
      db,
      `SELECT
         c.cluster_id AS id,
         CAST(c.size AS REAL) / ? AS size_ratio,
         COALESCE(AVG(p.opscore), 0.0) / 10.0 AS mean_opscore,
         COALESCE(
           SQRT(MAX(0.0, AVG(p.opscore * p.opscore) - AVG(p.opscore) * AVG(p.opscore))),
           0.0
         ) / 10.0 AS opscore_stddev,
         CAST(COUNT(CASE WHEN cm.is_bridge = 1 THEN 1 END) AS REAL) / MAX(c.size, 1) AS bridge_ratio,
         c.size AS cluster_size,
         ${artifactSql}
         ${feedscoreSql}
         ${puuidSql}
       FROM clusters c
       LEFT JOIN cluster_members cm ON c.cluster_id = cm.cluster_id
       LEFT JOIN players p ON cm.puuid = p.puuid
       GROUP BY c.cluster_id
       HAVING c.size >= 2
       ORDER BY c.size DESC`,
      [total],
    );

    const round4 = (v) => Math.round((v || 0) * 10000) / 10000;

    const clusters = rows.map((r) => {
      const size_ratio = round4(r.size_ratio);
      const mean_opscore = round4(r.mean_opscore);
      const opscore_stddev = round4(r.opscore_stddev);
      const cohesion = round4(1.0 - r.bridge_ratio);
      const internal_edge_ratio = round4(Math.max(0, 1.0 - Math.min(1, r.opscore_stddev * 2)));

      // Normalize raw weighted averages to 0–1
      const a1 = (r.a1_wa || 0) / CAP; // combat
      const a2 = (r.a2_wa || 0) / CAP; // risk
      const a3 = (r.a3_wa || 0) / CAP; // resource
      const a4 = (r.a4_wa || 0) / CAP; // map/objective
      const a5 = (r.a5_wa || 0) / CAP; // team

      const feed_risk = Math.max(0, Math.min(1, (r.feedscore_wa || 0) / 10.0));

      const founder_puuids = r.puuids_ordered
        ? r.puuids_ordered.split(",").filter(Boolean).slice(0, 3)
        : [];

      return {
        id: r.id,
        size_ratio,
        mean_opscore,
        opscore_stddev,
        cohesion,
        internal_edge_ratio,
        cluster_size: Number(r.cluster_size),
        feed_risk: round4(feed_risk),
        founder_puuids,
        fight_conversion:     round4(a1),
        damage_pressure:      round4(a1),
        death_cost:           round4(a2),
        survival_quality:     round4(a2),
        economy:              round4(a3),
        tempo:                round4(a3),
        vision_control:       round4(a4),
        objective_conversion: round4(a4),
        setup_control:        round4(a5),
        protection_support:   round4(a5),
        a_combat:        round4(a1),
        a_risk:          round4(a2),
        a_resource:      round4(a3),
        a_map_objective: round4(a4),
        a_team:          round4(a5),
      };
    });

    return {
      datasetId: dataset.id,
      clusterCount: clusters.length,
      totalMembersInClusters: total,
      minClusterSize: 2,
      clusters,
    };
  } finally {
    db.close();
  }
}

// Neurosim tribal simulation proxy
// Note: /api/neurosim/cluster-export is handled natively below — do not override it
app.all("/api/neurosim/health", (req, res) => neurosimBridge.proxyHttp(req, res));
app.all("/api/neurosim/api/*path", (req, res) => neurosimBridge.proxyHttp(req, res));

app.get([
  "/api/neurosim/cluster-export",
  "/api/neurosim/datasets/:datasetId/cluster-export",
], async (req, res) => {
  try {
    const dataset = req.params.datasetId
      ? getDatasetConfigById(req.params.datasetId)
      : getActiveDataset();
    if (!dataset) {
      return res.status(404).json({ error: `Unknown dataset: ${req.params.datasetId}` });
    }
    const result = await computeNeurosimClusterProfiles(dataset);
    res.json(result);
  } catch (error) {
    console.error("[neurosim] cluster-export failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------

neurosimBridge.startNeurosimBackend();

const server = app.listen(PORT, () => {
  loadDatasetRegistry();
  openActiveRawDatabase();
  openActiveRefinedDatabase();
  warnAboutLegacyMatchFiles();
  console.log(`Backend listening at http://localhost:${PORT}`);
  void prewarmRustMetadata();
});

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/api/neurosim/ws/tribal-simulation") {
    neurosimBridge.proxyWebSocket(req, socket, head);
  }
});
app.get("/api/ping", (req, res) => {
  res.send("pong");
});
