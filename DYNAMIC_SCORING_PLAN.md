# Match-Based Performance Scoring Reference

## Final Result

The product exposes two player scores:

- `opscore`: the main role-aware performance score on a `0-10` scale
- `feedscore`: a lower-is-better penalty score tied to deaths versus contribution

## Intended Meaning

The goal is to describe **how a player looks across the matches stored in the dataset, in the context of the positions they actually played**.

**Grounding:** Based on the current dataset → this player demonstrates X, Y performance [per role].

This is NOT temporal. We do not track improvement or streaks because match data is collected as fragments, not linearly. Players play multiple roles in their History.

---

## Design Principles

✅ **Included:**
- Match performance analysis
- Role-aware context (from `teamPosition` JSON field)
- Dataset-wide averaging (all matches equally weighted)
- Position-specific expectations

❌ **Excluded:**
- Role confidence estimation (role is explicit in JSON)
- Streak detection (data is non-linear)
- Stability bonuses (we measure capability, not consistency)
- Time decay weighting (all dataset matches equally valid)

---

## Part 1: Role-Specific Implementations

### TOP Lane

**Responsibilities:** Solo lane dominance, duel strength, map control of enemy side, split-push pressure

**Key Attributes:**
- `kills`, `deaths`, `assists` - KDA foundation
- `damagePerMinute` - laning phase damage output
- `damageTakenOnTeamPercentage` - how much they absorb
- `buffsStolen` - dominance over enemy jungler/top (map control assertion)
- `controlWardsPlaced` - map awareness in river/enemy half
- `enemyChampionImmobilizations` - teamfight utility
- `damageDealtToBuildings`, `damageDealtToTurrets` - split-push value
- `killsNearEnemyTurret` - dive statistics
- `takedownsInAlcove` - alcove control
- `wardTakedowns` - vision denial
- `knockEnemyIntoTeamAndKill` - setup plays
- `killingSprees`, `multikills` - decisive moments
- `teamDamagePercentage` - relative impact
- `laneMinionsFirst10Minutes` - early economy
- `firstBloodKill`, `firstTowerKill` - early dominance
- `turretPlatesTaken` - early objective value
- `epicMonsterStolenWithoutSmite` - big + on map control
- `visionScore`, `detectorWardsPlaced` - map awareness
- `win` - match outcome (should have bigger weight)

**Formula Weight Distribution:**
```
TOP_Score = 
  (kda_baseline * 1.1) +                      // Dueling frequent
  (gold_efficiency * 1.05) +                  // Solo economy important
  (map_awareness * 0.9 -with+ buffs * 1.2) + // River control
  (utility_score * 0.6) +                     // Less utility role
  (damage * 1.15 * dpm_factor) +              // Laning phase damage
  (tanking * 1.0) +                           // Standard
  (objectives * 1.2 * turret_focus) +         // Split push valued
  (early_game * 1.05) +                       // Lane pressure
  (win_bonus * 0.25)                          // Outcome weight
```

### JUNGLE

**Responsibilities:** Objective control (dragon/baron/scuttle), ganking, vision clearing, level advantages, soloKills, counter-jungling

**Key Attributes:**
- `kills`, `deaths`, `assists` - KDA (supports solo/gank plays)
- `soloKills` - dueling strength
- `soloBaronKills`, `teamBaronKills` - objective control
- `teamElderDragonKills`, `teamDragonKills` - major objectives
- `voidMonsterKill` - bonus objective
- `takedownsAfterGainingLevelAdvantage` - snowball efficiency
- `wardTakedowns` - **BIGGER WEIGHT** (clearing vision is jungle job)
- `epicMonsterStolenWithoutSmite` - high-value counterplay
- `killAfterHiddenWithAlly` - setup/gank coordination
- `killsOnLanersEarlyJungleAsJungler` - early pressure
- `riftHeraldKills` - structural damage setup
- `scuttleCrabs` - map awareness + early rotation value
- `damagePerMinute` - balanced (not primary like top)
- `goldPerMinute` - typically lower than laners (0.7x multiplier)
- `controlWardsPlaced`, `visionScore` - map control (with ++ for ward clears)
- `detectorWardsPlaced` - counter-warding
- `damageDealtToObjectives` - objective pressure
- `laneMinionsFirst10Minutes` - should be low (jungler job, not CS)
- `firstBloodKill`, `firstBloodAssist` - early game initiation
- `knockEnemyIntoTeamAndKill` - setup plays
- `totalHeal`, `totalDamageShieldedOnTeammates` - some utility
- `win` - outcome weight

**Formula Weight Distribution:**
```
JUNGLE_Score = 
  (kda_baseline * 1.2) +                      // Solo kills/assists critical
  (gold_efficiency * 0.7) +                   // Lower gold income
  (map_awareness * 1.4 * ward_clear_bonus) + // Ward clearing = PRIMARY JOB
  (utility_score * 0.8) +                     // Some support utility
  (damage * 1.0) +                            // Balanced
  (tanking * 0.8) +                           // Should avoid deaths
  (objectives * 1.4 * dragon_baron_weight) +  // Dragon/Baron/Scuttle critical
  (early_game * 1.3 * gank_weight) +          // Early ganks set tempo
  (win_bonus * 0.25)
```

### MIDDLE

**Responsibilities:** Roaming impact, map awareness, balanced damage, lane pressure, occasional rotations to other lanes

**Key Attributes:**
- `kills`, `deaths`, `assists` - KDA (roaming feeds assists)
- `damagePerMinute` - mid-game damage focus
- `goldPerMinute` - mid should secure wave cs
- `visionScore`, `controlWardsPlaced` - roamers need strong vision for rotation timing
- `detectorWardsPlaced` - counter-warding when roaming
- `wardTakedowns` - vision denial during rotations
- `damageDealtToBuildings`, `damageDealtToTurrets` - objective participation
- `killsOnOtherLanesEarlyJungleAsLaner` - **roaming kills on other lanes**
- `takedownsAfterGainingLevelAdvantage` - leverage mid priority
- `physicalDamageDealtToChampions`, `magicDamageDealtToChampions` - both AD/AP viable
- `laneMinionsFirst10Minutes` - CS efficiency early
- `teamDamagePercentage` - relative impact
- `turretTakedowns` - roam follow-up
- `enemyChampionImmobilizations` - mid liners can have utility
- `firstBloodKill`, `firstTowerAssist` - early roam impact
- `skillshotsDodged` - positioning awareness for roaming
- `win` - outcome weight

**Formula Weight Distribution:**
```
MIDDLE_Score = 
  (kda_baseline * 1.0) +                      // Standard participation
  (gold_efficiency * 1.1) +                   // Mid secures wave
  (map_awareness * 1.2 * roam_assist) +       // Roamers need vision
  (utility_score * 1.0) +                     // Balanced
  (damage * 1.05) +                           // Slightly carry lean
  (tanking * 0.8) +                           // Glass cannons
  (objectives * 1.0) +                        // Standard participation
  (early_game * 1.1 * roam_kill_bonus) +      // Mid gauntlet early
  (win_bonus * 0.25)
```

### BOTTOM (ADC)

**Responsibilities:** Gold priority (carry resource), sustained damage in teamfights, positioning safety, dual-lane coordination

**Key Attributes:**
- `kills`, `deaths`, `assists` - KDA (high KDA expected in dual lane)
- `goldPerMinute` - **HIGHEST gold priority role** (1.3x multiplier)
- `goldEarned` - direct resource priority
- `damagePerMinute` - primary DPS source in mid-late game
- `physicalDamageDealtToChampions`, `magicDamageDealtToChampions` - mixed (mainly AD)
- `trueDamageDealtToChampions` - all damage counts
- `visionScore` - **IMPORTANT visibility** (not less than support; if no wards = bad player)
- `controlWardsPlaced`, `wardsPlaced` - safety vision critical
- `visionWardsBoughtInGame` - defensive warding value
- `skillshotsDodged` - positioning safety is measure of skill
- `damageSelfMitigated` - positioning awareness (avoiding damage)
- `teamDamagePercentage` - sustained damage focus
- `killsUnderOwnTurret` - tower defense plays
- `takdowns` - teamfight presence
- `killingSprees` - carry snowballing
- `multiplkills` - teamfight cleanup
- `laneMinionsFirst10Minutes` - early duo lane economy
- `detectorWardsPlaced` - sweeping in duo lane
- `firstBloodKill` - early lane pressure
- `turretPlatesTaken` - bot lane objective value
- `soloKills` - LESS weight (has support, not solo)
- `killsOnOtherLanesEarlyJungleAsLaner` - LESS weight (should focus lane)
- `win` - outcome weight

**Formula Weight Distribution:**
```
BOTTOM_Score = 
  (kda_baseline * 1.2) +                      // High KDA expected
  (gold_efficiency * 1.3) +                   // HIGHEST gold priority
  (map_awareness * 1.1 * vision_not_less) +   // Safety vision critical
  (utility_score * 0.7) +                     // Support job mainly
  (damage * 1.4) +                            // PRIMARY DPS SOURCE
  (tanking * 0.6) +                           // Should avoid damage
  (objectives * 0.9 * turret_plates_weight) + // Less turret focus
  (early_game * 1.0) +                        // Standard early pressure
  (skillshots_dodged * 0.1) +                 // Positioning measure
  (win_bonus * 0.25)
```

### UTILITY (Support)

**Responsibilities:** Vision dominance, peeling, damage mitigation, shield/heal output, ward economy, wards cleared

**Key Attributes:**
- `kills` - **NOT primary** (0.7x in baseline kda)
- `assists` - **PRIMARY contribution** (weighted in baseline)
- `deaths` - LOWER tolerance (0.80x multiplier, expected to die more but still penalized)
- `goldPerMinute` - **NOT important** (0.4x multiplier, lowest gold role)
- `goldSpent` - support spending pattern (wards, support items)
- `visionScore` - **MAXIMUM WEIGHT** (1.8x multiplier)
- `wardsPlaced` - **PRIMARY STAT** (frequent warding)
- `wardsKilled` - vision preservation
- `controlWardsPlaced` - ward economy item usage
- `detectorWardsPlaced` - **BIGGER WEIGHT** (sweeping is support job)
- `visionWardsBoughtInGame` - direct warding investment
- `wardsGuarded` - defense posture
- `wardTakedowns` - **BIGGER WEIGHT** (supporting team's vision clearing)
- `enemyChampionImmobilizations` - **CORE STAT** (CC is primary job)
- `totalDamageShieldedOnTeammates` - **CORE STAT** (peeling/protection)
- `totalHeal` - **CORE STAT** (sustain enabled)
- `damageSelfMitigated` - **CORE STAT** (tanking for team)
- `timeCCingOthers` - teamfight control duration
- `knockEnemyIntoTeamAndKill` - setup plays
- `damageDealtToBuildings` - minimal (not their job)
- `damagePerMinute` - NOT primary (0.5x multiplier)
- `teamDamagePercentage` - enablement role
- `physicalDamageDealtToChampions`, `magicDamageDealtToChampions` - NOT damage role
- `laneMinionsFirst10Minutes` - should be minimal (not CS role)
- `firstBloodAssist` - setup assist
- `win` - outcome weight

**Formula Weight Distribution:**
```
UTILITY_Score = 
  (kda_baseline * 0.7) +                      // Assists weighted in baseline
  (gold_efficiency * 0.4) +                   // Lowest gold role
  (map_awareness * 1.8) +                     // WARD GAME IS PRIMARY
  (utility_score * 1.8) +                     // PEELING/HEALS/SHIELDS CORE
  (damage * 0.5) +                            // NOT a damage role
  (tanking * 1.1) +                           // Stands for team
  (objectives * 0.7) +                        // Not objective focus
  (early_game * 0.8 * setup_bonus) +          // Enables lane
  (win_bonus * 0.25)
```

---

## Part 2: Feedscore By Role

**Per-Match Baseline:**
```
feedscore_base = deaths - (kills + assists) * 0.35
```

**Role-Adjusted Death Tolerance (lower multiplier = kinder penalty):**
```
DEATH_TOLERANCE = {
  TOP:     1.0,      // Standard penalty
  JUNGLE:  1.05,     // Slightly higher risk tolerance
  MIDDLE:  1.0,      // Standard penalty
  BOTTOM:  1.15,     // ADC deaths are more costly (lost resource)
  UTILITY: 0.80      // Support deaths less penalized (expected sacrifice)
}
```

**Applied:**
```
feedscore_adjusted = deaths * DEATH_TOLERANCE[role] - (kills + assists) * 0.35
```

---

## Source of Truth

For detailed formula breakdown and implementation guide, see:
- [docs/dynamic-opscore-system.md](/C:/Users/admin/Downloads/premgraph/premadegraph/docs/dynamic-opscore-system.md)
- [dsopfeed_prompt.md](/C:/Users/admin/Downloads/premgraph/premadegraph/dsopfeed_prompt.md)
