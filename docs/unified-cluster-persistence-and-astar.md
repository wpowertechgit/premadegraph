# Unified Cluster Persistence And Exact A*

## Overview
This document describes the current graph architecture after the SQLite cluster persistence and Rust A* integration work.

The project now has two cluster systems that coexist in the same database:

- `python_population`: population / country-analysis clusters produced by the Python graph pipeline
- `rust_pathfinding`: strong-connection runtime clusters produced by the Rust graph engine

They serve different purposes and do not replace each other.

## Main Goals
- Persist clusters as first-class database entities instead of JSON-only artifacts
- Keep Python clustering for population analysis and country inference
- Build the runtime pathfinding graph directly in Rust from real match data and the player database
- Support exact A* with admissible lower bounds
- Keep the frontend contract stable enough to evolve without rewriting the whole UI

## Database Schema
Clusters are now stored in the same SQLite database as the player records.

### `clusters`
Stores cluster-level metadata:

- `cluster_id`
- `cluster_type`
- `algorithm`
- `size`
- `best_op`
- `worst_feed`
- `summary_json`
- `center_x`
- `center_y`
- `build_version`
- `updated_at`

### `cluster_members`
Stores normalized membership rows:

- `cluster_id`
- `puuid`
- `is_bridge`
- `is_star`
- `is_best_op`
- `is_worst_feed`
- `role_json`

The schema is created by [cluster_persistence.py](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/cluster_persistence.py) for Python writes and mirrored in the Rust runtime for Rust-side persistence.

## Python Cluster Pipeline
The Python side still owns the population-analysis cluster flow.

Relevant files:

- [build_graph.py](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/build_graph.py)
- [new_build_graph.py](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/new_build_graph.py)
- [fetch_clusters.py](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/fetch_clusters.py)

Current behavior:

- Builds a co-presence graph from real matches
- Filters weak ties with `min_weight >= 2`
- Detects communities or connected components depending on the script
- Saves JSON artifacts in `backend/clusters/`
- Upserts the resulting clusters into SQLite as `python_population`

This keeps the country/presentation pipeline intact while making the DB the authoritative runtime store.

## Rust Runtime Graph
The Rust engine no longer depends on the toy dataset for real execution. It now builds its graph directly from:

- raw match JSON files in `backend/data` or `PATHFINDER_MATCH_DIR`
- player metadata in `playersrefined.db` via `GRAPH_DB_PATH` / `DB_PATH`

Relevant files:

- [main.rs](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/pathfinder-rust/src/main.rs)
- [engine.rs](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/pathfinder-rust/src/engine.rs)
- [graph.rs](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/pathfinder-rust/src/engine/graph.rs)
- [search.rs](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/pathfinder-rust/src/engine/search.rs)

### Graph Layers
Rust builds two related graph views:

- Population graph:
  - undirected co-presence graph
  - used for global rendering
  - filtered to repeated ties with `weight >= 2`
- Pathfinder graph:
  - signed graph over the filtered node set
  - stores ally weight, total matches, and dominant relation
  - used for `social-path` and `battle-path` search

### Runtime Clusters
Rust pathfinding clusters are connected components over the filtered co-presence graph.

Current properties:

- weak one-off edges are ignored
- nodes outside the filtered graph are excluded from the runtime pathfinding/global view
- each cluster gets a generated center position
- each node gets a position relative to its cluster
- best-op and worst-feed members are derived from DB scores
- simple bridge candidates are inferred from cross-cluster connectivity

Rust then persists these as `rust_pathfinding` rows in SQLite.

## Search Algorithms
The runtime currently supports:

- BFS
- Dijkstra
- Bidirectional search
- A*

### Weighted Mode
Weighted mode means stronger repeated connections become cheaper to traverse.

Cost rule:

- unweighted: constant edge cost
- weighted: inverse-strength cost based on repeated interaction count

Interpretation by path mode:

- `social-path`: uses ally strength
- `battle-path`: uses total repeated matches

### Exact A*
A* is implemented as an exact shortest-path algorithm, not a visual shortcut.

Heuristic:

- `ALT` landmark lower bound on the runtime graph
- cluster-hop lower bound from cluster-to-cluster separation
- final heuristic is `max(alt_lb, cluster_lb)`

Tie-break only:

- layout distance is used only when ordering equal candidates
- it is not used as the correctness-bearing heuristic

That keeps A* admissible while still letting the visual cluster structure influence search order in a safe way.

## API Surface
Express remains the orchestration shell.

Relevant file:

- [server.js](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/server.js)

Rust-backed endpoints:

- `GET /api/pathfinder-rust/options`
- `GET /api/pathfinder-rust/global-view`
- `GET /api/pathfinder-rust/engine-spec`
- `POST /api/pathfinder-rust/run`
- `POST /api/pathfinder-rust/compare`
- `POST /api/pathfinder-rust/player-focus`

Node-backed endpoints still exist for the older pathfinder path.

## Frontend Integration
The frontend was updated so the execution modes and algorithm support stay consistent with the backend.

Relevant files:

- [PathfinderLabPage.tsx](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/frontend/src/PathfinderLabPage.tsx)
- [PathfinderControls.tsx](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/frontend/src/PathfinderControls.tsx)
- [PathfinderGraphOverlay.tsx](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/frontend/src/PathfinderGraphOverlay.tsx)
- [pathfinderTypes.ts](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/frontend/src/pathfinderTypes.ts)

Current behavior:

- execution modes are aligned as `frontend-demo`, `backend`, and `rust-backend`
- A* is only shown where the selected execution mode actually supports it
- weighted mode is available for both Dijkstra and A* where supported
- graph nodes can now carry cluster and role metadata in the response model

## Validation Performed
The implementation was verified with:

- `python -m py_compile backend/build_graph.py backend/new_build_graph.py backend/cluster_persistence.py backend/fetch_clusters.py`
- `cargo check`
- `cargo run -- options`
- `python new_build_graph.py --connected-only --min-weight 2`
- `npm run build`

Observed persisted cluster counts after validation:

- `python_population`: 271 clusters
- `rust_pathfinding`: 268 clusters

## Notes
- JSON cluster files are still useful as exports/debug artifacts, but they are no longer the main runtime source of truth.
- The real runtime graph is now driven by match data plus the player DB.
- The next logical frontend step is to consume the Rust `global-view` and `player-focus` endpoints directly instead of relying mainly on the preview snapshot path.
