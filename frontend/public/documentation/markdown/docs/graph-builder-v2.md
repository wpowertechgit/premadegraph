# Graph Builder V2

## Summary

Graph Builder V2 replaces the current Python/PyVis associative population graph workflow with a Rust-first, dataset-aware graph artifact pipeline (that is exposed on the /graph page).

The current endpoint still runs:

```js
app.post("/api/generate-graph", (req, res) => {
  execFile("python", ["build_graph.py", "--connected-only", "--min-weight", "2"])
})
```

That workflow should remain available for now as a legacy compatibility path, but it should not be the future thesis/demo graph builder. It struggles with large graphs because it produces a standalone browser-heavy HTML visualization rather than a scalable graph artifact model.

The new direction is:

- keep `min_weight = 2` as the base population render threshold
- build graph state in Rust
- use `flexset` as the main signed-network dataset
- cluster before rendering
- always generate the graph of the selected dataset
- export cached binary artifacts for progressive WebGL rendering
- keep ally/enemy relation data available
- expose enemy edges as a frontend toggle
- preserve subtle interactive physics, cluster separation, and draggable nodes
- connect pathfinder overlays through click-selected players

Country-based clustering/workflow should be retired from the future thesis path. Country metadata can remain in legacy data, but it should not drive the research graph.

## Current State

The project currently has two graph paths:

1. Legacy Python graph builder
   - `backend/build_graph.py`
   - called by `/api/generate-graph`
   - uses NetworkX and PyVis
   - emits `output/premade_network.html`
   - filters with `--connected-only --min-weight 2`

2. Rust runtime graph
   - `backend/pathfinder-rust`
   - already builds signed pair relations
   - supports `social-path` and `battle-path`
   - powers pathfinder, signed balance, assortativity, and bird's-eye artifacts

Graph Builder V2 should evolve the Rust runtime path rather than extending the Python HTML generator.

## Decision

Use a Rust-first graph builder pipeline for future large population rendering.

The Python builder remains temporarily available, but its role becomes legacy/debug only.
!!!!THE NEW GRAPH BUILDER IS REPLACING THE ASSOCIATIVE GRAPH!!!! DOESN'T INTERFERE WITH THE 3D BIRD'S EYE VIEW!!!!
Graph Builder V2 will own:

- match scan
- signed pair accumulation
- min-support filtering
- clustering
- layout preparation
- cached artifact export
- frontend graph rendering contract

Express should remain a thin orchestration layer. The browser should render already-prepared graph artifacts instead of building or laying out the graph itself.

## Dataset Scope

The primary dataset is `flexset`.

Expected scale:

- 3000-5000+ matches
- 5000+ visible players
- tens of thousands of relationships
- repeated ally and enemy evidence

`soloq` remains a control dataset for individual performance distributions. It should not be treated as equivalent to the Flex Queue signed relationship graph.

Before real Graph Builder V2 results are considered valid, the active dataset must have:

- populated refined player database
- documented match count
- documented player count
- documented edge count
- documented graph construction rule
- documented min-support threshold

## Graph Semantics

Each player pair should be represented once with signed relationship evidence:

```txt
player_a
player_b
ally_weight
enemy_weight
total_matches
dominant_relation
```

Rules:

- `ally_weight`: number of matches where both players were on the same team
- `enemy_weight`: number of matches where players were on opposite teams
- `total_matches = ally_weight + enemy_weight`
- `dominant_relation = ally` when `ally_weight >= enemy_weight`
- `dominant_relation = enemy` when `enemy_weight > ally_weight`

The population render keeps edges where:

```txt
total_matches >= 2
```

This threshold is not removed. It is the baseline population graph.

## Clustering

Clustering should be updated for thesis value, not just visual grouping.

Use deterministic Rust-side research clustering as the main future direction.

Default clustering graph:

```txt
ally_weight >= 2
```

Reason:

- ally ties represent repeated same-team relationships
- enemy-only ties can connect large parts of the dataset too aggressively
- clustering through enemy-only edges weakens the interpretation of communities
- enemy evidence remains available for analysis and toggled rendering

Recommended first implementation:

- deterministic repeated-ally components as the raw connectivity layer
- split oversized connected components into bounded local ally groups for visual/research cluster reporting
- keep cross-group ally links visible as bridge relationships instead of using them to merge groups
- then evaluate Louvain/Leiden-style community detection later if needed

Cluster outputs should include:

- cluster id
- member count
- representative players
- best `opscore` member
- worst `feedscore` member
- explicit highlight metadata for players who are best `opscore`, worst `feedscore`, or both
- internal ally edge count
- enemy/cross-cluster edge count
- deterministic layout anchor

Visual ally groups should be capped at roughly 20 players. This prevents long transitive teammate chains from being displayed as a single implausible premade cluster while preserving bridge players and bridge edges as meaningful cross-group structure.

Country-based clustering should not be part of V2.

## Rendering Strategy

The browser should not receive a huge JSON graph and run a full live force simulation.

Graph Builder V2 should export cached binary artifacts, similar to the existing bird's-eye pipeline:

```txt
manifest.json
summary.md
node_meta.json
node_positions.f32
node_metrics.u32
edge_pairs.u32
edge_props.u32
cluster_meta.json
```

The frontend should render with WebGL/Three.js.

`summary.md` is generated beside the binary artifacts as a machine-readable research context file. It records dataset id, dataset scale, construction semantics, metric coverage, node/edge/cluster feature candidates, top bridge-orbit clusters, and suggested downstream analysis questions for machine-learning-oriented work such as assortativity, signed balance, centrality comparison, and cluster embeddings. It must frame orbit fields as visual heuristics, not ground-truth labels.

Each graph generation also writes an immutable archive copy named `summary_<datasetId>_<generatedAtUnixMs>.md`. The plain `summary.md` file is the latest summary for API/UI access, while the archived summary files preserve previous runs so AI/ML analysis outputs are not silently replaced after rebuilds.

The summary should also include explicit instructions for a later AI or ML assistant:

- read the artifact identity and graph scale first
- treat artifact files as canonical data and the Markdown as interpretation context
- look into assortativity, signed balance, bridge centrality, edge support, metric coverage, and cluster-level feature distributions
- compare ally-only, enemy-only, battle-path, internal-cluster, and cross-cluster bridge projections explicitly
- report missing metric coverage before modeling `opscore` or `feedscore`
- avoid identity leakage from player ids/names
- avoid causal or psychological claims unless a separate experiment supports them

The old gravity feeling should be preserved as interaction polish, not as the source of truth for the layout.

Recommended approach:

- Rust computes stable base positions
- Rust layout places bounded ally groups on bridge-driven orbits so central broker groups sit closer to the invisible center while weakly connected groups remain farther out
- browser renders nodes and edges with typed arrays
- browser supports camera movement, hover, click, search, and filtering
- browser applies subtle local physics around the fixed layout to keep the graph feeling alive
- browser lets users drag individual nodes like the legacy PyVis view
- dragged nodes should remain interactive overlays on top of the stable Rust layout, not persisted research coordinates
- cluster highlight styling must show best `opscore`, worst `feedscore`, and the rare case where one player is both
- bridge-first styling must keep cross-group ally links visible while making dense internal and enemy edge layers secondary
- bounded ally groups should render as visible cluster objects, not just loose nodes:
  - translucent cluster fill
  - thick colored outline
  - thick internal unity strokes between members
  - member-to-member ally links stay available inside each cluster even when cross-cluster bridge links are disabled
  - node colors drawn above all edge and cluster layers
- pathfinder selection must be optional in the graph view:
  - no default source/target auto-selection
  - users can clear selected pathfinder players
  - users can switch to a cluster-only view that hides cross-cluster bridge and enemy layers while preserving each cluster's internal member links
- no browser-side global graph layout for the full dataset

The physics model should be intentionally restrained:

- gentle node repulsion inside dense local neighborhoods
- mild spring behavior toward the Rust-provided base position
- collision/spacing behavior that avoids label and node overlap where practical
- no full browser-side recomputation of cluster membership or global layout
- no physics setting that can merge separated clusters back together

## Enemy Edge Toggle

Enemy edges must be preserved in the graph model.

The frontend should expose enemy edges as a toggle:

- ally edges visible by default
- enemy edges hidden or faint by default
- toggle can reveal enemy edges
- relation bit is stored in `edge_props`
- toggling should not require rebuilding the graph

The default visual hierarchy should be:

1. cluster fill and outline
2. internal cluster unity strokes
3. internal ally member links
4. optional cross-cluster ally bridge edges
5. optional enemy edges
6. player nodes and selected path overlay

This ordering prevents the graph from becoming a dense line cloud where clusters and nodes disappear underneath edge overdraw.

Suggested edge encoding:

```txt
bit0 = relation
  0 = ally
  1 = enemy

remaining bits = support weight
```

This matches the existing bird's-eye direction.

## Pathfinder Overlay

Pathfinder should connect to the graph through click-selected players.

Interaction model:

1. user clicks a player node
2. first click sets source
3. second click sets target
4. frontend calls Rust pathfinder
5. returned path is highlighted over the graph
6. selected path mode controls whether enemy edges may be used

Path modes remain:

- `social-path`: ally-supported traversal only
- `battle-path`: ally and enemy traversal

The overlay should reuse the existing Rust endpoint behavior rather than creating a separate pathfinding graph. Likewise we use currently in our current model, e.g. GraphPage.tsx

## Proposed API Surface

Use versioned Rust-backed graph endpoints.

Example:

```txt
GET /api/pathfinder-rust/graph-v2/manifest
GET /api/pathfinder-rust/graph-v2/summary
GET /api/pathfinder-rust/graph-v2/node-meta
GET /api/pathfinder-rust/graph-v2/node-positions
GET /api/pathfinder-rust/graph-v2/node-metrics
GET /api/pathfinder-rust/graph-v2/edge-pairs
GET /api/pathfinder-rust/graph-v2/edge-props
GET /api/pathfinder-rust/graph-v2/cluster-meta
POST /api/pathfinder-rust/graph-v2/rebuild
```

These active-dataset endpoints are compatibility aliases. The preferred architecture is dataset-scoped serving:

```txt
GET /api/pathfinder-rust/datasets/:datasetId/graph-v2/manifest
GET /api/pathfinder-rust/datasets/:datasetId/graph-v2/summary
GET /api/pathfinder-rust/datasets/:datasetId/graph-v2/node-meta
GET /api/pathfinder-rust/datasets/:datasetId/graph-v2/node-positions
GET /api/pathfinder-rust/datasets/:datasetId/graph-v2/node-metrics
GET /api/pathfinder-rust/datasets/:datasetId/graph-v2/edge-pairs
GET /api/pathfinder-rust/datasets/:datasetId/graph-v2/edge-props
GET /api/pathfinder-rust/datasets/:datasetId/graph-v2/cluster-meta
POST /api/pathfinder-rust/datasets/:datasetId/graph-v2/rebuild
```

Graph V2 artifacts must be generated and served from the requested dataset's own cache directory:

```txt
backend/data/cache/<datasetId>/graph-v2/
```

The active dataset should not be treated as the canonical Graph V2 storage boundary. It is only a UI convenience. Dataset-scoped endpoints allow multiple dataset outputs to coexist and be compared without switching global state or overwriting another dataset's artifacts.

Datasets with no usable refined player table should still receive a valid empty Graph V2 summary. In that case `nodeCount = 0`, `edgeCount = 0`, and `clusterCount = 0` mean the dataset is not ready for graph-level conclusions yet. Analysis agents should treat those summaries as readiness markers, not failed exports.

The rebuild endpoint should be explicit. Normal page loads should use cached artifacts for the requested dataset.

## Cache Rules

Graph artifacts should be regenerated when any of these change:

- dataset id
- match input fingerprint
- player database fingerprint
- min support threshold
- graph builder version
- clustering algorithm version
- layout version

The backend must reject stale Graph V2 cache manifests. A cache is valid only when the manifest dataset id matches the active dataset and the manifest versions match the current expected versions:

- `graph-builder-v2.2`
- `bounded-ally-groups-v2`
- `bridge-orbit-layout-v1`

This prevents the old `ally-components-v1` / `cluster-grid-spiral-v1` artifact from being served after rebuilds. That old artifact can create fake mega-clusters such as a 2,983-player ally component, which violates the current bounded-group rule.

The manifest should record:

- dataset id
- latest summary file
- archived summary file
- match count
- player count
- node count
- edge count
- ally edge count
- enemy edge count
- cluster count
- min support threshold
- graph builder version
- layout version
- generation time
- artifact file sizes
- summary markdown file size

## Migration Plan

1. Keep `/api/generate-graph` unchanged for now.
2. Mark Python/PyVis graph generation as legacy in documentation.
3. Build Rust Graph Builder V2 beside the current Rust pathfinder graph.
4. Export V2 graph artifacts into the active dataset cache.
5. Add frontend loader for Graph Builder V2 artifacts.
6. Add ally/enemy edge visibility controls.
7. Add subtle local physics, visible cluster gaps, and draggable node interaction.
8. Add click-to-select source/target pathfinder overlay.
9. Validate on `flexset`.
10. Only after V2 is stable, retire the Python graph builder from the main UI.

## Validation Requirements

Graph Builder V2 is not done until these are true:

- pair relation construction is correct on tiny hand-checked match fixtures
- `min_weight = 2` filtering behaves exactly as documented
- ally-only clustering does not merge communities through enemy-only edges
- enemy edge toggle changes visibility without rebuilding artifacts
- cluster gaps remain visible at the default camera distance
- best `opscore`, worst `feedscore`, and combined highlight cases are visible and testable
- node dragging works without mutating persisted Rust layout artifacts
- pathfinder overlay can select players by click and highlight returned routes
- outputs are deterministic across reruns
- manifest records dataset and graph construction details
- browser can render the target population without freezing
- benchmark includes graph size, generation time, artifact sizes, and frontend load/render behavior

## Non-Goals

Do not include:

- Contraction Hierarchies
- temporal consistency analysis
- player stability timelines
- community cohesion vs performance
- country-based thesis claims
- UI-first graph rewrites before Rust artifacts are stable
- browser-side full force layout for the large graph
- unsupported social or psychological claims

## Thesis Framing

Graph Builder V2 should be framed as a scalable signed-network construction and rendering pipeline.

Its thesis value is that it enables:

- full Flex Queue population rendering
- signed graph exploration
- Structural Balance experiments
- Assortativity experiments
- pathfinding overlays
- future centrality and bridge-player analysis

The point is not just a bigger graph. The point is a more defensible research graph that can still be explored visually.
