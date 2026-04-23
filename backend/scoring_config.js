const ROLE_MULTIPLIERS = {
  TOP: {
    kda: 1.1,
    economy: 1.05,
    map_awareness: 0.9,
    utility: 0.6,
    damage: 1.15,
    tanking: 1.0,
    objectives: 1.2,
    early_game: 1.05,
  },
  JUNGLE: {
    kda: 1.2,
    economy: 0.7,
    map_awareness: 1.4,
    utility: 0.8,
    damage: 1.0,
    tanking: 0.8,
    objectives: 1.4,
    early_game: 1.3,
  },
  MIDDLE: {
    kda: 1.0,
    economy: 1.1,
    map_awareness: 1.2,
    utility: 1.0,
    damage: 1.05,
    tanking: 0.8,
    objectives: 1.0,
    early_game: 1.1,
  },
  BOTTOM: {
    kda: 1.2,
    economy: 1.3,
    map_awareness: 1.1,
    utility: 0.7,
    damage: 1.4,
    tanking: 0.6,
    objectives: 0.9,
    early_game: 1.0,
  },
  UTILITY: {
    kda: 0.7,
    economy: 0.4,
    map_awareness: 1.8,
    utility: 1.8,
    damage: 0.5,
    tanking: 1.1,
    objectives: 0.7,
    early_game: 0.8,
  },
  UNKNOWN: {
    kda: 1.0,
    economy: 1.0,
    map_awareness: 1.0,
    utility: 1.0,
    damage: 1.0,
    tanking: 1.0,
    objectives: 1.0,
    early_game: 1.0,
  },
};

const DEATH_TOLERANCE = {
  TOP: 1.0,
  JUNGLE: 1.05,
  MIDDLE: 1.0,
  BOTTOM: 1.15,
  UTILITY: 0.8,
  UNKNOWN: 1.0,
};

const SCORING_CONFIG = {
  minMatchesForMeaningfulScore: 1,
  roleMultipliers: ROLE_MULTIPLIERS,
  deathTolerance: DEATH_TOLERANCE,
  normalization: {
    floorPercentile: 0.05,
    centerPercentile: 0.5,
    ceilingPercentile: 0.95,
    centerScore: 6.6,
  },
};

module.exports = {
  ...SCORING_CONFIG,
  ROLE_MULTIPLIERS,
  DEATH_TOLERANCE,
};
