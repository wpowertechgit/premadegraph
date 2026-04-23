# Dynamic Opscore & Feedscore Planning Document

## Executive Summary

Current scoring is **time-invariant and role-agnostic**—every match contributes equally to lifetime averages. This plan introduces:

1. **Role-based adjustments** to weight player position/responsibility expectations
2. **Temporal dynamics** to capture streaks, recent form, and stability
3. **Time decay** to make recent performance more influential
4. **Context-aware normalization** respecting role-specific performance ranges

---

## Part 1: Role-Based Adjustments

### Current Role Data

The codebase already tracks roles via `rolesByMember` in [cluster_persistence.py](backend/cluster_persistence.py):

```python
rolesByMember: {
  "player_id": {
    "is_bridge": boolean,
    "is_star": boolean
  }
}
```

### Proposed Role Categories

Extend the role model to capture **position/playstyle** more explicitly:

```javascript
{
  "role": "support" | "carry" | "mid" | "jungler" | "top" | "unknown",
  "is_star": boolean,        // Central node in cluster
  "is_bridge": boolean,      // Connects clusters
  "stability": float         // 0-1, derived from temporal variance
}
```

#### Role Semantics

| Role | Typical Responsibility | Weight Factor |
|------|----------------------|---------------|
| **carry** | High damage, resource priority | opscore multiplier +0.15 |
| **mid** | Mixed damage/utility, roaming | opscore neutral (1.0x) |
| **jungler** | Lower gold, high map pressure | goldEarned weight reduced, assists weighted +0.20 |
| **top** | Split-push, isolation | assists neutral, vision weight -0.10 |
| **support** | Ward vision, peel, low resource | kills/gold heavily penalized, vision weight +0.35, assists +0.30 |
| **unknown** | Baseline (current formula) | 1.0x (no adjustment) |

### Role Detection Strategy

**Phase 1 (MVP):** Manual tagging or rule-based detection from match stats
- Lowest KDA → likely support
- Highest gold → likely carry
- Highest map coverage → likely jungler
- Use kill/death ratio extremes as heuristics

**Phase 2 (Optional):** Unsupervised clustering of stat profiles per player to refine role assignment

### Role-Adjusted Opscore Formula

```javascript
function opscoreForRole(match, playerRole) {
  const base = 
    kills + 
    assists * 0.965 + 
    (goldEarned / gameDurationMinutes) + 
    visionScore * 0.15;
    
  const roleAdjustments = {
    carry:    { kills: 1.15, assists: 0.90, gold: 1.10, vision: 0.90 },
    mid:      { kills: 1.05, assists: 1.00, gold: 1.00, vision: 1.05 },
    jungler:  { kills: 1.10, assists: 1.20, gold: 0.75, vision: 1.00 },
    top:      { kills: 1.00, assists: 0.90, gold: 1.05, vision: 0.90 },
    support:  { kills: 0.60, assists: 1.30, gold: 0.40, vision: 1.50 },
    unknown:  { kills: 1.00, assists: 1.00, gold: 1.00, vision: 1.00 }
  };
  
  const adj = roleAdjustments[playerRole] || roleAdjustments.unknown;
  
  return (
    kills * adj.kills +
    assists * 0.965 * adj.assists +
    (goldEarned / gameDurationMinutes) * adj.gold +
    visionScore * 0.15 * adj.vision
  );
}
```

### Role-Adjusted Feedscore Formula

```javascript
function feedscoreForRole(match, playerRole) {
  const base = deaths - (kills + assists) * 0.35;
  
  const roleTolerance = {
    support:   0.80,   // Support expected to die more (lower penalty)
    carry:     1.20,   // Carry deaths heavily penalized (higher weight)
    mid:       1.00,
    jungler:   1.05,
    top:       1.00,
    unknown:   1.00
  };
  
  const penalty = roleTolerance[playerRole] || 1.00;
  
  return deaths * penalty - (kills + assists) * 0.35;
}
```

---

## Part 2: Temporal Dynamics

### Goal

Capture **player form** (recent performance), **stability** (variance), and **streaks** without losing interpretability.

### Core Metrics

#### 2.1 Dataset-Wide Match Averaging

Average over the stored match history without age-based decay:

```javascript
const averagedOpscore =
  sumOf(match => opscoreForMatch(match))
  / matchCount;
```

**Interpretation:**
- Every stored match contributes equally to the main dynamic score
- This avoids pretending the dataset is fresher than it really is
- Recent-form analysis can still live in separate indicators

#### 2.2 Stability/Volatility Metric

```javascript
function calculateStability(matches) {
  const opscores = matches.map(m => opscoreForMatch(m));
  const mean = average(opscores);
  const stdDev = standardDeviation(opscores);
  
  // Coefficient of variation (normalized std dev)
  const cv = stdDev / (mean + 1e-6);
  
  // Convert to 0-1 scale (higher = more stable)
  // Assume CV typically ranges 0-0.4
  return Math.max(0, Math.min(1, 1 - (cv / 0.4)));
}
```

**Interpretation:**
- Stability = 0.9+ → player is very consistent
- Stability = 0.5-0.7 → player shows moderate variance
- Stability = <0.3 → player is very streaky/volatile

#### 2.3 Streak Detection

```javascript
function detectStreak(matches, window = 5) {
  // Compute rolling average over last N matches
  const recent = matches.slice(-window);
  const recentMean = average(recent.map(m => opscoreForMatch(m)));
  
  // Compare to long-term mean
  const longTermMean = average(matches.map(m => opscoreForMatch(m)));
  
  // Streak intensity: -1 to +1 (negative = slump, positive = hot streak)
  return (recentMean - longTermMean) / (longTermMean + 1e-6);
}
```

**Interpretation:**
- Streak > +0.2 → hot streak (playing above average)
- Streak < -0.2 → slump (playing below average)
- -0.2 ≤ Streak ≤ +0.2 → normal form

---

## Part 3: Unified Dynamic Scoring Formula

### 3.1 Opscore (Dynamic)

```javascript
function dynamicOpscore(player, allMatches, weights = {}) {
  const {
    useRoleAdjustment = true,
    streakInfluence = 0.15,
    stabilityInfluence = 0.10
  } = weights;
  
  // Base: Role-adjusted dataset average
  const baseScores = allMatches.map(match => {
    const role = detectPlayerRole(player, match);
    return useRoleAdjustment 
      ? opscoreForRole(match, role)
      : opscorePerMatch(match);
  });
  
  const averagedOpscore = average(baseScores);
  
  // Stability boost: consistent players score slightly higher
  const stability = calculateStability(allMatches);
  const stabilityBoost = stability * stabilityInfluence;
  
  // Streak adjustment: hot streaks boost, slumps reduce
  const streak = detectStreak(allMatches, 5);
  const streakAdjustment = streak * streakInfluence;
  
  // Combine adjustments
  const adjusted = 
    averagedOpscore * (1 + stabilityBoost + streakAdjustment);
  
  // Normalize to 0-10 scale (same percentile interpolation as before)
  return normalizeToScale(adjusted);
}
```

### 3.2 Feedscore (Dynamic)

```javascript
function dynamicFeedscore(player, allMatches, weights = {}) {
  const {
    useRoleAdjustment = true,
    streakInfluence = 0.15
  } = weights;
  
  // Base: Role-adjusted dataset average (lower is better)
  const baseScores = allMatches.map(match => {
    const role = detectPlayerRole(player, match);
    return useRoleAdjustment
      ? feedscoreForRole(match, role)
      : feedscorePerMatch(match);
  });
  
  const averagedFeedscore = average(baseScores);
  
  // Streak adjustment: hot streaks reduce feedscore penalty
  const streak = detectStreak(allMatches, 5);
  const streakPenalty = streak < 0 ? Math.abs(streak * streakInfluence) : 0;
  
  // Apply streak reduction (lower feedscore is better)
  const adjusted = averagedFeedscore * (1 - streakPenalty);
  
  return adjusted; // Keep raw values for now (no separate 0-10 scale)
}
```

---

## Part 4: Storage & Database Updates

### Current Schema
```sql
CREATE TABLE players (
  opscore REAL,      -- current: simple average
  feedscore REAL,    -- current: simple average
  match_count INT
);
```

### Proposed Extended Schema
```sql
ALTER TABLE players ADD COLUMN (
	  -- Dynamic metrics
	  opscore_decay REAL,           -- dynamic opscore (0-10)
	  feedscore_decay REAL,         -- dynamic feedscore
  opscore_recent REAL,          -- last 7 days average
  opscore_stability REAL,       -- 0-1 consistency metric
  
  -- Role-based scores
  detected_role TEXT,           -- 'carry'|'mid'|'jungler'|'top'|'support'|'unknown'
  opscore_roleadjusted REAL,    -- role-weighted opscore (0-10)
  feedscore_roleadjusted REAL,  -- role-weighted feedscore
  
  -- Streak info
  current_streak REAL,          -- -1 to +1 (positive = hot, negative = slump)
  last_updated TIMESTAMP
);
```

### Backward Compatibility
- Keep existing `opscore` and `feedscore` columns as "baseline"
- Add new columns prefixed with descriptive names
- Frontend can toggle between old/new scores via config
- API versioning for score endpoints

---

## Part 5: Role Detection Strategy

### Phase 1: Rule-Based Heuristics

```javascript
function detectPlayerRole(player, match) {
  const { kills, deaths, assists, goldEarned, wardsPlaced, visionScore } = match;
  const kda = (kills + assists) / Math.max(1, deaths);
  const goldPerMin = goldEarned / (match.gameDurationMinutes + 1);
  
  // Simple decision tree
  if (wardsPlaced > 8 || visionScore > 80) {
    if (goldPerMin < 300) return "support";
  }
  if (goldPerMin > 450) return "carry";
  if (goldPerMin > 380) {
    if (wardsPlaced < 3) return "top";
    else return "mid";
  }
  if (kills + assists > 12) return "jungler";
  
  return "unknown";
}
```

### Phase 2: Persistent Role Assignment

Store detected role per player (not per match) in a `player_roles` table:

```sql
CREATE TABLE player_roles (
  player_id TEXT PRIMARY KEY,
  detected_role TEXT,          -- most common role across last 20 matches
  role_confidence REAL,        -- 0-1
  recent_role_history TEXT,    -- JSON: [role, role, role, ...]
  last_updated TIMESTAMP
);
```

---

## Part 6: Implementation Phases

### Phase 1: MVP (Week 1-2)
- [ ] Extract role history from existing match data
- [ ] Implement role-adjustment multipliers (simple table-driven)
- [ ] Use dataset-average scoring with no age-based weighting
- [ ] Compute stability metric as post-processing
- [ ] Update backend scoring calc functions
- [ ] Extend DB schema (non-destructive ALTER)
- [ ] Recompute scores for all players
- [ ] Add API endpoint `/api/players/:id/scores?mode=dynamic|legacy`

### Phase 2: Frontend Toggle (Week 2-3)
- [ ] Add scoring mode selector to UI
- [ ] Display stability/streak indicators
- [ ] Show role-adjusted breakdown in player details
- [ ] A/B compare old vs new scores on graphs

### Phase 3: Validation & Refinement (Week 3-4)
- [ ] Verify assortativity remains strong on new scores
- [ ] Verify balance metrics stable
- [ ] Spot-check role assignments
- [ ] Gather feedback on interpretability
- [ ] Adjust multipliers if needed

### Phase 4: Optional Polish (Week 4+)
- [ ] Per-role performance baseline (for better normalization)
- [ ] Richer streak UI (hotstreak badges, slump warnings)
- [ ] Temporal chart showing score evolution
- [ ] Role-specific leaderboards

---

## Part 7: Validation Strategy

### 7.1 Correctness Checks

**Hand-verify on small dataset:**
1. Pick 3-5 players with complete match history
2. Manually calculate role-adjusted opscore by hand
3. Compare with implementation
4. Verify dataset-average calculations by hand

**Regression checks:**
```python
# Verify new scores correlate with old
correlation(oldOpscores, newOpscores) > 0.85  # Should be very high
correlation(oldFeedscores, newFeedscores) > 0.80
```

### 7.2 Research Impact Checks

**Does new scoring preserve our thesis narratives?**
- Assortativity on opscore should stay **>0.5** (currently 0.587)
- Balance ratio should stay **~65%** balanced
- If either metric degrades, recalibrate multipliers

### 7.3 Interpretability Checks

**For each player in top 10 opscores:**
1. Show old vs new score
2. Show breakdown: role adjustment + streak contribution
3. Check if ranking changes make sense

### 7.4 UI/UX Validation

- Users can toggle between "Legacy" and "Dynamic" scores
- Legend explains what each metric means
- No score suddenly drops/spikes without visible reason

---

## Part 8: Configuration & Tuning

### Default Hyperparameters

```javascript
const SCORING_CONFIG = {
	  // Role adjustments (per role)
  roleMultipliers: {
    carry:    { kills: 1.15, assists: 0.90, gold: 1.10, vision: 0.90 },
    mid:      { kills: 1.05, assists: 1.00, gold: 1.00, vision: 1.05 },
    jungler:  { kills: 1.10, assists: 1.20, gold: 0.75, vision: 1.00 },
    top:      { kills: 1.00, assists: 0.90, gold: 1.05, vision: 0.90 },
    support:  { kills: 0.60, assists: 1.30, gold: 0.40, vision: 1.50 }
  },
  
  // Streak/stability influence
  streakInfluence: 0.15,       // 15% of adjusted score
  stabilityInfluence: 0.10,    // 10% bonus for consistency
  
  // Streak window
  streakWindow: 5,             // last N matches
  
  // Minimum match count for meaningful metrics
  minMatches: 5
};
```

### Tuning Strategy

1. Start with conservative multipliers (values near 1.0)
2. Monitor assortativity/balance metrics as canary
3. Adjust based on feedback and research goals
4. Document all changes

---

## Part 9: Design Constraints & Principles

### Must Haves

- ✅ Maintain interpretability (not black-box)
- ✅ Preserve 0-10 opscore scale
- ✅ Keep feedscore as comparative metric
- ✅ Don't break existing research (assortativity, balance)
- ✅ Backward compatible with existing DB
- ✅ Reproducible (deterministic output)

### Should Haves

- ✅ Role-aware adjustments
- ✅ Recency weighting
- ✅ Stability/consistency recognition
- ✅ Streak detection
- ✅ Toggle for old/new score comparison

### Nice to Have (Future)

- Per-role normalization (different 0-10 scales)
- Automated role refinement
- Multi-season temporal analysis
- Season-reset handling

---

## Part 10: Open Questions & Decisions

1. **Minimum match count:** Should we require 10+ matches for meaningful dynamic score, or use adaptive thresholds per role?

2. **Role persistence:** Should detected role be sticky (require N consecutive matches to change) or adaptive per match?

3. **Normalization:** Should role-specific subgroups have separate percentile normalization, or global?

4. **Feedback loop:** Should we use assortativity/balance metrics as feedback to refine multipliers?

5. **Legacy comparison period:** How long to keep both scores visible side-by-side for user validation?

---

## Summary Table: What Changes

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Opscore** | Time-invariant average | Dataset-average + role-adjusted + streak influenced |
| **Feedscore** | Time-invariant average | Dataset-average + role-adjusted + streak penalty |
| **Role** | Not integrated | Explicit role detection + multiplier table |
| **Time** | Only duration normalization | No age-based weighting across stored matches |
| **Stability** | N/A | 0-1 metric (consistency score) |
| **Streak** | N/A | -1 to +1 (hot/slump indicator) |
| **DB** | 2 score columns | +6 new columns (non-destructive) |
| **API** | Single score | Query param: `mode=legacy\|dynamic` |

