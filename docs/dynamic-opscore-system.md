# Match-Based Performance Scoring System

This document describes the player performance scoring methodology based on match-level analysis.

The implementation lives in:

- [backend/scoring_config.js](/C:/Users/admin/Downloads/premgraph/premadegraph/backend/scoring_config.js)
- [backend/lib/scoring_utils.js](/C:/Users/admin/Downloads/premgraph/premadegraph/backend/lib/scoring_utils.js)
- [backend/normalize_players_by_puuid.js](/C:/Users/admin/Downloads/premgraph/premadegraph/backend/normalize_players_by_puuid.js)

## Core Principle

**Based on the current dataset → This player demonstrates X, Y performance across multiple roles.**

This is NOT a dynamic/temporal scoring system. We do not track improvements or streaks because:
- Match data is collected as fragments, not linearly over time
- Players can play multiple roles across different matches
- The role is **already explicitly defined in the JSON** via `teamPosition` attribute
- We measure capability snapshot, not trajectory

The score answers: **Given these N matches, what is this player's overall performance profile?**

---

## Stored Columns

The player scoring table contains these fields:

- `opscore`: normalized performance score on `0-10` scale (based on dataset)
- `feedscore`: death-to-participation penalty (lower is better)
- `matches_processed`: number of matches analyzed for this player's scores
- `score_computed_at`: timestamp of last recomputation

Removed fields (not applicable to dataset-based scoring):
- ~~role_confidence~~ - role is explicit in `teamPosition` JSON field
- ~~current_streak~~ - match data is not linear; no temporal trajectory
- ~~opscore_stability~~ - we measure capability, not consistency
- ~~opscore_recent~~ - all matches in dataset are equally valid

---

## Step 1: Role-Based Scoring (The Foundation)

Each match is scored according to the **role the player actually played** (from `teamPosition`). The role determines which attributes matter most and their weight multipliers.

### Role: TOP Lane

**Expected Responsibilities:**  
Solo lane dominance, duel strength, map control via buffs/vision, split-push pressure

**Key Attributes & Weights:**
| Attribute | Weight | Purpose |
|-----------|--------|---------|
| `kills` | +1.0 | Dueling success |
| `deaths` | -0.25 | Penalty per death |
| `assists` | +0.965 | Kill participation |
| `damagePerMinute` | +1.15 | Laning phase damage |
| `damageTakenOnTeamPercentage` | +1.0 | Damage absorption |
| `buffsStolen` | +1.2 | Map control dominance |
| `controlWardsPlaced` | +0.9 | River/enemy half awareness |
| `damageDealtToBuildings` | +1.2 | Split-push value |
| `damageDealtToTurrets` | +1.2 | Structure impact |
| `killsNearEnemyTurret` | +0.8 | Dive statistics |
| `takedownsInAlcove` | +0.7 | Special area control |
| `wardTakedowns` | +0.7 | Vision denial |
| `knockEnemyIntoTeamAndKill` | +0.8 | Setup plays |
| `multikills` | +0.6 | Decisive moments |
| `teamDamagePercentage` | +0.8 | Relative impact |
| `firstBloodKill` | +0.5 | Early dominance |
| `firstTowerKill` | +0.3 | Objective control |
| `turretPlatesTaken` | +0.8 | Early objective value |
| `epicMonsterStolenWithoutSmite` | +1.0 | High-value counterplay |
| `visionScore` | +0.9 | Map awareness |
| `win` | +0.25 | Match outcome |

### Role: JUNGLE

**Expected Responsibilities:**  
Dragon/Baron/Scuttle control, ganking, vision clearing, level advantages, counter-jungling

**Key Attributes & Weights:**
| Attribute | Weight | Purpose |
|-----------|--------|---------|
| `kills` | +1.0 | Gank success |
| `deaths` | -0.25 | Penalty |
| `assists` | +0.965 | Gank participation |
| `soloKills` | +0.8 | Dueling strength |
| `soloBaronKills` | +1.5 | Solo objective control |
| `teamBaronKills` | +1.2 | Major objective |
| `teamElderDragonKills` | +1.3 | Ultimate objective |
| `teamDragonKills` | +1.1 | Dragon priority |
| `voidMonsterKill` | +0.4 | Bonus objective |
| `takedownsAfterGainingLevelAdvantage` | +0.9 | Snowball efficiency |
| `wardTakedowns` | +1.4 | **CORE JOB: Vision clearing** |
| `detectorWardsPlaced` | +1.2 | Counter-warding |
| `epicMonsterStolenWithoutSmite` | +1.0 | High-value play |
| `killAfterHiddenWithAlly` | +0.9 | Setup coordination |
| `killsOnLanersEarlyJungleAsJungler` | +0.9 | Early pressure |
| `riftHeraldKills` | +0.8 | Structural setup |
| `scuttleCrabs` | +0.7 | Map awareness/rotation |
| `controlWardsPlaced` | +1.4 | Jungle pathing vision |
| `visionScore` | +1.4 | **Map control + ward clearing** |
| `firstBloodKill` | +0.5 | Early game initiation |
| `knockEnemyIntoTeamAndKill` | +0.9 | Setup plays |
| `damagePerMinute` | +1.0 | Balanced output |
| `goldPerMinute` | +0.7 | Lower gold income role |
| `totalHeal` | +0.3 | Some sustain |
| `totalDamageShieldedOnTeammates` | +0.3 | Minimal utility |
| `win` | +0.25 | Match outcome |

### Role: MIDDLE

**Expected Responsibilities:**  
Roaming impact, map awareness, balanced ad-hoc damage, lane pressure with occasional rotations

**Key Attributes & Weights:**
| Attribute | Weight | Purpose |
|-----------|--------|---------|
| `kills` | +1.0 | Roaming kill contribution |
| `deaths` | -0.25 | Penalty |
| `assists` | +0.965 | Kill participation |
| `damagePerMinute` | +1.05 | Mid-game damage |
| `goldPerMinute` | +1.1 | Mid secures wave |
| `visionScore` | +1.2 | Roaming timing vision |
| `controlWardsPlaced` | +1.2 | Rotation vision |
| `wardsPlaced` | +0.8 | Roaming support |
| `detectorWardsPlaced` | +1.0 | Counter-warding |
| `wardTakedowns` | +0.9 | Vision denial |
| `damageDealtToBuildings` | +0.9 | Roam follow-up turrets |
| `damageDealtToTurrets` | +0.9 | Objective participation |
| `killsOnOtherLanesEarlyJungleAsLaner` | +1.0 | **ROAMING KILLS** |
| `takedownsAfterGainingLevelAdvantage` | +0.8 | Leverage mid priority |
| `physicalDamageDealtToChampions` | +0.5 | Damage type (AD viable) |
| `magicDamageDealtToChampions` | +0.5 | Damage type (AP viable) |
| `laneMinionsFirst10Minutes` | +0.7 | Early CS efficiency |
| `teamDamagePercentage` | +0.8 | Relative impact |
| `turretTakedowns` | +0.7 | Roam objective value |
| `enemyChampionImmobilizations` | +0.5 | Some utility CA |
| `firstBloodKill` | +0.5 | Early roam impact |
| `firstTowerAssist` | +0.3 | Roam follow-up |
| `skillshotsDodged` | +0.3 | Positioning for rotations |
| `win` | +0.25 | Match outcome |

### Role: BOTTOM (ADC)

**Expected Responsibilities:**  
Gold priority (carry resource), sustained DPS in teamfights, positioning safety, dual-lane synergy

**Key Attributes & Weights:**
| Attribute | Weight | Purpose |
|-----------|--------|---------|
| `kills` | +1.0 | Teamfight cleanup |
| `deaths` | -0.25 | Penalty (critical resource) |
| `assists` | +0.965 | Kill participation |
| `goldPerMinute` | +1.3 | **HIGHEST gold priority** |
| `goldEarned` | +0.8 | Direct resource priority |
| `damagePerMinute` | +1.4 | **PRIMARY DPS source** |
| `physicalDamageDealtToChampions` | +0.7 | Carry damage (mostly AD) |
| `magicDamageDealtToChampions` | +0.5 | Carry damage (some AP) |
| `trueDamageDealtToChampions` | +0.5 | All damage counts |
| `visionScore` | +1.1 | **VISION CRITICAL for safety** |
| `controlWardsPlaced` | +1.1 | Defensive warding |
| `wardsPlaced` | +1.1 | Safety vision |
| `visionWardsBoughtInGame` | +0.8 | Defensive warding investment |
| `detectorWardsPlaced` | +0.8 | Duo lane sweeping |
| `skillshotsDodged` | +0.5 | **Positioning safety measure** |
| `damageSelfMitigated` | +0.4 | Positioning awareness |
| `teamDamagePercentage` | +1.0 | Sustained damage focus |
| `killsUnderOwnTurret` | +0.5 | Tower defense |
| `takedowns` | +0.8 | Teamfight presence |
| `killingSprees` | +0.7 | Carry snowball |
| `multikills` | +0.6 | Teamfight cleanup |
| `laneMinionsFirst10Minutes` | +0.8 | Early duo economy |
| `firstBloodKill` | +0.4 | Early lane pressure |
| `turretPlatesTaken` | +0.7 | Bot lane early objective |
| `soloKills` | +0.3 | **LESS weight** (has support) |
| `killsOnOtherLanesEarlyJungleAsLaner` | +0.2 | **LESS weight** (focus lane) |
| `win` | +0.25 | Match outcome |

### Role: UTILITY (Support)

**Expected Responsibilities:**  
Vision dominance, peeling/protection, damage mitigation, heals/shields, ward economy, vision clearing

**Key Attributes & Weights:**
| Attribute | Weight | Purpose |
|-----------|--------|---------|
| `kills` | +0.3 | **NOT primary** (setup value) |
| `deaths` | -0.2 | **LOWER penalty** (expected to die more) |
| `assists` | +0.965 | **PRIMARY contribution** |
| `goldPerMinute` | +0.4 | **LOWEST gold role** |
| `visionScore` | +1.8 | **MAXIMUM WEIGHT: Ward game** |
| `wardsPlaced` | +1.5 | **PRIMARY STAT** |
| `wardsKilled` | +0.9 | Vision preservation |
| `controlWardsPlaced` | +1.4 | Ward economy items |
| `detectorWardsPlaced` | +1.6 | **BIGGER WEIGHT: Sweeping job** |
| `visionWardsBoughtInGame` | +1.0 | Warding investment |
| `wardsGuarded` | +0.6 | Defense posture |
| `wardTakedowns` | +1.5 | **BIGGER WEIGHT: Support clearing** |
| `enemyChampionImmobilizations` | +1.5 | **CORE: CC is primary** |
| `totalDamageShieldedOnTeammates` | +1.5 | **CORE: Peeling/protection** |
| `totalHeal` | +1.4 | **CORE: Sustain enabled** |
| `damageSelfMitigated` | +1.4 | **CORE: Tanking for team** |
| `timeCCingOthers` | +1.2 | Teamfight control |
| `knockEnemyIntoTeamAndKill` | +1.0 | Setup plays |
| `damageDealtToBuildings` | +0.2 | Minimal (not their job) |
| `damagePerMinute` | +0.5 | **NOT damage role** |
| `physicalDamageDealtToChampions` | +0.3 | Minimal damage focus |
| `magicDamageDealtToChampions` | +0.3 | Minimal damage focus |
| `teamDamagePercentage` | +0.3 | Enablement role |
| `laneMinionsFirst10Minutes` | +0.1 | Should be minimal |
| `firstBloodAssist` | +0.3 | Setup assist value |
| `firstTowerAssist` | +0.2 | Support enablement |
| `win` | +0.25 | Match outcome |

---

## Step 2: Baseline Score Calculation

For each match, aggregate the role-weighted attributes:

```
baseline_per_match = sum(
  attribute_value × role_weight × importance_factor
)
```

Example for TOP lane with 10 kills, 3 deaths, 15 assists:
```
kda_component = (10 × 1.0) + (15 × 0.965) - (3 × 0.25) = 10 + 14.475 - 0.75 = 23.725
```

Then apply other weighted attributes the same way and sum total baseline.

---

## Step 3: Dataset Averaging

Average all role-weighted per-match scores across the player's matches:

```
player_opscore_raw = sum(baseline_per_match_i) / match_count
```

All matches in the dataset are equally weighted. We do not apply:
- ~~Age-based decay~~ - Match data is fragmented, not temporal
- ~~Stability bonuses~~ - We measure capability, not consistency
- ~~Streak adjustments~~ - No linear timeline to track streaks

---

## Step 4: Normalization to 0-10 Scale

After computing raw scores for all players, the batch process derives:

- global minimum raw score
- global median raw score  
- global maximum raw score

Then the raw score is mapped piecewise:

```javascript
if (raw <= median) {
  normalized = ((raw - min) / (median - min)) * 4;
} else {
  normalized = 4 + ((raw - median) / (max - median)) * 6;
}
```

Result is clamped to `0-10` range. This normalized value is written to `players.opscore`.

---

## Feedscore Formula

Feedscore penalizes deaths relative to participation:

```
feedscore_per_match = deaths - (kills + assists) * 0.35
```

**Role-Specific Death Tolerances (lower multiplier = less penalty):**

```javascript
DEATH_TOLERANCE = {
  "TOP":    1.0,      // Standard penalty
  "JUNGLE": 1.05,     // Slightly higher risk tolerance
  "MIDDLE": 1.0,      // Standard penalty
  "BOTTOM": 1.15,     // ADC deaths more costly (lost resource)
  "UTILITY": 0.80     // Support deaths less penalized (expected sacrifice)
}
```

**Applied:**
```
role_adjusted_feedscore = deaths * role_tolerance - (kills + assists) * 0.35
```

Like opscore, final feedscore is the arithmetic mean across all matches, then normalized to 0-10 scale.

---

## Implementation Notes

- The batch recomputation happens in `normalizePlayersByPuuid()`.
- Match JSON files processed in sorted filename order for deterministic results.
- Role comes directly from the `teamPosition` field—no heuristic detection needed.
- Each match scored independently using its own role multipliers before averaging.
- Players with multiple roles automatically get multi-role representation in their average.

---

## Example Output

On a normalization run:

- processed matches: `3471`
- unique players: `25618`
- raw opscore range: `12.4 .. 847.2`
- normalized opscore range: `0.00 .. 10.00`
- normalization anchors: `min = 12.4`, `median = 185.3`, `max = 847.2`

These anchors update whenever the dataset changes.

---

## Design Philosophy

This scoring system answers:

**"Given the matches in this dataset, what does this player's performance profile look like across the positions they play?"**

It does NOT answer:
- "Is this player improving?"
- "What is their peak form?"
- "What's their recent momentum?"

Those are different analytical questions requiring different methodology.

The score reflects **capability and contribution across the available match sample, weighted fairly for each position's unique responsibilities**.
