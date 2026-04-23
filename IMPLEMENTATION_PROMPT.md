# Dynamic Opscore & Feedscore Implementation Prompt

## Overview

Implement a role-aware and streak-aware scoring system to replace the current time-invariant opscore/feedscore calculations. This system will enhance player performance metrics while maintaining thesis validity (assortativity >0.5, balance ~65%).

---

## Phase 1: Backend Foundations (Weeks 1-2)

### 1.1 Database Schema Extension

**File:** `backend/` (schema migration or SQL update script)

Create a new table `player_scores_dynamic` to store computed metrics alongside existing data:

```sql
CREATE TABLE player_scores_dynamic (
  player_id TEXT PRIMARY KEY,
  
  -- Dynamic scores (0-10 for opscore)
  opscore_decay REAL,           
  feedscore_decay REAL,         
  
  -- 7-day rolling window
  opscore_recent REAL,          
  feedscore_recent REAL,
  
  -- Stability & consistency (0-1)
  opscore_stability REAL,       
  
  -- Role detection
  detected_role TEXT DEFAULT 'unknown',
  role_confidence REAL,         
  
  -- Streak info (-1 to +1)
  current_streak REAL,          
  
  -- Metadata
  matches_processed INTEGER,
  last_computed TIMESTAMP,
  
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

-- Index for quick lookups
CREATE INDEX idx_player_scores_dynamic_player_id 
  ON player_scores_dynamic(player_id);
```

**Alternative:** If modifying existing `players` table is preferred, use ALTER TABLE:

```sql
ALTER TABLE players ADD COLUMN (
  opscore_decay REAL DEFAULT NULL,
  feedscore_decay REAL DEFAULT NULL,
  opscore_recent REAL DEFAULT NULL,
  feedscore_recent REAL DEFAULT NULL,
  opscore_stability REAL DEFAULT NULL,
  detected_role TEXT DEFAULT 'unknown',
  role_confidence REAL DEFAULT 0.0,
  current_streak REAL DEFAULT 0.0,
  dynamic_score_updated TIMESTAMP DEFAULT NULL
);
```

**Decision:** Choose one approach (separate table preferred for clean separation and easier rollback).

---

### 1.2 Create Scoring Configuration File

**File:** `backend/scoring_config.js`

```javascript
/**
 * Dynamic Scoring Configuration
 * 
 * This file centralizes all tunable parameters for the new scoring system.
 * Modify these values to adjust scoring behavior globally.
 */

const SCORING_CONFIG = {
  // ============ Role Multipliers ============
  // Each role has custom stat weights
  // Format: { kills: multiplier, assists: multiplier, gold: multiplier, vision: multiplier }
  roleMultipliers: {
    carry: {
      kills: 1.15,
      assists: 0.90,
      gold: 1.10,
      vision: 0.90
    },
    mid: {
      kills: 1.05,
      assists: 1.00,
      gold: 1.00,
      vision: 1.05
    },
    jungler: {
      kills: 1.10,
      assists: 1.20,
      gold: 0.75,
      vision: 1.00
    },
    top: {
      kills: 1.00,
      assists: 0.90,
      gold: 1.05,
      vision: 0.90
    },
    support: {
      kills: 0.60,
      assists: 1.30,
      gold: 0.40,
      vision: 1.50
    },
    unknown: {
      kills: 1.00,
      assists: 1.00,
      gold: 1.00,
      vision: 1.00
    }
  },
  
  // ============ Streak & Stability Influence ============
  streakInfluence: 0.15,        // Hot streak can boost score up to 15%
  stabilityInfluence: 0.10,     // Consistent players get up to 10% bonus
  streakWindow: 5,              // Last N matches for streak calculation
  
  // ============ Data Quality Thresholds ============
  minMatchesForMeaningfulScore: 5,  // Require at least N matches
  minMatchesForStability: 10,       // Require N matches for stability metric
  
  // ============ Role Detection Thresholds ============
  roleThresholds: {
    supportVisionScore: 80,
    supportWardsPlaced: 8,
    supportGoldPerMin: 300,
    carryGoldPerMin: 450,
    topGoldPerMin: 380,
    junglerAssists: 12
  }
};

module.exports = SCORING_CONFIG;
```

---

### 1.3 Create Core Scoring Utilities Library

**File:** `backend/lib/scoring_utils.js`

Implement all mathematical functions for the new scoring system:

```javascript
const SCORING_CONFIG = require('../scoring_config');

/**
 * ============ HELPER FUNCTIONS ============
 */

/**
 * Calculate coefficient of variation (normalized standard deviation).
 * Used to measure consistency/volatility of player performance.
 * 
 * @param {number[]} values - Array of numerical values
 * @returns {number} CV value (higher = more volatile)
 */
function coefficientOfVariation(values) {
  if (!values || values.length === 0) return 0;
  
  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / n;
  const stdDev = Math.sqrt(variance);
  
  return Math.abs(stdDev) / (Math.abs(mean) + 1e-6);
}

/**
 * Convert coefficient of variation to stability score (0-1 scale).
 * Higher values = more stable/consistent player.
 * 
 * @param {number} cv - Coefficient of variation
 * @param {number} maxCV - Maximum expected CV for normalization (default: 0.4)
 * @returns {number} Stability score (0-1)
 */
function cvToStabilityScore(cv, maxCV = 0.4) {
  return Math.max(0, Math.min(1, 1 - (cv / maxCV)));
}

/**
 * Detect player's primary role based on match statistics.
 * Uses simple heuristic decision tree.
 * 
 * @param {object} matchStats - Match statistics { kills, deaths, assists, goldEarned, wardsPlaced, visionScore, gameDurationMinutes }
 * @returns {string} Role: 'support'|'carry'|'mid'|'jungler'|'top'|'unknown'
 */
function detectPlayerRoleFromMatch(matchStats) {
  const {
    kills = 0,
    deaths = 1,
    assists = 0,
    goldEarned = 0,
    wardsPlaced = 0,
    visionScore = 0,
    gameDurationMinutes = 30
  } = matchStats;
  
  const kda = (kills + assists) / Math.max(1, deaths);
  const goldPerMin = goldEarned / Math.max(1, gameDurationMinutes);
  const { roleThresholds } = SCORING_CONFIG;
  
  // Support: high vision, high wards, low gold
  if (visionScore > roleThresholds.supportVisionScore || 
      wardsPlaced > roleThresholds.supportWardsPlaced) {
    if (goldPerMin < roleThresholds.supportGoldPerMin) {
      return 'support';
    }
  }
  
  // Carry: very high gold
  if (goldPerMin > roleThresholds.carryGoldPerMin) {
    return 'carry';
  }
  
  // Mid: medium-high gold, balanced stats
  if (goldPerMin > roleThresholds.topGoldPerMin) {
    if (wardsPlaced < 3) {
      return 'top';
    } else {
      return 'mid';
    }
  }
  
  // Jungler: lower gold, high assists relative to kills
  if (assists > kills && assists > roleThresholds.junglerAssists) {
    return 'jungler';
  }
  
  return 'unknown';
}

/**
 * Detect primary role for a player across their match history.
 * Returns the most common role in recent matches.
 * 
 * @param {object[]} recentMatches - Last N matches with stats
 * @param {number} windowSize - How many recent matches to consider
 * @returns {object} { role: string, confidence: number (0-1) }
 */
function detectPlayerRoleFromHistory(recentMatches, windowSize = 10) {
  const roles = recentMatches
    .slice(-windowSize)
    .map(m => detectPlayerRoleFromMatch(m));
  
  const roleCounts = {};
  roles.forEach(role => {
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });
  
  const sortedRoles = Object.entries(roleCounts)
    .sort(([, countA], [, countB]) => countB - countA);
  
  if (sortedRoles.length === 0) {
    return { role: 'unknown', confidence: 0 };
  }
  
  const [primaryRole, count] = sortedRoles[0];
  const confidence = count / windowSize;
  
  return { role: primaryRole, confidence };
}

/**
 * ============ OPSCORE CALCULATIONS ============
 */

/**
 * Calculate per-match opscore WITHOUT role adjustment.
 * This is the baseline formula (current implementation).
 * 
 * @param {object} matchStats - { kills, assists, goldEarned, visionScore, gameDurationMinutes }
 * @returns {number} Raw opscore for the match
 */
function opscorePerMatch(matchStats) {
  const {
    kills = 0,
    assists = 0,
    goldEarned = 0,
    visionScore = 0,
    gameDurationMinutes = 30
  } = matchStats;
  
  return (
    kills +
    assists * 0.965 +
    (goldEarned / Math.max(1, gameDurationMinutes)) +
    visionScore * 0.15
  );
}

/**
 * Calculate per-match opscore WITH role adjustment.
 * Multiplies each stat component by role-specific weight.
 * 
 * @param {object} matchStats - Match stats
 * @param {string} role - Player role ('carry'|'mid'|'jungler'|'top'|'support'|'unknown')
 * @returns {number} Role-adjusted opscore
 */
function opscoreForRole(matchStats, role = 'unknown') {
  const {
    kills = 0,
    assists = 0,
    goldEarned = 0,
    visionScore = 0,
    gameDurationMinutes = 30
  } = matchStats;
  
  const adj = SCORING_CONFIG.roleMultipliers[role] || 
              SCORING_CONFIG.roleMultipliers.unknown;
  
  return (
    kills * adj.kills +
    assists * 0.965 * adj.assists +
    (goldEarned / Math.max(1, gameDurationMinutes)) * adj.gold +
    visionScore * 0.15 * adj.vision
  );
}

/**
 * Calculate average opscore across matches.
 * 
 * @param {object[]} matches - Array of { matchStats, ageInDays, role }
 * @param {boolean} useRole - Apply role multipliers (default: true)
 * @returns {number} Average opscore
 */
function timeWeightedOpscore(matches, useRole = true) {
  if (!matches || matches.length === 0) return 0;
  
  const totalScore = matches.reduce((sum, match) => {
    const rawScore = useRole
      ? opscoreForRole(match.matchStats, match.role)
      : opscorePerMatch(match.matchStats);
    
    return sum + rawScore;
  }, 0);
  
  return totalScore / matches.length;
}

/**
 * Calculate stability bonus for opscore.
 * Consistent players get a small boost; volatile players get no bonus.
 * 
 * @param {object[]} matches - Match history
 * @returns {number} Bonus multiplier (0 to stabilityInfluence, e.g., 0 to 0.10)
 */
function calculateStabilityBonus(matches) {
  if (!matches || matches.length < SCORING_CONFIG.minMatchesForStability) {
    return 0; // Not enough data
  }
  
  const opscores = matches.map(m => opscorePerMatch(m.matchStats));
  const cv = coefficientOfVariation(opscores);
  const stability = cvToStabilityScore(cv);
  
  return stability * SCORING_CONFIG.stabilityInfluence;
}

/**
 * Calculate streak adjustment for opscore.
 * Hot streaks boost score; slumps reduce it.
 * 
 * @param {object[]} matches - Full match history
 * @param {number} window - Last N matches to consider
 * @returns {number} Streak multiplier (-streakInfluence to +streakInfluence)
 */
function calculateStreakMultiplier(matches, window = SCORING_CONFIG.streakWindow) {
  if (!matches || matches.length < window) {
    return 0; // Not enough data for streak
  }
  
  const recentMatches = matches.slice(-window);
  const oldMatches = matches.slice(0, Math.max(1, matches.length - window));
  
  const recentAvg = recentMatches.reduce((sum, m) => 
    sum + opscorePerMatch(m.matchStats), 0) / recentMatches.length;
  
  const oldAvg = oldMatches.length > 0
    ? oldMatches.reduce((sum, m) => sum + opscorePerMatch(m.matchStats), 0) / oldMatches.length
    : recentAvg;
  
  const streakIntensity = (recentAvg - oldAvg) / (Math.abs(oldAvg) + 1e-6);
  
  // Clamp to [-1, +1] and scale by streakInfluence
  return Math.max(-1, Math.min(1, streakIntensity)) * SCORING_CONFIG.streakInfluence;
}

/**
 * Calculate dynamic opscore (final composite metric).
 * Combines time-weighting, role-adjustment, stability bonus, and streak.
 * 
 * @param {object[]} matches - Full match history [ { matchStats, ageInDays, role }, ... ]
 * @param {object} options - { useRoleAdjustment: bool }
 * @returns {number} Raw dynamic opscore (not yet normalized to 0-10)
 */
function calculateDynamicOpscore(matches, options = {}) {
  const {
    useRoleAdjustment = true
  } = options;
  
  if (!matches || matches.length === 0) return 0;
  if (matches.length < SCORING_CONFIG.minMatchesForMeaningfulScore) {
    return 0; // Not enough data
  }
  
  // Base: dataset-average and role-adjusted
  const baseScore = timeWeightedOpscore(matches, useRoleAdjustment);
  
  // Adjustments
  const stabilityBonus = calculateStabilityBonus(matches);
  const streakMultiplier = calculateStreakMultiplier(matches);
  
  // Final: base * (1 + bonuses)
  const adjusted = baseScore * (1 + stabilityBonus + streakMultiplier);
  
  return adjusted;
}

/**
 * ============ FEEDSCORE CALCULATIONS ============
 */

/**
 * Calculate per-match feedscore WITHOUT role adjustment.
 * Lower feedscore is better (indicates fewer deaths relative to participation).
 * 
 * @param {object} matchStats - { kills, deaths, assists }
 * @returns {number} Raw feedscore (typically negative or small positive)
 */
function feedscorePerMatch(matchStats) {
  const {
    kills = 0,
    deaths = 1,
    assists = 0
  } = matchStats;
  
  return deaths - (kills + assists) * 0.35;
}

/**
 * Calculate per-match feedscore WITH role adjustment.
 * Some roles (support) are expected to die more; adjust penalty accordingly.
 * 
 * @param {object} matchStats - Match stats
 * @param {string} role - Player role
 * @returns {number} Role-adjusted feedscore
 */
function feedscoreForRole(matchStats, role = 'unknown') {
  const {
    kills = 0,
    deaths = 1,
    assists = 0
  } = matchStats;
  
  // Role-specific death tolerance multiplier
  const roleTolerance = {
    support: 0.80,   // Support deaths less penalized (lower multiplier = lower penalty)
    carry: 1.20,     // Carry deaths heavily penalized
    mid: 1.00,
    jungler: 1.05,
    top: 1.00,
    unknown: 1.00
  };
  
  const penalty = roleTolerance[role] || 1.00;
  
  return deaths * penalty - (kills + assists) * 0.35;
}

/**
 * Calculate average feedscore across matches.
 * 
 * @param {object[]} matches - Array of match objects
 * @param {boolean} useRole - Apply role multipliers
 * @returns {number} Average feedscore (lower is better)
 */
function timeWeightedFeedscore(matches, useRole = true) {
  if (!matches || matches.length === 0) return 0;
  
  const totalScore = matches.reduce((sum, match) => {
    const rawScore = useRole
      ? feedscoreForRole(match.matchStats, match.role)
      : feedscorePerMatch(match.matchStats);
    
    return sum + rawScore;
  }, 0);
  
  return totalScore / matches.length;
}

/**
 * Calculate streak penalty for feedscore (only applied during slumps).
 * Hot streaks reduce feedscore penalty; slumps increase it.
 * 
 * @param {object[]} matches - Full match history
 * @param {number} window - Last N matches for streak detection
 * @returns {number} Penalty multiplier (0 to streakInfluence)
 */
function calculateStreakFeedscorePenalty(matches, window = SCORING_CONFIG.streakWindow) {
  if (!matches || matches.length < window) {
    return 0;
  }
  
  const recentMatches = matches.slice(-window);
  const oldMatches = matches.slice(0, Math.max(1, matches.length - window));
  
  const recentAvg = recentMatches.reduce((sum, m) =>
    sum + opscorePerMatch(m.matchStats), 0) / recentMatches.length;
  
  const oldAvg = oldMatches.length > 0
    ? oldMatches.reduce((sum, m) => sum + opscorePerMatch(m.matchStats), 0) / oldMatches.length
    : recentAvg;
  
  const streak = (recentAvg - oldAvg) / (Math.abs(oldAvg) + 1e-6);
  
  // During hot streak: reduce feedscore penalty
  // During slump: no additional penalty (already captured in opscore reduction)
  if (streak > 0.2) {
    return Math.min(streak * SCORING_CONFIG.streakInfluence, SCORING_CONFIG.streakInfluence);
  }
  
  return 0;
}

/**
 * Calculate dynamic feedscore (final composite metric).
 * 
 * @param {object[]} matches - Full match history
 * @param {object} options - { useRoleAdjustment: bool }
 * @returns {number} Raw dynamic feedscore (lower is better, no 0-10 normalization)
 */
function calculateDynamicFeedscore(matches, options = {}) {
  const { useRoleAdjustment = true } = options;
  
  if (!matches || matches.length === 0) return 0;
  if (matches.length < SCORING_CONFIG.minMatchesForMeaningfulScore) {
    return 0;
  }
  
  // Base: dataset-average and role-adjusted
  const baseScore = timeWeightedFeedscore(matches, useRoleAdjustment);
  
  // Hot streak reduction (negative = better, since lower feedscore is better)
  const streakReduction = calculateStreakFeedscorePenalty(matches);
  
  // Final: base * (1 - reduction) for hot streaks
  const adjusted = baseScore * (1 - streakReduction);
  
  return adjusted;
}

/**
 * ============ NORMALIZATION ============
 */

/**
 * Calculate 7-day rolling average opscore (recent form indicator).
 * 
 * @param {object[]} matches - All matches with ageInDays
 * @returns {number} Average opscore for matches from last 7 days
 */
function calculateRecentOpscore(matches) {
  const recentMatches = matches.filter(m => m.ageInDays <= 7);
  
  if (recentMatches.length === 0) return 0;
  
  const total = recentMatches.reduce((sum, m) => 
    sum + opscorePerMatch(m.matchStats), 0);
  
  return total / recentMatches.length;
}

/**
 * Calculate 7-day rolling average feedscore.
 * 
 * @param {object[]} matches - All matches with ageInDays
 * @returns {number} Average feedscore for last 7 days
 */
function calculateRecentFeedscore(matches) {
  const recentMatches = matches.filter(m => m.ageInDays <= 7);
  
  if (recentMatches.length === 0) return 0;
  
  const total = recentMatches.reduce((sum, m) =>
    sum + feedscorePerMatch(m.matchStats), 0);
  
  return total / recentMatches.length;
}

/**
 * Normalize raw opscore to 0-10 scale using percentile interpolation.
 * Uses global dataset percentiles (must be computed once at startup).
 * 
 * @param {number} rawScore - Raw opscore to normalize
 * @param {object} percentiles - { min: number, median: number, max: number }
 * @returns {number} Normalized score (0-10)
 * 
 * Example percentiles from current data:
 *   min: 146.92 → 0.0
 *   median: 424.93 → 4.0
 *   max: 1252.11 → 10.0
 */
function normalizeOpscoreTo0To10(rawScore, percentiles) {
  const { min, median, max } = percentiles;
  
  if (rawScore < median) {
    // Interpolate between min and median
    const ratio = (rawScore - min) / (median - min);
    return ratio * 4; // Map to 0-4 range
  } else {
    // Interpolate between median and max
    const ratio = (rawScore - median) / (max - median);
    return 4 + (ratio * 6); // Map to 4-10 range
  }
}

/**
 * ============ EXPORTS ============
 */

module.exports = {
  // Time & utility
  coefficientOfVariation,
  cvToStabilityScore,
  
  // Role detection
  detectPlayerRoleFromMatch,
  detectPlayerRoleFromHistory,
  
  // Opscore
  opscorePerMatch,
  opscoreForRole,
  timeWeightedOpscore,
  calculateStabilityBonus,
  calculateStreakMultiplier,
  calculateDynamicOpscore,
  calculateRecentOpscore,
  
  // Feedscore
  feedscorePerMatch,
  feedscoreForRole,
  timeWeightedFeedscore,
  calculateStreakFeedscorePenalty,
  calculateDynamicFeedscore,
  calculateRecentFeedscore,
  
  // Normalization
  normalizeOpscoreTo0To10
};
```

---

### 1.4 Create Score Computation Service

**File:** `backend/lib/score_computation_service.js`

This is the main orchestrator that ties everything together:

```javascript
const scoringUtils = require('./scoring_utils');
const SCORING_CONFIG = require('../scoring_config');

/**
 * Complete score computation service.
 * Fetches match history, computes all metrics, stores results.
 */

class ScoreComputationService {
  constructor(db) {
    this.db = db;
    this.opscorePercentiles = null; // Cached percentiles
  }
  
  /**
   * Compute all dynamic scores for a single player.
   * 
   * @param {string} playerId - Player UUID or ID
   * @param {array} matches - Match history with computed age
   * @returns {promise<object>} Computed scores object
   */
  async computePlayerScores(playerId, matches) {
    if (!matches || matches.length === 0) {
      return this.getDefaultScores();
    }
    
    // Enrich matches with role and age info
    const enrichedMatches = matches.map(m => ({
      matchStats: m,
      ageInDays: this.calculateMatchAge(m.timestamp),
      role: scoringUtils.detectPlayerRoleFromMatch(m)
    }));
    
    // Detect primary role
    const { role: primaryRole, confidence: roleConfidence } =
      scoringUtils.detectPlayerRoleFromHistory(enrichedMatches);
    
    // Calculate primary scores
    const dynamicOpscore = scoringUtils.calculateDynamicOpscore(enrichedMatches);
    const dynamicFeedscore = scoringUtils.calculateDynamicFeedscore(enrichedMatches);
    
    // Calculate recent (7-day) scores
    const recentOpscore = scoringUtils.calculateRecentOpscore(enrichedMatches);
    const recentFeedscore = scoringUtils.calculateRecentFeedscore(enrichedMatches);
    
    // Calculate stability
    const allOpscores = matches.map(m => scoringUtils.opscorePerMatch(m));
    const cv = scoringUtils.coefficientOfVariation(allOpscores);
    const stability = scoringUtils.cvToStabilityScore(cv);
    
    // Calculate streak
    const streakRatio = scoringUtils.calculateStreakMultiplier(enrichedMatches) /
      SCORING_CONFIG.streakInfluence; // Convert back to -1 to +1 scale
    
    // Normalize to 0-10 scale (using cached percentiles)
    const normalizedOpscore = this.opscorePercentiles
      ? scoringUtils.normalizeOpscoreTo0To10(dynamicOpscore, this.opscorePercentiles)
      : dynamicOpscore; // Fallback if percentiles not available
    
    return {
      playerId,
      opscoreDecay: normalizedOpscore,
      feedscoreDecay: dynamicFeedscore,
      opscoreRecent: recentOpscore,
      feedscoreRecent: recentFeedscore,
      opscoreStability: stability,
      detectedRole: primaryRole,
      roleConfidence,
      currentStreak: streakRatio,
      matchesProcessed: matches.length,
      lastComputed: new Date().toISOString()
    };
  }
  
  /**
   * Batch compute scores for multiple players.
   * 
   * @param {array} playerIds - List of player IDs to compute
   * @returns {promise} Completion status
   */
  async computeAllPlayerScores(playerIds) {
    console.log(`Starting batch score computation for ${playerIds.length} players...`);
    
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      
      try {
        // Fetch match history from DB
        const matches = await this.db.query(
          `SELECT matchStats FROM player_matches 
           WHERE player_id = $1 
           ORDER BY timestamp ASC`,
          [playerId]
        );
        
        // Compute scores
        const scores = await this.computePlayerScores(
          playerId,
          matches.rows.map(r => r.matchstats)
        );
        
        // Store in DB
        await this.saveScoresToDB(scores);
        
        // Progress indicator
        if ((i + 1) % 100 === 0) {
          console.log(`Progress: ${i + 1}/${playerIds.length} completed`);
        }
      } catch (err) {
        console.error(`Error computing scores for player ${playerId}:`, err.message);
        // Continue with next player
      }
    }
    
    console.log('Batch score computation complete.');
  }
  
  /**
   * Save computed scores to database.
   * 
   * @param {object} scores - Scores object from computePlayerScores()
   * @returns {promise} Query result
   */
  async saveScoresToDB(scores) {
    const {
      playerId,
      opscoreDecay,
      feedscoreDecay,
      opscoreRecent,
      feedscoreRecent,
      opscoreStability,
      detectedRole,
      roleConfidence,
      currentStreak,
      matchesProcessed,
      lastComputed
    } = scores;
    
    // Option A: Insert/update in separate table
    return this.db.query(
      `INSERT INTO player_scores_dynamic (
        player_id, opscore_decay, feedscore_decay, opscore_recent,
        feedscore_recent, opscore_stability, detected_role, role_confidence,
        current_streak, matches_processed, last_computed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (player_id) DO UPDATE SET
        opscore_decay = $2,
        feedscore_decay = $3,
        opscore_recent = $4,
        feedscore_recent = $5,
        opscore_stability = $6,
        detected_role = $7,
        role_confidence = $8,
        current_streak = $9,
        matches_processed = $10,
        last_computed = $11`,
      [playerId, opscoreDecay, feedscoreDecay, opscoreRecent, feedscoreRecent,
       opscoreStability, detectedRole, roleConfidence, currentStreak, matchesProcessed,
       lastComputed]
    );
  }
  
  /**
   * Load and cache global opscore percentiles from dataset.
   * Call this once at service startup.
   * 
   * @returns {promise<object>}
   */
  async loadOpscorePercentiles() {
    const result = await this.db.query(
      `SELECT
        percentile_cont(0.0) WITHIN GROUP (ORDER BY opscore) as min,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY opscore) as median,
        percentile_cont(1.0) WITHIN GROUP (ORDER BY opscore) as max
       FROM players`
    );
    
    this.opscorePercentiles = result.rows[0];
    console.log('Loaded opscore percentiles:', this.opscorePercentiles);
    
    return this.opscorePercentiles;
  }
  
  /**
   * Helper: Calculate match age in days.
   * 
   * @param {string|number} timestamp - Match timestamp
   * @returns {number} Age in days
   */
  calculateMatchAge(timestamp) {
    const matchDate = new Date(timestamp);
    const now = new Date();
    const diffMs = now - matchDate;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays;
  }
  
  /**
   * Get default scores for new/unknown players.
   * 
   * @returns {object}
   */
  getDefaultScores() {
    return {
      opscoreDecay: 0,
      feedscoreDecay: 0,
      opscoreRecent: 0,
      feedscoreRecent: 0,
      opscoreStability: 0,
      detectedRole: 'unknown',
      roleConfidence: 0,
      currentStreak: 0,
      matchesProcessed: 0,
      lastComputed: null
    };
  }
}

module.exports = ScoreComputationService;
```

---

### 1.5 Update Backend API Endpoints

**File:** `backend/server.js` (add new endpoints)

Add these endpoints to expose the new scoring system:

```javascript
/**
 * GET /api/players/:playerId/scores
 * 
 * Fetch scores for a single player.
 * 
 * Query params:
 *   - mode: 'legacy' | 'dynamic' | 'both' (default: 'both')
 *
 * Response:
 *   {
 *     playerId: string,
 *     legacy: { opscore: number, feedscore: number, matchCount: number },
 *     dynamic: {
 *       opscoreDecay: number,
 *       feedscoreDecay: number,
 *       opscoreRecent: number,
 *       opscoreStability: number (0-1),
 *       detectedRole: string,
 *       currentStreak: number (-1 to +1),
 *       lastUpdated: timestamp
 *     }
 *   }
 */
app.get('/api/players/:playerId/scores', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { mode = 'both' } = req.query;
    
    const result = {};
    
    // Legacy scores
    if (mode === 'legacy' || mode === 'both') {
      const legacyResult = await db.query(
        `SELECT opscore, feedscore, match_count
         FROM players WHERE player_id = $1`,
        [playerId]
      );
      
      if (legacyResult.rows.length > 0) {
        const row = legacyResult.rows[0];
        result.legacy = {
          opscore: row.opscore,
          feedscore: row.feedscore,
          matchCount: row.match_count
        };
      }
    }
    
    // Dynamic scores
    if (mode === 'dynamic' || mode === 'both') {
      const dynamicResult = await db.query(
        `SELECT * FROM player_scores_dynamic WHERE player_id = $1`,
        [playerId]
      );
      
      if (dynamicResult.rows.length > 0) {
        const row = dynamicResult.rows[0];
        result.dynamic = {
          opscoreDecay: row.opscore_decay,
          feedscoreDecay: row.feedscore_decay,
          opscoreRecent: row.opscore_recent,
          feedscoreRecent: row.feedscore_recent,
          opscoreStability: row.opscore_stability,
          detectedRole: row.detected_role,
          roleConfidence: row.role_confidence,
          currentStreak: row.current_streak,
          matchesProcessed: row.matches_processed,
          lastUpdated: row.last_computed
        };
      }
    }
    
    res.json(result);
  } catch (err) {
    console.error('Error fetching player scores:', err);
    res.status(500).json({ error: 'Failed to fetch player scores' });
  }
});

/**
 * GET /api/scores/config
 * 
 * Return current scoring configuration.
 * Useful for UI to understand how scoring works.
 */
app.get('/api/scores/config', (req, res) => {
  const SCORING_CONFIG = require('./scoring_config');
  res.json(SCORING_CONFIG);
});

/**
 * POST /api/scores/recompute
 * 
 * Trigger recomputation of dynamic scores for all players.
 * Admin-only endpoint (add auth check).
 * 
 * Query params:
 *   - playerIds: comma-separated list (optional, compute all if omitted)
 *
 * Response: { status: 'started' | 'completed', playersAffected: number }
 */
app.post('/api/scores/recompute', async (req, res) => {
  try {
    // TODO: Add admin authentication check here
    
    const { playerIds } = req.query;
    let idsToCompute = [];
    
    if (playerIds) {
      idsToCompute = playerIds.split(',');
    } else {
      // Get all player IDs
      const result = await db.query('SELECT DISTINCT player_id FROM players');
      idsToCompute = result.rows.map(r => r.player_id);
    }
    
    // Load percentiles
    const ScoreComputationService = require('./lib/score_computation_service');
    const scoreService = new ScoreComputationService(db);
    await scoreService.loadOpscorePercentiles();
    
    // Start batch computation (async, don't wait)
    scoreService.computeAllPlayerScores(idsToCompute)
      .catch(err => console.error('Batch score computation error:', err));
    
    res.json({
      status: 'started',
      playersAffected: idsToCompute.length
    });
  } catch (err) {
    console.error('Error starting score recomputation:', err);
    res.status(500).json({ error: 'Failed to start recomputation' });
  }
});

/**
 * GET /api/scores/leaderboard
 * 
 * Get top players by score (dynamic or legacy).
 * 
 * Query params:
 *   - mode: 'legacy' | 'dynamic' (default: 'dynamic')
 *   - limit: number of results (default: 50, max: 500)
 *   - role: filter by role (optional, e.g., 'support')
 *
 * Response: { leaderboard: [ { playerId, name, opscore, role, streak }, ... ] }
 */
app.get('/api/scores/leaderboard', async (req, res) => {
  try {
    const { mode = 'dynamic', limit = 50, role } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 50, 500);
    
    let query;
    let params = [];
    
    if (mode === 'legacy') {
      query = `
        SELECT p.player_id, p.player_name, p.opscore, p.feedscore
        FROM players p
        ORDER BY p.opscore DESC
        LIMIT $1
      `;
      params = [safeLimit];
    } else {
      // Dynamic mode
      query = `
        SELECT 
          p.player_id, 
          p.player_name, 
          d.opscore_decay,
          d.detected_role,
          d.current_streak,
          d.opscore_stability
        FROM players p
        LEFT JOIN player_scores_dynamic d ON p.player_id = d.player_id
        WHERE d.opscore_decay IS NOT NULL
      `;
      
      if (role) {
        query += ` AND d.detected_role = $1`;
        params.push(role);
      }
      
      query += ` ORDER BY d.opscore_decay DESC LIMIT $${params.length + 1}`;
      params.push(safeLimit);
    }
    
    const result = await db.query(query, params);
    
    res.json({
      mode,
      leaderboard: result.rows.map((row, idx) => ({
        rank: idx + 1,
        playerId: row.player_id,
        playerName: row.player_name,
        opscore: mode === 'legacy' ? row.opscore : row.opscore_decay,
        feedscore: row.feedscore || null,
        role: row.detected_role || 'unknown',
        streak: row.current_streak || 0,
        stability: row.opscore_stability || 0
      }))
    });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});
```

---

## Phase 2: Frontend Integration (Weeks 2-3)

### 2.1 Create Score Display Component

**File:** `frontend/src/components/ScoreDisplay.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import './ScoreDisplay.css';

/**
 * ScoreDisplay Component
 * 
 * Displays both legacy and dynamic scores with visual indicators.
 * User can toggle between modes.
 */

export default function ScoreDisplay({ playerId, mode = 'dynamic' }) {
  const [selectedMode, setSelectedMode] = useState(mode);
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchScores();
  }, [playerId, selectedMode]);
  
  const fetchScores = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/players/${playerId}/scores?mode=${selectedMode}`
      );
      const data = await response.json();
      setScores(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <div className="score-display loading">Loading...</div>;
  if (error) return <div className="score-display error">Error: {error}</div>;
  if (!scores) return <div className="score-display">No scores available</div>;
  
  return (
    <div className="score-display">
      {/* Mode toggle */}
      <div className="mode-toggle">
        <button
          className={selectedMode === 'legacy' ? 'active' : ''}
          onClick={() => setSelectedMode('legacy')}
        >
          Legacy
        </button>
        <button
          className={selectedMode === 'dynamic' ? 'active' : ''}
          onClick={() => setSelectedMode('dynamic')}
        >
          Dynamic
        </button>
      </div>
      
      {/* Legacy scores */}
      {scores.legacy && selectedMode === 'legacy' && (
        <div className="score-card legacy">
          <h3>Legacy Scores</h3>
          <div className="score-item">
            <span className="label">Opscore:</span>
            <span className="value">{scores.legacy.opscore.toFixed(2)}</span>
          </div>
          <div className="score-item">
            <span className="label">Feedscore:</span>
            <span className="value">{scores.legacy.feedscore.toFixed(2)}</span>
          </div>
          <div className="score-item">
            <span className="label">Matches:</span>
            <span className="value">{scores.legacy.matchCount}</span>
          </div>
          <div className="note">
            <em>Time-invariant lifetime averages</em>
          </div>
        </div>
      )}
      
      {/* Dynamic scores */}
      {scores.dynamic && selectedMode === 'dynamic' && (
        <div className="score-card dynamic">
          <h3>Dynamic Scores</h3>
          
          {/* Main score */}
          <div className="score-item large">
            <span className="label">Opscore (Decayed):</span>
            <span className="value opscore-badge">
              {scores.dynamic.opscoreDecay.toFixed(1)}
            </span>
          </div>
          
          {/* Secondary metrics */}
          <div className="metrics-grid">
            <div className="metric">
              <span className="label">Role:</span>
              <span className="value role-badge">
                {scores.dynamic.detectedRole}
              </span>
            </div>
            
            <div className="metric">
              <span className="label">Recent Form:</span>
              <span className="value">
                {scores.dynamic.opscoreRecent.toFixed(1)}
              </span>
            </div>
            
            <div className="metric">
              <span className="label">Stability:</span>
              <StabilityBar value={scores.dynamic.opscoreStability} />
            </div>
            
            <div className="metric">
              <span className="label">Streak:</span>
              <StreakIndicator value={scores.dynamic.currentStreak} />
            </div>
            
            <div className="metric">
              <span className="label">Feedscore:</span>
              <span className="value">
                {scores.dynamic.feedscoreDecay.toFixed(2)}
              </span>
            </div>
            
            <div className="metric">
              <span className="label">Matches:</span>
              <span className="value">{scores.dynamic.matchesProcessed}</span>
            </div>
          </div>
          
          {/* Legend */}
          <div className="legend">
            <p><strong>Dynamic Scoring Factors:</strong></p>
            <ul>
              <li><strong>Dataset Average:</strong> All stored matches contribute equally to the main dynamic score</li>
              <li><strong>Role Adjustment:</strong> {scores.dynamic.detectedRole} multipliers applied</li>
              <li><strong>Stability Bonus:</strong> Consistent players get ~{(scores.dynamic.opscoreStability * 10).toFixed(1)}% boost</li>
              <li><strong>Streak Multiplier:</strong> {scores.dynamic.currentStreak > 0.1 ? 'Hot streak' : scores.dynamic.currentStreak < -0.1 ? 'Slump' : 'Normal form'}</li>
            </ul>
          </div>
          
          <div className="metadata">
            Last updated: {new Date(scores.dynamic.lastUpdated).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * StabilityBar - Visual indicator for player consistency
 */
function StabilityBar({ value }) {
  let label = 'Low';
  let color = '#ff6b6b';
  
  if (value > 0.7) {
    label = 'High';
    color = '#51cf66';
  } else if (value > 0.4) {
    label = 'Medium';
    color = '#ffd43b';
  }
  
  return (
    <div className="stability-bar">
      <div
        className="bar-fill"
        style={{ width: `${value * 100}%`, backgroundColor: color }}
      />
      <span className="bar-label">{label}</span>
    </div>
  );
}

/**
 * StreakIndicator - Hot streak / slump indicator
 */
function StreakIndicator({ value }) {
  let icon = '→';
  let text = 'Normal';
  let color = '#868e96';
  
  if (value > 0.2) {
    icon = '📈';
    text = `Hot (+${(value * 100).toFixed(0)}%)`;
    color = '#51cf66';
  } else if (value < -0.2) {
    icon = '📉';
    text = `Slump (${(value * 100).toFixed(0)}%)`;
    color = '#ff6b6b';
  }
  
  return (
    <span style={{ color }}>
      {icon} {text}
    </span>
  );
}
```

### 2.2 Create Leaderboard Component

**File:** `frontend/src/components/ScoreLeaderboard.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import './ScoreLeaderboard.css';

/**
 * ScoreLeaderboard Component
 * 
 * Displays top players ranked by score.
 * Can toggle between legacy and dynamic modes.
 * Can filter by role.
 */

export default function ScoreLeaderboard() {
  const [mode, setMode] = useState('dynamic');
  const [selectedRole, setSelectedRole] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchLeaderboard();
  }, [mode, selectedRole]);
  
  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        mode,
        limit: 100,
        ...(selectedRole && { role: selectedRole })
      });
      
      const response = await fetch(`/api/scores/leaderboard?${params}`);
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const roles = ['support', 'carry', 'mid', 'jungler', 'top'];
  
  return (
    <div className="score-leaderboard">
      <h2>Player Rankings</h2>
      
      {/* Controls */}
      <div className="controls">
        <div className="mode-buttons">
          {['legacy', 'dynamic'].map(m => (
            <button
              key={m}
              className={mode === m ? 'active' : ''}
              onClick={() => setMode(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        
        {mode === 'dynamic' && (
          <div className="role-filter">
            <button
              className={selectedRole === null ? 'active' : ''}
              onClick={() => setSelectedRole(null)}
            >
              All Roles
            </button>
            {roles.map(role => (
              <button
                key={role}
                className={selectedRole === role ? 'active' : ''}
                onClick={() => setSelectedRole(role)}
              >
                {role}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Results */}
      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">Error: {error}</div>}
      
      {!loading && leaderboard.length > 0 && (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              {mode === 'dynamic' && (
                <>
                  <th>Role</th>
                  <th>Score</th>
                  <th>Recent</th>
                  <th>Stability</th>
                  <th>Streak</th>
                </>
              )}
              {mode === 'legacy' && (
                <>
                  <th>Opscore</th>
                  <th>Feedscore</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {leaderboard.map(player => (
              <tr key={player.playerId} className="player-row">
                <td className="rank">{player.rank}</td>
                <td className="player-name">{player.playerName}</td>
                
                {mode === 'dynamic' && (
                  <>
                    <td className="role-cell">
                      <span className={`role-badge ${player.role}`}>
                        {player.role}
                      </span>
                    </td>
                    <td className="score-cell">
                      <strong>{player.opscore.toFixed(1)}</strong>
                    </td>
                    <td className="metric-cell">
                      {player.recentScore?.toFixed(1) || '—'}
                    </td>
                    <td className="stability-cell">
                      <ProgressBar value={player.stability} />
                    </td>
                    <td className="streak-cell">
                      <StreakBadge value={player.streak} />
                    </td>
                  </>
                )}
                
                {mode === 'legacy' && (
                  <>
                    <td className="score-cell">{player.opscore.toFixed(2)}</td>
                    <td className="feedscore-cell">{player.feedscore?.toFixed(2) || '—'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
      {!loading && leaderboard.length === 0 && (
        <div className="empty">No players found</div>
      )}
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{
          width: `${value * 100}%`,
          backgroundColor: value > 0.7 ? '#51cf66' : value > 0.4 ? '#ffd43b' : '#ff6b6b'
        }}
      />
    </div>
  );
}

function StreakBadge({ value }) {
  if (value > 0.2) {
    return <span className="streak-badge hot">📈 Hot</span>;
  }
  if (value < -0.2) {
    return <span className="streak-badge slump">📉 Slump</span>;
  }
  return <span className="streak-badge normal">→ Normal</span>;
}
```

### 2.3 Update Player Detail View

**File:** `frontend/src/views/PlayerDetail.jsx` (add score display section)

Add this section to the player detail view to show scores:

```jsx
// Add import
import ScoreDisplay from '../components/ScoreDisplay';

// In JSX, add new section:
<div className="player-section scores-section">
  <h3>Performance Scores</h3>
  <ScoreDisplay playerId={player.id} mode="dynamic" />
</div>
```

---

## Phase 3: Testing & Validation (Weeks 3-4)

### 3.1 Create Unit Tests

**File:** `backend/lib/__tests__/scoring_utils.test.js`

```javascript
const assert = require('assert');
const scoringUtils = require('../scoring_utils');

describe('Scoring Utils', () => {
  
  // ============ Role Detection Tests ============
  describe('detectPlayerRoleFromMatch', () => {
    it('should detect support role', () => {
      const stats = {
        kills: 2,
        deaths: 8,
        assists: 25,
        goldEarned: 8000,
        wardsPlaced: 15,
        visionScore: 150,
        gameDurationMinutes: 30
      };
      const role = scoringUtils.detectPlayerRoleFromMatch(stats);
      assert.strictEqual(role, 'support');
    });
    
    it('should detect carry role', () => {
      const stats = {
        kills: 12,
        deaths: 3,
        assists: 5,
        goldEarned: 18000,
        wardsPlaced: 2,
        visionScore: 20,
        gameDurationMinutes: 30
      };
      const role = scoringUtils.detectPlayerRoleFromMatch(stats);
      assert.strictEqual(role, 'carry');
    });
  });
  
  // ============ Opscore Tests ============
  describe('opscorePerMatch', () => {
    it('should calculate basic opscore correctly', () => {
      const stats = {
        kills: 5,
        assists: 10,
        goldEarned: 12000,
        visionScore: 30,
        gameDurationMinutes: 30
      };
      const score = scoringUtils.opscorePerMatch(stats);
      // 5 + 10*0.965 + 12000/30 + 30*0.15
      // = 5 + 9.65 + 400 + 4.5
      // = 419.15
      assert(Math.abs(score - 419.15) < 0.1);
    });
  });
  
  // ============ Stability Tests ============
  describe('coefficientOfVariation', () => {
    it('should return 0 for identical values', () => {
      const cv = scoringUtils.coefficientOfVariation([5, 5, 5, 5]);
      assert.strictEqual(cv, 0);
    });
    
    it('should detect high variance', () => {
      const cv1 = scoringUtils.coefficientOfVariation([100, 100, 100, 100]);
      const cv2 = scoringUtils.coefficientOfVariation([50, 100, 150, 100]);
      assert(cv2 > cv1);
    });
  });
  
});
```

### 3.2 Create Integration Tests

**File:** `backend/tests/score_computation_integration.test.js`

```javascript
const assert = require('assert');
const ScoreComputationService = require('../lib/score_computation_service');

describe('Score Computation Integration', () => {
  let scoreService;
  
  before(() => {
    // Mock DB
    scoreService = new ScoreComputationService(mockDb);
  });
  
  it('should compute consistent scores across reruns', async () => {
    const mockMatches = [
      {
        kills: 5,
        deaths: 2,
        assists: 10,
        goldEarned: 12000,
        visionScore: 30,
        gameDurationMinutes: 30,
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      },
      // More matches...
    ];
    
    const scores1 = await scoreService.computePlayerScores('player1', mockMatches);
    const scores2 = await scoreService.computePlayerScores('player1', mockMatches);
    
    assert.deepStrictEqual(scores1, scores2);
  });
  
  it('should apply role multipliers correctly', async () => {
    // Test that role-adjusted scores differ from baseline
  });
  
});
```

### 3.3 Validation Checklist

Create `VALIDATION_CHECKLIST.md` to track validation steps:

```markdown
# Dynamic Scoring Validation Checklist

## Phase 1: Mathematical Correctness
- [ ] Hand-verify opscore calculation for 3-5 test players
- [ ] Verify dataset-average score calculation against hand-computed examples
- [ ] Verify role-adjusted scores differ from baseline
- [ ] Confirm stability metric ranges 0-1
- [ ] Confirm streak metric ranges -1 to +1

## Phase 2: Data Integrity
- [ ] All matches can be parsed and processed
- [ ] No division-by-zero errors
- [ ] Null/missing data handled gracefully
- [ ] Percentile normalization works correctly
- [ ] 100% of players compute without error

## Phase 3: Research Validation
- [ ] Assortativity on opscore: > 0.5 (baseline: 0.587)
- [ ] Balance ratio: ~65% (baseline: 65%)
- [ ] No outlier scores (>10 or <0 for opscore)
- [ ] No extreme feedscore values without explanation

## Phase 4: UI/UX
- [ ] Score display renders correctly
- [ ] Legacy/Dynamic toggle works
- [ ] Leaderboard shows correct rankings
- [ ] Tooltips explain all metrics
- [ ] No console errors in browser

## Phase 5: Performance
- [ ] Full batch computation completes in < 5 minutes
- [ ] API responses < 200ms
- [ ] No memory leaks during batch processing
- [ ] DB queries use indexes efficiently
```

---

## Phase 4: Deployment & Monitoring (Weeks 4+)

### 4.1 Create Migration Script

**File:** `backend/migrations/add_dynamic_scoring.sql`

```sql
-- Add dynamic scoring table
CREATE TABLE IF NOT EXISTS player_scores_dynamic (
  player_id TEXT PRIMARY KEY,
  opscore_decay REAL,
  feedscore_decay REAL,
  opscore_recent REAL,
  feedscore_recent REAL,
  opscore_stability REAL,
  detected_role TEXT DEFAULT 'unknown',
  role_confidence REAL DEFAULT 0.0,
  current_streak REAL DEFAULT 0.0,
  matches_processed INTEGER DEFAULT 0,
  last_computed TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

-- Create indexes
CREATE INDEX idx_psd_opscore_decay ON player_scores_dynamic(opscore_decay DESC);
CREATE INDEX idx_psd_role ON player_scores_dynamic(detected_role);
CREATE INDEX idx_psd_stability ON player_scores_dynamic(opscore_stability DESC);
```

### 4.2 Create Monitoring Dashboard

**File:** `backend/scripts/monitor_scoring.js`

```javascript
/**
 * Monitoring script for scoring system health.
 * Run this periodically to check for issues.
 */

const db = require('../db');

async function monitorScoringHealth() {
  console.log('=== Scoring System Health Check ===\n');
  
  try {
    // 1. Check coverage
    const coverageResult = await db.query(`
      SELECT 
        COUNT(DISTINCT p.player_id) as total_players,
        COUNT(DISTINCT d.player_id) as players_with_dynamic_scores,
        ROUND(100.0 * COUNT(DISTINCT d.player_id) / COUNT(DISTINCT p.player_id), 2) as coverage_percent
      FROM players p
      LEFT JOIN player_scores_dynamic d ON p.player_id = d.player_id
    `);
    
    console.log('Coverage:', coverageResult.rows[0]);
    
    // 2. Check percentiles
    const percentileResult = await db.query(`
      SELECT
        MIN(opscore_decay) as min_score,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY opscore_decay) as q1,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY opscore_decay) as median,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY opscore_decay) as q3,
        MAX(opscore_decay) as max_score
      FROM player_scores_dynamic
    `);
    
    console.log('\nOpscore Distribution:', percentileResult.rows[0]);
    
    // 3. Check for outliers
    const outlierResult = await db.query(`
      SELECT COUNT(*) as extreme_scores
      FROM player_scores_dynamic
      WHERE opscore_decay < 0 OR opscore_decay > 10
    `);
    
    console.log('\nOutliers (opscore not in 0-10 range):', outlierResult.rows[0].extreme_scores);
    
    // 4. Check role distribution
    const roleResult = await db.query(`
      SELECT detected_role, COUNT(*) as count
      FROM player_scores_dynamic
      GROUP BY detected_role
      ORDER BY count DESC
    `);
    
    console.log('\nRole Distribution:');
    roleResult.rows.forEach(row => {
      console.log(`  ${row.detected_role}: ${row.count}`);
    });
    
    // 5. Check recent updates
    const updateResult = await db.query(`
      SELECT 
        COUNT(*) as updated_recently,
        MAX(last_computed) as most_recent_update
      FROM player_scores_dynamic
      WHERE last_computed > NOW() - INTERVAL '1 day'
    `);
    
    console.log('\nRecent Updates:', updateResult.rows[0]);
    
  } catch (err) {
    console.error('Error during health check:', err);
  }
}

monitorScoringHealth();
```

---

## Summary of Implementation Requirements

### Files to Create
1. `backend/scoring_config.js` - Configuration file
2. `backend/lib/scoring_utils.js` - Core math library
3. `backend/lib/score_computation_service.js` - Computation orchestrator
4. `backend/lib/__tests__/scoring_utils.test.js` - Unit tests
5. `backend/tests/score_computation_integration.test.js` - Integration tests
6. `backend/migrations/add_dynamic_scoring.sql` - Database migration
7. `backend/scripts/monitor_scoring.js` - Monitoring script
8. `frontend/src/components/ScoreDisplay.jsx` - Score display component
9. `frontend/src/components/ScoreLeaderboard.jsx` - Leaderboard component

### Files to Modify
1. `backend/server.js` - Add new API endpoints
2. `frontend/src/views/PlayerDetail.jsx` - Integrate score display
3. `backend/package.json` - Add new dependencies if needed

### Database Changes
- Create `player_scores_dynamic` table (or ALTER `players` table)
- Create indexes for performance

### Testing
- Hand-verify calculations on sample data
- Run unit tests
- Check assortativity/balance metrics remain valid
- Monitor outliers and data quality

### Deployment Order
1. Create database schema
2. Deploy backend with new endpoints
3. Deploy frontend with new components
4. Run batch score computation
5. Enable score toggle in UI
6. Monitor and tune parameters

---

## Key Decision Points to Resolve Before Implementation

1. **Database Strategy:** New table or ALTER existing? → Recommend new table for safety
2. **Computation Trigger:** On-demand only or periodic batch? → Both (batch nightly, on-demand via admin)
3. **Role Persistence:** Per-match detection or global assignment? → Global (most common role in window)
4. **Minimum Match Count:** 5 or 10? → 5 for initial metric, 10+ for stability
5. **Feature Flag:** Gradually roll out or all-at-once? → Start with toggle (legacy/dynamic), plan sunset

---

## Performance Expectations

- **Batch computation:** 10,000 players in ~2-5 minutes
- **Per-player API:** <100ms response time
- **Leaderboard query:** <500ms
- **Frontend rendering:** <100ms

---

## Success Criteria

✅ All formulas mathematically correct and reproducible
✅ Assortativity remains > 0.5 on new dynamic opscore
✅ Balance ratio remains ~65%
✅ UI seamlessly toggles between legacy and dynamic
✅ No console errors or performance degradation
✅ Monitoring dashboard shows system health

