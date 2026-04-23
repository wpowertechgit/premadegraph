const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const scoringUtils = require("./lib/scoring_utils");

const DYNAMIC_PLAYER_COLUMNS = [
  { name: "opscore_legacy", definition: "REAL" },
  { name: "feedscore_legacy", definition: "REAL" },
  { name: "opscore_decay", definition: "REAL" },
  { name: "feedscore_decay", definition: "REAL" },
  { name: "opscore_recent", definition: "REAL" },
  { name: "feedscore_recent", definition: "REAL" },
  { name: "opscore_stability", definition: "REAL" },
  { name: "detected_role", definition: "TEXT DEFAULT 'unknown'" },
  { name: "role_confidence", definition: "REAL DEFAULT 0.0" },
  { name: "current_streak", definition: "REAL DEFAULT 0.0" },
  { name: "matches_processed", definition: "INTEGER DEFAULT 0" },
  { name: "dynamic_score_updated", definition: "TEXT" },
];

function resolvePathFromEnv(...keys) {
  for (const key of keys) {
    if (!process.env[key]) {
      continue;
    }
    return path.isAbsolute(process.env[key])
      ? process.env[key]
      : path.resolve(__dirname, process.env[key]);
  }
  return null;
}

function resolveDbFile(explicitPath) {
  if (explicitPath) {
    return path.isAbsolute(explicitPath)
      ? explicitPath
      : path.resolve(__dirname, explicitPath);
  }

  const envPath = resolvePathFromEnv("GRAPH_DB_PATH", "DB_PATH", "PLAYERS_REFINED_DB_PATH");
  if (envPath) {
    return envPath;
  }

  const candidates = [
    path.resolve(__dirname, "playersrefined.db"),
    path.resolve(__dirname, "../playersrefined.db"),
    path.resolve(__dirname, "players.db"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

function resolveMatchDir(explicitPath) {
  if (explicitPath) {
    return path.isAbsolute(explicitPath)
      ? explicitPath
      : path.resolve(__dirname, explicitPath);
  }

  const envPath = resolvePathFromEnv("PATHFINDER_MATCH_DIR", "MATCHES_DIR");
  if (envPath) {
    return envPath;
  }

  return path.join(__dirname, "data");
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function ensurePlayersTableSchema(db) {
  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS players (
      puuid TEXT PRIMARY KEY,
      names TEXT,
      feedscore REAL,
      opscore REAL,
      country TEXT,
      match_count INTEGER
    )`,
  );

  const columns = await dbAll(db, "PRAGMA table_info(players)");
  const existingColumns = new Set(columns.map((column) => column.name));

  for (const column of DYNAMIC_PLAYER_COLUMNS) {
    if (!existingColumns.has(column.name)) {
      await dbRun(db, `ALTER TABLE players ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
}

async function normalizePlayersByPuuid(options = {}) {
  return new Promise((resolve, reject) => {
    const dbFile = resolveDbFile(options.dbFile);
    const matchDir = resolveMatchDir(options.matchDir);
    const db = new sqlite3.Database(dbFile);

    const playersMap = new Map();
    let totalMatches = 0;
    let totalPlayers = 0;

    (async () => {
      try {
        await ensurePlayersTableSchema(db);
        await dbRun(
          db,
          `UPDATE players
           SET opscore = 0,
               feedscore = 0,
               match_count = 0,
               opscore_legacy = NULL,
               feedscore_legacy = NULL,
               opscore_decay = NULL,
               feedscore_decay = NULL,
               opscore_recent = NULL,
               feedscore_recent = NULL,
               opscore_stability = NULL,
               detected_role = 'unknown',
               role_confidence = 0.0,
               current_streak = 0.0,
               matches_processed = 0,
               dynamic_score_updated = NULL`,
        );

        const files = fs.readdirSync(matchDir).filter(f => f.endsWith(".json")).sort();
        console.log(`Processing ${files.length} match files...`);

        for (const file of files) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(matchDir, file), "utf-8"));
            
            // Validate that the JSON has the expected structure
            if (!data.info || !data.info.participants) {
              console.warn(`Skipping ${file}: Invalid structure`);
              continue;
            }

            totalMatches++;
            const gameDurationSeconds = data.info.gameDuration;
            const gameDurationMinutes = gameDurationSeconds / 60;
            const matchEndTimestamp = Number(data.info.gameEndTimestamp)
              || Number(data.info.gameCreation)
              || fs.statSync(path.join(matchDir, file)).mtimeMs;
            const ageInDays = Math.max(
              0,
              (Date.now() - matchEndTimestamp) / (1000 * 60 * 60 * 24),
            );
            
            for (const p of data.info.participants) {
              // Validate required fields
              if (!p.puuid) {
                console.warn(`Skipping participant in ${file}: Missing puuid`);
                continue;
              }

              const puuid = p.puuid;
              const name = `${scoringUtils.normalizeName(p.riotIdGameName)}#${scoringUtils.normalizeName(p.riotIdTagline)}`;
              const matchStats = scoringUtils.buildMatchStats(p, gameDurationMinutes);
              const role = scoringUtils.detectPlayerRoleFromMatch(matchStats);

              if (!playersMap.has(puuid)) {
                playersMap.set(puuid, {
                  names: new Set([name]),
                  match_count: 1,
                  country: null,
                  matches: [{
                    ageInDays,
                    matchStats,
                    role,
                    timestampMs: matchEndTimestamp,
                  }],
                });
                totalPlayers++;
              } else {
                const player = playersMap.get(puuid);
                player.names.add(name);
                player.match_count += 1;
                player.matches.push({
                  ageInDays,
                  matchStats,
                  role,
                  timestampMs: matchEndTimestamp,
                });
              }
            }
          } catch (fileErr) {
            console.error(`Error processing file ${file}:`, fileErr.message);
            continue;
          }
        }

        console.log(`Processed ${totalMatches} matches and found ${totalPlayers} unique players`);
        if (playersMap.size === 0) {
          console.log("No players found in match directory; normalization completed with no updates.");
          db.close((closeErr) => {
            if (closeErr) {
              reject(closeErr);
              return;
            }
            resolve();
          });
          return;
        }
        
        // Log some statistics
        const matchCounts = Array.from(playersMap.values()).map(p => p.match_count);
        const avgMatches = matchCounts.reduce((a, b) => a + b, 0) / matchCounts.length;
        const maxMatches = Math.max(...matchCounts);
        const minMatches = Math.min(...matchCounts);
        
        console.log(`Match count stats - Avg: ${avgMatches.toFixed(2)}, Min: ${minMatches}, Max: ${maxMatches}`);

        const computedProfiles = [...playersMap.entries()].map(([puuid, data]) => ({
          puuid,
          names: [...data.names].sort(),
          country: data.country,
          match_count: data.match_count,
          profile: scoringUtils.computePlayerDynamicProfile(data.matches),
        }));

        const rawDynamicOpscores = computedProfiles.map((entry) => entry.profile.dynamicOpscoreRaw);
        const percentiles = scoringUtils.derivePercentiles(rawDynamicOpscores);
        const rawLegacyOpscores = computedProfiles.map((entry) => entry.profile.baselineOpscore);
        const normalizedOpscores = [];
        const logFilePath = path.join(path.dirname(dbFile), "raw_scores_log.txt");
        const logStream = fs.createWriteStream(logFilePath, { flags: "w" });
        logStream.write(
          "puuid;legacy_opscore_raw;dynamic_opscore_raw;dynamic_opscore_normalized;role;role_confidence;streak;stability\n",
        );

        await dbRun(db, "BEGIN TRANSACTION");
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO players (
            puuid,
            names,
            feedscore,
            opscore,
            country,
            match_count,
            opscore_legacy,
            feedscore_legacy,
            opscore_decay,
            feedscore_decay,
            opscore_recent,
            feedscore_recent,
            opscore_stability,
            detected_role,
            role_confidence,
            current_streak,
            matches_processed,
            dynamic_score_updated
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let insertedCount = 0;
        for (const entry of computedProfiles) {
          const normalizedDynamicOpscore = scoringUtils.roundTo(
            scoringUtils.normalizeOpscoreTo0To10(entry.profile.dynamicOpscoreRaw, percentiles),
            2,
          );
          const normalizedRecentOpscore = scoringUtils.roundTo(
            scoringUtils.normalizeOpscoreTo0To10(entry.profile.recentOpscoreRaw, percentiles),
            2,
          );
          normalizedOpscores.push(normalizedDynamicOpscore);

          logStream.write(
            [
              entry.puuid,
              entry.profile.baselineOpscore.toFixed(4),
              entry.profile.dynamicOpscoreRaw.toFixed(4),
              normalizedDynamicOpscore.toFixed(2),
              entry.profile.detectedRole,
              entry.profile.roleConfidence.toFixed(4),
              entry.profile.currentStreak.toFixed(4),
              entry.profile.opscoreStability.toFixed(4),
            ].join(";") + "\n",
          );

          await new Promise((resolveStmt, rejectStmt) => {
            stmt.run(
              entry.puuid,
              JSON.stringify(entry.names),
              entry.profile.dynamicFeedscore,
              normalizedDynamicOpscore,
              entry.country,
              entry.match_count,
              entry.profile.baselineOpscore,
              entry.profile.baselineFeedscore,
              normalizedDynamicOpscore,
              entry.profile.dynamicFeedscore,
              normalizedRecentOpscore,
              entry.profile.recentFeedscore,
              entry.profile.opscoreStability,
              entry.profile.detectedRole,
              entry.profile.roleConfidence,
              entry.profile.currentStreak,
              entry.profile.matchesProcessed,
              new Date().toISOString(),
              (err) => {
                if (err) {
                  rejectStmt(err);
                  return;
                }
                resolveStmt();
              },
            );
          });
          insertedCount++;
        }

        logStream.end();
        console.log(`Raw scores logged to: ${logFilePath}`);

        await new Promise((resolveStmt, rejectStmt) => {
          stmt.finalize((err) => {
            if (err) {
              rejectStmt(err);
              return;
            }
            resolveStmt();
          });
        });
        await dbRun(db, "COMMIT");

        console.log(`Inserted ${insertedCount} players with dynamic opscores`);

        const avgLegacyRaw = scoringUtils.average(rawLegacyOpscores);
        const minLegacyRaw = Math.min(...rawLegacyOpscores);
        const maxLegacyRaw = Math.max(...rawLegacyOpscores);
        const avgDynamicRaw = scoringUtils.average(rawDynamicOpscores);
        const minDynamicRaw = Math.min(...rawDynamicOpscores);
        const maxDynamicRaw = Math.max(...rawDynamicOpscores);
        const avgNormalized = scoringUtils.average(normalizedOpscores);
        const minNormalized = Math.min(...normalizedOpscores);
        const maxNormalized = Math.max(...normalizedOpscores);

        console.log(
          `Legacy raw opscore stats - Avg: ${avgLegacyRaw.toFixed(2)}, Min: ${minLegacyRaw.toFixed(2)}, Max: ${maxLegacyRaw.toFixed(2)}`,
        );
        console.log(
          `Dynamic raw opscore stats - Avg: ${avgDynamicRaw.toFixed(2)}, Min: ${minDynamicRaw.toFixed(2)}, Max: ${maxDynamicRaw.toFixed(2)}`,
        );
        console.log(
          `Dynamic normalized opscore stats - Avg: ${avgNormalized.toFixed(2)}, Min: ${minNormalized.toFixed(2)}, Max: ${maxNormalized.toFixed(2)}`,
        );
        console.log(
          `Dynamic normalization anchors - Min: ${percentiles.min.toFixed(2)}, Median: ${percentiles.median.toFixed(2)}, Max: ${percentiles.max.toFixed(2)}`,
        );

        const bins = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const distribution = new Array(bins.length - 1).fill(0);

        for (const score of normalizedOpscores) {
          for (let i = 0; i < bins.length - 1; i++) {
            if (score >= bins[i] && score < bins[i + 1]) {
              distribution[i]++;
              break;
            } else if (score === 10 && i === bins.length - 2) {
              distribution[i]++;
              break;
            }
          }
        }

        console.log("Normalized score distribution:");
        for (let i = 0; i < distribution.length; i++) {
          const range = `${bins[i]}-${bins[i + 1]}`;
          console.log(`  ${range}: ${distribution[i]} players`);
        }

        db.close((closeErr) => {
          if (closeErr) {
            reject(closeErr);
            return;
          }
          resolve();
        });
      } catch (err) {
        try {
          await dbRun(db, "ROLLBACK");
        } catch {
          // Ignore rollback errors if a transaction was never opened.
        }
        db.close();
        reject(err);
      }
    })();
  });
}

module.exports = { normalizePlayersByPuuid };

// Only run if this file is executed directly
if (require.main === module) {
  normalizePlayersByPuuid()
    .then(() => console.log("Player normalization completed successfully!"))
    .catch(err => console.error("Error during normalization:", err));
}
