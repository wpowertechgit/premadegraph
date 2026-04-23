# Master+ Solo Queue EUNE Dataset Collection Strategy

**Status:** Planning (Collection Phase: Not Started)  
**Timeline:** After apex-flex dataset validation  
**Purpose:** Orthogonal performance baseline for genetic-neurosim tribal seeding

---

## Overview

The Master+ Solo Queue EUNE dataset is a **structurally independent** collection designed to answer the question:

> **"What does pure player performance look like when network premade relationships are removed?"**

This dataset serves three functions:

1. **Genetic-Neurosim Seed Pool** — Uncorrelated performance profiles for population initialization
2. **Performance Metric Averaging** — Solo queue only means no team/cluster influence on stats
3. **Survival-of-the-Fittest Baseline** — No premade structure = no graph-based advantages, only mechanical skill

---

## Why This Dataset Is Different

### Comparison Matrix

| Aspect | Dataset 1 (Player-Crawl) | Dataset 2 (Apex Flex) | **Dataset 3 (SoloQ)** |
|--------|-------------------------|------------------------|------------------------|
| **Structure** | Premade-heavy network | Deliberate cluster seeds | **Random, no network** |
| **Graph Use** | ✓ Clustering + analysis | ✓ Topology validation | **✗ Performance only** |
| **Premade Frequency** | High | Medium (intentional) | **Rare/accidental** |
| **Purpose** | Social balance theory | Network robustness | **Performance baseline** |
| **Genetic-Neurosim Role** | Cluster profiles seeded | Topological comparison | **Raw skill seed pool** |

### Key Insight

By collecting completely random solo queue players:

- No graph structure bias
- No team synergy artifacts
- Pure mechanical + decision-making performance
- Independent performance distribution for statistical comparison

---

## Collection Strategy

### Phase 1: Entry Point (1 Random Master Player)

**Starting Condition:**
- Begin with a randomly selected Master-tier player on EUNE (700-800 LP range is acceptable volatility)
- Collect their recent solo queue match history

**Why 700 LP?**
- Master+ tier is guaranteed tier floor (no Diamond contamination)
- 700 LP introduces acceptable randomness without being "player is boosted"
- Reduces collection bias vs always hitting 1000 LP players

### Phase 2: Radial Random Discovery

For each match in the first player's match history:

1. Identify other players in that match (9 opponent + 4 teammate totals)
2. **Randomly select** 1-2 players from that match (not systematically, pure randomness)
3. For that randomly selected player, collect their solo queue match history
4. **Do not expand if** the player shows premade pattern clustering (same duo/trio appearing 4+ times)

**Why random selection matters:**
- Prevents deterministic clustering around high-profile players
- Spreads across skill levels within Master+
- Reduces network re-emergence naturally

### Phase 3: Breadth Over Depth

Continue until you have:

- **Minimum:** 50 unique Master+ players
- **Target:** 80-120 unique Master+ players
- **Stop condition:** When new players stop expanding (saturation)

**Rationale:**
- 50 is minimum for statistical significance (opscore/feedscore distribution)
- 80-120 gives comfortable sample for genetic algorithm seeding (multiple distinct profiles)
- Diminishing returns beyond 120 (still solo queue filtered)

---

## Per-Player Match Collection Guidelines

### Recommended Sample Sizes

| Match Count | Use Case | Reasoning |
|-------------|----------|-----------|
| **5 matches** | Quick screening | Too sparse; opscore/feedscore high variance |
| **10 matches** | ⭐ **Sweet spot** | Enough for robust mean/variance, low API burden |
| **15 matches** | Premium pool | High confidence; use for cluster seed profiles |
| **20+ matches** | Statistical deep dive | Diminishing returns on collection cost |

**Decision: Collect 10 matches per player as default.**

Rationale:
- 10 matches = ~2 hours of gameplay per player
- API cost remains manageable (10 × 80 players = 800 matches total)
- Sufficient to compute:
  - Mean opscore / feedscore
  - Variance (stability proxy)
  - Outlier detection (one-trick vs generalist)
  - Role distribution

### For the Initial "Random Pick" Player

**Recommendation: 15 matches minimum**

Reasoning:
- First player anchor point sets tone
- Want higher confidence in entry point
- 15 matches show trajectory and volatility
- Use to establish baseline benchmarks for the dataset

---

## Dataset Output Format

After collection, organize into:

```
soloq_dataset/
├── player_profiles.json
│   ├── player_id: {
│   │     "puuid": "...",
│   │     "name": "...",
│   │     "rank": "Master",
│   │     "lp": 750,
│   │     "match_count": 10,
│   │     "opscore_mean": 6.2,
│   │     "opscore_std": 1.4,
│   │     "feedscore_mean": 3.1,
│   │     "feedscore_std": 1.9,
│   │     "roles": ["mid", "adc"],
│   │     "is_one_trick": false
│   │   }
│   └── ...
├── raw_matches/
│   ├── match_1.json
│   ├── match_2.json
│   └── ...
└── collection_metadata.json
   └── {
         "started_at": "2026-05-XX",
         "total_players": 95,
         "total_matches": 950,
         "entry_player": "xxxxxx",
         "api_calls": 1200,
         "notes": "..."
       }
```

---

## How This Feeds Genetic-Neurosim

### Data Contract

For each player profile:

1. **Initial Energy** → `opscore_mean` (higher mean → higher starting energy)
2. **Mutation Aggressiveness** → `opscore_std` (high variance → more exploration in genome space)
3. **Population Clustering** → `role` distribution (group players by role for comparative runs)
4. **Fitness Target** → `feedscore_mean` (inverse fitness; lower is better)

### Expected Experiment

1. Seed 5 populations with different opscore profiles from SoloQ dataset
2. Run genetic algorithm on each population independently
3. Observe: Do high-skill profiles converge faster? Do low-skill profiles explore more?
4. Compare against graph-based cluster seeding (do network relationships matter for evolution?)

---

## Timeline & Constraints

### Estimated API/Labor Cost

| Phase | Matches | Duration | Notes |
|-------|---------|----------|-------|
| Entry point | 15 | 1-2 hours | Single player collection + manual review |
| Discovery radial | 100-150 | 4-6 hours | Identifier selection + screening |
| Depth collection | 750-850 | 8-10 hours | Main bulk collection |
| **Total** | **~950 matches** | **~15 hours** | Distributed collection recommended |

### When to Collect

**Recommended:**
- After apex-flex dataset analysis is complete
- Gives time to:
  - Learn collection patterns from apex-flex
  - Refine match filtering logic
  - Validate performance metrics on known data
- Parallel collection OK if data pipeline is stable

---

## Data Quality Checks

Before using profiles for genetic-neurosim seeding, validate:

1. **No Premade Clustering**
   - Check if any player duo/trio appears in 4+ matches
   - If found, flag player as "weak filter" but keep (rare in soloq anyway)

2. **Rank Consistency**
   - All collected players must have been Master+ at collection time
   - Re-verify 24 hours after collection

3. **Role Diversity**
   - Verify roles span all 5 (top, jng, mid, adc, sup)
   - Don't reject single-role players, but track separately

4. **Outlier Detection**
   - Flag players with opscore > 9 or < 2 in any match (possible smurfs or extremely bad games)
   - Keep them but mark as "high variance"

5. **Match Completeness**
   - Every match must have: kills, deaths, assists, gold earned, vision score, role
   - Reject matches with missing fields

---

## Conceptual Goal

This dataset is **the control group for everything else**.

- Graph-based datasets tell you about social structure
- SoloQ dataset tells you about individual performance
- Genetic algorithms run on both → you see which factors matter for evolution
- Thesis insight: "Performance profiles and network structure evolve independently/together"

---

## Next Steps

1. ✓ Approve this strategy
2. → Implement random player discovery logic
3. → Set up collection + validation pipeline
4. → Run 15-match entry point pilot
5. → Analyze entry point for collection quality signals
6. → Scale to full dataset (80-120 players)
7. → Export to genetic-neurosim seeding format
8. → Run comparative simulations

---

## References

- **Related:** [apex-flex-collection-strategy.md](apex-flex-collection-strategy.md)
- **Integration:** [premadegraph-x-genetic-neurosim-integration-plan.md](premadegraph-x-genetic-neurosim-integration-plan.md)
- **Theory:** [thesis-framework-signed-balance-assortativity.md](thesis-framework-signed-balance-assortativity.md)
