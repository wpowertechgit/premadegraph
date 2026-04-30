# Apex Flex Queue Master+ Data Collection Strategy

## Overview

**Dataset ID:** `flexset`  
**Target:** Master+ Ranked Flex Queue (EUNE)  
**Thesis Relevance:** Core dataset for Flex Queue associative graph analysis, dataset comparison, assortativity, and centrality studies. Signed balance is retained only as a methodological boundary case; see `signed-balance-methodological-retirement.md`.

---

## Collection Rationale

### Why Flex Queue?

Flex queue naturally aggregates **intentional premades**:
- Teams are explicitly formed by players, not random SR matchmaking
- Same 2-5 player groups recurring across matches reveals true alliance/enmity patterns
- Skill variance minimal at Master+ tier (removes confounding variables)
- Match timestamps allow temporal stability analysis

### Why This Approach?

**10 seed players with non-overlapping teams** balances:
- ✅ Directed exploration (let graph grow organically from seeds)
- ✅ Reduced redundancy (seeds don't interfere with each other's discovery)
- ✅ Enough coverage to capture multiple distinct premade clusters
- ✅ Thesis defensibility (systematic, not arbitrary cherry-picking)

---

## Collection Strategy

### Phase 1: Seed Selection

**Goal:** Identify 10 independent Master+ players in Ranked Flex

**Criteria:**
- **Tier:** Master tier (LP ≥ 0) or Grandmaster or Challenger
- **Region:** EUNE primary
- **Recent Activity:** Must have ranked flex match within last 30 days (active players)
- **Team Composition:** Each seed plays with a **distinct main flex team** (no player overlap across seed groups)

**Selection Process:**
1. Query Riot API for ~50 random Master+ players in flex queue
2. Filter for recent activity
3. Manually verify each seed's primary flex teammates from last 5-10 matches
4. Select 10 seeds such that their primary teams don't share members
5. Document seed metadata:
   - Player name, PUUID, LP, main role
   - Primary team composition (3-5 teammates)
   - Date range of baseline matches used for team detection

**Example seed group:**
```
Seed 1: Player_A (Jungle) - team: [Player_A, Support_B, ADC_C, Top_D, Mid_E]
Seed 2: Player_F (Mid) - team: [Player_F, Support_G, ADC_H, Top_I, Jungle_J]
... (8 more non-overlapping seeds)
```

### Phase 2: Iterative Graph Exploration

**Goal:** Discover all co-players and their relationships organically

**Algorithm:**
1. **Start:** Add all 10 seed players to the processing queue
2. **For each player in queue:**
   - Fetch their last N ranked flex matches (N = 15-20 for depth)
   - Extract all co-players (teammates and opponents)
   - For each co-player:
     - If new (not yet in graph): Add to queue
     - If in graph: Increment edge weight (ally/enemy edge)
3. **Termination:** Stop when queue stabilizes (few new players discovered)

**Edge Classification:**
- **Ally edge (+1):** Co-players on same team in ranked flex
- **Enemy edge (-1):** Players opposed in ranked flex
- **Weight:** Count of matches (ally/enemy count per pair)

**Stopping Criterion:**
- Queue < 10 new players for 2 consecutive iterations, OR
- Total matches collected ≥ 3,000-5,000, OR
- Total unique players ≥ 400-600

### Phase 3: Consolidation & Refinement

**Goal:** Ensure data quality before analysis

**Actions:**
1. **De-duplicate:** Resolve alternative account aliases (same player, multiple accounts)
2. **Filter low-confidence edges:** Remove ally/enemy pairs with only 1 match history
3. **Verify queue type:** Re-check that all matches are truly `RANKED_FLEX_SR`
4. **Timestamp validation:** Confirm all matches occurred within acceptable date range
5. **Generate summary statistics:**
   - Total players
   - Total matches
   - Total edges (ally + enemy)
   - Signed triad distribution (preview)

---

## Expected Outcomes

### Graph Size Estimates

| Metric | Expected Range |
|--------|-----------------|
| Unique Players | 400–700 |
| Ally Edges | 800–1,200 |
| Enemy Edges | 300–600 |
| Total Matches | 3,000–5,000 |
| Average Degree | 4–6 per player |
| Cluster Count (Louvain) | 8–15 |

### Data Properties

- **Density of signed triads:** High (flex teams are stable)
- **Balance ratio:** Expected 65–75% balanced (structural balance theory)
- **Assortativity:** Moderate positive (similar-skill players cluster)
- **Temporal stability:** High within 2-3 week windows

---

## Implementation Parameters

### MatchCollector Config

```json
{
  "datasetId": "flexset",
  "mode": "seed-based",
  "collectorMode": "seed-expansion",
  "seedPlayers": [
    "seed_1_puuid", "seed_2_puuid", ... "seed_10_puuid"
  ],
  "matchesPerPlayer": 20,
  "queueType": "RANKED_FLEX_SR",
  "minTier": "MASTER",
  "regions": ["EUN1", "EUW1"],
  "apiKey": "${RIOT_API_KEY}",
  "requestsPerSecond": 15,
  "requestsPer2Min": 90,
  "minimumPremadeRepeats": 1,
  "randomSeed": 42,
  "maxIterations": 10
}
```

### Database Schema

Matches stored in `backend/data/matches/flexset/` as JSON files:
- Naming: `{REGION}_{GAME_ID}.json` (e.g., `EUN1_3784523524.json`)
- Player data normalized in `flexset/playersrefined.db`
- Co-play relationships indexed by (puuid1, puuid2) pairs

---

## Analysis Pipeline

### Stage 1: Graph Construction
→ `build_graph.py` with flexset dataset → `flexset/clusters_with_names.json`

### Stage 2: Structural Balance Analysis
→ Compute signed triads, balance ratio → AGENTS.md Feature 1 output

### Stage 3: Centrality & Assortativity
→ Brandes betweenness (Rust) → Assortativity analysis → Feature 2 & 3

### Stage 4: Temporal Consistency
→ Segment by patch/week → Stability scores per player → Feature 4

---

## Validation & QA

### Pre-Release Checks

- [ ] All 10 seeds confirmed non-overlapping in primary teams
- [ ] ≥ 95% of matched games are `RANKED_FLEX_SR`
- [ ] ≥ 90% of players are Master+ (tier distribution logged)
- [ ] Edge weights > 0 for all relationships
- [ ] No duplicate player nodes (PUUIDs normalized)
- [ ] Timestamp coverage ≤ 30-day window

### Expected Issues & Mitigations

| Issue | Mitigation |
|-------|-----------|
| Account suspension/renaming | Store PUUID + name pair; use PUUID as primary key |
| API rate limits | Batch requests; respect 2min window throttle |
| Seed players boost/decay tier mid-collection | Filter to Master+ at query time; accept tier volatility ±50 LP |
| Same players appear across multiple seeds | Re-select seeds if overlap detected; tighten criteria |

---

## Success Criteria

✅ Collection successful if:
1. **Completion:** ≥ 3,000 ranked flex matches collected
2. **Graph size:** 400–700 unique Master+ players
3. **Clustering:** ≥ 8 distinct clusters identified via Louvain
4. **Balance:** Signed triads measurable (> 100 triads)
5. **Temporal window:** All matches within ±30 days of seed data
6. **Assortativity:** Clear positive correlation for similar-tier players

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Seed selection & validation | 1–2 hours | 10 seed PUUIDs + teams documented |
| Graph exploration (API collection) | 4–6 hours | ~3,000–5,000 matches in flexset/matches |
| Data consolidation & QA | 1–2 hours | Normalized players.db + validation report |
| Graph construction & clustering | 30 min | Clusters JSON + preview statistics |

**Total:** ~6–10 hours of wall-clock time (mostly API rate-limited waits)

---

## Notes for Thesis

This collection strategy demonstrates:
- **Rigorous methodology:** Seed-based expansion with documented parameters
- **Defensibility:** Non-arbitrary selection; reproducible process
- **Scale:** Enough players for statistical significance without overwhelming complexity
- **Directedness:** Captures *intentional* premade groups (flex-specific property)
- **Research quality:** Feeds into multiple planned analyses (balance, centrality, assortativity, stability)

The flexset dataset becomes the **primary evidence corpus** for all signed graph and premade relationship hypotheses in the thesis.
