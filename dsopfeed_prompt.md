# Match-Based Performance Scoring Implementation Guide

## Architectural Overview

**Goal:** Replace the simplistic 4-stat baseline with a comprehensive 8-artifact system that respects role-specific responsibilities.

**Key Changes:**
- Remove: Temp heuristic role detection, streak bonuses, stability calculations
- Add: 8 performance artifacts, explicit role from JSON, role-specific multipliers
- Keep: Dataset averaging, 0-10 normalization, feedscore calculation

**Result:** More nuanced, fairer, position-aware scoring without unnecessary temporal logic.

---

## Implementation Phases

### Phase 1: Core Backend (Days 1-2)
- Implement 8 artifact extraction in `scoring_utils.js`
- Add role multiplier table in `scoring_config.js`
- Pipeline: baseline → role-adjust → average → normalize

### Phase 2: Testing & Validation (Days 3-4)
- Hand-verify on example_match_data.json
- Run full dataset normalization
- Verify assortativity & balance metrics hold
- Spot-check player scores for reasonableness

### Phase 3: Optional Frontend (Day 5+)
- Display role in player cards
- (Skip: No toggle needed; scoring is unified now)

---

## Section 1: Artifact Definitions

### Artifact 1: Kill/Death/Assist Baseline

**JSON Sources:**
- `participant.kills`
- `participant.assists`
- `participant.deaths`

**Formula:**
```javascript
kda_baseline = kills + (assists * 0.965) - (deaths * 0.25)
```

**Rationale:**
- Kills and assists represent impact
- 0.965 multiplier reflects assists being slightly less valuable than kills
- Death penalty (−0.25 per) captures the cost of dying

### Artifact 2: Economic Performance

**JSON Sources:**
- `participant.goldEarned`
- `participant.goldSpent`
- `match.info.gameDuration` (in milliseconds → convert to minutes)

**Formula:**
```javascript
gpm = goldEarned / (gameDurationMinutes || 1)
efficiency = (goldSpent / ((goldEarned || 1))) 

economy_score = (gpm / 10) + Math.clamp(efficiency, 0.5, 1.0) * 0.5
```

**Rationale:**
- Gold per minute is a key efficiency metric
- Spending ratio shows resource management (high spend = active, low = hoarding)
- Normalized to 0-2 range for artifact inclusion

### Artifact 3: Map Awareness (Vision & Warding)

**JSON Sources:**
- `participant.visionScore`
- `participant.wardsPlaced`
- `participant.detectorWardsPlaced`
- `participant.warsKilled`
- `participant.controlWardsPlaced`

**Formula:**
```javascript
map_awareness_score =
  (visionScore * 0.15) +
  (wardsPlaced * 0.05) +
  (detectorWardsPlaced * 0.04) +
  (wardsKilled * 0.08) +
  (controlWardsPlaced * 0.06)
```

**Rationale:**
- Vision score scales with game length and warding effectiveness
- Ward placement shows proactive map control
- Detector wards show enemy sweeping defense
- Ward kills show counter-warding
- Control wards show objective area control

### Artifact 4: Utility & Support (Team-Enabling)

**JSON Sources:**
- `participant.challenges.enemyChampionImmobilizations`
- `participant.totalDamageShieldedOnTeammates`
- `participant.totalHeal`
- `participant.challenges.damageSelfMitigated`
- `participant.challenges.timeCCingOthers`

**Formula:**
```javascript
utility_score =
  (enemyChampionImmobilizations * 0.08) +
  (totalDamageShieldedOnTeammates * 0.001) +
  (totalHeal * 0.001) +
  (damageSelfMitigated * 0.002) +
  (timeCCingOthers * 0.01)
```

**Rationale:**
- Immobilizations (stun, root, etc.) are high-impact plays
- Shields & heals enable team survival
- Self-mitigated damage shows defensive play
- CC duration shows team fight control
- Scales to 0-50 range after role multipliers

### Artifact 5: Damage Output (Offense)

**JSON Sources:**
- `participant.physicalDamageDealtToChampions`
- `participant.magicDamageDealtToChampions`
- `participant.trueDamageDealtToChampions`

**Formula:**
```javascript
total_champ_damage = 
  physicalDamageDealtToChampions +
  magicDamageDealtToChampions +
  trueDamageDealtToChampions

damage_output_score = (total_champ_damage / 1000) * 0.2
```

**Rationale:**
- Represents offensive contribution
- Normalized /1000 to scale with typical ranges (500-2000 damage per match)
- All damage types count equally

### Artifact 6: Damage Tanking (Defense)

**JSON Sources:**
- `participant.totalDamageTaken`
- `match.info.gameDuration`

**Formula:**
```javascript
tanking_score = (totalDamageTaken / (gameDurationMinutes || 1)) * 0.05
```

**Rationale:**
- Higher tanking normalized by game length
- Scaling factor (0.05) ensures parity with other artifacts
- Recognizes defensive/frontline play

### Artifact 7: Objective Control

**JSON Sources:**
- `participant.damageDealtToBuildings`
- `participant.turretTakedowns`
- `participant.inhibitorTakedowns`
- `participant.challenges.turretPlatesTaken`
- `participant.damageDealtToTurrets`

**Formula:**
```javascript
objective_control_score =
  (damageDealtToBuildings * 0.002) +
  (turretTakedowns * 0.25) +
  (inhibitorTakedowns * 0.5) +
  (turretPlatesTaken * 0.03) +
  (damageDealtToTurrets * 0.001)
```

**Rationale:**
- Building damage contributes to win condition
- Turret takedowns are high-value objectives
- Inhibitor takedowns are game-changing
- Turret plates are early-game objective wins
- Scaling ensures balanced contribution (0–100 range)

### Artifact 8: Early Game Dominance

**JSON Sources:**
- `participant.firstBloodKill`
- `participant.firstBloodAssist`
- `participant.firstTowerKill`
- `participant.firstTowerAssist`
- `participant.challenges.laneMinionsFirst10Minutes`

**Formula:**
```javascript
early_game_score =
  (firstBloodKill * 0.5) +
  (firstBloodAssist * 0.2) +
  (firstTowerKill * 0.3) +
  (firstTowerAssist * 0.1) +
  (laneMinionsFirst10Minutes / 50)
```

**Rationale:**
- First blood indicates early aggression
- First tower sets momentum
- CS@10 shows early efficiency
- Early advantages often translate to win probability

---

## Section 2: Database Schema

Minimal, non-destructive schema update:

```sql
ALTER TABLE players ADD COLUMN (
  opscore REAL DEFAULT 0,           -- New 0-10 normalized score
  feedscore REAL DEFAULT 0,         -- New 0-10 normalized feedscore
  matches_processed INT DEFAULT 0,  -- Count of matches
  score_computed_at TIMESTAMP       -- Last computation time
);
```

That's it. No temporary tables, no role columns. Role comes from match JSON directly each time.

---

## Section 3: Scoring Pipeline

### Step 1: Extract Baselines (Per Match)

In `scoring_utils.js`, add function:

```javascript
function extractBaselineArtifacts(participant, gameLengthMinutes) {
  return {
    kda: participant.kills + (participant.assists * 0.965) - (participant.deaths * 0.25),
    economy: (participant.goldEarned / gameLengthMinutes) / 10,
    map_awareness: (participant.visionScore * 0.15) + (participant.wardsPlaced * 0.05) + ...,
    utility: (participant.challenges?.enemyChampionImmobilizations * 0.08) + ...,
    damage: (participant.physicalDamageDealtToChampions + ...) / 1000 * 0.2,
    tanking: (participant.totalDamageTaken / gameLengthMinutes) * 0.05,
    objectives: (participant.damageDealtToBuildings * 0.002) + ...,
    early_game: (participant.firstBloodKill * 0.5) + ...
  };
}
```

### Step 2: Get Role (From JSON)

```javascript
function getRoleFromMatch(participant) {
  return participant.teamPosition || "UNKNOWN";  // "TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"
}
```

### Step 3: Apply Role Multipliers

```javascript
function applyRoleMultipliers(baseline, role) {
  const multipliers = ROLE_MULTIPLIERS[role] || ROLE_MULTIPLIERS.UNKNOWN;
  return {
    kda: baseline.kda * multipliers.kda,
    economy: baseline.economy * multipliers.economy,
    map_awareness: baseline.map_awareness * multipliers.map_awareness,
    utility: baseline.utility * multipliers.utility,
    damage: baseline.damage * multipliers.damage,
    tanking: baseline.tanking * multipliers.tanking,
    objectives: baseline.objectives * multipliers.objectives,
    early_game: baseline.early_game * multipliers.early_game
  };
}
```

### Step 4: Sum to Per-Match Score

```javascript
function computeMatchScore(roleAdjusted) {
  return Object.values(roleAdjusted).reduce((sum, val) => sum + val, 0);
}
```

### Step 5: Average Across Dataset

```javascript
function computePlayerBaselineScore(allMatches) {
  const matchScores = allMatches.map(match => computeMatchScore(match.roleAdjusted));
  return matchScores.reduce((sum, score) => sum + score, 0) / matchScores.length;
}
```

### Step 6: Normalize to 0-10

```javascript
function normalizeToScale(rawScore, globalMin, globalMedian, globalMax) {
  if (rawScore <= globalMedian) {
    return ((rawScore - globalMin) / (globalMedian - globalMin)) * 4;
  } else {
    return 4 + ((rawScore - globalMedian) / (globalMax - globalMedian)) * 6;
  }
}
```

---

## Section 4: Feedscore Calculation

Feedscore penalizes deaths; lower is better.

**Per-Match Baseline:**
```javascript
function feedscoreBaseline(participant) {
  return participant.deaths - (participant.kills + participant.assists) * 0.35;
}
```

**Role-Adjusted Death Tolerance:**
```javascript
const DEATH_TOLERANCE = {
  TOP:     1.0,
  JUNGLE:  1.05,
  MIDDLE:  1.0,
  BOTTOM:  1.15,    // ADC deaths are more costly
  UTILITY: 0.80     // Support expected to die more
};
```

**Applied:**
```javascript
function feedscoreAdjusted(baseline, role) {
  return baseline * DEATH_TOLERANCE[role];
}
```

**Final:** Average across all matches, normalize to 0-10 using same percentile mapping as opscore.

---

## Section 5: Role-Specific Attribute Specifications

### TOP Lane Role Implementation

**Responsibilities:** Solo dominance, duel strength, map control, split-push

**Weighted Attributes:**
```javascript
TOP_ATTRIBUTES = {
  // Core KDA
  kills:                                  { multiplier: 1.0,  source: "kills", meaning: "dueling success" },
  assists:                                { multiplier: 0.965, source: "assists", meaning: "kill participation" },
  deaths:                                 { multiplier: -0.25, source: "deaths", meaning: "dying penalty" },
  
  // Damage & Fight
  damagePerMinute:                        { multiplier: 1.15, source: "challenges.damagePerMinute", meaning: "laning output" },
  damageTakenOnTeamPercentage:            { multiplier: 1.0,  source: "challenges.damageTakenOnTeamPercentage", meaning: "damage absorption" },
  physicalDamageDealtToChampions:         { multiplier: 0.8,  source: "physicalDamageDealtToChampions", meaning: "AD damage" },
  magicDamageDealtToChampions:            { multiplier: 0.8,  source: "magicDamageDealtToChampions", meaning: "AP damage" },
  
  // Objectives
  damageDealtToBuildings:                 { multiplier: 1.2, source: "damageDealtToBuildings", meaning: "split-push value" },
  damageDealtToTurrets:                   { multiplier: 1.2, source: "damageDealtToTurrets", meaning: "structure impact" },
  turretTakedowns:                        { multiplier: 0.8, source: "turretTakedowns", meaning: "early objective" },
  turretPlatesTaken:                      { multiplier: 0.8, source: "challenges.turretPlatesTaken", meaning: "early plates" },
  inhibitorTakedowns:                     { multiplier: 1.0, source: "inhibitorTakedowns", meaning: "major objective" },
  
  // Map Control
  buffsStolen:                            { multiplier: 1.2, source: "challenges.buffsStolen", meaning: "map dominance" },
  controlWardsPlaced:                     { multiplier: 0.9, source: "controlWardsPlaced", meaning: "river awareness" },
  visionScore:                            { multiplier: 0.9, source: "visionScore", meaning: "map awareness" },
  detectorWardsPlaced:                    { multiplier: 0.8, source: "detectorWardsPlaced", meaning: "counter-warding" },
  wardTakedowns:                          { multiplier: 0.7, source: "wardTakedowns", meaning: "vision denial" },
  epicMonsterStolenWithoutSmite:          { multiplier: 1.0, source: "challenges.epicMonsterStolenWithoutSmite", meaning: "high-value play" },
  
  // Teamfight
  killsNearEnemyTurret:                   { multiplier: 0.8, source: "challenges.killsNearEnemyTurret", meaning: "dive stats" },
  knockEnemyIntoTeamAndKill:              { multiplier: 0.8, source: "challenges.knockEnemyIntoTeamAndKill", meaning: "setup plays" },
  multikills:                             { multiplier: 0.6, source: "multikills", meaning: "decisive moments" },
  takedownsInAlcove:                      { multiplier: 0.7, source: "challenges.takedownsInAlcove", meaning: "alcove control" },
  
  // Economy & Early
  goldPerMinute:                          { multiplier: 1.05, source: "calculated from goldEarned/gameDuration", meaning: "economy" },
  firstBloodKill:                         { multiplier: 0.5, source: "firstBloodKill", meaning: "early dominance" },
  firstTowerKill:                         { multiplier: 0.3, source: "firstTowerKill", meaning: "first objective" },
  laneMinionsFirst10Minutes:              { multiplier: 0.7, source: "challenges.laneMinionsFirst10Minutes", meaning: "CS early" },
  
  // Impact
  teamDamagePercentage:                   { multiplier: 0.8, source: "challenges.teamDamagePercentage", meaning: "relative impact" },
  win:                                    { multiplier: 0.25, source: "win", meaning: "outcome weight" }
}
```

### JUNGLE Role Implementation

**Responsibilities:** Objective control, ganking,  vision clearing, level advantages, counter-jungling

**Weighted Attributes:**
```javascript
JUNGLE_ATTRIBUTES = {
  // Core KDA
  kills:                                  { multiplier: 1.0,  source: "kills", meaning: "gank success" },
  assists:                                { multiplier: 0.965, source: "assists", meaning: "gank participation" },
  deaths:                                 { multiplier: -0.25, source: "deaths", meaning: "penalty" },
  
  // Solo Plays
  soloKills:                              { multiplier: 0.8, source: "challenges.soloKills", meaning: "dueling strength" },
  soloBaronKills:                         { multiplier: 1.5, source: "challenges.soloBaronKills", meaning: "solo objective" },
  
  // Objectives (PRIMARY)
  teamBaronKills:                         { multiplier: 1.2, source: "baronKills", meaning: "major objective" },
  teamDragonKills:                        { multiplier: 1.1, source: "dragonKills", meaning: "dragon priority" },
  teamElderDragonKills:                   { multiplier: 1.3, source: "challenges.elderDragonKillsWithOpposingSoul (related)", meaning: "ultimate objective" },
  riftHeraldKills:                        { multiplier: 0.8, source: "challenges.riftHeraldTakedowns", meaning: "structural setup" },
  scuttleCrabs:                           { multiplier: 0.7, source: "challenges.scuttleCrabKills", meaning: "map awareness + rotation" },
  
  // Vision (CORE JOB)
  wardTakedowns:                          { multiplier: 1.4, source: "wardTakedowns", meaning: "clearing vision **BIGGER WEIGHT**" },
  detectorWardsPlaced:                    { multiplier: 1.2, source: "detectorWardsPlaced", meaning: "counter-warding" },
  controlWardsPlaced:                     { multiplier: 1.4, source: "controlWardsPlaced", meaning: "jungle pathing vision" },
  visionScore:                            { multiplier: 1.4, source: "visionScore", meaning: "map control + clearing" },
  
  // Plays & Cooldowns
  epicMonsterStolenWithoutSmite:          { multiplier: 1.0, source: "challenges.epicMonsterStolenWithoutSmite", meaning: "high-value counterplay" },
  killAfterHiddenWithAlly:                { multiplier: 0.9, source: "challenges.killAfterHiddenWithAlly", meaning: "setup coordination" },
  killsOnLanersEarlyJungleAsJungler:      { multiplier: 0.9, source: "challenges.killsOnLanersEarlyJungleAsJungler", meaning: "early pressure" },
  takedownsAfterGainingLevelAdvantage:    { multiplier: 0.9, source: "challenges.takedownsAfterGainingLevelAdvantage", meaning: "snowball efficiency" },
  
  // Damage & Utility
  damagePerMinute:                        { multiplier: 1.0, source: "challenges.damagePerMinute", meaning: "balanced output" },
  knockEnemyIntoTeamAndKill:              { multiplier: 0.9, source: "challenges.knockEnemyIntoTeamAndKill", meaning: "setup plays" },
  totalHeal:                              { multiplier: 0.3, source: "totalHeal", meaning: "some sustain" },
  totalDamageShieldedOnTeammates:         { multiplier: 0.3, source: "totalDamageShieldedOnTeammates", meaning: "minimal utility" },
  
  // Economy
  goldPerMinute:                          { multiplier: 0.7, source: "calculated", meaning: "lower gold than laners" },
  
  // Early & Impact
  firstBloodKill:                         { multiplier: 0.5, source: "firstBloodKill", meaning: "early initiation" },
  win:                                    { multiplier: 0.25, source: "win", meaning: "outcome" }
}
```

### MIDDLE Role Implementation

**Responsibilities:** Roaming, map awareness, balanced damage, lane pressure

**Weighted Attributes:**
```javascript
MIDDLE_ATTRIBUTES = {
  // Core KDA + Roaming
  kills:                                  { multiplier: 1.0, source: "kills", meaning: "roaming kill contribution" },
  assists:                                { multiplier: 0.965, source: "assists", meaning: "kill participation" },
  deaths:                                 { multiplier: -0.25, source: "deaths", meaning: "penalty" },
  killsOnOtherLanesEarlyJungleAsLaner:   { multiplier: 1.0, source: "challenges.killsOnOtherLanesEarlyJungleAsLaner", meaning: "**ROAMING KILLS**" },
  
  // Damage & Output
  damagePerMinute:                        { multiplier: 1.05, source: "challenges.damagePerMinute", meaning: "mid-game damage" },
  physicalDamageDealtToChampions:         { multiplier: 0.5, source: "physicalDamageDealtToChampions", meaning: "AD viable" },
  magicDamageDealtToChampions:            { multiplier: 0.5, source: "magicDamageDealtToChampions", meaning: "AP viable" },
  teamDamagePercentage:                   { multiplier: 0.8, source: "challenges.teamDamagePercentage", meaning: "relative impact" },
  
  // Vision & Roaming
  visionScore:                            { multiplier: 1.2, source: "visionScore", meaning: "roaming timing vision" },
  controlWardsPlaced:                     { multiplier: 1.2, source: "controlWardsPlaced", meaning: "rotation vision" },
  wardsPlaced:                            { multiplier: 0.8, source: "wardsPlaced", meaning: "roaming support" },
  detectorWardsPlaced:                    { multiplier: 1.0, source: "detectorWardsPlaced", meaning: "counter-warding" },
  wardTakedowns:                          { multiplier: 0.9, source: "wardTakedowns", meaning: "vision denial" },
  
  // Objectives & Pressure
  damageDealtToBuildings:                 { multiplier: 0.9, source: "damageDealtToBuildings", meaning: "roam follow-up turrets" },
  damageDealtToTurrets:                   { multiplier: 0.9, source: "damageDealtToTurrets", meaning: "objective participation" },
  turretTakedowns:                        { multiplier: 0.7, source: "turretTakedowns", meaning: "roam objective" },
  takedownsAfterGainingLevelAdvantage:    { multiplier: 0.8, source: "challenges.takedownsAfterGainingLevelAdvantage", meaning: "leverage mid priority" },
  
  // Utility & Plays
  enemyChampionImmobilizations:           { multiplier: 0.5, source: "challenges.enemyChampionImmobilizations", meaning: "some utility CC" },
  knockEnemyIntoTeamAndKill:              { multiplier: 0.7, source: "challenges.knockEnemyIntoTeamAndKill", meaning: "setup plays" },
  
  // Economy & Early
  goldPerMinute:                          { multiplier: 1.1, source: "calculated", meaning: "mid secures wave" },
  laneMinionsFirst10Minutes:              { multiplier: 0.7, source: "challenges.laneMinionsFirst10Minutes", meaning: "CS efficiency early" },
  firstBloodKill:                         { multiplier: 0.5, source: "firstBloodKill", meaning: "early roam impact" },
  firstTowerAssist:                       { multiplier: 0.3, source: "firstTowerAssist", meaning: "roam follow-up" },
  
  // Positioning
  skillshotsDodged:                       { multiplier: 0.3, source: "challenges.skillshotsDodged", meaning: "positioning for rotations" },
  
  // Outcome
  win:                                    { multiplier: 0.25, source: "win", meaning: "outcome" }
}
```

### BOTTOM (ADC) Role Implementation

**Responsibilities:** Gold priority, sustained DPS, positioning safety, dual-lane synergy

**Weighted Attributes:**
```javascript
BOTTOM_ATTRIBUTES = {
  // Core KDA
  kills:                                  { multiplier: 1.0, source: "kills", meaning: "teamfight cleanup" },
  assists:                                { multiplier: 0.965, source: "assists", meaning: "kill participation" },
  deaths:                                 { multiplier: -0.25, source: "deaths", meaning: "penalty (critical resource)" },
  
  // Economy (PRIORITY ROLE)
  goldPerMinute:                          { multiplier: 1.3, source: "calculated", meaning: "**HIGHEST gold priority**" },
  goldEarned:                             { multiplier: 0.8, source: "goldEarned", meaning: "direct resource" },
  
  // Damage (PRIMARY DPS)
  damagePerMinute:                        { multiplier: 1.4, source: "challenges.damagePerMinute", meaning: "**PRIMARY DPS source**" },
  physicalDamageDealtToChampions:         { multiplier: 0.7, source: "physicalDamageDealtToChampions", meaning: "carry damage (mostly AD)" },
  magicDamageDealtToChampions:            { multiplier: 0.5, source: "magicDamageDealtToChampions", meaning: "carry damage (some AP)" },
  trueDamageDealtToChampions:             { multiplier: 0.5, source: "trueDamageDealtToChampions", meaning: "all damage counts" },
  teamDamagePercentage:                   { multiplier: 1.0, source: "challenges.teamDamagePercentage", meaning: "sustained damage focus" },
  
  // Vision (IMPORTANT - NOT LESS THAN SUPPORT)
  visionScore:                            { multiplier: 1.1, source: "visionScore", meaning: "**VISION CRITICAL for safety**" },
  controlWardsPlaced:                     { multiplier: 1.1, source: "controlWardsPlaced", meaning: "defensive warding" },
  wardsPlaced:                            { multiplier: 1.1, source: "wardsPlaced", meaning: "safety vision" },
  visionWardsBoughtInGame:                { multiplier: 0.8, source: "visionWardsBoughtInGame", meaning: "defensive investment" },
  detectorWardsPlaced:                    { multiplier: 0.8, source: "detectorWardsPlaced", meaning: "duo lane sweeping" },
  
  // Positioning (CRITICAL FOR ADC)
  skillshotsDodged:                       { multiplier: 0.5, source: "challenges.skillshotsDodged", meaning: "**positioning safety measure**" },
  damageSelfMitigated:                    { multiplier: 0.4, source: "challenges.damageSelfMitigated", meaning: "positioning awareness" },
  
  // Teamfight & Plays
  takedowns:                              { multiplier: 0.8, source: "challenges.takedowns", meaning: "teamfight presence" },
  killingSprees:                          { multiplier: 0.7, source: "killingSprees", meaning: "carry snowball" },
  multikills:                             { multiplier: 0.6, source: "multikills", meaning: "teamfight cleanup" },
  killsUnderOwnTurret:                    { multiplier: 0.5, source: "challenges.killsUnderOwnTurret", meaning: "tower defense" },
  
  // Early Game & Objectives
  firstBloodKill:                         { multiplier: 0.4, source: "firstBloodKill", meaning: "early lane pressure" },
  laneMinionsFirst10Minutes:              { multiplier: 0.8, source: "challenges.laneMinionsFirst10Minutes", meaning: "early duo economy" },
  turretPlatesTaken:                      { multiplier: 0.7, source: "challenges.turretPlatesTaken", meaning: "bot lane early objective" },
  
  // De-weighted (solo lane mechanics)
  soloKills:                              { multiplier: 0.3, source: "challenges.soloKills", meaning: "**LESS weight** (has support)" },
  killsOnOtherLanesEarlyJungleAsLaner:   { multiplier: 0.2, source: "challenges.killsOnOtherLanesEarlyJungleAsLaner", meaning: "**LESS weight** (focus lane)" },
  
  // Outcome
  win:                                    { multiplier: 0.25, source: "win", meaning: "outcome" }
}
```

### UTILITY (Support) Role Implementation

**Responsibilities:** Vision dominance, peeling, damage mitigation, heals/shields, ward economy

**Weighted Attributes:**
```javascript
UTILITY_ATTRIBUTES = {
  // Core KDA (Assists PRIMARY)
  kills:                                  { multiplier: 0.3, source: "kills", meaning: "**NOT primary** (setup value)" },
  assists:                                { multiplier: 0.965, source: "assists", meaning: "**PRIMARY contribution**" },
  deaths:                                 { multiplier: -0.2, source: "deaths", meaning: "**LOWER penalty** (expected)" },
  
  // Economy (NOT RELEVANT)
  goldPerMinute:                          { multiplier: 0.4, source: "calculated", meaning: "**LOWEST gold role**" },
  
  // Vision (MAXIMUM WEIGHT - WARD GAME)
  visionScore:                            { multiplier: 1.8, source: "visionScore", meaning: "**MAXIMUM WEIGHT: Ward game**" },
  wardsPlaced:                            { multiplier: 1.5, source: "wardsPlaced", meaning: "**PRIMARY STAT**" },
  controlWardsPlaced:                     { multiplier: 1.4, source: "controlWardsPlaced", meaning: "ward economy items" },
  detectorWardsPlaced:                    { multiplier: 1.6, source: "detectorWardsPlaced", meaning: "**BIGGER WEIGHT: Sweeping job**" },
  visionWardsBoughtInGame:                { multiplier: 1.0, source: "visionWardsBoughtInGame", meaning: "warding investment" },
  wardsGuarded:                           { multiplier: 0.6, source: "challenges.wardsGuarded", meaning: "defense posture" },
  
  // Vision Clearing (CORE JOB)
  wardsKilled:                            { multiplier: 0.9, source: "wardsKilled", meaning: "vision preservation" },
  wardTakedowns:                          { multiplier: 1.5, source: "wardTakedowns", meaning: "**BIGGER WEIGHT: Support clearing**" },
  
  // Peeling & Utility (CORE STATS)
  enemyChampionImmobilizations:           { multiplier: 1.5, source: "challenges.enemyChampionImmobilizations", meaning: "**CORE: CC is primary**" },
  totalDamageShieldedOnTeammates:         { multiplier: 1.5, source: "totalDamageShieldedOnTeammates", meaning: "**CORE: Peeling/protection**" },
  totalHeal:                              { multiplier: 1.4, source: "totalHeal", meaning: "**CORE: Sustain enabled**" },
  damageSelfMitigated:                    { multiplier: 1.4, source: "challenges.damageSelfMitigated", meaning: "**CORE: Tanking for team**" },
  timeCCingOthers:                        { multiplier: 1.2, source: "challenges.timeCCingOthers", meaning: "teamfight control duration" },
  knockEnemyIntoTeamAndKill:              { multiplier: 1.0, source: "challenges.knockEnemyIntoTeamAndKill", meaning: "setup plays" },
  
  // NOT Damage Role
  damagePerMinute:                        { multiplier: 0.5, source: "challenges.damagePerMinute", meaning: "**NOT damage role**" },
  physicalDamageDealtToChampions:         { multiplier: 0.3, source: "physicalDamageDealtToChampions", meaning: "minimal damage" },
  magicDamageDealtToChampions:            { multiplier: 0.3, source: "magicDamageDealtToChampions", meaning: "minimal damage" },
  teamDamagePercentage:                   { multiplier: 0.3, source: "challenges.teamDamagePercentage", meaning: "enablement role" },
  damageDealtToBuildings:                 { multiplier: 0.2, source: "damageDealtToBuildings", meaning: "minimal (not job)" },
  
  // Economy & Early (MINIMAL)
  laneMinionsFirst10Minutes:              { multiplier: 0.1, source: "challenges.laneMinionsFirst10Minutes", meaning: "should be minimal" },
  firstBloodAssist:                       { multiplier: 0.3, source: "firstBloodAssist", meaning: "setup assist value" },
  firstTowerAssist:                       { multiplier: 0.2, source: "firstTowerAssist", meaning: "support enablement" },
  
  // Outcome
  win:                                    { multiplier: 0.25, source: "win", meaning: "outcome" }
}
```

---

## Section 6: Role Multipliers Configuration

In `backend/scoring_config.js`, use these pre-calculated multipliers derived from the attribute specifications above:

```javascript
/**
 * Performance Scoring Configuration
 * Role-specific multipliers for 8-artifact scoring
 */

const ROLE_MULTIPLIERS = {
  TOP:    { kda: 1.1,  economy: 1.05, map_awareness: 0.9,  utility: 0.6,  damage: 1.15, tanking: 1.0,  objectives: 1.2,  early_game: 1.05 },
  JUNGLE: { kda: 1.2,  economy: 0.7,  map_awareness: 1.4,  utility: 0.8,  damage: 1.0,  tanking: 0.8,  objectives: 1.4,  early_game: 1.3  },
  MIDDLE: { kda: 1.0,  economy: 1.1,  map_awareness: 1.2,  utility: 1.0,  damage: 1.05, tanking: 0.8,  objectives: 1.0,  early_game: 1.1  },
  BOTTOM: { kda: 1.2,  economy: 1.3,  map_awareness: 1.1,  utility: 0.7,  damage: 1.4,  tanking: 0.6,  objectives: 0.9,  early_game: 1.0  },
  UTILITY: { kda: 0.7, economy: 0.4, map_awareness: 1.8, utility: 1.8, damage: 0.5, tanking: 1.1, objectives: 0.7, early_game: 0.8 }
};

const DEATH_TOLERANCE = {
  TOP:     1.0,
  JUNGLE:  1.05,
  MIDDLE:  1.0,
  BOTTOM:  1.15,
  UTILITY: 0.80
};

module.exports = { ROLE_MULTIPLIERS, DEATH_TOLERANCE };
```

---

## Section 7: Implementation Functions

In `backend/lib/scoring_utils.js`:

### Extract Baseline Artifacts

```javascript
function extractArtifacts(participant, gameLengthMinutes) {
  const challenges = participant.challenges || {};
  
  return {
    kda:             participant.kills + (participant.assists * 0.965) - (participant.deaths * 0.25),
    economy:         (participant.goldEarned / Math.max(1, gameLengthMinutes)) / 10 + 
                     Math.min(1, participant.goldSpent / Math.max(1, participant.goldEarned)) * 0.5,
    map_awareness:   (participant.visionScore * 0.15) + 
                     (participant.wardsPlaced * 0.05) +
                     ((participant.detectorWardsPlaced || 0) * 0.04) +
                     (participant.wardsKilled * 0.08) +
                     ((participant.controlWardsPlaced || 0) * 0.06),
    utility:         (challenges.enemyChampionImmobilizations * 0.08) +
                     ((participant.totalDamageShieldedOnTeammates || 0) * 0.001) +
                     ((participant.totalHeal || 0) * 0.001) +
                     ((challenges.damageSelfMitigated || 0) * 0.002) +
                     ((challenges.timeCCingOthers || 0) * 0.01),
    damage:          ((participant.physicalDamageDealtToChampions || 0) +
                     (participant.magicDamageDealtToChampions || 0) +
                     (participant.trueDamageDealtToChampions || 0)) / 1000 * 0.2,
    tanking:         (participant.totalDamageTaken / Math.max(1, gameLengthMinutes)) * 0.05,
    objectives:      ((participant.damageDealtToBuildings || 0) * 0.002) +
                     (participant.turretTakedowns * 0.25) +
                     (participant.inhibitorTakedowns * 0.5) +
                     ((challenges.turretPlatesTaken || 0) * 0.03) +
                     ((participant.damageDealtToTurrets || 0) * 0.001),
    early_game:      (participant.firstBloodKill * 0.5) +
                     (participant.firstBloodAssist * 0.2) +
                     (participant.firstTowerKill * 0.3) +
                     (participant.firstTowerAssist * 0.1) +
                     ((challenges.laneMinionsFirst10Minutes || 0) / 50)
  };
}
```

### Apply Role Multipliers

```javascript
function applyRoleMultipliers(artifacts, role, roleMultipliers) {
  const multiplier = roleMultipliers[role] || roleMultipliers.UNKNOWN;
  
  return {
    kda: artifacts.kda * multiplier.kda,
    economy: artifacts.economy * multiplier.economy,
    map_awareness: artifacts.map_awareness * multiplier.map_awareness,
    utility: artifacts.utility * multiplier.utility,
    damage: artifacts.damage * multiplier.damage,
    tanking: artifacts.tanking * multiplier.tanking,
    objectives: artifacts.objectives * multiplier.objectives,
    early_game: artifacts.early_game * multiplier.early_game
  };
}
```

### Sum & Average

```javascript
function scoreMatch(adjusted) {
  return Object.values(adjusted).reduce((sum, val) => sum + val, 0);
}

function playerBaselineScore(matches) {
  if (matches.length === 0) return 0;
  const scores = matches.map(m => scoreMatch(m.adjusted));
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
```

### Normalize

```javascript
function normalizeScore(rawScore, globalMin, globalMedian, globalMax) {
  if (rawScore <= globalMedian) {
    return ((rawScore - globalMin) / (globalMedian - globalMin)) * 4;
  } else {
    return 4 + ((rawScore - globalMedian) / (globalMax - globalMedian)) * 6;
  }
}
```

---

## Section 7: Testing on Example Data

Given `backend/example/example_match_data.json`:

1. Pick the first participant (Gyökeres, TOP lane, K'Sante)
2. Extract artifacts manually:

```javascript
const participant = match.info.participants[0];
const gameMins = match.info.gameDuration / 60000; // Convert ms to minutes

const artifacts = extractArtifacts(participant, gameMins);
// kda ≈ 2 + (19 * 0.965) - (12 * 0.25) = 18.635
// economy ≈ (13813 / 41) / 10 + 0.953 ≈ 34.7 + 0.953 = 35.7
// ...etc
```

3. Apply TOP multipliers:
```javascript
const adjusted = applyRoleMultipliers(artifacts, "TOP", ROLE_MULTIPLIERS);
```

4. Calculate match score and verify it's reasonable (should be 50-150 range for most matches)

---

## Section 8: Deployment Steps

1. **Update scoring_config.js:**  
   - Replace old heuristic role detection thresholds with ROLE_MULTIPLIERS table
   - Remove streakInfluence, stabilityInfluence, minMatchesForStability

2. **Update scoring_utils.js:**
   - Remove detectPlayerRoleFromMatch, cvToStabilityScore, calculateStabilityBonus, calculateStreakMultiplier
   - Add extractArtifacts, applyRoleMultipliers
   - Keep normalizeToScale as-is

3. **Update normalize_players_by_puuid.js:**
   - For each player: loop through matches
   - Extract artifacts → apply role (from teamPosition) → apply mult → score → average
   - Normalize using global min/median/max

4. **Test:**
   - Hand-verify on example data
   - Run full recompute
   - Check assortativity >0.5, balance ~65%

5. **Monitor:**
   - Watch for unexpected score changes
   - Validate that player rankings make intuitive sense
   - Adjust role multipliers if needed

---

## Section 9: Summary of Changes

| Item | Before | After |
|------|--------|-------|
| **Time Complexity** | 4 stats + streak calc + stability calc | 8 artifacts (no temporal) |
| **Role Input** | Heuristic with thresholds | Direct from `teamPosition` |
| **Multiplier Tuning** | 2 per-role params (kills, assists, gold, vision) | 8 per-role params (all artifacts) |
| **Temporal** | Streaks, stability, age decay | None |
| **Dataset Average** | Simple | Simple |
| **Normalization** | Percentile | Percentile |
| **Result** | Simpler, more position-aware, no false temporal logic |

Done.

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

