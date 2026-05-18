# Tribe 397 Victory Run - 2026-05-18

## Overview

This Tribal NeuroSim v3 run produced one of the strongest validation outcomes so far: a full 599-tribe world converged to a single surviving empire after **7,758 decisive combat ticks** and continued to a logged single-tribe state at tick **7,800**.

**Winner:** Tribe 397 - `Empire` tier - final map control - selected population 2,681,596 at tick 7,764

The decisive final opponent was **Tribe 269**. The run is especially useful because the final duel was not a simple runaway from the largest territorial empire. Tribe 269 entered the final phase with the larger territory block, but Tribe 397 survived repeated defensive tests, expanded through opportunistic wars, and won the direct 397-vs-269 war.

---

## Source Material

| Source | Value |
|---|---|
| Log file | `backend/genetic-neurosim/logs/518run.txt` |
| Run timestamp | 2026-05-18 22:11:38 to 22:31:07 |
| Logged final state | tick 7,800, alive=1 |
| Client validation captures | tick 7,692 and tick 7,764 screenshots |
| Architecture | Rust backend + C# MonoGame client |
| Simulation version shown in client | Tribal NeuroSim v3 |

The log records a single surviving tribe at tick 7,800:

```text
[SIM tick=7800] alive=1 tiles=51391 max_tile=51391 avg_pop=5305532 wars_active=0
```

The client capture shortly after the final victory shows Tribe 397 selected at tick 7,764 with 51,390 tiles, confirming practical full-map control.

---

## Run Parameters Inferred From The Run

| Parameter | Value |
|---|---|
| Starting tribe count | 599 |
| Final surviving tribe | Tribe 397 |
| Final opposing tribe | Tribe 269 |
| Final logged tick | 7,800 |
| Final logged map control | 51,391 tiles |
| Final logged active wars | 0 |
| Final polity distribution | Empire:1 |

---

## Timeline

### Tick 50-900 - Early Collapse Into Contenders

The world began with rapid local war and consolidation. By tick 50, 557 tribes were still alive, but early eliminations were already frequent. By tick 900, the world had fallen to 277 tribes, with 105 empires already present.

Important macro markers:

| Tick | Alive | Tiles | Max tile | Empire count |
|---|---:|---:|---:|---:|
| 50 | 557 | 1,684 | 10 | 0 |
| 250 | 462 | 5,117 | 101 | 1 |
| 500 | 410 | 8,360 | 159 | 33 |
| 900 | 277 | 12,455 | 304 | 105 |

This was not a slow start. The simulation quickly created many empire-tier candidates rather than one early runaway.

### Tick 964-1806 - Both Finalists Prove Defensive Staying Power

Before the endgame, both final tribes were attacked and survived.

Tribe 397 defensive wins:

| Tick | Event |
|---|---|
| 975 | Tribe 448 defeated by Tribe 397 |
| 1,284 | Tribe 228 defeated by Tribe 397 |
| 1,647 | Tribe 473 defeated by Tribe 397 |

Tribe 269 defensive wins:

| Tick | Event |
|---|---|
| 213 | Tribe 292 defeated by Tribe 269 |
| 1,641 | Tribe 317 defeated by Tribe 269 |
| 1,806 | Tribe 145 defeated by Tribe 269 |

The important story here is that neither finalist survived by avoiding contact entirely. Both had already demonstrated that they could absorb attacks before the late-game empire phase.

### Tick 5,000-6,900 - Late Empire Plateau

The run entered a long plateau where every survivor was already an empire. At tick 5,000, 35 empires remained. From tick 5,200 through 6,900, the world stabilized in the low twenties, with many ticks having zero active wars.

This is the period where the run becomes more interesting than a pure combat cascade. The final winner needed not only combat output, but also enough food, settlement stability, and patience to survive the long empire standoff.

Tribe 397 won a major defensive test during this period:

```text
[WAR tick=5041] tribe_153 declares war on tribe_397
[WAR tick=5151] tribe_153 defeated by tribe_397 (defender won)
```

Then, shortly before the final cascade, Tribe 397 defended again:

```text
[WAR tick=6944] tribe_249 declares war on tribe_397
[WAR tick=7047] tribe_249 defeated by tribe_397 (defender won)
```

### Tick 7,080-7,300 - The Endgame Ignites

At tick 7,080 the simulation generated a cluster of opportunity wars. Tribe 397 entered the endgame actively:

```text
[OPPORTUNITY WAR tick=7080] tribe_397 -> tribe_373 (raid=0.14 aggr=0.13)
[WAR tick=7095] tribe_397 defeated tribe_373 (attacker won)
```

This kicked off the collapse from 20 living empires at tick 7,050 to 14 at tick 7,100. Tribe 397 then removed another major rival:

```text
[WAR tick=7200] tribe_397 defeated tribe_389 (attacker won)
```

By tick 7,300, only 6 empires remained.

### Tick 7,320-7,650 - Tribe 269 Becomes The Giant, Tribe 397 Becomes The Cleaner

At tick 7,320, multiple empires targeted Tribe 269, including Tribe 397:

```text
[OPPORTUNITY WAR tick=7320] tribe_239 -> tribe_269
[OPPORTUNITY WAR tick=7320] tribe_306 -> tribe_269
[OPPORTUNITY WAR tick=7320] tribe_363 -> tribe_269
[OPPORTUNITY WAR tick=7320] tribe_380 -> tribe_269
[OPPORTUNITY WAR tick=7320] tribe_397 -> tribe_269
```

This is the decisive setup. Tribe 269 was not passively waiting for the final duel. It was the center of a multi-front endgame and won several of those fights:

| Tick | Tribe 269 event |
|---|---|
| 7,389 | defeated Tribe 363 |
| 7,440 | defeated Tribe 306 |
| 7,620 | defeated Tribe 239 |

Those victories made Tribe 269 enormous. At tick 7,650 the log shows only two tribes left, with the largest empire holding 35,309 tiles:

```text
[SIM tick=7650] alive=2 tiles=51384 max_tile=35309 avg_pop=4715616 wars_active=0
```

The screenshots at tick 7,692 confirm that the largest block was Tribe 269:

| Metric at tick 7,692 | Tribe 397 | Tribe 269 |
|---|---:|---:|
| Population | 3,454,057 | 3,210,536 |
| Food | 3,990,767 | 5,031,278 |
| Territory | 16,078 tiles | 35,310 tiles |
| Fitness | 0.72 | 0.59 |
| Behavior | Supply | Pathfinders |
| Focus | Resource | MapObjective |
| Resource artifact | 0.95 | 0.81 |
| Map objective artifact | 0.78 | 0.95 |
| Isolation drive | 0.65 | 0.87 |

This is the core tension of the run: **269 had territory and food mass, but 397 had better selected fitness and a stronger resource/supply posture.**

### Tick 7,650-7,758 - Final Duel

The final duel was already prepared by the tick 7,320 opportunity war where Tribe 397 targeted Tribe 269. Tribe 269 later also targeted Tribe 397:

```text
[OPPORTUNITY WAR tick=7680] tribe_269 -> tribe_397 (raid=0.12 aggr=0.15)
```

The decisive result followed:

```text
[WAR tick=7758] tribe_397 defeated tribe_269 (attacker won)
```

The "attacker won" tag is important because Tribe 397 had initiated a war against Tribe 269 earlier in the final-six phase. Tribe 269 may have had the larger territory block, but Tribe 397 was not merely defending the final duel; it had already selected 269 as the terminal target.

### Tick 7,764-7,800 - Full-Map Control

After defeating Tribe 269, Tribe 397 became the only surviving empire. The client capture at tick 7,764 shows:

| Final selected metric | Tribe 397 |
|---|---:|
| Population | 2,681,596 |
| Food | 4,498,587 |
| Territory | 51,390 tiles |
| Fitness | 0.63 |
| Polity | Empire |
| Wars | 157 |
| Active enemies | 0 |
| Tombstones | 0 |

The log then records the stable one-tribe state at tick 7,800:

```text
[SIM tick=7800] alive=1 tiles=51391 max_tile=51391 avg_pop=5305532 wars_active=0
```

---

## Why Tribe 397 Defeated Tribe 269

Tribe 397 won because it combined three advantages at the exact moment the simulation narrowed to the final empires.

First, Tribe 397 had already proven it could survive incoming pressure. It defeated attacks from Tribe 448, 228, 473, 153, and 249 before the final cascade. That matters because the final phase was not a clean one-on-one tournament; surviving opportunistic attacks was part of reaching the duel.

Second, Tribe 397 entered the final phase as a resource/supply empire rather than a pure map-objective empire. At tick 7,692, Tribe 269 held much more territory and more stored food, but Tribe 397 had higher selected fitness (0.72 vs 0.59), Supply behavior, Resource focus, and a stronger Resource artifact (0.95 vs 0.81). The screenshot implies that 397 was a smaller but healthier empire when the last two powers were visible.

Third, Tribe 269 had to spend the final stretch absorbing multiple opponents. Between ticks 7,320 and 7,620, 269 was targeted by 239, 306, 363, 380, and 397. It beat 363, 306, and 239, which made it territorially dominant, but those wars also left it inside the hottest part of the endgame. Tribe 397, meanwhile, removed 373, 389, 470, and 380, then resolved the already-open 397-vs-269 war.

In story terms: **Tribe 269 became the giant; Tribe 397 became the executioner.**

---

## Winner Profile - Tribe 397

| Metric | Value |
|---|---:|
| Final polity tier | Empire |
| Final selected territory | 51,390 tiles |
| Final logged max tile | 51,391 tiles |
| Final selected population | 2,681,596 |
| Final selected food | 4,498,587 |
| Final selected fitness | 0.63 |
| Wars recorded in client | 157 |
| Final active enemies | 0 |

### Dataset Identity Discovery

After the run, Tribe 397 was traced back through the NeuroSim cluster export. The simulation uses zero-based tribe indexes, while the exported cluster ids are one-based in the `rust_pathfinding` namespace. Therefore:

```text
tribe_397 -> clusters[397] -> rust_pathfinding:398
```

The source cluster comes from:

```text
backend/data/databases/flexset/playersrefined.db
backend/genetic-neurosim/backend/flexset-clusters.json
```

This cluster contains exactly two player profiles. The public Riot IDs are intentionally omitted from this documentation; the stable identifiers are retained as PUUIDs for reproducibility.

| Player label | PUUID | Dataset detected role | Manual context | Opscore | Feedscore | Matches processed |
|---|---|---|---|---:|---:|---:|
| Player A | `C9DYbuCPKZUNus9NJBM0yPqtCyvt7dtAjJ_I38VmbKafCH9O6d8MbDqrNM8iGfElOlVMAak5zyEPxA` | MIDDLE | Known ADC/carry player outside this dataset | 7.40 | 2.11 | 3 |
| Player B | `YJbOqnJuIeVXrK0bMKimpuNGe0n4EnzLuFJhhZBy0uRUQHJlrQsFpr2AGmOAjEVOSbI9bkhwiPkMXQ` | UTILITY | Support duo | 7.07 | 1.44 | 3 |

The cluster aggregate was:

| Cluster metric | Value |
|---|---:|
| Cluster id | `rust_pathfinding:398` |
| Cluster size | 2 |
| Mean opscore | 7.235 |
| Mean feedscore | 1.775 |
| Opscore rank among size >= 2 clusters | 154 / 599 |
| Low-feed rank among size >= 2 clusters | 19 / 599 |
| Economy artifact average | 42.422 |
| Utility artifact average | 63.478 |

This is the most important post-run discovery: **the winning empire was seeded by a tiny high-skill duo cluster, not by a large community cluster.** The dataset profile is not the absolute highest opscore seed, but it is an unusually clean combination of high performance, very low feed risk, and strong resource/utility signals.

The player context is especially interesting because Player A was later identified manually as a Season 13 Challenger peak ADC/carry player, while this specific dataset detected Player A primarily as `MIDDLE` across the three processed matches. Player B was manually identified as the support duo and a Master peak player. That external lookup should be treated as qualitative context, not as a database-derived claim, but it makes the simulation result much more interpretable: NeuroSim elevated a compact elite carry-support duo into a dominant civilization seed.

### Flex Match Evidence For The Tribe 397 Seed

The two players appeared together in exactly three Flex match files in this dataset:

```text
backend/data/matches/flexset/EUN1_3943185685.json
backend/data/matches/flexset/EUN1_3943530074.json
backend/data/matches/flexset/EUN1_3943606498.json
```

All three matches were wins.

| Match | Player label | Role | Champion | K / D / A | Damage | Gold | CS | Vision |
|---|---|---|---|---:|---:|---:|---:|---:|
| `EUN1_3943185685` | Player A | BOTTOM | Ashe | 4 / 6 / 13 | 29,932 | 15,356 | 283 | 31 |
| `EUN1_3943185685` | Player B | UTILITY | Nami | 5 / 6 / 17 | 12,142 | 10,837 | 31 | 115 |
| `EUN1_3943530074` | Player A | MIDDLE | Galio | 9 / 6 / 12 | 36,648 | 16,886 | 293 | 17 |
| `EUN1_3943530074` | Player B | UTILITY | Janna | 4 / 9 / 27 | 13,389 | 12,673 | 47 | 160 |
| `EUN1_3943606498` | Player A | MIDDLE | Xerath | 10 / 1 / 15 | 29,590 | 11,932 | 216 | 15 |
| `EUN1_3943606498` | Player B | BOTTOM | Jinx | 11 / 4 / 12 | 21,588 | 11,410 | 123 | 25 |

Team outcomes for those matches:

| Match | Team kills | Enemy kills | Dragons | Towers | Inhibitors |
|---|---:|---:|---:|---:|---:|
| `EUN1_3943185685` | 36 | 29 | 3 | 8 | 1 |
| `EUN1_3943530074` | 49 | 46 | 4 | 12 | 5 |
| `EUN1_3943606498` | 36 | 17 | 3 | 5 | 1 |

The match evidence explains why the profile converted so well into NeuroSim terms:

- Player A contributed carry-level damage and farm across the sampled games, including an Ashe bottom win and a 10 / 1 / 15 Xerath mid game.
- Player B contributed extremely high support utility in the support games, with 115 and 160 vision score in the two long wins.
- The duo profile was flexible: the same two-player seed included Ashe/Nami bottom lane, Galio/Janna mid-support, and Xerath/Jinx carry distribution.
- Their aggregate feed risk was low, especially for `uni#nxc`, whose feedscore was 1.44.
- The cluster was small, cohesive, and efficient rather than large, noisy, or high-variance.

In simulation-story terms, Tribe 397 was not just "a random winner." It was a micro-empire seeded from an elite ADC/support-style duo profile: enough combat output to win fights, enough economy/resource signal to scale, and enough utility/support signal to stabilize under pressure.

### Runner-Up Dataset Identity - Tribe 269

The final opponent was also traced back through the NeuroSim cluster export:

```text
tribe_269 -> clusters[269] -> rust_pathfinding:270
```

The public Riot IDs are intentionally omitted here as well. The stable PUUIDs are retained for reproducibility.

| Player label | PUUID | Dataset detected role | Opscore | Feedscore | Matches processed |
|---|---|---|---:|---:|---:|
| Player C | `6XtAvVyCs2XQOjxQgh9HYGTLcMlEm_jKXYxwaz-6scjX0BFVVULlyflktbMO7T79mg-JvhX5fWxn5g` | BOTTOM | 5.71 | 7.75 | 2 |
| Player D | `DzqPPTpXM0AYKG1OD5S6Z4rRobbUmQH_a_JOn7vGcJoX9_T4o-onq9lOP_hMShNib6obbKXK75VUGg` | JUNGLE | 7.66 | 7.15 | 2 |
| Player E | `zC6M25-xTuggckbznnye0R36UmeL3k3Wuj8RHQYuOE3Hxx3cW9jNmiWQ4U8NxnnJZ-O6UBZq82Fj_Q` | UTILITY | 1.14 | 4.50 | 2 |

The cluster aggregate was:

| Cluster metric | Value |
|---|---:|
| Cluster id | `rust_pathfinding:270` |
| Cluster size | 3 |
| Mean opscore | 4.837 |
| Mean feedscore | 6.467 |
| Opscore rank among size >= 2 clusters | 472 / 599 |
| Low-feed rank among size >= 2 clusters | 345 / 599 |
| Economy artifact average | 31.794 |
| Utility artifact average | 58.354 |
| Tanking artifact average | 38.977 |

This makes Tribe 269 very different from Tribe 397. Tribe 397 was a compact, clean, low-feed seed. Tribe 269 was a volatile three-player seed: one strong jungle/carry profile, one high-damage bottom profile, and one low-opscore support profile, with much higher feed risk overall.

The cluster appeared in exactly two Flex match files:

```text
backend/data/matches/flexset/EUN1_3936149010.json
backend/data/matches/flexset/EUN1_3943581528.json
```

The match evidence shows the volatility clearly:

| Match | Player label | Role | Champion | Result | K / D / A | Damage | Gold | CS | Vision |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| `EUN1_3936149010` | Player D | JUNGLE | Nocturne | Loss | 2 / 6 / 1 | 6,228 | 5,474 | 94 | 13 |
| `EUN1_3936149010` | Player C | BOTTOM | Corki | Loss | 1 / 9 / 2 | 10,659 | 4,634 | 94 | 6 |
| `EUN1_3936149010` | Player E | UTILITY | Yuumi | Loss | 0 / 7 / 3 | 3,493 | 3,506 | 11 | 6 |
| `EUN1_3943581528` | Player D | JUNGLE | Sejuani | Win | 8 / 6 / 11 | 22,540 | 15,076 | 226 | 37 |
| `EUN1_3943581528` | Player C | BOTTOM | Corki | Win | 22 / 7 / 7 | 63,400 | 18,553 | 212 | 39 |
| `EUN1_3943581528` | Player E | UTILITY | Yuumi | Win | 1 / 7 / 31 | 15,542 | 11,205 | 18 | 40 |

Team outcomes:

| Match | Result | Team kills | Enemy kills | Dragons | Towers | Inhibitors |
|---|---|---:|---:|---:|---:|---:|
| `EUN1_3936149010` | Loss | 6 | 25 | 0 | 0 | 0 |
| `EUN1_3943581528` | Win | 47 | 38 | 3 | 12 | 6 |

This explains why Tribe 269 reached the final two in a different way than Tribe 397. The seed profile was not clean or consistently elite, but it had a much more explosive ceiling. In the winning sampled match, Player C produced a 22-kill Corki game with 63,400 champion damage, Player D supplied jungle/frontline pressure on Sejuani, and Player E supplied a 31-assist Yuumi support pattern.

That high-variance profile matches Tribe 269's simulation story. Near the end, Tribe 269 became the largest territorial empire and absorbed multiple opponents, but its selected fitness was lower than Tribe 397's at tick 7,692. In short:

> Tribe 269 was the high-variance conqueror. Tribe 397 was the cleaner finisher.

### Neural And Artifact Signature

From the tick 7,764 winner capture:

| Signal | Value |
|---|---:|
| Combat artifact | 0.66 |
| Resource artifact | 0.95 |
| Map objective artifact | 0.78 |
| Risk artifact | 0.89 |
| Team artifact | 0.71 |
| Aggression drive | 0.13 |
| Resource drive | 0.14 |
| Goal drive | 0.14 |
| Migration drive | 0.49 |
| Raid drive | 0.13 |
| Isolation drive | 0.80 |
| Expansion drive | 0.23 |

This is a very distinctive winner. Tribe 397 was not the most obviously aggressive tribe. Its raid and aggression values were low, but it had strong risk tolerance, strong resource capability, and enough isolation to avoid dependence on alliances. The outcome looks less like berserker conquest and more like durable empire management followed by precise late wars.

---

## Endgame Elimination Chain

The final collapse from 20 empires to 1 happened extremely quickly:

| Tick | Alive | Key event |
|---|---:|---|
| 7,050 | 20 | Tribe 249 had just been defeated by Tribe 397 |
| 7,095 | 14 | Tribe 397 defeated Tribe 373 |
| 7,140 | 11 | Tribe 269 defeated Tribe 155 |
| 7,200 | 10 | Tribe 397 defeated Tribe 389 |
| 7,266 | 8 | Tribe 397 defeated Tribe 470; Tribe 269 also had a claim against 470 |
| 7,300 | 6 | Six empires remained |
| 7,389 | 5 | Tribe 269 defeated Tribe 363 |
| 7,440 | 4 | Tribe 269 defeated Tribe 306 |
| 7,563 | 3 | Tribe 397 defeated Tribe 380 |
| 7,620 | 2 | Tribe 269 defeated Tribe 239 |
| 7,758 | 1 | Tribe 397 defeated Tribe 269 |

This sequence is almost ideal for validation storytelling: both finalists are active, both eliminate strong rivals, and the final winner is decided by a direct logged combat result rather than an unexplained disappearance.

---

## Validation Notes

| Check | Result |
|---|---|
| Full run reached one survivor | Passed |
| Winner visible in client | Passed |
| Final opponent identifiable | Passed |
| Final decisive combat event logged | Passed |
| Final active wars reached zero | Passed |
| Endgame story reconstructable from log | Passed |
| Screenshot state agrees with log direction | Passed |

No obvious late-game liveness failure appears in this run. The simulation reached a stable one-empire end state, and the final winner is explainable from the logged war chain.

One caveat: early in the log, some reciprocal low-tick wars contain paired "attacker won" and "defender won" records for the same neighboring tribes. The final 397-vs-269 sequence is much cleaner and has a single decisive terminal result, so this does not undermine the endgame interpretation, but it is worth keeping in mind when using early-war counts as exact statistics.

---

## Other Interesting Fumbled Tribes

### Tribe 380 - The Glass Cannon Contender

Tribe 380 is one of the most interesting non-finalists in the run because its exported profile looked strong enough to plausibly win under a different endgame geometry:

```text
tribe_380 -> clusters[380] -> rust_pathfinding:381
```

The public Riot IDs are intentionally omitted here. The stable PUUIDs are retained for reproducibility.

| Player label | PUUID | Dataset detected role | Opscore | Feedscore | Matches processed |
|---|---|---|---:|---:|---:|
| Player F | `0vbuXR6-ut_sU-JGkLsJkiZD70qpaAINhDBdeIf83znFcgfxirMEKMcmRfKwwaFU1Ky0iH_BnNsqdw` | BOTTOM | 9.00 | 6.61 | 2 |
| Player G | `xRcjcBaNY00glLGmSzony7KYgCxlveAKg0QnxGksxrQS0r2giWQ1RwZdJJRK4O6DbQ84V1tmvUInHw` | UTILITY | 10.00 | 4.25 | 2 |

Cluster profile:

| Cluster metric | Value |
|---|---:|
| Cluster id | `rust_pathfinding:381` |
| Cluster size | 2 |
| Mean opscore | 9.50 |
| Feed risk | 5.43 |
| Combat artifact | 0.7583 |
| Resource artifact | 0.7231 |
| Map objective artifact | 0.6313 |
| Team artifact | 1.00 |

The match evidence shows why this tribe was dangerous but unstable:

| Match | Player label | Role | Champion | Result | K / D / A | Damage | Gold | CS | Vision |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| `EUN1_3937301168` | Player F | BOTTOM | Yasuo | Win | 19 / 9 / 4 | 56,038 | 18,281 | 232 | 6 |
| `EUN1_3937301168` | Player G | UTILITY | Nautilus | Win | 0 / 10 / 24 | 15,524 | 10,056 | 19 | 58 |
| `EUN1_3943067239` | Player F | BOTTOM | Hwei | Loss | 21 / 9 / 7 | 66,028 | 22,274 | 317 | 15 |
| `EUN1_3943067239` | Player G | UTILITY | Nautilus | Loss | 2 / 10 / 24 | 19,370 | 11,600 | 38 | 106 |

Team outcomes:

| Match | Result | Team kills | Enemy kills | Dragons | Towers | Inhibitors |
|---|---|---:|---:|---:|---:|---:|
| `EUN1_3937301168` | Win | 45 | 32 | 3 | 10 | 2 |
| `EUN1_3943067239` | Loss | 39 | 46 | 1 | 6 | 1 |

Tribe 380's run path:

| Tick | Event |
|---|---|
| 7,089 | Tribe 380 defeated Tribe 272 |
| 7,215 | Tribe 380 defeated Tribe 403 |
| 7,320 | Tribe 380 targeted Tribe 269 |
| 7,500 | Tribe 380 targeted Tribe 269 again |
| 7,563 | Tribe 397 defeated Tribe 380 |

This tribe had huge carry pressure and strong duo synergy, but the seed profile was bloody. The bottom/carry player produced enormous damage and kill counts, while the support profile produced heavy assist and vision numbers but also very high deaths. That likely translated into a simulation tribe with enough force to reach the final four, but not enough stability to survive the cleanest late-game empire.

In short:

> Tribe 380 had finalist-level firepower, but not finalist-level survivability.

### Tribe 389 - The Clean Macro Rival

Tribe 389 is interesting because it looked less volatile than Tribe 380 and more like a clean objective-control contender:

```text
tribe_389 -> clusters[389] -> rust_pathfinding:390
```

The public Riot IDs are intentionally omitted here. The stable PUUIDs are retained for reproducibility.

| Player label | PUUID | Dataset detected role | Opscore | Feedscore | Matches processed |
|---|---|---|---:|---:|---:|
| Player H | `jQUyXkviiZPSpeNvdJLWADxilcxSNybPPNYYT-6pM71Ws8k2KacHqkPaE4XYKZjH1xlEPz6aPaOnbA` | TOP | 10.00 | 0.68 | 2 |
| Player I | `YQZX1xwqkLiTrKUE15aRkzn2d0Du1hAaJcjdFlVZDvNpm3dJCP4xTHHQJvUSRlnO4m9_tWAVkkmA8A` | UTILITY | 7.13 | 4.47 | 2 |

Cluster profile:

| Cluster metric | Value |
|---|---:|
| Cluster id | `rust_pathfinding:390` |
| Cluster size | 2 |
| Mean opscore | 8.565 |
| Feed risk | 2.575 |
| Combat artifact | 0.6998 |
| Resource artifact | 0.7004 |
| Map objective artifact | 0.8596 |
| Team artifact | 0.4907 |

The match evidence shows a cleaner and more macro-oriented profile than Tribe 380:

| Match | Player label | Role | Champion | Result | K / D / A | Damage | Gold | CS | Vision |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| `EUN1_3942688095` | Player H | TOP | Volibear | Win | 14 / 3 / 10 | 55,153 | 21,101 | 293 | 31 |
| `EUN1_3942688095` | Player I | UTILITY | Pyke | Win | 8 / 10 / 6 | 14,512 | 12,091 | 55 | 104 |
| `EUN1_3942951474` | Player I | JUNGLE | Nunu | Win | 5 / 4 / 19 | 12,006 | 12,475 | 216 | 25 |
| `EUN1_3942951474` | Player H | BOTTOM | Ezreal | Win | 18 / 5 / 6 | 36,884 | 16,300 | 219 | 21 |

Team outcomes:

| Match | Result | Team kills | Enemy kills | Dragons | Towers | Inhibitors |
|---|---|---:|---:|---:|---:|---:|
| `EUN1_3942688095` | Win | 42 | 46 | 4 | 10 | 2 |
| `EUN1_3942951474` | Win | 43 | 24 | 4 | 9 | 1 |

Tribe 389's late run path:

| Tick | Event |
|---|---|
| 5,514 | Tribe 389 defeated Tribe 586 |
| 7,001 | Tribe 74 declared war on Tribe 389 |
| 7,080 | Tribe 389 defeated Tribe 74 |
| 7,140 | Tribe 389 targeted Tribe 397 |
| 7,200 | Tribe 397 defeated Tribe 389 |

This tribe had the profile of a real late-game threat: high opscore, low feed risk, strong resource signal, and the strongest map-objective artifact among the highlighted fumbled tribes so far. It did not appear to be a reckless glass cannon. Its problem was timing and target selection. It entered the final cascade by beating Tribe 74, then immediately targeted Tribe 397, the eventual winner, and was removed at tick 7,200.

In short:

> Tribe 389 looked like a clean macro contender, but it challenged the final winner too early and got erased before its objective profile could matter.

### Early Negative Edge Cases - Weak Seeds That Collapsed Fast

The run also produced useful negative validation cases. These tribes exited early and their exported profiles explain why: low measured opscore, high feed risk, weak combat conversion, weak objective pressure, or some combination of those traits.

This section should be interpreted carefully. These are **weak dataset profiles**, not permanent judgments about the real players. A small Flex sample can capture unlucky games, off-role games, tilt games, or bad matchmaking. NeuroSim only receives the profile extracted from the dataset, so the claim is limited to:

> Given the profile observed in this dataset, these tribes had poor simulation survival traits.

| Tribe | Cluster | Eliminated | Killer | Size | Mean opscore | Feed risk | Combat | Resource | Map objective | Why the seed was fragile |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| 537 | `rust_pathfinding:538` | tick 462 | Tribe 562 | 2 | 0.40 | 7.32 | 0.20 | 0.49 | 0.13 | Almost no performance signal; high feed; no objective profile. |
| 343 | `rust_pathfinding:344` | tick 489 | Tribe 368 | 2 | 1.14 | 8.71 | 0.27 | 0.53 | 0.20 | Double jungle-detected profile with very high feed risk. |
| 523 | `rust_pathfinding:524` | tick 255 | Tribe 547 | 2 | 1.48 | 7.04 | 0.32 | 0.72 | 0.23 | Low-opscore mid/bottom seed with no strong carry anchor. |
| 563 | `rust_pathfinding:564` | tick 261 | Tribe 564 | 2 | 2.68 | 8.94 | 0.27 | 0.55 | 0.21 | High-feed profile with weak combat and map pressure. |
| 407 | `rust_pathfinding:408` | tick 123 | Tribe 408 | 2 | 3.75 | 8.05 | 0.32 | 0.50 | 0.41 | Bottom/utility seed with poor survival traits. |
| 281 | `rust_pathfinding:282` | tick 222 | Tribe 230 | 3 | 4.10 | 9.01 | 0.21 | 0.52 | 0.26 | One decent member, but the cluster had a severe feed-risk leak. |

Member-level evidence:

| Tribe | Player label | Dataset role | Opscore | Feedscore | Matches processed |
|---|---|---|---:|---:|---:|
| 537 | Player J | JUNGLE | 0.00 | 7.21 | 3 |
| 537 | Player K | MIDDLE | 0.79 | 7.43 | 3 |
| 343 | Player L | JUNGLE | 0.38 | 6.78 | 2 |
| 343 | Player M | JUNGLE | 1.91 | 10.00 | 3 |
| 523 | Player N | MIDDLE | 1.92 | 7.11 | 5 |
| 523 | Player O | BOTTOM | 1.04 | 6.95 | 4 |
| 563 | Player P | JUNGLE | 3.25 | 7.88 | 2 |
| 563 | Player Q | MIDDLE | 2.11 | 10.00 | 2 |
| 407 | Player R | UTILITY | 3.28 | 7.41 | 2 |
| 407 | Player S | BOTTOM | 4.22 | 8.69 | 2 |
| 281 | Player T | UTILITY | 5.14 | 7.80 | 2 |
| 281 | Player U | BOTTOM | 0.75 | 10.00 | 2 |
| 281 | Player V | TOP | 6.40 | 9.22 | 2 |

The cleanest negative case is Tribe 537. It combined a 0.40 mean opscore, 7.32 feed risk, 0.20 combat artifact, and 0.13 map-objective artifact. In simulation terms, that is almost the opposite of Tribe 397: little combat output, poor safety, and no strong macro identity. Its early elimination is therefore not surprising and supports the validation story that NeuroSim is responding to the seeded profile rather than picking winners arbitrarily.

The more nuanced negative case is Tribe 281. It was not uniformly hopeless: one member had a 6.40 opscore and another had a 5.14 opscore. But the cluster-level feed risk was 9.01, including one 0.75 opscore / 10.00 feedscore bottom profile. That makes it a good example of a profile where one or two usable signals could not compensate for a structural survival leak.

In short:

> The weak seeds died early for profile-legible reasons: low output, high feed risk, weak combat, weak map pressure, or unstable internal composition.

---

## Thesis/Demo Significance

This run is stronger than the first complete run because it demonstrates a more legible endgame:

- The simulation does not merely stop when one tribe survives; it produces a reconstructable geopolitical sequence.
- Tribe 397's victory is interpretable through measurable state: fitness, territory, food, behavior/focus, and neural drives.
- The final opponent, Tribe 269, is not a straw rival. It held the larger territory block shortly before the final duel and had just defeated several other empires.
- The run supports the Genetic NeuroSim v2 framing as an exploratory simulation seeded by real graph/player profiles, while keeping the claim properly bounded to simulation behavior.

The best short version of the story:

> Tribe 269 conquered the endgame map. Tribe 397 survived the endgame pressure, stayed healthier, and then killed the conqueror.
