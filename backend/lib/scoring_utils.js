const SCORING_CONFIG = require("../scoring_config");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sortedValues, p) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) {
    return 0;
  }
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const position = (sortedValues.length - 1) * clamp(p, 0, 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const weight = position - lowerIndex;

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

function derivePercentiles(values) {
  const sortedValues = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sortedValues.length === 0) {
    return { min: 0, median: 0, max: 0 };
  }

  return {
    min: sortedValues[0],
    median: percentile(sortedValues, 0.5),
    max: sortedValues[sortedValues.length - 1],
  };
}

function deriveNormalizationAnchors(values, config = SCORING_CONFIG.normalization) {
  const sortedValues = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sortedValues.length === 0) {
    return {
      min: 0,
      median: 0,
      max: 0,
      floor: 0,
      center: 0,
      ceiling: 0,
      centerScore: numberOrZero(config?.centerScore) || 6,
    };
  }

  const centerScore = clamp(numberOrZero(config?.centerScore) || 6, 0.5, 9.5);
  const floor = percentile(sortedValues, numberOrZero(config?.floorPercentile) || 0.05);
  const center = percentile(sortedValues, numberOrZero(config?.centerPercentile) || 0.5);
  const ceiling = percentile(sortedValues, numberOrZero(config?.ceilingPercentile) || 0.95);

  return {
    min: sortedValues[0],
    median: percentile(sortedValues, 0.5),
    max: sortedValues[sortedValues.length - 1],
    floor,
    center,
    ceiling,
    centerScore,
  };
}

function roundTo(value, digits = 4) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function normalizeName(value, fallback = "Unknown") {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function booleanAsNumber(value) {
  return value ? 1 : 0;
}

function normalizeRole(rawRole) {
  const role = String(rawRole || "").trim().toUpperCase();

  switch (role) {
    case "TOP":
      return "TOP";
    case "JUNGLE":
      return "JUNGLE";
    case "MID":
    case "MIDDLE":
      return "MIDDLE";
    case "ADC":
    case "BOT":
    case "BOTTOM":
      return "BOTTOM";
    case "SUPPORT":
    case "UTILITY":
      return "UTILITY";
    default:
      return "UNKNOWN";
  }
}

function resolveGameDurationMinutes(gameDurationRaw) {
  const numeric = numberOrZero(gameDurationRaw);
  if (numeric <= 0) {
    return 1;
  }

  if (numeric > 100000) {
    return Math.max(1, numeric / 60000);
  }

  return Math.max(1, numeric / 60);
}

function buildMatchTeamContext(participants = []) {
  const teams = new Map();

  for (const participant of participants || []) {
    const teamId = numberOrZero(participant?.teamId);
    if (!teamId) {
      continue;
    }
    const team = teams.get(teamId) || {
      kills: 0,
      totalDamageDealtToChampions: 0,
    };
    team.kills += numberOrZero(participant?.kills);
    team.totalDamageDealtToChampions += numberOrZero(participant?.totalDamageDealtToChampions);
    teams.set(teamId, team);
  }

  return teams;
}

function buildMatchStats(participant, gameDurationRaw, teamContext = null) {
  const challenges = participant?.challenges || {};
  const gameDurationMinutes = resolveGameDurationMinutes(gameDurationRaw);
  const gameDurationSeconds = Math.max(1, gameDurationMinutes * 60);
  const teamId = numberOrZero(participant?.teamId);
  const team = teamContext instanceof Map ? teamContext.get(teamId) : null;

  return {
    role: normalizeRole(participant?.teamPosition),
    teamId,
    gameDurationMinutes,
    gameDurationSeconds,
    teamKills: numberOrZero(team?.kills),
    teamTotalDamageDealtToChampions: numberOrZero(team?.totalDamageDealtToChampions),
    kills: numberOrZero(participant?.kills),
    deaths: numberOrZero(participant?.deaths),
    assists: numberOrZero(participant?.assists),
    goldEarned: numberOrZero(participant?.goldEarned),
    goldSpent: numberOrZero(participant?.goldSpent),
    visionScore: numberOrZero(participant?.visionScore),
    wardsPlaced: numberOrZero(participant?.wardsPlaced),
    detectorWardsPlaced: numberOrZero(participant?.detectorWardsPlaced),
    wardsKilled: numberOrZero(participant?.wardsKilled),
    controlWardsPlaced:
      numberOrZero(participant?.controlWardsPlaced) || numberOrZero(challenges?.controlWardsPlaced),
    totalMinionsKilled: numberOrZero(participant?.totalMinionsKilled),
    neutralMinionsKilled: numberOrZero(participant?.neutralMinionsKilled),
    totalDamageShieldedOnTeammates: numberOrZero(participant?.totalDamageShieldedOnTeammates),
    totalHealsOnTeammates: numberOrZero(participant?.totalHealsOnTeammates),
    totalHeal: numberOrZero(participant?.totalHeal),
    damageSelfMitigated:
      numberOrZero(challenges?.damageSelfMitigated) || numberOrZero(participant?.damageSelfMitigated),
    timeCCingOthers:
      numberOrZero(challenges?.timeCCingOthers) || numberOrZero(participant?.timeCCingOthers),
    physicalDamageDealtToChampions: numberOrZero(participant?.physicalDamageDealtToChampions),
    magicDamageDealtToChampions: numberOrZero(participant?.magicDamageDealtToChampions),
    trueDamageDealtToChampions: numberOrZero(participant?.trueDamageDealtToChampions),
    totalDamageDealtToChampions: numberOrZero(participant?.totalDamageDealtToChampions) ||
      numberOrZero(participant?.physicalDamageDealtToChampions) +
      numberOrZero(participant?.magicDamageDealtToChampions) +
      numberOrZero(participant?.trueDamageDealtToChampions),
    totalDamageTaken: numberOrZero(participant?.totalDamageTaken),
    totalTimeSpentDead: numberOrZero(participant?.totalTimeSpentDead),
    longestTimeSpentLiving: numberOrZero(participant?.longestTimeSpentLiving),
    damageDealtToBuildings: numberOrZero(participant?.damageDealtToBuildings),
    damageDealtToObjectives: numberOrZero(participant?.damageDealtToObjectives),
    damageDealtToEpicMonsters: numberOrZero(participant?.damageDealtToEpicMonsters),
    turretTakedowns: numberOrZero(participant?.turretTakedowns),
    inhibitorTakedowns: numberOrZero(participant?.inhibitorTakedowns),
    dragonKills: numberOrZero(participant?.dragonKills),
    baronKills: numberOrZero(participant?.baronKills),
    objectivesStolen: numberOrZero(participant?.objectivesStolen),
    objectivesStolenAssists: numberOrZero(participant?.objectivesStolenAssists),
    turretPlatesTaken: numberOrZero(challenges?.turretPlatesTaken),
    damageDealtToTurrets: numberOrZero(participant?.damageDealtToTurrets),
    firstBloodKill: booleanAsNumber(participant?.firstBloodKill),
    firstBloodAssist: booleanAsNumber(participant?.firstBloodAssist),
    firstTowerKill: booleanAsNumber(participant?.firstTowerKill),
    firstTowerAssist: booleanAsNumber(participant?.firstTowerAssist),
    laneMinionsFirst10Minutes: numberOrZero(challenges?.laneMinionsFirst10Minutes),
    enemyChampionImmobilizations: numberOrZero(challenges?.enemyChampionImmobilizations),
    soloKills: numberOrZero(challenges?.soloKills),
    pickKillWithAlly: numberOrZero(challenges?.pickKillWithAlly),
    tookLargeDamageSurvived: numberOrZero(challenges?.tookLargeDamageSurvived),
    survivedThreeImmobilizesInFight: numberOrZero(challenges?.survivedThreeImmobilizesInFight),
    survivedSingleDigitHpCount: numberOrZero(challenges?.survivedSingleDigitHpCount),
    earlyLaningPhaseGoldExpAdvantage: numberOrZero(challenges?.earlyLaningPhaseGoldExpAdvantage),
    laningPhaseGoldExpAdvantage: numberOrZero(challenges?.laningPhaseGoldExpAdvantage),
    jungleCsBefore10Minutes: numberOrZero(challenges?.jungleCsBefore10Minutes),
    initialCrabCount: numberOrZero(challenges?.initialCrabCount),
    initialBuffCount: numberOrZero(challenges?.initialBuffCount),
    controlWardTimeCoverageInRiverOrEnemyHalf: numberOrZero(challenges?.controlWardTimeCoverageInRiverOrEnemyHalf),
    dragonTakedowns: numberOrZero(challenges?.dragonTakedowns),
    baronTakedowns: numberOrZero(challenges?.baronTakedowns),
    riftHeraldTakedowns: numberOrZero(challenges?.riftHeraldTakedowns),
    immobilizeAndKillWithAlly: numberOrZero(challenges?.immobilizeAndKillWithAlly),
    knockEnemyIntoTeamAndKill: numberOrZero(challenges?.knockEnemyIntoTeamAndKill),
    effectiveHealAndShielding: numberOrZero(challenges?.effectiveHealAndShielding),
    saveAllyFromDeath: numberOrZero(challenges?.saveAllyFromDeath),
  };
}

function detectPlayerRoleFromMatch(matchLike) {
  if (!matchLike) {
    return "UNKNOWN";
  }

  if (typeof matchLike === "object") {
    if ("teamPosition" in matchLike || "individualPosition" in matchLike) {
      return normalizeRole(matchLike.teamPosition || matchLike.individualPosition);
    }
    if ("role" in matchLike) {
      return normalizeRole(matchLike.role);
    }
  }

  return "UNKNOWN";
}

function detectPlayerRoleFromHistory(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return { role: "UNKNOWN", confidence: 0 };
  }

  const roleCounts = new Map();
  matches.forEach((match) => {
    const role = normalizeRole(match?.role || match?.matchStats?.role);
    roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
  });

  const ranked = [...roleCounts.entries()].sort((left, right) => right[1] - left[1]);
  const [role, count] = ranked[0] || ["UNKNOWN", 0];

  return {
    role,
    confidence: roundTo(count / matches.length, 4),
  };
}

function extractArtifacts(matchStats) {
  const stats = matchStats || {};
  const gameLengthMinutes = Math.max(1, numberOrZero(stats.gameDurationMinutes) || 1);
  const goldEarned = numberOrZero(stats.goldEarned);
  const goldSpent = numberOrZero(stats.goldSpent);
  const efficiency = clamp(goldSpent / Math.max(1, goldEarned), 0.5, 1.0);

  return {
    kda:
      numberOrZero(stats.kills) +
      numberOrZero(stats.assists) * 0.965 -
      numberOrZero(stats.deaths) * 0.25,
    economy: goldEarned / gameLengthMinutes / 10 + efficiency * 0.5,
    map_awareness:
      numberOrZero(stats.visionScore) * 0.15 +
      numberOrZero(stats.wardsPlaced) * 0.05 +
      numberOrZero(stats.detectorWardsPlaced) * 0.04 +
      numberOrZero(stats.wardsKilled) * 0.08 +
      numberOrZero(stats.controlWardsPlaced) * 0.06,
    utility:
      numberOrZero(stats.enemyChampionImmobilizations) * 0.08 +
      numberOrZero(stats.totalDamageShieldedOnTeammates) * 0.001 +
      numberOrZero(stats.totalHeal) * 0.001 +
      numberOrZero(stats.damageSelfMitigated) * 0.002 +
      numberOrZero(stats.timeCCingOthers) * 0.01,
    damage:
      (numberOrZero(stats.physicalDamageDealtToChampions) +
        numberOrZero(stats.magicDamageDealtToChampions) +
        numberOrZero(stats.trueDamageDealtToChampions)) /
      1000 *
      0.2,
    tanking: (numberOrZero(stats.totalDamageTaken) / gameLengthMinutes) * 0.05,
    objectives:
      numberOrZero(stats.damageDealtToBuildings) * 0.002 +
      numberOrZero(stats.turretTakedowns) * 0.25 +
      numberOrZero(stats.inhibitorTakedowns) * 0.5 +
      numberOrZero(stats.turretPlatesTaken) * 0.03 +
      numberOrZero(stats.damageDealtToTurrets) * 0.001,
    early_game:
      numberOrZero(stats.firstBloodKill) * 0.5 +
      numberOrZero(stats.firstBloodAssist) * 0.2 +
      numberOrZero(stats.firstTowerKill) * 0.3 +
      numberOrZero(stats.firstTowerAssist) * 0.1 +
      numberOrZero(stats.laneMinionsFirst10Minutes) / 50,
  };
}

function applyRoleMultipliers(artifacts, role, roleMultipliers = SCORING_CONFIG.roleMultipliers) {
  const multiplier = roleMultipliers[normalizeRole(role)] || roleMultipliers.UNKNOWN;

  return {
    kda: numberOrZero(artifacts?.kda) * multiplier.kda,
    economy: numberOrZero(artifacts?.economy) * multiplier.economy,
    map_awareness: numberOrZero(artifacts?.map_awareness) * multiplier.map_awareness,
    utility: numberOrZero(artifacts?.utility) * multiplier.utility,
    damage: numberOrZero(artifacts?.damage) * multiplier.damage,
    tanking: numberOrZero(artifacts?.tanking) * multiplier.tanking,
    objectives: numberOrZero(artifacts?.objectives) * multiplier.objectives,
    early_game: numberOrZero(artifacts?.early_game) * multiplier.early_game,
  };
}

function scoreMatch(adjustedArtifacts) {
  return Object.values(adjustedArtifacts || {}).reduce((sum, value) => sum + numberOrZero(value), 0);
}

function averageArtifacts(matches, key) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return 0;
  }
  return average(matches.map((match) => numberOrZero(match?.adjusted?.[key])));
}

function playerBaselineScore(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return 0;
  }

  return average(
    matches.map((match) => {
      const adjusted =
        match?.adjusted ||
        applyRoleMultipliers(
          extractArtifacts(match?.matchStats),
          match?.role || match?.matchStats?.role,
        );
      return scoreMatch(adjusted);
    }),
  );
}

function opscorePerMatch(matchStats) {
  return scoreMatch(extractArtifacts(matchStats));
}

function opscoreForRole(matchStats, role = "UNKNOWN") {
  return scoreMatch(applyRoleMultipliers(extractArtifacts(matchStats), role));
}

function feedscorePerMatch(matchStats) {
  const stats = matchStats || {};
  return numberOrZero(stats.deaths) - (numberOrZero(stats.kills) + numberOrZero(stats.assists)) * 0.35;
}

function feedscoreForRole(matchStats, role = "UNKNOWN") {
  const stats = matchStats || {};
  const normalizedRole = normalizeRole(role || stats.role);
  const tolerance = SCORING_CONFIG.deathTolerance[normalizedRole] || SCORING_CONFIG.deathTolerance.UNKNOWN;

  return numberOrZero(stats.deaths) * tolerance -
    (numberOrZero(stats.kills) + numberOrZero(stats.assists)) * 0.35;
}

function opscoreV2Config() {
  return SCORING_CONFIG.opscoreV2 || {};
}

function roleExpectation(role) {
  const config = opscoreV2Config();
  const normalizedRole = normalizeRole(role);
  return config.roleExpectations?.[normalizedRole] || config.roleExpectations?.UNKNOWN || {};
}

function artifactWeights(role, artifactKey) {
  const config = opscoreV2Config();
  const normalizedRole = normalizeRole(role);
  return (
    config.artifactWeights?.[normalizedRole]?.[artifactKey] ||
    config.artifactWeights?.UNKNOWN?.[artifactKey] ||
    [0.5, 0.5]
  );
}

function durationReliability(gameDurationMinutes) {
  const durationConfig = opscoreV2Config().durationReliability || {};
  const minMinutes = numberOrZero(durationConfig.minimumReliableMinutes) || 12;
  const fullMinutes = numberOrZero(durationConfig.fullReliableMinutes) || 20;
  const denominator = Math.max(fullMinutes - minMinutes, 1e-6);
  return clamp((numberOrZero(gameDurationMinutes) - minMinutes) / denominator, 0, 1);
}

function durationAdjustedScore(score, gameDurationMinutes) {
  const durationConfig = opscoreV2Config().durationReliability || {};
  const reliability = durationReliability(gameDurationMinutes);
  const neutralScore = numberOrZero(durationConfig.neutralScore) || 0.7;
  return reliability * numberOrZero(score) + (1 - reliability) * neutralScore;
}

function shortGameOverflowFactor(gameDurationMinutes) {
  return 0.5 + 0.5 * durationReliability(gameDurationMinutes);
}

function opscoreV2BaseCurve(ratio) {
  const curve = opscoreV2Config().curve || {};
  const target = clamp(numberOrZero(curve.targetAtExpected) || 0.7, 0.01, 0.99);
  const sharpness = Math.max(numberOrZero(curve.sharpness) || 2, 0.1);
  const midpoint = ((1 - target) / target) ** (1 / sharpness);
  const safeRatio = Math.max(0, numberOrZero(ratio));
  const ratioPower = safeRatio ** sharpness;
  return ratioPower / (ratioPower + midpoint ** sharpness);
}

function scorePositiveMetric(value, expected) {
  const curve = opscoreV2Config().curve || {};
  const ratio = Math.max(0, numberOrZero(value)) / Math.max(numberOrZero(expected), 1e-6);
  const lambda = numberOrZero(curve.overflowLambda) || 0.5;
  const cap = numberOrZero(curve.subcategoryCap) || 2.2;
  return Math.min(cap, opscoreV2BaseCurve(ratio) + lambda * Math.log(Math.max(1, ratio)));
}

function scoreNegativeMetric(value, expected) {
  const ratio = Math.max(0, numberOrZero(value)) / Math.max(numberOrZero(expected), 1e-6);
  return scorePositiveMetric(1 / Math.max(ratio, 1e-6), 1);
}

function indicatorScore(value, positive = 0.9, neutral = 0.48) {
  return numberOrZero(value) > 0 ? positive : neutral;
}

function weightedBaseArtifact(firstScore, secondScore, weights) {
  return 2 * (numberOrZero(weights?.[0]) * firstScore + numberOrZero(weights?.[1]) * secondScore);
}

function overflowArtifact(baseValue, artifactKey, gameDurationMinutes) {
  const config = opscoreV2Config();
  const cap = numberOrZero(config.artifactSoftCap) || 4.5;
  const alpha = numberOrZero(config.artifactOverflow?.[artifactKey]);
  const overflow = alpha * shortGameOverflowFactor(gameDurationMinutes) * Math.max(0, baseValue - 2);
  return Math.min(cap, baseValue + overflow);
}

function perMinuteScore(value, expected, gameDurationMinutes) {
  return durationAdjustedScore(scorePositiveMetric(value, expected), gameDurationMinutes);
}

function computeOpscoreV2Match(matchStats, role = "UNKNOWN") {
  const stats = matchStats || {};
  const normalizedRole = normalizeRole(role || stats.role);
  const expected = roleExpectation(normalizedRole);
  const gameDurationMinutes = Math.max(1, numberOrZero(stats.gameDurationMinutes) || 1);
  const gameDurationSeconds = Math.max(1, numberOrZero(stats.gameDurationSeconds) || gameDurationMinutes * 60);
  const teamKills = Math.max(1, numberOrZero(stats.teamKills));
  const teamDamage = Math.max(1, numberOrZero(stats.teamTotalDamageDealtToChampions));

  const kills = numberOrZero(stats.kills);
  const assists = numberOrZero(stats.assists);
  const deaths = numberOrZero(stats.deaths);
  const assistWeight = numberOrZero(expected.assistWeight) || 0.75;
  const weightedTakedowns = kills + assists * assistWeight;
  const conversionRate = weightedTakedowns / teamKills;

  const playmaking =
    0.65 * scorePositiveMetric(numberOrZero(stats.soloKills), expected.soloKills) +
    0.35 * scorePositiveMetric(numberOrZero(stats.pickKillWithAlly), expected.pickKills);
  const fightConversion =
    0.75 * scorePositiveMetric(conversionRate, expected.killParticipation) +
    0.25 * playmaking;

  const championDamage = numberOrZero(stats.totalDamageDealtToChampions);
  const damagePerMinute = championDamage / gameDurationMinutes;
  const damageShare = championDamage / teamDamage;
  const damagePressure = Math.sqrt(
    perMinuteScore(damagePerMinute, expected.damagePerMinute, gameDurationMinutes) *
    scorePositiveMetric(damageShare, expected.damageShare),
  );

  const deathRate = deaths / gameDurationMinutes;
  const deadTimeShare = numberOrZero(stats.totalTimeSpentDead) / gameDurationSeconds;
  const adjustedDeathRateScore = durationAdjustedScore(
    scoreNegativeMetric(deathRate, expected.deathRate),
    gameDurationMinutes,
  );
  const adjustedDeadTimeScore = durationAdjustedScore(
    scoreNegativeMetric(deadTimeShare, expected.deadTimeShare),
    gameDurationMinutes,
  );
  const riskRatio =
    (
      0.55 * (deathRate / Math.max(numberOrZero(expected.deathRate), 1e-6)) +
      0.45 * (deadTimeShare / Math.max(numberOrZero(expected.deadTimeShare), 1e-6))
    ) /
    (1 + 0.75 * conversionRate);
  const deathCost = Math.max(
    0,
    Math.min(
      opscoreV2Config().curve?.subcategoryCap || 2.2,
      0.5 * scoreNegativeMetric(riskRatio, 1) +
        0.25 * adjustedDeathRateScore +
        0.25 * adjustedDeadTimeScore,
    ),
  );

  const livingRatio = numberOrZero(stats.longestTimeSpentLiving) / gameDurationSeconds;
  const clutchSurvival =
    numberOrZero(stats.tookLargeDamageSurvived) +
    numberOrZero(stats.survivedThreeImmobilizesInFight) +
    numberOrZero(stats.survivedSingleDigitHpCount);
  const survivalQuality =
    0.7 * scorePositiveMetric(livingRatio, expected.livingRatio) +
    0.3 * scorePositiveMetric(clutchSurvival, expected.clutchSurvival);

  const goldPerMinute = numberOrZero(stats.goldEarned) / gameDurationMinutes;
  const spendEfficiency = clamp(numberOrZero(stats.goldSpent) / Math.max(1, numberOrZero(stats.goldEarned)), 0, 1);
  const csPerMinute =
    (numberOrZero(stats.totalMinionsKilled) + numberOrZero(stats.neutralMinionsKilled)) / gameDurationMinutes;
  const csWeight = normalizedRole === "UTILITY" ? 0.05 : 0.25;
  const economy =
    0.55 * perMinuteScore(goldPerMinute, expected.goldPerMinute, gameDurationMinutes) +
    csWeight * perMinuteScore(csPerMinute, expected.csPerMinute, gameDurationMinutes) +
    (0.45 - csWeight) * spendEfficiency;

  let tempo;
  if (normalizedRole === "JUNGLE") {
    tempo =
      0.4 * scorePositiveMetric(numberOrZero(stats.jungleCsBefore10Minutes), expected.jungleCs10) +
      0.3 * scorePositiveMetric(numberOrZero(stats.initialCrabCount), expected.initialCrabs) +
      0.3 * scorePositiveMetric(numberOrZero(stats.initialBuffCount), expected.initialBuffs);
  } else {
    tempo =
      0.45 * scorePositiveMetric(numberOrZero(stats.laneMinionsFirst10Minutes), expected.laneCs10) +
      0.35 * indicatorScore(stats.earlyLaningPhaseGoldExpAdvantage) +
      0.2 * indicatorScore(stats.laningPhaseGoldExpAdvantage, 0.85, 0.48);
  }

  const visionPerMinute = numberOrZero(stats.visionScore) / gameDurationMinutes;
  const wardActivityPerMinute =
    (
      numberOrZero(stats.wardsPlaced) +
      numberOrZero(stats.wardsKilled) +
      numberOrZero(stats.detectorWardsPlaced) +
      numberOrZero(stats.controlWardsPlaced)
    ) /
    gameDurationMinutes;
  const visionControl =
    0.7 * perMinuteScore(visionPerMinute, expected.visionPerMinute, gameDurationMinutes) +
    0.2 * perMinuteScore(wardActivityPerMinute, expected.wardActivityPerMinute, gameDurationMinutes) +
    0.1 * clamp(numberOrZero(stats.controlWardTimeCoverageInRiverOrEnemyHalf), 0, 1);

  const objectiveDamagePerMinute = numberOrZero(stats.damageDealtToObjectives) / gameDurationMinutes;
  const epicParticipation =
    (numberOrZero(stats.dragonTakedowns) || numberOrZero(stats.dragonKills)) +
    1.5 * (numberOrZero(stats.baronTakedowns) || numberOrZero(stats.baronKills)) +
    numberOrZero(stats.riftHeraldTakedowns) +
    2 * numberOrZero(stats.objectivesStolen);
  const structureConversion =
    numberOrZero(stats.turretTakedowns) + 1.5 * numberOrZero(stats.inhibitorTakedowns);
  const objectiveConversion =
    0.4 * perMinuteScore(objectiveDamagePerMinute, expected.objectiveDamagePerMinute, gameDurationMinutes) +
    0.35 * scorePositiveMetric(epicParticipation, expected.epicParticipation) +
    0.25 * scorePositiveMetric(structureConversion, expected.structureConversion);

  const defaultMapWeights = artifactWeights(normalizedRole, "map_objective_control");
  const dominance = clamp((objectiveConversion - visionControl) / 1.5, 0, 1);
  const objectiveWeight = Math.min(0.9, numberOrZero(defaultMapWeights[1]) + 0.25 * dominance);
  const visionWeight = 1 - objectiveWeight;

  const ccVolumePerMinute =
    (numberOrZero(stats.enemyChampionImmobilizations) + 0.25 * numberOrZero(stats.timeCCingOthers)) /
    gameDurationMinutes;
  const ccConversion =
    numberOrZero(stats.immobilizeAndKillWithAlly) + numberOrZero(stats.knockEnemyIntoTeamAndKill);
  const setupControl =
    0.55 * perMinuteScore(ccVolumePerMinute, expected.ccPerMinute, gameDurationMinutes) +
    0.45 * scorePositiveMetric(ccConversion, expected.ccConversion);

  const allyProtection =
    numberOrZero(stats.effectiveHealAndShielding) ||
    numberOrZero(stats.totalDamageShieldedOnTeammates) + numberOrZero(stats.totalHealsOnTeammates);
  const protectionSupport =
    0.75 * perMinuteScore(allyProtection / gameDurationMinutes, expected.protectionPerMinute, gameDurationMinutes) +
    0.25 * scorePositiveMetric(numberOrZero(stats.saveAllyFromDeath), expected.saves);

  const combatBase = weightedBaseArtifact(
    fightConversion,
    damagePressure,
    artifactWeights(normalizedRole, "combat_impact"),
  );
  const riskBase = weightedBaseArtifact(
    deathCost,
    survivalQuality,
    artifactWeights(normalizedRole, "risk_discipline"),
  );
  const resourceBase = weightedBaseArtifact(
    economy,
    tempo,
    artifactWeights(normalizedRole, "resource_tempo"),
  );
  const mapBase = weightedBaseArtifact(visionControl, objectiveConversion, [visionWeight, objectiveWeight]);
  const teamBase = weightedBaseArtifact(
    setupControl,
    protectionSupport,
    artifactWeights(normalizedRole, "team_enablement"),
  );

  const artifacts = {
    combat_impact: overflowArtifact(combatBase, "combat_impact", gameDurationMinutes),
    risk_discipline: overflowArtifact(riskBase, "risk_discipline", gameDurationMinutes),
    resource_tempo: overflowArtifact(resourceBase, "resource_tempo", gameDurationMinutes),
    map_objective_control: overflowArtifact(mapBase, "map_objective_control", gameDurationMinutes),
    team_enablement: overflowArtifact(teamBase, "team_enablement", gameDurationMinutes),
  };
  const subcategories = {
    fight_conversion: fightConversion,
    damage_pressure: damagePressure,
    death_cost: deathCost,
    survival_quality: survivalQuality,
    economy,
    tempo,
    vision_control: visionControl,
    objective_conversion: objectiveConversion,
    setup_control: setupControl,
    protection_support: protectionSupport,
    objective_dominance: dominance,
  };
  const rawScore = Object.values(artifacts).reduce((sum, value) => sum + numberOrZero(value), 0);
  const opscore = clamp(rawScore, 0, 10);
  const feedRisk = clamp(10 - 5 * artifacts.risk_discipline, 0, 10);

  return {
    rawScore: roundTo(rawScore),
    opscore: roundTo(opscore),
    feedRisk: roundTo(feedRisk),
    feedDiscipline: roundTo(10 - feedRisk),
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([key, value]) => [key, roundTo(value)])),
    subcategories: Object.fromEntries(Object.entries(subcategories).map(([key, value]) => [key, roundTo(value)])),
  };
}

function normalizeTo0To10(rawScore, percentiles) {
  const floor = numberOrZero(percentiles?.floor ?? percentiles?.min);
  const center = numberOrZero(percentiles?.center ?? percentiles?.median);
  const ceiling = numberOrZero(percentiles?.ceiling ?? percentiles?.max);
  const centerScore = clamp(numberOrZero(percentiles?.centerScore) || 6, 0.5, 9.5);

  if (ceiling <= floor) {
    return rawScore > 0 ? 5 : 0;
  }

  if (rawScore <= floor) {
    return 0;
  }
  if (rawScore >= ceiling) {
    return 10;
  }

  if (rawScore <= center || center <= floor) {
    const denominator = Math.max(center - floor, 1e-6);
    return clamp(((rawScore - floor) / denominator) * centerScore, 0, centerScore);
  }

  const denominator = Math.max(ceiling - center, 1e-6);
  return clamp(
    centerScore + ((rawScore - center) / denominator) * (10 - centerScore),
    centerScore,
    10,
  );
}

function normalizeOpscoreTo0To10(rawScore, percentiles) {
  return normalizeTo0To10(rawScore, percentiles);
}

function normalizeFeedscoreTo0To10(rawScore, percentiles) {
  return normalizeTo0To10(rawScore, percentiles);
}

function computePlayerDynamicProfile(matchHistory) {
  if (!Array.isArray(matchHistory) || matchHistory.length === 0) {
    return {
      baselineOpscore: 0,
      baselineFeedscore: 0,
      dynamicOpscoreRaw: 0,
      dynamicFeedscoreRaw: 0,
      detectedRole: "UNKNOWN",
      roleConfidence: 0,
      currentStreak: 0,
      opscoreStability: 0,
      recentOpscoreRaw: 0,
      recentFeedscore: 0,
      matchesProcessed: 0,
      artifacts: {
        combat_impact: 0,
        risk_discipline: 0,
        resource_tempo: 0,
        map_objective_control: 0,
        team_enablement: 0,
      },
      subcategories: {},
      roleBreakdown: {},
    };
  }

  const enrichedMatches = matchHistory.map((match) => {
    const matchStats = match?.matchStats || match;
    const role = normalizeRole(match?.role || matchStats?.role || matchStats?.teamPosition);
    const artifacts = extractArtifacts(matchStats);
    const adjusted = applyRoleMultipliers(artifacts, role);
    const v2 = computeOpscoreV2Match(matchStats, role);

    return {
      ...match,
      matchStats,
      role,
      artifacts,
      adjusted,
      baselineScore: scoreMatch(artifacts),
      adjustedScore: scoreMatch(adjusted),
      baselineFeedscore: feedscorePerMatch(matchStats),
      adjustedFeedscore: v2.feedRisk,
      v2,
    };
  });

  const { role, confidence } = detectPlayerRoleFromHistory(enrichedMatches);
  const roleBreakdown = enrichedMatches.reduce((accumulator, match) => {
    accumulator[match.role] = (accumulator[match.role] || 0) + 1;
    return accumulator;
  }, {});

  const baselineOpscore = average(enrichedMatches.map((match) => match.baselineScore));
  const baselineFeedscore = average(enrichedMatches.map((match) => match.baselineFeedscore));
  const dynamicOpscoreRaw = average(enrichedMatches.map((match) => match.v2.opscore));
  const dynamicFeedscoreRaw = average(enrichedMatches.map((match) => match.adjustedFeedscore));
  const artifacts = {
    combat_impact: roundTo(average(enrichedMatches.map((match) => numberOrZero(match.v2.artifacts.combat_impact)))),
    risk_discipline: roundTo(average(enrichedMatches.map((match) => numberOrZero(match.v2.artifacts.risk_discipline)))),
    resource_tempo: roundTo(average(enrichedMatches.map((match) => numberOrZero(match.v2.artifacts.resource_tempo)))),
    map_objective_control: roundTo(average(enrichedMatches.map((match) => numberOrZero(match.v2.artifacts.map_objective_control)))),
    team_enablement: roundTo(average(enrichedMatches.map((match) => numberOrZero(match.v2.artifacts.team_enablement)))),
  };
  const subcategoryKeys = [
    "fight_conversion",
    "damage_pressure",
    "death_cost",
    "survival_quality",
    "economy",
    "tempo",
    "vision_control",
    "objective_conversion",
    "setup_control",
    "protection_support",
    "objective_dominance",
  ];
  const subcategories = Object.fromEntries(
    subcategoryKeys.map((key) => [
      key,
      roundTo(average(enrichedMatches.map((match) => numberOrZero(match.v2.subcategories[key])))),
    ]),
  );

  return {
    baselineOpscore: roundTo(baselineOpscore),
    baselineFeedscore: roundTo(baselineFeedscore),
    dynamicOpscoreRaw: roundTo(dynamicOpscoreRaw),
    dynamicFeedscoreRaw: roundTo(dynamicFeedscoreRaw),
    detectedRole: role,
    roleConfidence: confidence,
    currentStreak: 0,
    opscoreStability: 0,
    recentOpscoreRaw: roundTo(dynamicOpscoreRaw),
    recentFeedscore: roundTo(dynamicFeedscoreRaw),
    matchesProcessed: enrichedMatches.length,
    artifacts,
    subcategories,
    roleBreakdown,
  };
}

module.exports = {
  applyRoleMultipliers,
  average,
  buildMatchStats,
  buildMatchTeamContext,
  clamp,
  computeOpscoreV2Match,
  computePlayerDynamicProfile,
  deriveNormalizationAnchors,
  derivePercentiles,
  detectPlayerRoleFromHistory,
  detectPlayerRoleFromMatch,
  extractArtifacts,
  feedscoreForRole,
  feedscorePerMatch,
  normalizeFeedscoreTo0To10,
  normalizeName,
  normalizeOpscoreTo0To10,
  normalizeRole,
  normalizeTo0To10,
  opscoreForRole,
  opscorePerMatch,
  playerBaselineScore,
  roundTo,
  scoreMatch,
};
