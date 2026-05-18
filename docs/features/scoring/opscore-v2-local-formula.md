# Opscore v2 Local Formula

## Purpose

Opscore v2 is a local, role-aware player performance score on a `0-10` scale.

It is designed to answer:

> Given this player's role, match context, and direct in-game contribution, how well did the player perform in this match?

The score does not depend on the average quality of the current dataset. Dataset averages may still be computed for comparison and diagnostics, but they do not define the grade.

## Final Score

The final score is:

```text
opscore = min(10,
  A_combat
+ A_risk
+ A_resource
+ A_map_objective
+ A_team
)
```

Where:

```text
A_combat        = Combat Impact
A_risk          = Risk Discipline
A_resource      = Resource Tempo
A_map_objective = Map and Objective Control
A_team          = Team Enablement
```

Each artifact has a nominal value around `0-2`, but elite artifacts may exceed `2`. Only the final `opscore` is hard-capped at `10`.

## Core Scoring Curve

For positive metrics where higher is better:

```text
r = x / E_role
m = ((1 - t) / t)^(1 / h)
B(r) = r^h / (r^h + m^h)
S_plus(r) = min(c, B(r) + lambda * ln(max(1, r)))
```

For negative metrics where lower is better:

```text
S_minus(r) = S_plus(1 / r)
```

Recommended constants:

```text
t      = 0.70
h      = 2
lambda = 0.50
c      = 2.20
```

### Parameter Meanings

```text
x
  Observed local metric value.

E_role
  Expected value for the player's role.

r
  Role-normalized performance ratio.
  r = 1 means the player hit the role expectation.
  r > 1 means overperformance.
  r < 1 means underperformance.

t
  Score assigned when r = 1.
  With t = 0.70, expected performance receives 70% of the subcategory score.

h
  Curve sharpness.
  Higher values make the curve punish underperformance and reward overperformance more sharply.

m
  Curve midpoint derived from t and h.

B(r)
  Bounded base curve before elite overflow.

lambda
  Logarithmic overflow strength.
  Larger values reward elite overperformance more aggressively.

c
  Subcategory soft cap.
  This prevents a single raw metric from exploding without limit.
```

## Duration Reliability

Short games can distort per-minute values, especially early surrenders.

Define:

```text
D = game_minutes
R_D = clamp01((D - 12) / 8)
```

So:

```text
D <= 12 minutes -> R_D = 0
D = 15 minutes  -> R_D = 0.375
D >= 20 minutes -> R_D = 1
```

For volatile per-minute metrics:

```text
duration_adjusted_score =
  R_D * local_score + (1 - R_D) * neutral_score
```

Recommended:

```text
neutral_score = 0.70
```

Apply duration adjustment to:

```text
damage_per_min
gold_per_min
objective_damage_per_min
vision_per_min
ward_activity_per_min
cc_volume_per_min
death_rate
dead_time_share
```

Apply it weakly or not at all to concrete win-condition events:

```text
turretTakedowns
inhibitorTakedowns
dragonTakedowns
baronTakedowns
riftHeraldTakedowns
objectivesStolen
soloKills
pickKillWithAlly
saveAllyFromDeath
```

Short games also reduce overflow:

```text
short_game_overflow_factor =
  0.5 + 0.5 * R_D
```

## Artifact Overflow

Each artifact starts from a base value:

```text
A_i_base = 2 * (w1 * S1 + w2 * S2)
```

Then overflow is added:

```text
A_i = min(4.5, A_i_base + alpha_i * short_game_overflow_factor * max(0, A_i_base - 2))
```

Where:

```text
w1, w2
  Role-specific subcategory weights.

S1, S2
  Subcategory scores.

alpha_i
  Artifact-specific overflow strength.

4.5
  Soft artifact ceiling.
  The artifact may exceed its nominal 2-point value, but it cannot dominate without bound.
```

Recommended overflow strengths:

```text
Combat Impact:            alpha = 0.25
Risk Discipline:          alpha = 0.25
Resource Tempo:           alpha = 0.25
Map and Objective Control: alpha = 0.35
Team Enablement:          alpha = 0.20
```

Map and Objective Control receives higher overflow because structure and objective pressure can be a direct win condition.

## Artifact 1: Combat Impact

```text
A_combat_base =
  2 * (w_fc * fight_conversion + w_dp * damage_pressure)

A_combat =
  min(4.5, A_combat_base + 0.25 * short_game_overflow_factor * max(0, A_combat_base - 2))
```

Recommended role weights:

```text
TOP:     w_fc = 0.55, w_dp = 0.45
JUNGLE:  w_fc = 0.55, w_dp = 0.45
MIDDLE:  w_fc = 0.55, w_dp = 0.45
BOTTOM:  w_fc = 0.45, w_dp = 0.55
UTILITY: w_fc = 0.70, w_dp = 0.30
```

### Fight Conversion

```text
weighted_takedowns =
  kills + assists * assist_weight_role

conversion_rate =
  weighted_takedowns / max(1, team_kills)
```

```text
playmaking =
  0.65 * S_plus(soloKills / E_soloKills_role)
+ 0.35 * S_plus(pickKillWithAlly / E_pickKills_role)
```

```text
fight_conversion =
  0.75 * S_plus(conversion_rate / E_kp_role)
+ 0.25 * playmaking
```

### Damage Pressure

```text
damage_per_min =
  totalDamageDealtToChampions / game_minutes

damage_share =
  totalDamageDealtToChampions / max(1, team_totalDamageDealtToChampions)
```

```text
damage_pressure =
  sqrt(
    S_plus(damage_per_min / E_dpm_role)
  * S_plus(damage_share / E_damageShare_role)
  )
```

## Artifact 2: Risk Discipline

```text
A_risk_base =
  2 * (w_dc * death_cost + w_sq * survival_quality)

A_risk =
  min(4.5, A_risk_base + 0.25 * short_game_overflow_factor * max(0, A_risk_base - 2))
```

Recommended role weights:

```text
TOP:     w_dc = 0.65, w_sq = 0.35
JUNGLE:  w_dc = 0.65, w_sq = 0.35
MIDDLE:  w_dc = 0.65, w_sq = 0.35
BOTTOM:  w_dc = 0.75, w_sq = 0.25
UTILITY: w_dc = 0.65, w_sq = 0.35
```

### Death Cost

```text
death_rate =
  deaths / game_minutes

dead_time_share =
  totalTimeSpentDead / game_duration_seconds
```

```text
risk_ratio =
  (
    0.55 * (death_rate / E_deathRate_role)
  + 0.45 * (dead_time_share / E_deadTimeShare_role)
  )
  / (1 + 0.75 * conversion_rate)
```

```text
death_cost =
  S_minus(risk_ratio / 1.0)
```

### Survival Quality

```text
living_ratio =
  longestTimeSpentLiving / game_duration_seconds
```

```text
clutch_survival =
  tookLargeDamageSurvived
+ survivedThreeImmobilizesInFight
+ survivedSingleDigitHpCount
```

```text
survival_quality =
  0.70 * S_plus(living_ratio / E_livingRatio_role)
+ 0.30 * S_plus(clutch_survival / E_clutch_role)
```

## Artifact 3: Resource Tempo

```text
A_resource_base =
  2 * (w_ec * economy + w_tp * tempo)

A_resource =
  min(4.5, A_resource_base + 0.25 * short_game_overflow_factor * max(0, A_resource_base - 2))
```

Recommended role weights:

```text
TOP:     w_ec = 0.55, w_tp = 0.45
JUNGLE:  w_ec = 0.45, w_tp = 0.55
MIDDLE:  w_ec = 0.60, w_tp = 0.40
BOTTOM:  w_ec = 0.70, w_tp = 0.30
UTILITY: w_ec = 0.35, w_tp = 0.65
```

### Economy

```text
gold_per_min =
  goldEarned / game_minutes

spend_efficiency =
  clamp01(goldSpent / max(1, goldEarned))

cs_per_min =
  (totalMinionsKilled + neutralMinionsKilled) / game_minutes
```

```text
economy =
  0.55 * S_plus(gold_per_min / E_gpm_role)
+ cs_weight_role * S_plus(cs_per_min / E_cspm_role)
+ (0.45 - cs_weight_role) * spend_efficiency
```

Recommended:

```text
cs_weight_role = 0.25
cs_weight_UTILITY = 0.05
```

### Tempo

For laners:

```text
tempo =
  0.45 * S_plus(laneMinionsFirst10Minutes / E_cs10_role)
+ 0.35 * I(earlyLaningPhaseGoldExpAdvantage > 0)
+ 0.20 * I(laningPhaseGoldExpAdvantage > 0)
```

Recommended indicator:

```text
I(true)  = 0.90
I(false) = 0.48
```

For jungle:

```text
tempo =
  0.40 * S_plus(jungleCsBefore10Minutes / E_jungleCs10)
+ 0.30 * S_plus(initialCrabCount / E_crabs)
+ 0.30 * S_plus(initialBuffCount / E_buffs)
```

## Artifact 4: Map And Objective Control

```text
A_map_base =
  2 * (w_v_prime * vision_control + w_o_prime * objective_conversion)

A_map_objective =
  min(4.5, A_map_base + 0.35 * short_game_overflow_factor * max(0, A_map_base - 2))
```

Default role weights:

```text
TOP:     w_v = 0.35, w_o = 0.65
JUNGLE:  w_v = 0.30, w_o = 0.70
MIDDLE:  w_v = 0.45, w_o = 0.55
BOTTOM:  w_v = 0.35, w_o = 0.65
UTILITY: w_v = 0.70, w_o = 0.30
```

### Objective Dominance Reweighting

This lets split-push and objective-carry games receive proper credit.

```text
dominance =
  clamp01((objective_conversion - vision_control) / 1.5)
```

```text
w_o_prime =
  min(0.90, w_o + 0.25 * dominance)

w_v_prime =
  1 - w_o_prime
```

### Vision Control

```text
vision_per_min =
  visionScore / game_minutes
```

```text
ward_activity_per_min =
  (wardsPlaced + wardsKilled + detectorWardsPlaced + controlWardsPlaced)
  / game_minutes
```

```text
vision_control =
  0.70 * S_plus(vision_per_min / E_visionPm_role)
+ 0.20 * S_plus(ward_activity_per_min / E_wardPm_role)
+ 0.10 * clamp01(controlWardTimeCoverageInRiverOrEnemyHalf)
```

### Objective Conversion

```text
objective_damage_per_min =
  damageDealtToObjectives / game_minutes
```

```text
epic_participation =
  dragonTakedowns
+ 1.5 * baronTakedowns
+ riftHeraldTakedowns
+ 2 * objectivesStolen
```

```text
structure_conversion =
  turretTakedowns + 1.5 * inhibitorTakedowns
```

```text
objective_conversion =
  0.40 * S_plus(objective_damage_per_min / E_objDpm_role)
+ 0.35 * S_plus(epic_participation / E_epic_role)
+ 0.25 * S_plus(structure_conversion / E_structure_role)
```

## Artifact 5: Team Enablement

```text
A_team_base =
  2 * (w_sc * setup_control + w_ps * protection_support)

A_team =
  min(4.5, A_team_base + 0.20 * short_game_overflow_factor * max(0, A_team_base - 2))
```

Recommended role weights:

```text
TOP:     w_sc = 0.90, w_ps = 0.10
JUNGLE:  w_sc = 0.90, w_ps = 0.10
MIDDLE:  w_sc = 0.85, w_ps = 0.15
BOTTOM:  w_sc = 0.80, w_ps = 0.20
UTILITY: w_sc = 0.55, w_ps = 0.45
```

### Setup Control

```text
cc_volume_per_min =
  (enemyChampionImmobilizations + 0.25 * timeCCingOthers)
  / game_minutes
```

```text
cc_conversion =
  immobilizeAndKillWithAlly + knockEnemyIntoTeamAndKill
```

```text
setup_control =
  0.55 * S_plus(cc_volume_per_min / E_ccPm_role)
+ 0.45 * S_plus(cc_conversion / E_ccConversion_role)
```

### Protection Support

Preferred:

```text
ally_protection =
  effectiveHealAndShielding
```

Fallback:

```text
ally_protection =
  totalDamageShieldedOnTeammates + totalHealsOnTeammates
```

```text
protection_support =
  0.75 * S_plus((ally_protection / game_minutes) / E_protectionPm_role)
+ 0.25 * S_plus(saveAllyFromDeath / E_saves_role)
```

## Feedscore Retirement

There is no standalone feedscore formula in Opscore v2.

The old feedscore idea becomes a derived interpretation of Risk Discipline.

```text
feed_risk =
  clamp(0, 10, 10 - 5 * A_risk)
```

```text
feed_discipline =
  10 - feed_risk
```

This removes the old formula:

```text
deaths - (kills + assists) * 0.35
```

and replaces it with a role-aware, time-aware, contribution-aware risk model.

