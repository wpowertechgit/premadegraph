# Claude Code Prompt: Graph V2 Research Analysis

You are analyzing the Graph Builder V2 outputs for this thesis project.

Your goal is to draw technically defensible conclusions from the generated Graph V2 metadata and identify what should be improved in the assortativity and signed-balance analysis pipeline.

## Primary Files To Read First

Start with these summaries:

- `backend/data/cache/flexset/graph-v2/summary.md`
- `backend/data/cache/soloq/graph-v2/summary.md`

Then inspect the adjacent artifact files for each dataset:

- `manifest.json`
- `cluster_meta.json`
- `node_meta.json`
- `node_metrics.u32`
- `edge_pairs.u32`
- `edge_props.u32`

The `default` and `smoke-test-dataset` summaries may exist, but if they report `0 nodes`, treat them only as readiness markers.

## Dataset Interpretation

Use `flexset` as the primary signed-network dataset.

Use `soloq` only as a control or comparison dataset for individual-performance distributions. Do not treat SoloQ as equivalent to the Flex Queue relationship graph.

Important:

- Flex Queue can support signed-network conclusions because it contains repeated ally/enemy relations.
- SoloQ should not be used to claim stable social structure unless the data explicitly supports it.
- Keep Flex and SoloQ conclusions separated.

## What To Analyze

Focus on:

1. Numeric assortativity for `opscore`
2. Numeric assortativity for `feedscore`
3. Signed structural balance on ally/enemy triads
4. Bridge behavior from cluster metadata
5. Whether current Graph V2 metadata is sufficient for ML-oriented feature extraction
6. Whether the current analysis code is using the right graph projection

Do not work on:

- temporal consistency
- player stability over time
- cohesion-vs-performance dashboards
- causal psychology claims
- Contraction Hierarchies

These are out of scope for the current thesis direction.

## Graph Semantics

The Graph V2 projection uses:

- `ally_weight`: same-team co-occurrence count
- `enemy_weight`: opposite-team exposure count
- visible relation: `ally` when `ally_weight >= enemy_weight`, otherwise `enemy`
- visible edge threshold: `total_matches >= 2`
- cluster membership threshold: `ally_weight >= 2`
- bounded ally groups capped at 20 members
- oversized ally components split deterministically
- enemy-only edges must not merge clusters

Treat `orbitScore` and `orbitRadius` as visualization heuristics, not research labels.

They can be compared against later centrality results, but they are not ground truth.

## Artifact Decoding Notes

Use `manifest.json` for stride and encoding information.

Expected node metric order:

1. `totalDegree`
2. `allyDegree`
3. `enemyDegree`
4. `totalSupport`
5. `highlightFlags`
6. `matchCount`

Expected edge property encoding:

- bit 0 stores relation
  - `0 = ally`
  - `1 = enemy`
- remaining bits store support weight

Use `node_meta.json` to map metric rows back to player ids, names, `opscore`, `feedscore`, and cluster ids.

Use `cluster_meta.json` for cluster-level features:

- `memberCount`
- `internalAllyEdgeCount`
- `enemyCrossClusterEdgeCount`
- `crossAllySupport`
- `connectedAllyClusterCount`
- `orbitScore`
- `orbitRadius`
- highlighted best/worst players

## Required Outputs

Produce a concise Markdown report with these sections:

### 1. Dataset Readiness

For `flexset` and `soloq`, report:

- match count
- visible node count
- visible edge count
- ally edge count
- enemy edge count
- cluster count
- largest cluster size
- missing `opscore` coverage
- missing `feedscore` coverage

State whether each dataset is suitable for:

- signed-balance analysis
- assortativity analysis
- ML feature extraction

### 2. Assortativity Plan

Define exactly how assortativity should be computed:

- graph projection
  - ally-only
  - enemy-only
  - battle-path/all signed visible edges
  - cross-cluster bridge-only
  - internal-cluster ally-only
- attribute
  - `opscore`
  - `feedscore`
- formula
  - numeric Pearson correlation across edge endpoints
- filtering
  - exclude missing metric values
  - report skipped edges and skipped nodes
  - consider minimum `matchCount` threshold if needed

Identify whether current implementation matches this plan. If not, list specific code changes needed.

### 3. Signed Balance Plan

Define exactly how signed triads should be analyzed:

- use collapsed signed simple graph
- ally = positive
- enemy = negative
- valid triad = fully connected triple
- include threshold rule for edge support
- report balanced and unbalanced triad counts
- report triad type distribution
- report top nodes participating in unbalanced triads

Check whether the current implementation is using the intended sign and threshold semantics.

### 4. ML Feature Schema

Propose feature rows for:

- node-level ML
- edge-level ML
- cluster-level ML

For each feature schema, mark:

- usable now
- needs more validation
- should not be used because of leakage or weak meaning

Avoid using player id or player name as predictive features.

### 5. Findings

List the strongest findings that can be defended from the metadata.

Use cautious phrasing:

- "appears correlated"
- "under this graph projection"
- "suggests a candidate relationship"
- "requires validation"

Do not use:

- "proves"
- "causes"
- "toxic players attract toxic players"
- broad psychological claims

### 6. Recommended Code Fixes

If you find problems in the current assortativity or signed-balance code, propose concrete fixes with file paths.

Prefer Rust-side fixes for core graph algorithms.

Do not start with frontend work unless the backend result schema is already correct.

## Validation Requirements

Before calling any conclusion reliable, check:

- graph construction rule matches the summary
- dataset id matches the artifact path
- Graph V2 version is `graph-builder-v2.2`
- clustering version is `bounded-ally-groups-v2`
- layout version is `bridge-orbit-layout-v1`
- largest cluster size is `<= 20`
- metric coverage is sufficient
- repeated runs are deterministic where applicable

## Final Deliverable

Write a report to:

`docs/graph-v2-claude-analysis-report.md`

Keep it research-focused and implementation-useful.

Include:

- conclusions
- caveats
- code changes recommended
- analysis experiments to run next
- whether `flexset` and `soloq` should be handled differently

