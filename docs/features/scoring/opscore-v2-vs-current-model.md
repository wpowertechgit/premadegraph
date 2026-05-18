# Opscore v2 Compared With The Current Model

## Purpose

This document compares the current implemented scoring model with the proposed Opscore v2 local formula.

The goal of Opscore v2 is not just to add more fields. The goal is to fix the main methodological weakness of the current model:

> The current score is normalized against the dataset, so the same match performance can receive different final grades depending on who else is in the database.

Opscore v2 instead grades performance locally, using role-specific expectations and match context.

## Current Model Summary

The current backend scoring model computes eight artifacts:

```text
kda
economy
map_awareness
utility
damage
tanking
objectives
early_game
```

It applies role multipliers, sums the adjusted artifact values, averages them across a player's matches, and then normalizes the result to a `0-10` scale using dataset percentiles:

```text
player_opscore_raw =
  average(match_opscore_raw_i)
```

The final score is derived from dataset anchors:

```text
floor   = p5(raw_scores)
center  = p50(raw_scores)
ceiling = p95(raw_scores)
```

The median player in the dataset is mapped to approximately:

```text
6.6 / 10
```

## Current Feedscore Summary

The current feedscore is:

```text
feedscore =
  deaths * death_tolerance_role
- (kills + assists) * 0.35
```

Then it is also normalized against the dataset.

Higher stored feedscore means higher death risk, so lower is better.

## Main Problems With The Current Model

### 1. Dataset-Relative Grading Can Mislead

If a dataset is full of strong Challenger-level players, the median player still gets pushed toward the middle of the normalized scale.

If another dataset is full of Bronze-level players, the median player in that dataset also lands around the same middle range.

This creates a bad interpretation:

```text
Bronze dataset median ~= Challenger dataset median
```

That is not a real performance statement. It is only a dataset-relative statement.

Opscore v2 fixes this by making the core grade local:

```text
opscore_v2 = role_expectation_based_match_grade
```

Dataset averages are still useful, but only as diagnostics:

```text
dataset_average = comparison context
dataset_average != grading rule
```

### 2. Death Risk Is Too Weak Inside Opscore

In the current model, death cost appears mainly through:

```text
kda = kills + assists * 0.965 - deaths * 0.25
```

This penalty is small compared with artifacts such as economy, utility, tanking, and objectives.

As a result, a player can die often and still score highly if other raw artifact values are large.

Opscore v2 moves this into a dedicated artifact:

```text
A_risk = Risk Discipline
```

Risk Discipline uses:

```text
deaths / game_minutes
totalTimeSpentDead / game_duration_seconds
contribution-adjusted death cost
longestTimeSpentLiving
clutch survival events
```

This makes the old standalone feedscore unnecessary.

### 3. Feedscore Uses A Crude Formula

The current feedscore:

```text
deaths - (kills + assists) * 0.35
```

does not understand:

```text
game length
death timer length
role expectations
team kill context
whether the player carried despite deaths
whether deaths were offset by objective or combat conversion
```

Opscore v2 replaces feedscore with a derived interpretation of Risk Discipline:

```text
feed_risk = clamp(0, 10, 10 - 5 * A_risk)
```

This means feed risk is no longer a separate weak formula. It is derived from the same risk model that affects Opscore.

### 4. Tanking Is Ambiguous

The current model has a standalone tanking artifact:

```text
tanking = totalDamageTaken / game_minutes * 0.05
```

This can reward two very different behaviors:

```text
good front-lining
running into the enemy and dying repeatedly
```

Opscore v2 removes tanking as a standalone artifact.

Damage absorption is only useful when interpreted through:

```text
Risk Discipline
Team Enablement
survival quality
setup/control value
```

This avoids rewarding raw damage taken without asking whether it created value.

### 5. Hard Artifact Caps Hide Carry Performances

A strict `2 points per artifact` model would fail on split-push and solo-carry games.

Example:

```text
A Yorick can win through side-lane pressure while having low Team Enablement.
```

If every artifact is capped at `2`, then an elite split-push artifact cannot compensate for low teamfighting.

Opscore v2 allows artifact overflow:

```text
normal artifact:      0-2
elite artifact:       2-3
win-condition carry:  3-4+
```

Only the final score is hard-capped:

```text
opscore = min(10, sum(artifacts))
```

This allows one artifact to represent the actual win condition.

## Opscore v2 Summary

Opscore v2 uses five artifacts:

```text
Combat Impact
Risk Discipline
Resource Tempo
Map and Objective Control
Team Enablement
```

Each artifact has two subcategories:

```text
Combat Impact:
  fight_conversion
  damage_pressure

Risk Discipline:
  death_cost
  survival_quality

Resource Tempo:
  economy
  lane_or_jungle_tempo

Map and Objective Control:
  vision_control
  objective_conversion

Team Enablement:
  setup_control
  protection_support
```

Each subcategory is graded using a role-local curve:

```text
r = observed_value / expected_role_value
```

Expected performance maps to:

```text
0.70
```

Elite performance receives logarithmic overflow:

```text
S_plus(r) = min(c, B(r) + lambda * ln(max(1, r)))
```

This rewards the long tail of exceptional games without allowing one raw stat to grow without limit.

## Why Opscore v2 Is Better

### 1. It Grades The Match, Not The Dataset

The score does not collapse when the dataset is full of elite players, and it does not inflate when the dataset is weak.

This makes the score more portable across:

```text
Flex Queue dataset
SoloQ dataset
future expanded datasets
small test fixtures
```

### 2. It Is Role-Aware At The Metric Level

The current model uses role multipliers after artifact extraction.

Opscore v2 goes deeper:

```text
role-specific expected values
role-specific subcategory weights
role-specific assist weighting
role-specific economy and tempo expectations
role-specific map/objective expectations
```

This is more defensible because different roles have genuinely different win conditions.

### 3. It Rewards Actual Win Conditions

Opscore v2 can recognize multiple elite performance shapes:

```text
hard carry damage dealer
split-push structure carry
objective-control jungler
vision/control support
frontline setup player
low-death resource converter
```

The current model tends to flatten these into one summed raw score.

### 4. It Handles Split-Push Better

Opscore v2 has dynamic dominance reweighting:

```text
dominance =
  clamp01((objective_conversion - vision_control) / 1.5)
```

If objective conversion massively exceeds vision control, the Map and Objective artifact shifts weight toward objective conversion:

```text
w_o_prime =
  min(0.90, w_o + 0.25 * dominance)
```

This lets split-push and structure-win games receive proper credit.

### 5. It Uses Overflow Instead Of Hard Artifact Limits

The old hard-cap idea would say:

```text
artifact <= 2
```

Opscore v2 says:

```text
artifact nominal value ~= 2
artifact elite value > 2
artifact soft ceiling = 4.5
```

This creates a mathematical carry-potential mechanic.

### 6. It Avoids Double Counting Derived Fields

Opscore v2 prefers primitive fields and computes ratios directly.

For example, instead of blindly using:

```text
killParticipation
damagePerMinute
teamDamagePercentage
goldPerMinute
visionScorePerMinute
```

it computes:

```text
weighted_takedowns / team_kills
damage / game_minutes
damage / team_damage
gold / game_minutes
vision / game_minutes
```

This keeps the model more transparent and avoids accidentally counting derived Riot metrics twice.

### 7. It Handles Short Games More Safely

Short games can inflate per-minute values.

Opscore v2 adds duration reliability:

```text
R_D = clamp01((game_minutes - 12) / 8)
```

Volatile per-minute scores are pulled toward a neutral value in very short games:

```text
duration_adjusted_score =
  R_D * local_score + (1 - R_D) * 0.70
```

This prevents early surrenders from producing fake extreme scores.

## Example: Quinn Stress Test

On the tested match:

```text
TOP Quinn
40 / 9 / 14
win
```

The refined Opscore v2 scratch run produced:

```text
raw score = 11.72
opscore   = 10.00 capped
```

Artifact breakdown:

```text
Combat Impact:            2.85
Risk Discipline:          1.39
Resource Tempo:           1.57
Map and Objective Control: 3.11
Team Enablement:          2.80
```

Interpretation:

```text
The player delivered elite combat impact and objective pressure.
The 9 deaths lowered Risk Discipline.
The carry-level artifacts were strong enough to reach the final cap.
```

This is the intended behavior: elite performances can exceed nominal artifact values, but the final score remains bounded at `10`.

## Thesis Argument

The current model is useful as a first-generation role-adjusted scoring system, but it remains dataset-relative and partly dependent on broad raw artifact sums.

Opscore v2 is stronger because it is:

```text
local
role-aware
match-context-aware
less dependent on dataset composition
more resistant to short-game distortion
more explicit about death risk
able to represent carry win conditions
```

That makes it a better input for:

```text
assortativity analysis
Flex vs SoloQ comparison
centrality interpretation
future simulation seeding
```

