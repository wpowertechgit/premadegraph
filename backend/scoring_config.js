const SCORING_CONFIG = {
  streakInfluence: 0.15,
  stabilityInfluence: 0.10,
  streakWindow: 5,
  recentWindowDays: 7,
  minMatchesForMeaningfulScore: 5,
  minMatchesForStability: 10,
  minMatchesForRoleConfidence: 5,
  roleMultipliers: {
    carry: { kills: 1.15, assists: 0.9, gold: 1.1, vision: 0.9 },
    mid: { kills: 1.05, assists: 1.0, gold: 1.0, vision: 1.05 },
    jungler: { kills: 1.1, assists: 1.2, gold: 0.75, vision: 1.0 },
    top: { kills: 1.0, assists: 0.9, gold: 1.05, vision: 0.9 },
    support: { kills: 0.6, assists: 1.3, gold: 0.4, vision: 1.5 },
    unknown: { kills: 1.0, assists: 1.0, gold: 1.0, vision: 1.0 },
  },
  roleThresholds: {
    supportVisionScore: 80,
    supportWardsPlaced: 8,
    supportGoldPerMin: 300,
    carryGoldPerMin: 450,
    topGoldPerMin: 380,
    junglerAssists: 12,
  },
  feedscoreRoleTolerance: {
    support: 0.8,
    carry: 1.2,
    mid: 1.0,
    jungler: 1.05,
    top: 1.0,
    unknown: 1.0,
  },
};

module.exports = SCORING_CONFIG;
