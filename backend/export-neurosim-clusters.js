// Exports flexset cluster profiles to JSON for neurosim consumption.
// Usage: node export-neurosim-clusters.js [datasetId]
// Output: backend/genetic-neurosim/backend/flexset-clusters.json

const sqlite3 = require("sqlite3");
const path = require("path");
const fs = require("fs");

const datasetId = process.argv[2] || "flexset";
const dbPath = path.resolve(__dirname, `data/databases/${datasetId}/playersrefined.db`);
const outPath = path.resolve(__dirname, "genetic-neurosim/backend/flexset-clusters.json");

function sqliteGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function main() {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

  const totalRow = await sqliteGet(db, "SELECT SUM(size) AS total FROM clusters");
  const total = totalRow?.total || 1;

  const cols = await sqliteAll(db, "PRAGMA table_info(players)");
  const colNames = new Set(cols.map((c) => c.name));
  const hasV2 = colNames.has("artifact_combat_impact");
  const hasV1 = colNames.has("artifact_kda");
  const CAP = hasV2 ? 5.0 : 4.5;

  const wa = (col) =>
    hasV2 || hasV1
      ? `SUM(p.${col} * p.matches_processed) / NULLIF(SUM(p.matches_processed), 0)`
      : "0";

  const artifactSql = hasV2
    ? `${wa("artifact_combat_impact")} AS a1_wa, ${wa("artifact_risk_discipline")} AS a2_wa,
       ${wa("artifact_resource_tempo")} AS a3_wa, ${wa("artifact_map_objective_control")} AS a4_wa,
       ${wa("artifact_team_enablement")} AS a5_wa,`
    : hasV1
    ? `(${wa("artifact_kda")} + ${wa("artifact_damage")}) / 2.0 AS a1_wa,
       (${wa("artifact_tanking")}) AS a2_wa,
       (${wa("artifact_economy")} + ${wa("artifact_early_game")}) / 2.0 AS a3_wa,
       (${wa("artifact_map_awareness")} + ${wa("artifact_objectives")}) / 2.0 AS a4_wa,
       (${wa("artifact_utility")}) AS a5_wa,`
    : "0 AS a1_wa, 0 AS a2_wa, 0 AS a3_wa, 0 AS a4_wa, 0 AS a5_wa,";

  const feedscoreSql = colNames.has("feedscore")
    ? `SUM(p.feedscore * p.matches_processed) / NULLIF(SUM(p.matches_processed), 0) AS feedscore_wa,`
    : "0 AS feedscore_wa,";

  const rows = await sqliteAll(db, `
    SELECT
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
      0 AS no_raw_player_ids
    FROM clusters c
    LEFT JOIN cluster_members cm ON c.cluster_id = cm.cluster_id
    LEFT JOIN players p ON cm.puuid = p.puuid
    GROUP BY c.cluster_id
    HAVING c.size >= 2
    ORDER BY c.size DESC
  `, [total]);

  const round4 = (v) => Math.round((v || 0) * 10000) / 10000;

  // Normalize each artifact dimension by its actual max across all clusters.
  // CAP from server.js was designed for a different scoring era — current DB
  // has raw aggregated scores that exceed it, causing all values to clamp at 1.
  const maxA = [1, 2, 3, 4, 5].map((k) =>
    Math.max(...rows.map((r) => r[`a${k}_wa`] || 0), 1e-9)
  );

  const clusters = rows.map((r) => {
    const a1 = Math.min(1, (r.a1_wa || 0) / maxA[0]);
    const a2 = Math.min(1, (r.a2_wa || 0) / maxA[1]);
    const a3 = Math.min(1, (r.a3_wa || 0) / maxA[2]);
    const a4 = Math.min(1, (r.a4_wa || 0) / maxA[3]);
    const a5 = Math.min(1, (r.a5_wa || 0) / maxA[4]);
    return {
      id: r.id,
      size_ratio: round4(r.size_ratio),
      mean_opscore: round4(r.mean_opscore),
      opscore_stddev: round4(r.opscore_stddev),
      cohesion: round4(1.0 - r.bridge_ratio),
      internal_edge_ratio: round4(Math.max(0, 1.0 - Math.min(1, r.opscore_stddev * 2))),
      cluster_size: Number(r.cluster_size),
      feed_risk: round4(Math.max(0, Math.min(1, (r.feedscore_wa || 0) / 10.0))),
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
      founder_puuids: [],
    };
  });

  db.close();

  const out = { datasetId, clusterCount: clusters.length, totalMembersInClusters: total, clusters };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${clusters.length} clusters to ${outPath}`);
  console.log(`Schema: ${hasV2 ? "V2" : hasV1 ? "V1" : "none"} | CAP=${CAP}`);
  console.log(`Largest cluster: id=${clusters[0]?.id} size=${clusters[0]?.cluster_size}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
