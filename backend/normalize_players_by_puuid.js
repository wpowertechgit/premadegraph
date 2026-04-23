const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const scoringUtils = require("./lib/scoring_utils");

const PLAYER_TABLE_COLUMNS = [
  { name: "puuid", definition: "TEXT PRIMARY KEY" },
  { name: "names", definition: "TEXT" },
  { name: "feedscore", definition: "REAL" },
  { name: "opscore", definition: "REAL" },
  { name: "country", definition: "TEXT" },
  { name: "match_count", definition: "INTEGER DEFAULT 0" },
  { name: "detected_role", definition: "TEXT DEFAULT 'UNKNOWN'" },
  { name: "role_confidence", definition: "REAL DEFAULT 0.0" },
  { name: "matches_processed", definition: "INTEGER DEFAULT 0" },
  { name: "artifact_kda", definition: "REAL DEFAULT 0" },
  { name: "artifact_economy", definition: "REAL DEFAULT 0" },
  { name: "artifact_map_awareness", definition: "REAL DEFAULT 0" },
  { name: "artifact_utility", definition: "REAL DEFAULT 0" },
  { name: "artifact_damage", definition: "REAL DEFAULT 0" },
  { name: "artifact_tanking", definition: "REAL DEFAULT 0" },
  { name: "artifact_objectives", definition: "REAL DEFAULT 0" },
  { name: "artifact_early_game", definition: "REAL DEFAULT 0" },
  { name: "score_computed_at", definition: "TEXT" },
];

const LEGACY_SCORE_COLUMNS = new Set([
  "opscore_legacy",
  "feedscore_legacy",
  "opscore_decay",
  "feedscore_decay",
  "opscore_recent",
  "feedscore_recent",
  "opscore_stability",
  "current_streak",
  "dynamic_score_updated",
]);

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

function buildCreatePlayersTableSql(tableName = "players") {
  const columnSql = PLAYER_TABLE_COLUMNS.map((column) => `${column.name} ${column.definition}`).join(",\n      ");
  return `CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnSql}
    )`;
}

async function configureNormalizationDatabase(db) {
  await dbRun(db, "PRAGMA journal_mode = WAL");
  await dbRun(db, "PRAGMA synchronous = NORMAL");
  await dbRun(db, "PRAGMA temp_store = MEMORY");
  await dbRun(db, "PRAGMA foreign_keys = ON");
}

async function getPlayersTableInfo(db) {
  return dbAll(db, "PRAGMA table_info(players)");
}

function buildSelectExpression(existingColumns, columnName, fallbackSql) {
  return existingColumns.has(columnName) ? columnName : fallbackSql;
}

async function ensurePlayersTableSchema(db) {
  const columns = await getPlayersTableInfo(db);

  if (columns.length === 0) {
    await dbRun(db, buildCreatePlayersTableSql());
    return;
  }

  const existingColumns = new Set(columns.map((column) => column.name));
  const missingCanonical = PLAYER_TABLE_COLUMNS.some((column) => !existingColumns.has(column.name));
  const hasLegacyColumns = columns.some((column) => LEGACY_SCORE_COLUMNS.has(column.name));

  if (!missingCanonical && !hasLegacyColumns) {
    return;
  }

  const tempTable = "players_rebuilt";
  await dbRun(db, "BEGIN TRANSACTION");

  try {
    await dbRun(db, `DROP TABLE IF EXISTS ${tempTable}`);
    await dbRun(db, buildCreatePlayersTableSql(tempTable));

    const selectList = [
      buildSelectExpression(existingColumns, "puuid", "NULL"),
      buildSelectExpression(existingColumns, "names", "NULL"),
      buildSelectExpression(existingColumns, "feedscore", "0"),
      buildSelectExpression(existingColumns, "opscore", "0"),
      buildSelectExpression(existingColumns, "country", "NULL"),
      buildSelectExpression(existingColumns, "match_count", "0"),
      buildSelectExpression(existingColumns, "detected_role", "'UNKNOWN'"),
      buildSelectExpression(existingColumns, "role_confidence", "0.0"),
      buildSelectExpression(existingColumns, "matches_processed", "0"),
      buildSelectExpression(existingColumns, "artifact_kda", "0"),
      buildSelectExpression(existingColumns, "artifact_economy", "0"),
      buildSelectExpression(existingColumns, "artifact_map_awareness", "0"),
      buildSelectExpression(existingColumns, "artifact_utility", "0"),
      buildSelectExpression(existingColumns, "artifact_damage", "0"),
      buildSelectExpression(existingColumns, "artifact_tanking", "0"),
      buildSelectExpression(existingColumns, "artifact_objectives", "0"),
      buildSelectExpression(existingColumns, "artifact_early_game", "0"),
      existingColumns.has("score_computed_at")
        ? "score_computed_at"
        : buildSelectExpression(existingColumns, "dynamic_score_updated", "NULL"),
    ].join(", ");

    await dbRun(
      db,
      `INSERT INTO ${tempTable} (
        puuid,
        names,
        feedscore,
        opscore,
        country,
        match_count,
        detected_role,
        role_confidence,
        matches_processed,
        artifact_kda,
        artifact_economy,
        artifact_map_awareness,
        artifact_utility,
        artifact_damage,
        artifact_tanking,
        artifact_objectives,
        artifact_early_game,
        score_computed_at
      )
      SELECT ${selectList}
      FROM players`,
    );

    await dbRun(db, "DROP TABLE players");
    await dbRun(db, `ALTER TABLE ${tempTable} RENAME TO players`);
    await dbRun(db, "COMMIT");
  } catch (error) {
    try {
      await dbRun(db, "ROLLBACK");
    } catch {
      // Ignore rollback errors if transaction state is already closed.
    }
    throw error;
  }
}

async function readExistingCountries(db) {
  const columns = await getPlayersTableInfo(db);
  if (columns.length === 0) {
    return new Map();
  }

  const hasCountry = columns.some((column) => column.name === "country");
  const hasPuuid = columns.some((column) => column.name === "puuid");
  if (!hasCountry || !hasPuuid) {
    return new Map();
  }

  const rows = await dbAll(db, "SELECT puuid, country FROM players WHERE puuid IS NOT NULL");
  return new Map(rows.map((row) => [row.puuid, row.country ?? null]));
}

async function normalizePlayersByPuuid(options = {}) {
  return new Promise((resolve, reject) => {
    const dbFile = resolveDbFile(options.dbFile);
    const matchDir = resolveMatchDir(options.matchDir);
    const db = new sqlite3.Database(dbFile);

    (async () => {
      try {
        await configureNormalizationDatabase(db);

        const existingCountries = await readExistingCountries(db);
        await ensurePlayersTableSchema(db);

        const playersMap = new Map();
        const files = fs.readdirSync(matchDir).filter((file) => file.endsWith(".json")).sort();

        console.log(`Processing ${files.length} match files...`);

        for (const file of files) {
          try {
            const fullPath = path.join(matchDir, file);
            const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

            if (!data.info || !Array.isArray(data.info.participants)) {
              console.warn(`Skipping ${file}: Invalid structure`);
              continue;
            }

            const gameDuration = data.info.gameDuration;

            for (const participant of data.info.participants) {
              if (!participant.puuid) {
                continue;
              }

              const puuid = participant.puuid;
              const displayName = `${scoringUtils.normalizeName(participant.riotIdGameName)}#${scoringUtils.normalizeName(participant.riotIdTagline)}`;
              const role = scoringUtils.detectPlayerRoleFromMatch(participant);
              const matchStats = scoringUtils.buildMatchStats(participant, gameDuration);

              let player = playersMap.get(puuid);
              if (!player) {
                player = {
                  names: new Set(),
                  country: existingCountries.get(puuid) ?? null,
                  matches: [],
                };
                playersMap.set(puuid, player);
              }

              player.names.add(displayName);
              player.matches.push({ matchStats, role });
            }
          } catch (fileErr) {
            console.error(`Error processing file ${file}:`, fileErr.message);
          }
        }

        const totalPlayers = playersMap.size;
        const totalMatches = files.length;
        console.log(`Processed ${totalMatches} matches and found ${totalPlayers} unique players`);

        if (totalPlayers === 0) {
          await dbRun(db, "DELETE FROM players");
          db.close((closeErr) => {
            if (closeErr) {
              reject(closeErr);
              return;
            }
            resolve();
          });
          return;
        }

        const computedProfiles = [];
        const matchCounts = [];

        for (const [puuid, data] of playersMap.entries()) {
          matchCounts.push(data.matches.length);
          computedProfiles.push({
            puuid,
            names: [...data.names].sort(),
            country: data.country,
            match_count: data.matches.length,
            profile: scoringUtils.computePlayerDynamicProfile(data.matches),
          });
        }

        const avgMatches = scoringUtils.average(matchCounts);
        const minMatches = Math.min(...matchCounts);
        const maxMatches = Math.max(...matchCounts);
        console.log(`Match count stats - Avg: ${avgMatches.toFixed(2)}, Min: ${minMatches}, Max: ${maxMatches}`);

        const rawOpscores = computedProfiles.map((entry) => entry.profile.dynamicOpscoreRaw);
        const rawFeedscores = computedProfiles.map((entry) => entry.profile.dynamicFeedscoreRaw);
        const opscorePercentiles = scoringUtils.deriveNormalizationAnchors(rawOpscores);
        const feedscorePercentiles = scoringUtils.deriveNormalizationAnchors(rawFeedscores);

        const normalizedOpscores = [];
        const normalizedFeedscores = [];
        const roleBalance = {};
        const computedAt = new Date().toISOString();

        const logFilePath = path.join(path.dirname(dbFile), "raw_scores_log.txt");
        const logStream = fs.createWriteStream(logFilePath, { flags: "w" });
        logStream.write(
          "puuid;raw_opscore;normalized_opscore;raw_feedscore;normalized_feedscore;primary_role;role_share\n",
        );

        await dbRun(db, "BEGIN TRANSACTION");
        await dbRun(db, "DELETE FROM players");

        const stmt = db.prepare(`
          INSERT INTO players (
            puuid,
            names,
            feedscore,
            opscore,
            country,
            match_count,
            detected_role,
            role_confidence,
            matches_processed,
            artifact_kda,
            artifact_economy,
            artifact_map_awareness,
            artifact_utility,
            artifact_damage,
            artifact_tanking,
            artifact_objectives,
            artifact_early_game,
            score_computed_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const entry of computedProfiles) {
          const normalizedOpscore = scoringUtils.roundTo(
            scoringUtils.normalizeOpscoreTo0To10(entry.profile.dynamicOpscoreRaw, opscorePercentiles),
            2,
          );
          const normalizedFeedscore = scoringUtils.roundTo(
            scoringUtils.normalizeFeedscoreTo0To10(entry.profile.dynamicFeedscoreRaw, feedscorePercentiles),
            2,
          );

          normalizedOpscores.push(normalizedOpscore);
          normalizedFeedscores.push(normalizedFeedscore);

          const role = entry.profile.detectedRole || "UNKNOWN";
          if (!roleBalance[role]) {
            roleBalance[role] = {
              count: 0,
              rawOpscore: [],
              normalizedOpscore: [],
            };
          }
          roleBalance[role].count += 1;
          roleBalance[role].rawOpscore.push(entry.profile.dynamicOpscoreRaw);
          roleBalance[role].normalizedOpscore.push(normalizedOpscore);

          logStream.write(
            [
              entry.puuid,
              entry.profile.dynamicOpscoreRaw.toFixed(4),
              normalizedOpscore.toFixed(2),
              entry.profile.dynamicFeedscoreRaw.toFixed(4),
              normalizedFeedscore.toFixed(2),
              role,
              entry.profile.roleConfidence.toFixed(4),
            ].join(";") + "\n",
          );

          await new Promise((resolveStmt, rejectStmt) => {
            stmt.run(
              entry.puuid,
              JSON.stringify(entry.names),
              normalizedFeedscore,
              normalizedOpscore,
              entry.country,
              entry.match_count,
              role,
              entry.profile.roleConfidence,
              entry.profile.matchesProcessed,
              entry.profile.artifacts.kda,
              entry.profile.artifacts.economy,
              entry.profile.artifacts.map_awareness,
              entry.profile.artifacts.utility,
              entry.profile.artifacts.damage,
              entry.profile.artifacts.tanking,
              entry.profile.artifacts.objectives,
              entry.profile.artifacts.early_game,
              computedAt,
              (err) => {
                if (err) {
                  rejectStmt(err);
                  return;
                }
                resolveStmt();
              },
            );
          });
        }

        logStream.end();

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

        console.log(`Raw scores logged to: ${logFilePath}`);
        console.log(
          `Raw opscore stats - Avg: ${scoringUtils.average(rawOpscores).toFixed(2)}, Min: ${Math.min(...rawOpscores).toFixed(2)}, Max: ${Math.max(...rawOpscores).toFixed(2)}`,
        );
        console.log(
          `Normalized opscore stats - Avg: ${scoringUtils.average(normalizedOpscores).toFixed(2)}, Min: ${Math.min(...normalizedOpscores).toFixed(2)}, Max: ${Math.max(...normalizedOpscores).toFixed(2)}`,
        );
        console.log(
          `Opscore anchors - Floor(p5): ${opscorePercentiles.floor.toFixed(2)}, Center(p50->${opscorePercentiles.centerScore.toFixed(1)}): ${opscorePercentiles.center.toFixed(2)}, Ceiling(p95): ${opscorePercentiles.ceiling.toFixed(2)}`,
        );
        console.log(
          `Raw feedscore stats - Avg: ${scoringUtils.average(rawFeedscores).toFixed(2)}, Min: ${Math.min(...rawFeedscores).toFixed(2)}, Max: ${Math.max(...rawFeedscores).toFixed(2)}`,
        );
        console.log(
          `Normalized feedscore stats - Avg: ${scoringUtils.average(normalizedFeedscores).toFixed(2)}, Min: ${Math.min(...normalizedFeedscores).toFixed(2)}, Max: ${Math.max(...normalizedFeedscores).toFixed(2)}`,
        );
        console.log(
          `Feedscore anchors - Floor(p5): ${feedscorePercentiles.floor.toFixed(2)}, Center(p50->${feedscorePercentiles.centerScore.toFixed(1)}): ${feedscorePercentiles.center.toFixed(2)}, Ceiling(p95): ${feedscorePercentiles.ceiling.toFixed(2)}`,
        );
        console.log("Primary-role opscore balance snapshot:");
        for (const role of Object.keys(roleBalance).sort()) {
          const snapshot = roleBalance[role];
          console.log(
            `  ${role}: players=${snapshot.count}, raw_avg=${scoringUtils.average(snapshot.rawOpscore).toFixed(2)}, normalized_avg=${scoringUtils.average(snapshot.normalizedOpscore).toFixed(2)}`,
          );
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

if (require.main === module) {
  normalizePlayersByPuuid()
    .then(() => console.log("Player normalization completed successfully!"))
    .catch((err) => console.error("Error during normalization:", err));
}
