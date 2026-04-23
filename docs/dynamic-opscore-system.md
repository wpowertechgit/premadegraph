# Match-Based Performance Scoring System

This document describes the scoring system currently implemented in the backend.

The implementation lives in:

- [backend/scoring_config.js](/c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/scoring_config.js)
- [backend/lib/scoring_utils.js](/c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/lib/scoring_utils.js)
- [backend/normalize_players_by_puuid.js](/c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/normalize_players_by_puuid.js)

## Core Principle

The score is dataset-based, not temporal.

It answers:

**Given the matches stored in this dataset, what does this player's performance profile look like across the roles they actually played?**

This implementation does **not** use:

- streak detection
- stability bonuses
- time decay
- heuristic role inference

Role comes directly from Riot match JSON via `teamPosition`.

---

## Current Stored Fields

The implemented normalization pipeline writes:

- `players.opscore`: final normalized opscore on a `0-10` scale
- `players.feedscore`: final normalized feedscore on a `0-10` scale
- `players.match_count`: number of matches seen for the player
- `players.matches_processed`: number of matches used in score computation
- `players.detected_role`: most common explicit role in the stored sample
- `players.role_confidence`: share of matches played in that primary role
- `players.score_computed_at`: recomputation timestamp

---

## Step 1: Per-Match Artifact Extraction

Each match is converted into 8 baseline performance artifacts.

### Artifact 1: KDA Baseline

```javascript
kda = kills + (assists * 0.965) - (deaths * 0.25)
```

### Artifact 2: Economy

```javascript
efficiency = clamp(goldSpent / max(1, goldEarned), 0.5, 1.0)
economy = (goldEarned / gameDurationMinutes) / 10 + efficiency * 0.5
```

### Artifact 3: Map Awareness

```javascript
map_awareness =
  (visionScore * 0.15) +
  (wardsPlaced * 0.05) +
  (detectorWardsPlaced * 0.04) +
  (wardsKilled * 0.08) +
  (controlWardsPlaced * 0.06)
```

### Artifact 4: Utility

```javascript
utility =
  (enemyChampionImmobilizations * 0.08) +
  (totalDamageShieldedOnTeammates * 0.001) +
  (totalHeal * 0.001) +
  (damageSelfMitigated * 0.002) +
  (timeCCingOthers * 0.01)
```

### Artifact 5: Damage Output

```javascript
damage =
  (
    physicalDamageDealtToChampions +
    magicDamageDealtToChampions +
    trueDamageDealtToChampions
  ) / 1000 * 0.2
```

### Artifact 6: Tanking

```javascript
tanking = (totalDamageTaken / gameDurationMinutes) * 0.05
```

### Artifact 7: Objectives

```javascript
objectives =
  (damageDealtToBuildings * 0.002) +
  (turretTakedowns * 0.25) +
  (inhibitorTakedowns * 0.5) +
  (turretPlatesTaken * 0.03) +
  (damageDealtToTurrets * 0.001)
```

### Artifact 8: Early Game

```javascript
early_game =
  (firstBloodKill * 0.5) +
  (firstBloodAssist * 0.2) +
  (firstTowerKill * 0.3) +
  (firstTowerAssist * 0.1) +
  (laneMinionsFirst10Minutes / 50)
```

The implementation reads these values from participant fields and `participant.challenges` where needed.

---

## Step 2: Explicit Role Mapping

Implemented role normalization:

- `TOP -> TOP`
- `JUNGLE -> JUNGLE`
- `MID` or `MIDDLE -> MIDDLE`
- `BOT`, `ADC`, or `BOTTOM -> BOTTOM`
- `SUPPORT` or `UTILITY -> UTILITY`
- anything else -> `UNKNOWN`

The backend uses `teamPosition` from each participant as the source of truth.

---

## Step 3: Role Multipliers

After baseline artifact extraction, each artifact is multiplied by the role-specific weight table from `backend/scoring_config.js`.

```javascript
ROLE_MULTIPLIERS = {
  TOP:     { kda: 1.1, economy: 1.05, map_awareness: 0.9, utility: 0.6, damage: 1.15, tanking: 1.0, objectives: 1.2, early_game: 1.05 },
  JUNGLE:  { kda: 1.2, economy: 0.7,  map_awareness: 1.4, utility: 0.8, damage: 1.0,  tanking: 0.8, objectives: 1.4, early_game: 1.3  },
  MIDDLE:  { kda: 1.0, economy: 1.1,  map_awareness: 1.2, utility: 1.0, damage: 1.05, tanking: 0.8, objectives: 1.0, early_game: 1.1  },
  BOTTOM:  { kda: 1.2, economy: 1.3,  map_awareness: 1.1, utility: 0.7, damage: 1.4,  tanking: 0.6, objectives: 0.9, early_game: 1.0  },
  UTILITY: { kda: 0.7, economy: 0.4,  map_awareness: 1.8, utility: 1.8, damage: 0.5,  tanking: 1.1, objectives: 0.7, early_game: 0.8  },
  UNKNOWN: { kda: 1.0, economy: 1.0,  map_awareness: 1.0, utility: 1.0, damage: 1.0,  tanking: 1.0, objectives: 1.0, early_game: 1.0  }
}
```

The role-adjusted per-match opscore is:

```javascript
match_opscore_raw = sum(role_adjusted_artifacts)
```

This is the main implemented fairness mechanism so that strong `TOP`, `JUNGLE`, `UTILITY`, `MIDDLE`, and `BOTTOM` performances can land in comparable score ranges after normalization.

---

## Step 4: Feedscore by Role

Baseline per-match feedscore:

```javascript
feedscore = deaths - (kills + assists) * 0.35
```

Role-specific death tolerance:

```javascript
DEATH_TOLERANCE = {
  TOP: 1.0,
  JUNGLE: 1.05,
  MIDDLE: 1.0,
  BOTTOM: 1.15,
  UTILITY: 0.80,
  UNKNOWN: 1.0
}
```

Applied form:

```javascript
role_adjusted_feedscore =
  deaths * DEATH_TOLERANCE[role] - (kills + assists) * 0.35
```

The backend averages this role-adjusted feedscore across a player's matches and then normalizes it to `0-10`.

---

## Step 5: Player-Level Aggregation

For each player, the current backend computes:

- average baseline opscore across matches
- average baseline feedscore across matches
- average role-adjusted opscore across matches
- average role-adjusted feedscore across matches
- primary role and role share

Implemented aggregation:

```javascript
player_opscore_raw = average(match_opscore_raw_i)
player_feedscore_raw = average(match_feedscore_raw_i)
```

All matches are weighted equally.

There is no:

- recency weighting
- rolling window
- streak multiplier
- consistency bonus

---

## Step 6: Normalization

After raw scores are computed for all players, the backend derives percentile-based anchors:

- floor anchor: `p5`
- center anchor: `p50`
- ceiling anchor: `p95`

Then it maps scores piecewise:

```javascript
if (rawScore <= floor) {
  normalized = 0
} else if (rawScore <= center) {
  normalized = ((rawScore - floor) / (center - floor)) * 6.6
} else if (rawScore <= ceiling) {
  normalized = 6.6 + ((rawScore - center) / (ceiling - center)) * 3.4
} else {
  normalized = 10
}
```

This is applied to:

- raw role-adjusted opscore
- raw role-adjusted feedscore

This does two important things:

- the middle of the population is lifted into a more humane score range
- the top `5%` can already saturate at `10` instead of needing a once-in-a-dataset outlier

Both normalized outputs are clamped to `0-10`.

---

## Implementation Notes

The current implementation in `normalize_players_by_puuid.js` does the following:

1. Reads all match JSON files in deterministic sorted order.
2. Builds match stats from each participant.
3. Uses explicit `teamPosition` role information.
4. Extracts the 8 artifacts.
5. Applies role multipliers.
6. Averages per-player raw scores.
7. Derives dataset-wide normalization anchors.
8. Writes normalized scores back to the `players` table.

It also logs:

- raw opscore stats
- normalized opscore stats
- raw feedscore stats
- normalized feedscore stats
- normalization anchors
- a role-balance snapshot by primary role

That role-balance snapshot was added specifically to help tune whether strong players from different roles end up in comparable final score bands.

---

## Important Calibration Note

The formulas are implemented as written from the new scoring plan, but some artifacts can dominate raw totals on real Riot values:

- `utility`
- `tanking`

So the fairness question should be judged on:

- full-dataset normalization
- cross-role averages
- leaderboard sanity checks
- role-balance snapshots from normalization output

If a strong `UTILITY` or `TOP` player is still systematically below equally strong `BOTTOM` or `MIDDLE` players, the next step is multiplier tuning, not reintroducing temporal logic.

---

## Current Code Reality vs Old Design

The previous temporal scoring idea has now been removed from the implemented logic.

Not used anymore:

- heuristic role detection from wards/gold/kills
- time-decayed averages
- streak-based multipliers
- stability CV bonuses

Kept:

- dataset averaging
- percentile-style normalization
- feedscore concept
- role-sensitive scoring

---

## Design Goal

The intended behavior is:

**A genuinely good top laner, jungler, support, mid laner, or ADC should be able to reach a similarly strong final normalized score if they perform their role well.**

That is the main tuning target for this scoring system.
