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
const { executeRustCommand } = require("./pathfinder/rustBridge");

const rustResponseCache = {
  options: null,
  spec: null,
  "global-view": null,
};
const rustInFlightRequests = new Map();

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

app.use(cors());
app.use(bodyParser.json());
app.use('/graph-view', express.static(path.join(__dirname, 'output')));
const backendDir = __dirname;
const dbPath = path.resolve(__dirname, 'players.db'); //raw adatbazis amit kesobb kiegeszetiunk , celja a jatekosok adatainak tarolasa , de csak a nev alapjan
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Nem sikerült megnyitni az adatbázist:', err.message);
  } else {
    console.log('Adatbázis megnyitva.');
  }
});
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

app.listen(PORT, () => {
  console.log(`Backend listening at http://localhost:${PORT}`);
  void prewarmRustMetadata();
});
app.get("/api/ping", (req, res) => {
  res.send("pong");
});
