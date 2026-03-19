const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3001;
const MATCHES_DIR = path.join(__dirname, "data");
const { execFile } = require("child_process");
const { normalizePlayersByPuuid } = require("./normalize_players_by_puuid");
const {
  runSearch: runPrototypePathfinderSearch,
  compareAlgorithms: comparePrototypeAlgorithms,
  getOptions: getPrototypePathfinderOptions,
  getEngineSpec: getPrototypeEngineSpec,
} = require("./pathfinder/prototypeEngine");
const { executeRustCommand, executeRustCommandRaw } = require("./pathfinder/rustBridge");

const rustResponseCache = {
  options: null,
  spec: null,
  "global-view": null,
};
const rustInFlightRequests = new Map();
let signedBalanceQueue = Promise.resolve();
let signedBalanceActivePromise = null;
let signedBalanceActiveKey = null;
const birdseyeCacheDir = path.resolve(__dirname, "pathfinder-rust", "cache", "birdseye-3d-v4");
const birdseyeArtifactPaths = {
  manifest: path.join(birdseyeCacheDir, "manifest.json"),
  nodeMeta: path.join(birdseyeCacheDir, "node_meta.json"),
  nodePositions: path.join(birdseyeCacheDir, "node_positions.f32"),
  nodeMetrics: path.join(birdseyeCacheDir, "node_metrics.u32"),
  edgePairs: path.join(birdseyeCacheDir, "edge_pairs.u32"),
  edgeProps: path.join(birdseyeCacheDir, "edge_props.u32"),
};
let birdseyeCachePromise = null;
const SQLITE_BUSY_TIMEOUT_MS = 5000;

async function getCachedRustResponse(command, { forceRefresh = false } = {}) {
  if (!forceRefresh && rustResponseCache[command]) {
    return rustResponseCache[command];
  }

  if (!forceRefresh && rustInFlightRequests.has(command)) {
    return rustInFlightRequests.get(command);
  }

  const request = executeRustCommand(command)
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
  try {
    console.log("Prewarming Rust pathfinder metadata...");
    await Promise.all([
      getCachedRustResponse("options", { forceRefresh: true }),
      getCachedRustResponse("spec", { forceRefresh: true }),
      getCachedRustResponse("global-view", { forceRefresh: true }),
    ]);
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

      const activePromise = executeRustCommand("signed-balance", normalized);
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
  return Object.values(birdseyeArtifactPaths).every((artifactPath) => fs.existsSync(artifactPath));
}

async function ensureBirdseyeArtifacts() {
  if (hasBirdseyeArtifacts()) {
    return birdseyeArtifactPaths;
  }

  if (birdseyeCachePromise) {
    return birdseyeCachePromise;
  }

  birdseyeCachePromise = executeRustCommandRaw("birdseye-3d-export")
    .then(() => {
      if (!hasBirdseyeArtifacts()) {
        throw new Error("Birdseye 3D artifact export completed, but required files are missing.");
      }
      return birdseyeArtifactPaths;
    })
    .finally(() => {
      birdseyeCachePromise = null;
    });

  return birdseyeCachePromise;
}

async function streamBirdseyeArtifact(res, artifactPath, contentType) {
  await ensureBirdseyeArtifacts();
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  fs.createReadStream(artifactPath).pipe(res);
}

app.use(cors());
app.use(bodyParser.json({ limit: "25mb" }));
app.use('/graph-view', express.static(path.join(__dirname, 'output')));
const backendDir = __dirname;
const dbPath = path.resolve(__dirname, 'players.db'); //raw adatbazis amit kesobb kiegeszetiunk , celja a jatekosok adatainak tarolasa , de csak a nev alapjan
const replayDbPath = path.resolve(__dirname, "pathfinder_replays.db");
const db = new sqlite3.Database(
  dbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX,
  (err) => {
    if (err) {
      console.error('Nem sikerült megnyitni az adatbázist:', err.message);
    } else {
      console.log('Adatbázis megnyitva.');
    }
  }
);
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

db.configure("busyTimeout", SQLITE_BUSY_TIMEOUT_MS);
db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);
  db.run(`PRAGMA journal_mode = WAL`);
  db.run(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
});
replayDb.configure("busyTimeout", SQLITE_BUSY_TIMEOUT_MS);
replayDb.serialize(() => {
  replayDb.run(`PRAGMA foreign_keys = ON`);
  replayDb.run(`PRAGMA journal_mode = WAL`);
  replayDb.run(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
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
  return sqliteRun(db, sql, params);
}

function dbGet(sql, params = []) {
  return sqliteGet(db, sql, params);
}

function dbAll(sql, params = []) {
  return sqliteAll(db, sql, params);
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
// Ellenőrizd, hogy a data mappa létezik-e
if (!fs.existsSync(MATCHES_DIR)) {
  fs.mkdirSync(MATCHES_DIR);
}

// POST /api/save-match
app.post("/api/save-match", (req, res) => {
  const match = req.body;
  const matchId = match?.metadata?.matchId;
  if (!matchId) {
    return res.status(400).json({ error: "Missing matchId" });
  }

  const matchFilePath = path.join(MATCHES_DIR, `${matchId}.json`);

  if (fs.existsSync(matchFilePath)) {
    return res.status(200).json({ message: "Match already exists" });
  }

  fs.writeFileSync(matchFilePath, JSON.stringify(match, null, 2));
  return res.status(201).json({ message: "Match saved" });
});

// GET /api/matches → összes meccs kilistázása
app.get("/api/matches", (req, res) => {
  const files = fs.readdirSync(MATCHES_DIR).filter(f => f.endsWith(".json"));
  const allMatches = files.map(f => {
    const content = fs.readFileSync(path.join(MATCHES_DIR, f), "utf-8");
    return JSON.parse(content);
  });
  res.json(allMatches);
});
// Database setup
db.run(`
CREATE TABLE IF NOT EXISTS players (
  puuid TEXT PRIMARY KEY,
  names TEXT,
  feedscore REAL,
  opscore REAL,
  country TEXT,
  match_count INTEGER DEFAULT 1
)
`);

replayDb.run(`
CREATE TABLE IF NOT EXISTS pathfinder_replays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT NOT NULL UNIQUE,
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

app.post('/api/save-player', (req, res) => {
  const player = req.body;

  if (!player.name) {
    return res.status(400).json({ error: 'Missing player name' });
  }

  db.get("SELECT * FROM players WHERE names = ?", [player.name], (err, row) => {
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
          country = ?,
          match_count = ?
        WHERE names = ?
      `;

      db.run(sqlUpdate, [newFeedscore, newOpscore, player.country, newCount, player.name], function (err) {
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
            country: player.country,
            match_count: newCount
          }
        });
      });
    } else {
      // Insert new player
      const sqlInsert = `
        INSERT OR REPLACE INTO players (names, feedscore, opscore, country, match_count)
        VALUES (?, ?, ?, ?, 1)
      `;

      db.run(sqlInsert, [player.name, parseFloat(player.feedscore), parseFloat(player.opscore), player.country], function (err) {
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
            country: player.country,
            match_count: 1
          }
        });
      });
    }
  });
});

app.post("/api/generate-graph", (req, res) => {
  execFile("python", ["build_graph.py", "--connected-only", "--min-weight", "2"], { cwd: backendDir }, (error, stdout, stderr) => {
    if (error) {
      console.error("Python script error:", error);
      return res.status(500).json({ message: "Python script execution failed." });
    }
    if (stderr) {
      console.warn("Python script stderr:", stderr);
    }
    console.log("Graph generated successfully.");
    res.json({ message: "Graph generation completed." });
  });
});

app.get("/api/graph", (req, res) => {
  res.json({
    url: "http://localhost:3001/graph-view/premade_network.html"
  });
});

app.post("/api/normalize-players", async (req, res) => {
  try {
    await normalizePlayersByPuuid();
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
        includeTrace: payload.options?.includeTrace !== false,
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
        includeTrace: payload.options?.includeTrace !== false,
        maxSteps: payload.options?.maxSteps || 5000,
      },
    });
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
    });
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
    });
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

app.get("/api/pathfinder-replays", async (req, res) => {
  try {
    const replayRows = await replayDbAll(
      `SELECT *
       FROM pathfinder_replays
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT 24`,
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
    await replayDbRun("BEGIN IMMEDIATE TRANSACTION");

    const existingReplay = await replayDbGet(
      `SELECT id
       FROM pathfinder_replays
       WHERE cache_key = ?`,
      [payload.cacheKey],
    );

    let replayId = existingReplay?.id ?? null;
    if (replayId) {
      await replayDbRun(
        `UPDATE pathfinder_replays
         SET title = ?,
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.cacheKey,
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
    await streamBirdseyeArtifact(res, birdseyeArtifactPaths.manifest, "application/json; charset=utf-8");
  } catch (error) {
    console.error("Rust birdseye manifest failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-rust/birdseye-3d/node-meta", async (req, res) => {
  try {
    await streamBirdseyeArtifact(res, birdseyeArtifactPaths.nodeMeta, "application/json; charset=utf-8");
  } catch (error) {
    console.error("Rust birdseye node metadata failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-rust/birdseye-3d/node-positions", async (req, res) => {
  try {
    await streamBirdseyeArtifact(res, birdseyeArtifactPaths.nodePositions, "application/octet-stream");
  } catch (error) {
    console.error("Rust birdseye node positions failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-rust/birdseye-3d/node-metrics", async (req, res) => {
  try {
    await streamBirdseyeArtifact(res, birdseyeArtifactPaths.nodeMetrics, "application/octet-stream");
  } catch (error) {
    console.error("Rust birdseye node metrics failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-rust/birdseye-3d/edge-pairs", async (req, res) => {
  try {
    await streamBirdseyeArtifact(res, birdseyeArtifactPaths.edgePairs, "application/octet-stream");
  } catch (error) {
    console.error("Rust birdseye edge pairs failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pathfinder-rust/birdseye-3d/edge-props", async (req, res) => {
  try {
    await streamBirdseyeArtifact(res, birdseyeArtifactPaths.edgeProps, "application/octet-stream");
  } catch (error) {
    console.error("Rust birdseye edge props failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening at http://localhost:${PORT}`);
  void prewarmRustMetadata();
});
app.get("/api/ping", (req, res) => {
  res.send("pong");
});
