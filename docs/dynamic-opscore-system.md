# Dynamic Opscore System

This document describes how `opscore` works after the dynamic scoring upgrade.

The current implementation lives in:

- [backend/scoring_config.js](/C:/Users/admin/Downloads/premgraph/premadegraph/backend/scoring_config.js)
- [backend/lib/scoring_utils.js](/C:/Users/admin/Downloads/premgraph/premadegraph/backend/lib/scoring_utils.js)
- [backend/normalize_players_by_puuid.js](/C:/Users/admin/Downloads/premgraph/premadegraph/backend/normalize_players_by_puuid.js)

## Overview

`players.opscore` is no longer the old lifetime-average score.

It is now the normalized dynamic opscore:

1. compute a per-match baseline opscore
2. detect a likely role for each match
3. apply role-specific stat weights
4. average the role-adjusted match scores across the stored dataset
5. add a small stability bonus for consistent players
6. add a streak adjustment for recent hot or cold form
7. normalize the final raw dynamic score to the `0-10` scale

The old score is still preserved in `players.opscore_legacy`.

## Stored Columns

The normalization pipeline extends the `players` table with these fields:

- `opscore_legacy`: old baseline average opscore before the new dynamic logic
- `feedscore_legacy`: old baseline average feedscore
- `opscore_decay`: dynamic normalized opscore
- `feedscore_decay`: dynamic feedscore
- `opscore_recent`: recent-form opscore normalized to `0-10`
- `feedscore_recent`: recent-form feedscore
- `opscore_stability`: consistency score on a `0-1` scale
- `detected_role`: most common detected role across that player's matches
- `role_confidence`: confidence in the detected role on a `0-1` scale
- `current_streak`: recent form vs older form on a `-1..1` scale
- `matches_processed`: number of matches used
- `dynamic_score_updated`: timestamp of the batch recomputation

For compatibility with the rest of the codebase:

- `players.opscore = players.opscore_decay`
- `players.feedscore = players.feedscore_decay`

This means the graph builders, Rust analytics, and assortativity code now read the new dynamic score automatically.

## Step 1: Baseline Per-Match Opscore

The baseline per-match opscore is:

```text
opscore_per_match =
  kills
  + assists * 0.965
  + goldEarned / gameDurationMinutes
  + visionScore * 0.15
```

This is still the reference score used for:

- the legacy baseline average
- stability calculation
- streak detection
- recent raw opscore

## Step 2: Match-Level Role Detection

Each match gets a heuristic role label:

- `support` if vision or warding is high and gold per minute is low
- `carry` if gold per minute is very high
- `jungler` if assists are high relative to kills
- `top` or `mid` if gold per minute is moderately high
- `unknown` otherwise

Current thresholds:

- `supportVisionScore = 80`
- `supportWardsPlaced = 8`
- `supportGoldPerMin = 300`
- `carryGoldPerMin = 450`
- `topGoldPerMin = 380`
- `junglerAssists = 12`

The player-level primary role is then chosen as the most common detected role across that player's matches.

## Step 3: Role-Aware Per-Match Opscore

After role detection, the per-match score is reweighted by role.

Formula:

```text
role_adjusted_opscore =
  kills * role.kills
  + assists * 0.965 * role.assists
  + (goldEarned / gameDurationMinutes) * role.gold
  + visionScore * 0.15 * role.vision
```

Current role multipliers:

| Role | Kills | Assists | Gold | Vision |
| --- | ---: | ---: | ---: | ---: |
| carry | 1.15 | 0.90 | 1.10 | 0.90 |
| mid | 1.05 | 1.00 | 1.00 | 1.05 |
| jungler | 1.10 | 1.20 | 0.75 | 1.00 |
| top | 1.00 | 0.90 | 1.05 | 0.90 |
| support | 0.60 | 1.30 | 0.40 | 1.50 |
| unknown | 1.00 | 1.00 | 1.00 | 1.00 |

Interpretation:

- carries are rewarded more for kills and gold
- supports are rewarded more for assists and vision
- junglers are rewarded more for assists and less for raw gold

## Step 4: Dataset-Average Base Score

The dynamic base score is now the plain average of the role-adjusted per-match opscores across the stored dataset:

```text
average_role_adjusted_opscore =
  sum(role_adjusted_opscore_i) / match_count
```

This intentionally removes age-based weighting. Older stored matches are no longer discounted just because they are older.

## Step 5: Stability Bonus

Stability is based on the coefficient of variation of the baseline per-match opscore values:

```text
cv = stddev(opscore_per_match) / abs(mean(opscore_per_match))
stability = clamp(1 - cv / 0.4, 0, 1)
```

The score only becomes meaningful after at least `10` matches.

The bonus applied to opscore is:

```text
stability_bonus = stability * 0.10
```

Interpretation:

- more consistent players get up to a `10%` boost
- volatile players get little or no bonus

## Step 6: Streak Adjustment

Streak is based on recent form versus older form.

The implementation:

1. orders matches by timestamp
2. takes the last `5` matches as the recent window
3. compares their average baseline per-match opscore to the older matches

Formula:

```text
streak_ratio =
  clamp(
    (recent_avg - old_avg) / abs(old_avg),
    -1,
    1
  )
```

Then:

```text
streak_multiplier = streak_ratio * 0.15
```

Interpretation:

- a hot streak can add up to `15%`
- a slump can reduce the score
- players with too little history effectively get no streak effect

## Step 7: Raw Dynamic Opscore

The final raw dynamic opscore is:

```text
dynamic_opscore_raw =
  average_role_adjusted_opscore
  * (1 + stability_bonus + streak_multiplier)
```

This raw value is not stored as the public-facing canonical `opscore`.
It is first normalized to `0-10`.

## Step 8: Normalization To 0-10

Normalization is dataset-relative.

After all players are scored, the batch process derives:

- global minimum raw dynamic opscore
- global median raw dynamic opscore
- global maximum raw dynamic opscore

Then the raw score is mapped piecewise:

- `min -> 0`
- `median -> 4`
- `max -> 10`

Formula:

```text
if raw <= median:
  normalized = ((raw - min) / (median - min)) * 4
else:
  normalized = 4 + ((raw - median) / (max - median)) * 6
```

The result is clamped to the `0-10` range.

This normalized value is written into:

- `players.opscore`
- `players.opscore_decay`

## Recent Opscore

`opscore_recent` is not the same as the main dynamic opscore.

It is:

1. the average baseline per-match opscore from matches in the last `7` days
2. normalized onto the same `0-10` scale using the current dataset anchors

So:

- `opscore` answers "how strong is this player under the full dynamic model?"
- `opscore_recent` answers "how good has this player looked very recently?"

## Feedscore Changes

`feedscore` also became dynamic, but with simpler behavior.

Per-match baseline:

```text
feedscore_per_match = deaths - (kills + assists) * 0.35
```

Role-aware feedscore changes death tolerance by role:

- support: `0.80`
- carry: `1.20`
- mid: `1.00`
- jungler: `1.05`
- top: `1.00`
- unknown: `1.00`

It also uses a dataset-wide average and a small hot-streak reduction.

## Practical Meaning Of The Main Fields

- `opscore`: main score used by analytics and graph views now
- `opscore_legacy`: old average score for comparison
- `opscore_recent`: last-7-days form indicator
- `opscore_stability`: consistency indicator
- `detected_role`: inferred main playstyle/position
- `current_streak`: whether the player is trending up or down recently

## Important Implementation Notes

- The batch recomputation happens in `normalizePlayersByPuuid()`.
- Match JSON files are processed in sorted filename order for deterministic recomputation.
- Match age is derived from `gameEndTimestamp`, then `gameCreation`, then file modification time as fallback, but it is now only used for the recent-form fields such as `opscore_recent`.
- Role is detected per match, but the stored player role is the most common role across the player's history.
- The current implementation does not zero out low-match players; single-match players still receive a dynamic score, but typically with:
  - low role confidence
  - no stability bonus
  - no meaningful streak effect

## Example From The Current Local Recompute

On the normalization run performed on April 22, 2026:

- processed matches: `3471`
- unique players: `25618`
- legacy raw opscore range: `146.92 .. 1252.11`
- dynamic raw opscore range: `83.60 .. 1377.23`
- dynamic normalized opscore range: `0.00 .. 10.00`
- normalization anchors: `min = 83.60`, `median = 411.80`, `max = 1377.23`

These values can change when the dataset changes.

## Summary

In short, the new opscore is:

- still interpretable
- still rooted in match statistics
- no longer role-agnostic
- no longer based on a simple lifetime average
- slightly sensitive to consistency and recent momentum
- still exposed on the familiar `0-10` scale

That keeps the score aligned with the dataset you actually have while preserving compatibility with the rest of the graph analytics pipeline.
