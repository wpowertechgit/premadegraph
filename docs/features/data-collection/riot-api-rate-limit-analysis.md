# Riot API Rate Limit Analysis & Collection Capacity

**Dev Key Tier:** Standard Rate Limits (provided)  
**Analysis Date:** 2026-04-23  
**Purpose:** Determine maximum capacity for apex-flex (2,500 matches) + solo queue (2,500 matches)

---

## Quick Answer

**TL;DR:** Your rate limits are **not the bottleneck**. You can collect 5,000 matches in **1–2 hours** if discovery is optimized, or **4–6 hours** with conservative margins.

The real constraint is **player discovery efficiency**, not API throughput.

---

## Bottleneck Analysis

### Critical Endpoints for Data Collection

| Endpoint | Rate Limit | Requests Needed | Utilization |
|----------|-----------|-----------------|-------------|
| `match-v5/matches/{matchId}` | 2000/10s (12k/min) | **5,000** | **~2.5 seconds** |
| `match-v5/matches/by-puuid/{puuid}/ids` | 2000/10s (12k/min) | **~200** | **<1 second** |
| `summoner-v4/summoners/by-puuid/{puuid}` | 1600/min | **~200** | **~7 seconds** |
| `league-v4/entries/by-puuid/{puuid}` | 1200k/10min | **~200** | **Negligible** |

**Winner: Match details are the tightest constraint (but still very loose)**

---

### Math: 5,000 Match Details

**Scenario:** Download 5,000 unique match details

```
Rate: 2000 matches / 10 seconds
Need: 5,000 matches

Calculation:
5,000 matches ÷ 2000 matches/10s = 25 seconds of "full throttle"

With 20% safety margin (breaks, network variance, retries):
25 seconds × 1.2 = 30 seconds effective time
```

**Reality:** You'll spend more time parsing, storing, and discovering than downloading.

---

## Collection Workflow & Timeline

### Phase 1: Entry Point (10 seed players)

| Step | Endpoint | Requests | Rate Limit Status | Time |
|------|----------|----------|-------------------|------|
| Get master players | `league-v4/masterleagues/by-queue` | 1 | <1% | <1s |
| Get 10 PUUIDs | Manual selection | 0 | N/A | 5min |
| Get summoner info (10) | `summoner-v4` | 10 | <1% | <1s |
| Get rank info (10) | `league-v4/entries/by-puuid` | 10 | <1% | <1s |

**Phase 1 Total: ~5 minutes (mostly manual)**

---

### Phase 2: Collect Seed Match History (10 players × 25 matches)

| Step | Endpoint | Requests | Time | Notes |
|------|----------|----------|------|-------|
| Get match IDs (10 players) | `match-v5/by-puuid/{puuid}/ids` | 10 | <1s | Query last 25 matches per player |
| Get match details (250) | `match-v5/matches/{matchId}` | 250 | 1-2s | At 2000/10s rate |
| Parse + store (250) | Database | N/A | 30-60s | Parsing, deduplication, DB write |

**Phase 2 Total: ~1–2 minutes active, ~30–60 minutes passive (parsing/storage)**

---

### Phase 3: Discovery Phase (Find new players radially)

**Strategy:** From 250 seed matches, randomly select players to expand

| Step | Endpoint | Requests | Batch Size | Time per Batch |
|------|----------|----------|-----------|-----------------|
| Extract potential players | Parsing | 250 matches × 9 players = 2,250 candidates | N/A | ~1min parsing |
| Random sample (100 new) | Random selection | 0 | 100 out of 2,250 | <1s |
| Get match IDs (100) | `match-v5/by-puuid/ids` | 100 | 10 batches | ~5-10s |
| Get match details (2,000) | `match-v5/matches/{matchId}` | 2,000 | 200/batch | ~10s execution |
| Parse + store (2,000) | Database | N/A | Streaming | ~1-2min |

**Phase 3 Total: ~2–3 minutes active, ~1–2 minutes passive**

---

### Phase 4: Quality Filtering & Deduplication

| Operation | Time | Notes |
|-----------|------|-------|
| Deduplicate matches | SQL query | <5s |
| Filter non-solo queue | SQL filter | <5s |
| Validate data quality | Programmatic check | ~30s |
| Rank verification (200 players) | Batch summoner lookups | ~10s |

**Phase 4 Total: ~1 minute**

---

## Total Collection Time: 5,000 Matches

### Scenario A: Optimized (1–2 hours)

**Assumptions:**
- Entry point: Pre-selected 10 seed players
- Discovery: Efficient random sampling (100 players)
- Parallelization: Batch API calls (10 concurrent)
- Storage: Streaming writes

| Phase | Time |
|-------|------|
| Setup + entry | 5 min |
| Seed match download | 2 min active + 30 min storage |
| Discovery round 1 | 3 min active + 1 min storage |
| Quality checks | 1 min |
| **Total** | **~42 minutes** |

---

### Scenario B: Conservative (4–6 hours)

**Assumptions:**
- Manual player selection (no pre-selection)
- Sequential API calls (no batching)
- Validation after each phase
- Multiple retry logic

| Phase | Time |
|-------|------|
| Setup + manual selection | 30 min |
| Seed match download | 10 min active + 60 min storage |
| Discovery round 1 (sequential) | 15 min active + 30 min storage |
| Discovery round 2 (filter, dedupe) | 30 min |
| Quality checks + validation | 30 min |
| **Total** | **~3 hours** |

---

## Per-Dataset Breakdown

### Apex Flex: 2,500 Matches

```
10 seed players × 25 matches = 250 matches
100 discovery players × 22 matches = 2,200 matches
Total: 2,450 ≈ 2,500 ✓

Requests:
- Match IDs: 110 (negligible)
- Match details: 2,500 (30 seconds at rate limit)
- Summoner lookups: 110 (1 second at rate limit)

Estimated time: 45 min – 2 hours
```

### Solo Queue: 2,500 Matches

```
100 seed players × 25 matches each = 2,500 matches
(No discovery layer, pure radial random from entry point)

Requests:
- Match IDs: 100 (negligible)
- Match details: 2,500 (30 seconds at rate limit)
- Summoner lookups: 100 (1 second at rate limit)

Estimated time: 45 min – 1.5 hours
```

---

## Maximum Theoretical Capacity (If Unconstrained)

### Per 10-Second Window

| Endpoint | Max Requests | Realistic Batch |
|----------|-------------|-----------------|
| Match details | 2,000 | 100–200 |
| Match IDs | 2,000 | 100–200 |
| Summoner lookups | 1,600/min ≈ 267/10s | 100–200 |

**Bottleneck: Match details at 2,000/10s**

### Sustainable Collection Rate

| Timeframe | Theoretical | Realistic | Practical |
|-----------|------------|-----------|-----------|
| Per second | 200 | 100 | 50 |
| Per minute | 12,000 | 6,000 | 3,000 |
| Per hour | 720,000 | 360,000 | 180,000 |
| Per day | 17.28M | 8.64M | 4.32M |

**Your 5,000-match target is <1% of hourly capacity.**

---

## Rate Limit Margin of Safety

### Current vs. Capacity

| Metric | Actual Use | Limit | Margin |
|--------|-----------|-------|--------|
| Match details (10 sec) | 500 | 2,000 | **75% free** |
| Match IDs (10 sec) | 110 | 2,000 | **94.5% free** |
| Summoner lookups (1 min) | 110 | 1,600 | **93% free** |
| Account lookups (10 min) | ~200 | 1.2M | **99.98% free** |

**You are nowhere near hitting limits.**

---

## Implementation Recommendations

### Rate Limit Handling Strategy

Since you're using <1% of capacity, implement **conservative but non-paranoid** backoff:

```python
class RateLimitAwareClient:
    def __init__(self):
        self.request_history = {}  # endpoint -> [timestamps]
    
    def get_match(self, match_id):
        endpoint = "match-v5"
        
        # Check if we're within 50% of limit (conservative margin)
        if self.request_count(endpoint, 10) > 1000:  # 50% of 2000
            time.sleep(1)  # Back off
        
        response = api_request(f"/matches/{match_id}")
        self.log_request(endpoint)
        return response
```

**Key principle:** You don't need aggressive batching or complex queuing. Just:
1. Log requests per endpoint
2. If approaching 50% of limit, add small delays
3. Respect retry-after headers
4. Done.

---

## Collection Strategy: Config-Based Approach

Use the config JSON to specify exactly what to collect:

```json
{
  "dataset_id": "apex-flex-2500",
  "target_matches": 2500,
  "rate_limit_strategy": "conservative",
  "collection": {
    "seed_phase": {
      "method": "manual_puuids",
      "players": 10,
      "matches_per_player": 25,
      "expected_matches": 250
    },
    "discovery_phase": {
      "method": "radial_random",
      "discovery_from": "seed_phase",
      "new_players": 100,
      "matches_per_player": 22.5,
      "expected_matches": 2250
    }
  }
}
```

---

## Conclusion: Your Actual Timeline

| Collection | Ideal | Conservative | Your Setup |
|-----------|-------|--------------|-----------|
| Apex Flex (2,500) | **1 hour** | 2.5 hours | **~2 hours** |
| Solo Queue (2,500) | **45 min** | 2 hours | **~1.5 hours** |
| **Both** | **~1.5 hours** | **4–5 hours** | **~3–3.5 hours** |

**Real bottleneck:** Player discovery strategy and DB writes, not API rate limits.

---

## Next Steps

1. ✓ Rate limit analysis (done)
2. → Implement configurable collection script with conservative rate limiting
3. → Test on entry point (10 players, 250 matches)
4. → Validate discovery strategy efficiency
5. → Scale to full 5,000 matches
6. → Run both datasets in parallel if needed

You're good to go. Build with confidence—limits aren't your problem.
