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

### Why Role Multipliers Are Needed

League of Legends roles do not have the same strategic job. A raw stat can therefore mean different things depending on which role produced it.

The game-theory idea behind the multipliers is opportunity cost. Each role has limited time, gold, map access, and risk budget. A good score should reward the actions that are strategically rational for that role, not just the actions that generate large raw numbers.

For example, high turret damage from a `TOP` player is usually strong evidence of side-lane pressure, split-push threat, plate conversion, and map pressure that forces the enemy team to respond. The same raw turret damage from a `UTILITY` player is still useful, but it is less central to the support role because supports are normally responsible for vision control, crowd control, peeling, roaming, and enabling teammates rather than being the primary source of structure damage.

Likewise, a high vision score from a `UTILITY` player is not just a generic bonus stat. It is a direct signal that the player performed one of the support role's core strategic duties: reducing uncertainty on the map. Vision affects objective setup, jungle tracking, roam timing, flank prevention, and whether teammates can safely convert pressure into dragons, towers, or Baron. For a `BOTTOM` carry, vision still matters, but the role's main expected contribution is sustained damage output and resource conversion.

The multipliers therefore encode role expectations, not role favoritism. They answer:

**Given this player's assigned role, which artifacts are most strategically meaningful evidence that they performed that role well?**

This is also why the system should not compare raw kills, gold, vision, or turret damage equally across all players. Equal raw weighting would systematically favor roles with naturally high combat and economy statistics while underrating roles whose value is expressed through map control, initiation, protection, or objective setup.

### Role-Theory Summary

The current multiplier table is based on these practical game-theory assumptions:

- `TOP`: often creates value through lane pressure, side-lane threat, dueling, durability, turret pressure, and forcing enemy rotations.
- `JUNGLE`: creates value through early tempo, objective control, ganks, map information, and cross-map decision pressure.
- `MIDDLE`: creates value through central map access, roaming, wave control, damage threat, and early skirmish influence.
- `BOTTOM`: creates value through scaling economy, sustained team-fight damage, objective damage after fights, and clean combat conversion.
- `UTILITY`: creates value through vision, protection, engage/disengage tools, crowd control, healing/shielding, and teamfight enablement.

### Attribute Impact By Role

| Artifact | Why it matters | Higher-weight roles | Lower-weight roles |
| --- | --- | --- | --- |
| `kda` | Measures combat conversion: kills and assists gained while limiting deaths. It is useful for all roles, but it is especially important when a role is expected to turn fights directly into advantage. | `JUNGLE`, `BOTTOM`, `TOP` | `UTILITY` |
| `economy` | Measures resource acquisition and gold conversion. Economy is central for carry roles because items convert directly into damage and late-game threat. | `BOTTOM`, `MIDDLE`, `TOP` | `UTILITY`, `JUNGLE` |
| `map_awareness` | Measures vision and information control. Information reduces strategic uncertainty and enables safer objective, roam, and engage decisions. | `UTILITY`, `JUNGLE`, `MIDDLE` | `TOP` |
| `utility` | Measures non-damage team contribution such as crowd control, shielding, healing, and damage mitigation. These actions enable teammates and stabilize fights. | `UTILITY`, `MIDDLE` | `TOP`, `BOTTOM` |
| `damage` | Measures direct champion damage pressure. Damage is most central for carry roles and still relevant for solo lanes. | `BOTTOM`, `TOP`, `MIDDLE` | `UTILITY` |
| `tanking` | Measures absorbed pressure and durability. This matters when a player is expected to front-line, survive engages, or create space. | `UTILITY`, `TOP` | `BOTTOM`, `MIDDLE` |
| `objectives` | Measures structure and objective conversion. It captures whether pressure is translated into permanent map advantage. | `JUNGLE`, `TOP` | `UTILITY`, `BOTTOM` |
| `early_game` | Measures early tempo signals such as first blood, first tower participation, and early farming. Early advantages affect lane control, jungle access, and objective timing. | `JUNGLE`, `MIDDLE`, `TOP` | `UTILITY` |

### Role-Specific Interpretation Of Each Artifact

#### KDA

KDA is a broad combat signal, but it should not dominate every role equally. `BOTTOM` and `JUNGLE` receive higher weight because these roles are often judged by whether they convert fights into kills, assists, and tempo. `TOP` also benefits because isolated deaths or successful duels can heavily affect side-lane pressure. `UTILITY` receives lower weight because supports can make correct sacrificial plays, initiate fights, or die while protecting carries; a support with modest KDA can still create high strategic value through vision and utility.

#### Economy

Economy represents how well a player turns available resources into item progression. `BOTTOM` receives the strongest economy multiplier because marksmen and bot carries usually scale directly through gold and items. `MIDDLE` and `TOP` also receive positive weighting because lane income and item timing influence roaming, dueling, and side-lane control. `UTILITY` receives a low multiplier because supports intentionally operate with less gold, while `JUNGLE` economy is weighted lower because jungle impact is often expressed through tempo, ganks, and objectives rather than lane-style gold accumulation.

#### Map Awareness

Map awareness is a strategic information artifact. It matters most for `UTILITY`, because supports are primary vision controllers and often determine whether the team can safely approach objectives or defend against flanks. It is also strongly weighted for `JUNGLE`, because junglers need information to track the enemy jungler, time objectives, and choose gank paths. `MIDDLE` receives a moderate boost because mid lane has access to both sides of the map and often contributes to river vision. `TOP` is weighted lower because top lane is more isolated and usually has fewer map-wide vision responsibilities.

#### Utility

Utility captures actions that help the team without necessarily appearing as kills or damage: crowd control, healing, shielding, and mitigation. `UTILITY` receives the strongest multiplier because these are core support responsibilities. `MIDDLE` keeps neutral weighting because many mid-lane champions contribute crowd control or setup while still being expected to deal damage. `TOP` and `BOTTOM` receive lower multipliers because their primary expected value is more often pressure, damage, durability, or resource conversion.

#### Damage

Damage is most important for `BOTTOM`, where the role is commonly expected to provide sustained teamfight damage and late-game carry threat. `TOP` and `MIDDLE` also receive positive weighting because solo laners often create pressure through kill threat, burst, poke, or dueling. `JUNGLE` remains neutral because jungle champions vary widely between carry, tank, engage, and utility styles. `UTILITY` receives a low multiplier because support performance should not be judged mainly by damage output.

#### Tanking

Tanking measures how much pressure a player absorbs while staying involved. It is relevant for `TOP`, where many champions act as side-lane bruisers, tanks, or front-line initiators. It is also weighted slightly higher for `UTILITY`, because supports often face-check, peel, engage, or absorb threat for more valuable carries. `BOTTOM` receives a low multiplier because taking large amounts of damage as a carry is often a risk signal rather than a role goal. `MIDDLE` and `JUNGLE` are lower because their expected durability varies strongly by champion class.

#### Objectives

Objectives are the clearest bridge between individual action and winning map state. `JUNGLE` receives the strongest objective multiplier because jungle pathing, smite control, and neutral objective timing are central to the role. `TOP` also receives a strong multiplier because turret damage, plates, and side-lane structure pressure are major ways top laners convert lane advantage into team advantage. `MIDDLE` remains neutral because mid priority enables objectives but does not always show up as direct structure damage. `BOTTOM` is slightly lower because the role's primary signal is usually damage and economy, although objective conversion after fights is still valuable. `UTILITY` is lower because supports enable objectives mostly through vision and control rather than direct damage.

#### Early Game

Early-game impact measures whether a player contributes to tempo before the game stabilizes. `JUNGLE` receives the highest early-game multiplier because early pathing, ganks, first blood participation, and objective setup can define the map. `MIDDLE` receives a boost because mid priority and early roams affect both side lanes and river control. `TOP` receives a small boost because early lane control, plates, and first tower pressure can create side-lane leverage. `BOTTOM` stays neutral because many bot-lane champions scale later, while `UTILITY` is lower because support value is better captured through map awareness and utility than through early farming or kill events alone.

### Important Limitation

These multipliers are a transparent heuristic calibration layer, not a learned truth. They should be evaluated by role-balance snapshots, leaderboard sanity checks, and future data-driven coefficient analysis. If the dataset shows that a role is consistently over- or under-valued, the correct next step is to tune the multipliers or learn coefficients from data, while keeping the reasoning interpretable.

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

Important direction note: stored `feedscore` is a risk-style score. Higher raw deaths relative to kills and assists produces a higher stored normalized feedscore, so **lower is better**. The frontend may display a derived "Feed Discipline" value by inverting this risk score with `10 - feedscore`.

### Is Feedscore Redundant?

Feedscore is partly overlapping with opscore because deaths, kills, and assists already appear inside the `kda` artifact. However, it is not fully redundant in the current system because it answers a narrower question:

**How costly is this player's death pattern relative to their direct combat contribution?**

Opscore is a broad role-adjusted performance index. It can reward a player for vision, objectives, economy, damage, tanking, and utility even if that player also dies often. Feedscore isolates the downside risk of deaths more clearly. That makes it useful as a diagnostic companion metric, especially for identifying players whose overall contribution is high but whose death profile may still be risky.

The recommended interpretation is:

- keep `opscore` as the main performance score
- keep `feedscore` as a secondary "feed discipline" or "death-risk" diagnostic
- avoid presenting feedscore as equal in importance to opscore
- consider renaming it in the UI/documentation to `death_risk`, `feed_risk`, or `feed_discipline` to make the direction easier to understand

If the project later adds temporal consistency and player stability analysis, feedscore becomes more valuable again because repeated death-risk patterns can be studied separately from broad performance quality.

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
