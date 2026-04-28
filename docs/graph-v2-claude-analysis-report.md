# Graph V2 Claude Analysis Report

Generated: 2026-04-28  
Analyst: Claude Sonnet 4.6 (claude-sonnet-4-6)

---

## Validation Checklist

Before any conclusion is treated as reliable:

| Check | Flexset | SoloQ |
| --- | --- | --- |
| graphBuilderVersion = `graph-builder-v2.2` | ✓ | ✓ |
| clusteringAlgorithmVersion = `bounded-ally-groups-v2` | ✓ | ✓ |
| layoutVersion = `bridge-orbit-layout-v1` | ✓ | ✓ |
| largestClusterSize ≤ 20 | ✓ (exactly 20) | ✓ (exactly 20) |
| opscore coverage sufficient | ✓ (5741/5741) | ✓ (1538/1538) |
| feedscore coverage sufficient | ✓ (5741/5741) | ✓ (1538/1538) |
| datasetId matches artifact path | ✓ `flexset` | ✓ `soloq` |

Both datasets pass all validation checks.

---

## 1. Dataset Readiness

### Flexset

| Metric | Value |
| --- | ---: |
| matchCount | 4 980 |
| visibleNodeCount | 5 741 |
| visibleEdgeCount | 18 548 |
| allyEdgeCount | 13 572 (73.17%) |
| enemyEdgeCount | 4 976 (26.83%) |
| averageEdgeSupport | 3.405 |
| clusterCount | 1 531 |
| largestClusterSize | 20 |
| averageClusterSize | 3.750 |
| bridgeCandidateClusters | 815 |
| outerOrbitClusters | 716 |
| missing opscore | 0 / 5 741 |
| missing feedscore | 0 / 5 741 |

**Suitability:**
- Signed-balance analysis: **yes** — ally edge density (73%) and average cluster size (3.75) give enough within-cluster triads. Edge support average 3.4 means most visible edges survive a threshold of 2.
- Assortativity analysis: **yes** — full metric coverage, 18 548 edges across two projections.
- ML feature extraction: **yes** — node, edge, and cluster features all present. No missing-value imputation needed for opscore/feedscore.

### SoloQ

| Metric | Value |
| --- | ---: |
| matchCount | 2 000 |
| visibleNodeCount | 1 538 |
| visibleEdgeCount | 4 111 |
| allyEdgeCount | 2 682 (65.24%) |
| enemyEdgeCount | 1 429 (34.76%) |
| averageEdgeSupport | 2.364 |
| clusterCount | 870 |
| largestClusterSize | 20 |
| averageClusterSize | 1.768 |
| bridgeCandidateClusters | 605 |
| outerOrbitClusters | 265 |
| missing opscore | 0 / 1 538 |
| missing feedscore | 0 / 1 538 |

**Suitability:**
- Signed-balance analysis: **limited** — average cluster size 1.768 means most clusters are 1–2 players. Within-cluster triads will be very sparse. Cross-cluster signed triads via battle-path edges may exist but require lower thresholds.
- Assortativity analysis: **yes (control role only)** — full metric coverage, 4 111 edges are sufficient. Use SoloQ to compare individual-performance distributions against flexset, not to claim stable social structure.
- ML feature extraction: **yes (control role only)** — suitable as a comparison baseline for per-player features; cluster-level features from SoloQ are not equivalent to flexset cluster features.

---

## 2. Assortativity Plan

### Graph Projections Required

| Projection | Definition | Implemented? |
| --- | --- | --- |
| ally-only | edges where `ally_weight > 0` (≈ social-path) | ✓ via `social-path` mode |
| battle-path / all signed visible | edges where `total_matches > 0` | ✓ via `battle-path` mode |
| enemy-only | edges where `enemy_weight > ally_weight` | ✗ not implemented |
| cross-cluster bridge-only | edges where `cluster_membership[left] ≠ cluster_membership[right]` | ✗ not implemented |
| internal-cluster ally-only | edges where both endpoints share a cluster AND `ally_weight ≥ 2` | ✗ not implemented |

The three missing projections cannot be computed with the current request API. Adding them requires new projection enum variants in `assortativity.rs`.

### Attribute Plan

- `opscore`: numeric Pearson correlation across edge endpoints.
- `feedscore`: numeric Pearson correlation across edge endpoints.
- Both attributes have 100% coverage in both datasets; no imputation step needed.

### Formula

Pearson correlation using both orientations of each undirected edge — this is already correctly implemented in `PearsonAccumulator::add_undirected_edge`, which adds both `(left, right)` and `(right, left)` to accumulate the numerator/denominator symmetrically.

### Filtering

- Exclude nodes with missing metric: ✓ implemented.
- Skip edges with low support: ✓ implemented (`min_edge_support` request parameter).
- Skip nodes below `min_player_match_count`: ✓ implemented.
- Report skipped counts per category: ✓ implemented (three separate skip counters).

### Critical Mismatch: Support Measure Asymmetry

**Problem**: In `assortativity.rs`, `GraphMode::edge_support` returns:
- `social-path` → `ally_weight`
- `battle-path` → `total_matches`

This means `min_edge_support` filters on **different quantities** depending on the mode. When running social-path assortativity with `min_edge_support = 1`, edges with `ally_weight = 1` and `enemy_weight = 0` (`total_matches = 1`) are included. These edges are **not visible in Graph V2** (which requires `total_matches ≥ 2`). The assortativity result therefore includes pairs that the signed-network analysis excludes.

**Fix**: For social-path mode, enforce an implicit floor of `total_matches ≥ 2` to match Graph V2 semantics. The cleanest solution is to add a `min_total_matches` secondary filter applied before the `min_edge_support` check:

```rust
// In compute_metric_result, after candidate_edges += 1:
if relation.total_matches < MIN_GRAPH_V2_SUPPORT {
    computation.skipped_low_edge_support_edges += 1;
    continue;
}
```

Alternatively, document clearly in the API that callers must set `min_edge_support ≥ 2` when using social-path to align with Graph V2 visibility.

### Current Implementation Assessment

The core Pearson formula is correct. The within-cluster vs cross-cluster breakdown is implemented. The strong-ties/weak-ties split is implemented. The main gaps are: (a) missing enemy-only and bridge-only projections; (b) the support measure asymmetry described above; (c) no dedicated "Graph V2 visible edges only" guard.

---

## 3. Signed Balance Plan

### Projection Design

The current implementation in `signed_balance.rs` is structurally sound:

- ✓ Uses a collapsed signed simple graph built from `pair_relations`
- ✓ ally = positive (EdgeSign::Positive when `ally_weight > enemy_weight`)
- ✓ enemy = negative (EdgeSign::Negative when `enemy_weight > ally_weight`)
- ✓ valid triad = fully connected triple (requires all three pairwise edges to exist and resolve to a sign)
- ✓ tie handling is configurable via `SignedTiePolicy` (Exclude / Ally / Enemy)
- ✓ balanced / unbalanced counts reported
- ✓ triad type distribution reported (+++, ++-, +--, ---)
- ✓ top nodes by unbalanced triad count reported

### Threshold Rule

The support threshold (`min_edge_support`) uses `total_matches` (ally + enemy) as the measure. This is correct: for signed balance, both ally and enemy encounters contribute evidence of a relationship, so filtering on total_matches is semantically appropriate.

Recommended minimum: `min_edge_support = 2` (Graph V2 baseline visibility threshold). For thesis-quality conclusions, also run at `min_edge_support = 3` and report stability of the balanced ratio across both thresholds.

### Balance Classification

Balanced types: `+++` (all allies) and `+--` (two enemies, one ally).  
Unbalanced types: `++-` (two allies, one enemy) and `---` (all enemies).

This follows Heider's structural balance theory and is correctly implemented in `TriadPattern::is_balanced`.

### Concern: `+--` as Balanced

The `+--` pattern is balanced under Heider's theory (enemy of my enemy is my friend). However, in the game context (repeated co-queue), this interpretation should be stated with caution: "under the structural balance definition used here, a triad where two players share a mutual enemy is treated as balanced." Do not claim this is equivalent to social harmony.

### Implementation Gap

There is no ally-weight–only threshold option in signed balance. When both players meet as allies many times and enemies once, the relationship is signed "ally" at `ally_weight > enemy_weight`, but the `min_edge_support` threshold counts total_matches including the enemy encounter. This is correct behavior — it would be problematic to ignore enemy encounters when measuring relationship strength.

---

## 4. ML Feature Schema

### Node-Level Features

| Feature | Source | Status | Caution |
| --- | --- | --- | --- |
| `totalDegree` | node_metrics.u32 col 0 | **usable now** | — |
| `allyDegree` | node_metrics.u32 col 1 | **usable now** | — |
| `enemyDegree` | node_metrics.u32 col 2 | **usable now** | — |
| `totalSupport` | node_metrics.u32 col 3 | **usable now** | — |
| `matchCount` | node_metrics.u32 col 5 | **usable now** | players with low matchCount are less reliable |
| `opscore` | node_meta.json | **usable now** | 100% coverage in both datasets |
| `feedscore` | node_meta.json | **usable now** | 100% coverage; interpret as 0–10 scale, higher = more feeding |
| `highlightFlags` | node_metrics.u32 col 4 | **needs more validation** | cluster-relative flag; changes if cluster boundaries change |
| `clusterId` | node_meta.json | **should not use as predictor** | cluster-relative identifier; not stable across dataset versions |
| `playerId` / `label` | node_meta.json | **must not use** | identity leakage; not generalizable |

### Edge-Level Features

| Feature | Source | Status | Caution |
| --- | --- | --- | --- |
| `relation` (ally=0, enemy=1) | edge_props.u32 bit 0 | **usable now** | — |
| `support_weight` (total_matches) | edge_props.u32 bits 1+ | **usable now** | — |
| `ally_weight` | derivable from pair_relations | **usable now** | not stored in edge_props; requires node_meta join |
| `enemy_weight` | derivable from pair_relations | **usable now** | — |
| `same_cluster` flag | derived from node_meta.clusterIds | **usable now** | depends on current cluster assignment |
| `is_cross_cluster_bridge` | derived from cluster metadata | **needs more validation** | bridge detection is heuristic, not validated against Brandes |

### Cluster-Level Features

| Feature | Source | Status | Caution |
| --- | --- | --- | --- |
| `memberCount` | cluster_meta.json | **usable now** | — |
| `internalAllyEdgeCount` | cluster_meta.json | **usable now** | counts only within-cluster ally edges |
| `crossAllySupport` | cluster_meta.json | **usable now** | total ally_weight summed across cross-cluster ally edges |
| `connectedAllyClusterCount` | cluster_meta.json | **usable now** | — |
| `enemyCrossClusterEdgeCount` | cluster_meta.json | **needs more validation** | field name is misleading: counts enemy edges PLUS cross-cluster edges of any sign; see code note below |
| `orbitScore` | cluster_meta.json | **should not use as predictor** | visualization heuristic; not validated against Brandes betweenness |
| `orbitRadius` | cluster_meta.json | **should not use as predictor** | visualization heuristic |

**Code note on `enemyCrossClusterEdgeCount`**: In `graph_v2.rs::annotate_cluster_edges`:

```rust
if edge.relation == Relation::Enemy || left_cluster != right_cluster {
    clusters[left_cluster].enemy_cross_cluster_edge_count += 1;
    ...
}
```

This increments for any edge that is either an enemy edge OR a cross-cluster edge. A cross-cluster ally edge is also counted. The field is labeled "Enemy/cross exposure" in the summary table, which accurately describes the logic, but the field name `enemyCrossClusterEdgeCount` implies only enemy edges. This should be renamed or split before use as an ML feature.

---

## 5. Findings

The following are structurally defensible from the artifact metadata alone. No results from running assortativity or signed balance computations are available yet; these conclusions are pre-computation inferences.

### F1 — Flexset has stronger ally-group social structure than SoloQ

Under this graph projection, flexset's average cluster size (3.750) is more than twice SoloQ's (1.768). The ally edge fraction is 73% in flexset vs 65% in SoloQ. This appears consistent with the expected mechanics of Flex Queue: players who intentionally queue together appear more frequently as allies in the same cluster under the bounded-ally-groups-v2 algorithm. SoloQ clusters are predominantly singletons under this projection.

Caveat: requires validation — the algorithm caps cluster size at 20, so the averages reflect structure below that cap. Cluster counts (1531 vs 870) are not directly comparable without normalizing by match and player count.

### F2 — SoloQ bridge clusters connect to more clusters per cluster

The top SoloQ bridge cluster (`graph-v2:ally-group:3`) connects to 120 other clusters with cross_ally_support 505. The top flexset bridge cluster (`graph-v2:ally-group:26`) connects to only 109 clusters despite higher support (592). Under this graph projection, SoloQ bridge players appear to connect to a wider breadth of clusters, which suggests a candidate relationship between random queue assignment and broader cross-cluster ally exposure. This requires validation against Brandes betweenness.

### F3 — Full metric coverage enables unfiltered assortativity analysis

Both datasets have 100% opscore and feedscore coverage across all visible nodes. Under normal conditions, assortativity on these metrics will not need to report "skipped_missing_metric_edges" unless the runtime graph's player_rows are incomplete. This is a favorable condition for thesis claims about measurement completeness.

### F4 — Enemy edge fraction in SoloQ (34.76%) is substantially higher than flexset (26.83%)

Under this graph projection, SoloQ pairs appear as enemies more often than flexset pairs. This suggests a candidate relationship between queue type and the nature of repeated encounters. Whether this reflects the game mechanics (SoloQ matches are longer series so players encounter the same pool repeatedly as enemies) requires further investigation and should not be stated as a causal claim.

### F5 — Both datasets pass the Graph V2 cluster cap constraint

All clusters are ≤ 20 members in both datasets, satisfying the bounded-ally-groups-v2 guarantee. The deterministic split algorithm has not exceeded its bounds. This means cluster membership is stable and reproducible for ML purposes (given the same dataset and algorithm version).

### F6 — Average edge support in SoloQ (2.364) is near the visibility threshold

With average support of 2.364 and a minimum threshold of 2, most SoloQ edges are near-threshold. This means a `min_edge_support = 3` filter will discard a substantial fraction of SoloQ edges. Assortativity sensitivity sweeps should test both thresholds in SoloQ and report how much the coefficient changes. In flexset (average support 3.405), the dataset is more robust to higher thresholds.

---

## 6. Recommended Code Fixes

### Fix 1 — Add Graph V2 visibility floor to social-path assortativity

**File**: [backend/pathfinder-rust/src/engine/assortativity.rs](backend/pathfinder-rust/src/engine/assortativity.rs)

**Problem**: Social-path mode includes edges with `ally_weight > 0` and `total_matches = 1`, which Graph V2 would not show as visible (requires `total_matches ≥ 2`). This means the runtime assortativity population is not the same set of edges as the Graph V2 population.

**Fix**: Add a `min_total_matches` guard in `compute_metric_result` immediately after `candidate_edges += 1`:

```rust
// After: computation.candidate_edges += 1;
if relation.total_matches < 2 {
    computation.skipped_low_edge_support_edges += 1;
    continue;
}
```

Or add it as an explicit request field (`min_total_matches: u32`) so callers control it. The default should be 2 to match Graph V2 semantics.

### Fix 2 — Add enemy-only, cross-cluster, and within-cluster projections to assortativity

**File**: [backend/pathfinder-rust/src/engine/assortativity.rs](backend/pathfinder-rust/src/engine/assortativity.rs)

**Problem**: Only `social-path` (ally edges) and `battle-path` (all edges) projections are implemented. Enemy-only, cross-cluster, and within-cluster projections are needed to answer the thesis questions about whether similar-performance players appear assortatively connected when controlling for edge type and graph topology.

**Fix**: Extend `GraphMode` with new variants:

```rust
enum GraphMode {
    SocialPath,    // ally_weight > 0
    BattlePath,    // total_matches > 0
    EnemyOnly,     // enemy_weight > ally_weight (dominant_relation == "enemy")
    CrossCluster,  // cluster_membership[left] != cluster_membership[right]
    WithinCluster, // cluster_membership[left] == cluster_membership[right] AND ally_weight >= 2
}
```

This is a Rust-side change only; no frontend changes needed until the backend schema is correct.

### Fix 3 — Rename `enemy_cross_cluster_edge_count` to `exposure_count`

**File**: [backend/pathfinder-rust/src/engine/graph_v2.rs](backend/pathfinder-rust/src/engine/graph_v2.rs)

**Problem**: The field counts any edge that is either an enemy edge OR a cross-cluster edge. The name implies only enemy edges. This will create confusion when using it as an ML feature.

**Fix**: Rename `enemy_cross_cluster_edge_count` → `exposure_edge_count` (or split into `enemy_edge_count` and `cross_cluster_edge_count` separately). Update `ClusterBuildRecord`, `ClusterMetaRecord`, the `annotate_cluster_edges` function, and the summary markdown. The summary table already uses "Enemy/cross exposure" as the column label — align the field name to match.

### Fix 4 — Document that `feedscore` higher = more feeding

**File**: [backend/pathfinder-rust/src/engine/graph_v2.rs](backend/pathfinder-rust/src/engine/graph_v2.rs) and summary generation.

**Problem**: `worst_feed_member` is the player with the highest feedscore (`max_by`). If feedscore is on a 0–10 scale where 10 = most feeding, then this is correct. But the field name "worst" combined with "max feedscore" may confuse future readers if feedscore semantics change. Add a brief comment or a column description in the summary markdown stating the direction of the scale.

### Fix 5 — Add explicit Graph V2 artifact–based assortativity path (future)

**File**: new file — `backend/pathfinder-rust/src/engine/assortativity_v2.rs`

**Problem**: The current assortativity and signed balance analyses operate on the runtime `GraphState` built from raw match JSON + SQLite. The Graph V2 artifacts (`node_meta.json`, `edge_pairs.u32`, `edge_props.u32`, `cluster_meta.json`) are pre-computed but not used as the analysis source. The runtime graph does not apply the Graph V2 minimum support threshold at build time, so the analysis population differs from the artifact population.

**Fix** (future work): Add an artifact-based analysis path that reads from the pre-computed Graph V2 cache files instead of rebuilding from raw data. This would guarantee analysis/artifact consistency and enable per-dataset analysis (flexset vs soloq) without restarting the server.

---

## Next Experiments to Run

1. **Assortativity sweep**: Run both `social-path` and `battle-path` assortativity on flexset with `min_edge_support` in `{2, 3, 4}` and report coefficients for opscore and feedscore. Compare the within-cluster vs cross-cluster sub-coefficients.

2. **Assortativity significance**: Run `assortativity-significance` with `permutation_count = 100` for flexset social-path opscore and feedscore. Check whether the observed coefficient is outside the null distribution at α = 0.05 (empirical).

3. **Signed balance sweep**: Run `signed-balance-sweep` on flexset with `min_edge_supports = [2, 3, 4]` and `tie_policies = [Exclude, Ally, Enemy]`. Report balanced ratio stability across configurations. A stable ratio across multiple thresholds strengthens the finding.

4. **SoloQ control comparison**: Run the same assortativity sweep on SoloQ. If the opscore assortativity coefficient is similar in magnitude to flexset under social-path, it suggests the effect may not be specific to repeated social grouping. If it is lower or undefined, it supports the claim that Flex Queue social structure produces the assortative pattern.

5. **Bridge vs non-bridge assortativity**: Once the cross-cluster projection (Fix 2) is implemented, run assortativity on bridge-only edges and compare the coefficient to within-cluster assortativity. If bridge players appear less assortatively matched on opscore, this suggests a candidate relationship between cross-cluster exposure and mixed-performance groupings.

6. **`enemyCrossClusterEdgeCount` audit**: Before using this feature in any ML model, confirm experimentally that the field value matches the sum of (enemy edges + cross-cluster ally edges) rather than just enemy edges. Write a test in `graph_v2.rs` that verifies the count against a hand-constructed edge set.

---

## Flexset vs SoloQ: Should They Be Handled Differently?

**Yes, they should.**

| Dimension | Flexset | SoloQ |
| --- | --- | --- |
| Intended use | Primary signed-network analysis | Control / comparison baseline |
| Social structure claim | Defensible — players queue intentionally | Not defensible — random queue |
| Signed balance | Sufficient — denser clusters | Limited — sparse singleton clusters |
| Assortativity | Primary dataset | Secondary / comparison |
| ML training data | Primary | Control / stratification |
| Cluster features | Research-grade | Descriptive only |

Do not mix flexset and soloq conclusions. Report them in separate subsections and explicitly label which dataset each finding comes from.

---

## Caveats

- All findings in this report are derived from metadata and code inspection. No assortativity coefficients or signed balance ratios have been computed yet. The conclusions labeled F1–F6 are candidate relationships, not confirmed results.
- The signed balance analysis operates on the runtime `GraphState`, not the pre-generated Graph V2 artifacts. Until Fix 5 is implemented, there is a potential population mismatch between what the artifacts show and what the analysis computes.
- The orbit layout fields (`orbitScore`, `orbitRadius`) are explicitly excluded from research conclusions in this report. They require validation against Brandes betweenness centrality before any structural interpretation.
- Both datasets were generated at fixed points in time (flexset: unix 1777372712, soloq: unix 1777388825). Any new data collection will require regenerating artifacts and rerunning this analysis.
