# CLAUDE.md

This file is a structural map for future Claude/Codex sessions. It is meant to reduce architecture rediscovery, not to replace reading the specific files involved in a change.

## Project Identity

Premade Graph is a League of Legends thesis project that collects match data, builds player relationship graphs, and analyzes them through a Node/Express API, a Rust graph-analytics runtime, and a React/Vite frontend.

The current thesis direction is research-and-systems oriented:

- expand and document datasets first
- analyze signed ally/enemy graph structure with Structural Balance Theory
- measure performance-metric assortativity on graph edges
- compute betweenness centrality with Rust Brandes + Rayon
- later seed Genetic NeuroSim v2 from validated graph/player profiles

Contraction Hierarchies, temporal consistency/player stability, and community cohesion vs performance are out of scope unless the owner explicitly reopens them.

## High-Level Architecture

```text
frontend/ React + Vite UI
    |
    | HTTP fetches to localhost:3001
    v
backend/server.js Express API shell
    |
    | orchestrates SQLite, collector scripts, Python graph scripts,
    | and Rust pathfinder/analytics commands
    v
backend/pathfinder-rust Rust runtime
    |
    | loads match JSON + SQLite player rows, builds GraphState,
    | runs pathfinding and graph analytics
    v
datasets / SQLite / generated graph artifacts
```

Main responsibility split:

- Python scripts: match collection, older graph-building and clustering workflows, country/enrichment helpers.
- SQLite databases: player metadata, raw/refined scores, clusters, pathfinder replays.
- Node/Express: frontend-facing API, dataset registry, collector orchestration, runtime key management, Rust process bridge.
- Rust: canonical runtime graph projection, exact pathfinding, signed balance, assortativity, betweenness centrality, 3D graph bundle exports.
- React/Vite: analysis pages, graph exploration, pathfinder playback, dataset/key controls.

## Root Files

- `package.json`: root dev entrypoint. `npm run dev` starts backend and frontend concurrently.
- `docker-compose.yml`: container setup for backend and frontend.
- `playersrefined.db`: root-level refined player database used by current/default workflows.
- `AGENTS.md`: planning and scope rules. Read before starting research-feature work.
- `README.md`: user-facing overview and command examples.
- `docs/`: thesis notes, implementation plans, diagrams, and feature framing.

## Backend Structure

Primary entry point:

- `backend/server.js`: large Express API shell. It owns most HTTP routes, dataset selection, collector lifecycle, runtime key management, SQLite helpers, replay storage, cache serving, and Rust command calls.

Important backend files:

- `backend/pathfinder/rustBridge.js`: Node bridge to the Rust binary. It resolves the newest built binary, can run one-shot commands, and can keep a long-lived `serve` daemon for repeated Rust calls.
- `backend/match_collector.py`: Riot API match collector.
- `backend/collector_configs/`: named collection presets such as Apex Flex and Master SoloQ.
- `backend/build_graph.py`: older Python graph builder.
- `backend/cluster_persistence.py`: shared cluster persistence helper.
- `backend/add_new_players.js`: inserts raw player score rows.
- `backend/normalize_players_by_puuid.js`: normalizes player identities by PUUID.
- `backend/scoring_config.js`: score-related config used by backend scoring surfaces.
- `backend/pathfinder_replays.db`: replay persistence for pathfinder runs.
- `backend/data/`: dataset registry and dataset-local match/db/cache storage.
- `backend/clusters/` and `backend/output/`: generated graph/clustering artifacts.

Important API groups in `backend/server.js`:

- `/api/datasets*`: dataset registry, creation, selection, dataset info.
- `/api/runtime-keys*`: runtime API keys such as Riot and OpenRouter.
- `/api/match-collector*`: collector config, presets, status, start/stop.
- `/api/riot/*`: Riot API relay endpoints.
- `/api/players/*` and `/api/scores/*`: player options, score details, leaderboards.
- `/api/generate-graph`, `/api/graph`, `/api/normalize-players`: graph/data maintenance.
- `/api/pathfinder/*`: older JS/prototype pathfinder endpoints.
- `/api/pathfinder-rust/*`: Rust pathfinding, analytics, graph-v2, birdseye, and export endpoints.
- `/api/pathfinder-replays*`: saved replay CRUD.

## Rust Runtime

Rust crate:

- `backend/pathfinder-rust/Cargo.toml`
- binary name: `pathfinder_rust`
- dependencies include `serde`, `serde_json`, `rusqlite` with bundled SQLite, and `rayon`.

Entry points:

- `backend/pathfinder-rust/src/main.rs`: command dispatch. Supports one-shot CLI commands and `serve` mode with JSON line envelopes.
- `backend/pathfinder-rust/src/engine.rs`: public orchestration layer over the engine modules.
- `backend/pathfinder-rust/src/models.rs`: request/response contracts shared by commands.

Engine modules:

- `engine/graph.rs`: builds `GraphState` from match data and SQLite rows. Owns adjacency, signed pair relations, player rows, clusters, landmarks, and snapshots.
- `engine/search.rs`: BFS, Dijkstra, bidirectional search, and exact A*.
- `engine/signed_balance.rs`: Structural Balance Theory analysis over signed triads.
- `engine/assortativity.rs`: numeric assortativity for `opscore` and `feedscore`.
- `engine/centrality.rs`: weighted Brandes betweenness centrality with serial/parallel modes.
- `engine/experiments.rs`: sensitivity/permutation-style experiment runners.
- `engine/birdseye.rs`: exports full 3D birdseye artifacts.
- `engine/graph_v2.rs`: exports graph-v2 artifacts.

Core Rust graph concepts:

- `GraphState`: central runtime graph representation. Prefer extending this rather than inventing another graph model.
- `Neighbor`: adjacency entry with `ally_weight`, `total_matches`, and `dominant_relation`.
- `PairRelation`: collapsed undirected pair evidence with `ally_weight`, `enemy_weight`, `total_matches`, and `dominant_relation`.
- `social-path`: ally-only traversal.
- `battle-path`: ally or enemy traversal.
- weighted path cost: stronger relationships are cheaper; centrality uses the thesis rule `1 / strength` via integer scaling.

Rust commands exposed through the binary and Node bridge:

- `options`
- `global-view`
- `spec`
- `run`
- `compare`
- `player-focus`
- `signed-balance`
- `assortativity`
- `balance-sweep`
- `assortativity-significance`
- `betweenness-centrality`
- `birdseye-3d-export`
- `graph-v2-export`
- `serve`

Build the Rust binary before relying on backend Rust endpoints:

```bash
cd backend/pathfinder-rust
cargo build
```

## Frontend Structure

Frontend stack:

- React 19
- Vite
- React Router
- MUI
- Three.js
- TypeScript/TSX for most newer pages, with some older JSX components still present

Primary entry points:

- `frontend/src/App.tsx`: route tree, dataset/key state, sidebar layout, global actions.
- `frontend/src/AppNavbar.tsx`: navigation and dataset/runtime-key controls.
- `frontend/src/main.jsx`: React mount.
- `frontend/src/index.css` and `frontend/src/App.css`: global styling.
- `frontend/src/theme.ts`: MUI theme.
- `frontend/src/i18n.tsx`: English/Hungarian UI strings.

Main pages:

- `MatchAnalysisForm`: match/player score analysis.
- `MatchCollectorPage`: collector control surface.
- `GraphPage`: runtime graph view.
- `PlayerDetailPage`: player detail surface.
- `GraphSpherePage` / `GraphSphereScene`: full 3D graph sphere.
- `PathfinderLabPage`: shortest-path lab with playback and comparisons.
- `SignedBalancePage`: Structural Balance UI.
- `AssortativityPage`: assortativity UI.
- `BetweennessCentralityPage`: betweenness centrality UI.
- `DualAnalyticsView`: signed balance + assortativity combined analytics.

Shared frontend helpers:

- `pathfinderApi.ts`: Rust/API fetch helpers.
- `pathfinderTypes.ts`, `signedBalanceTypes.ts`, `assortativityTypes.ts`, `betweennessTypes.ts`, `graphV2Types.ts`: frontend contracts.
- `analyticsState.ts`: persisted analytics run state and interpretation helpers.
- `analyticsComponents.tsx`: reusable analytics display components.
- mock files such as `pathfinderMocks.ts`, `signedBalanceMock.ts`, and `assortativityMock.ts` support demo/fallback flows.

## Data And Artifact Flow

1. Match collection stores raw match JSON and updates player databases.
2. Player normalization consolidates player identity by PUUID.
3. Graph construction collapses repeated co-presence into ally/enemy pair evidence.
4. Rust loads match files and SQLite rows into `GraphState`.
5. Rust commands produce JSON analysis responses or precomputed artifact bundles.
6. Express exposes responses and streams artifact files to the frontend.
7. React pages visualize search, analytics, datasets, and graph exports.

Dataset support is centered in `backend/server.js`:

- active dataset selection controls database path, match path, cache path, and Rust environment overrides
- switching datasets clears Rust runtime/cache state
- graph-v2 routes support both active dataset and dataset-specific URL forms

## Research Feature Boundaries

When touching research features, preserve these boundaries:

- Build core algorithms in Rust first.
- Keep Express as orchestration and API translation, not the place for graph algorithms.
- Add frontend visualization only after the algorithm result schema is stable.
- Keep Flex Queue graph conclusions separate from SoloQ control-dataset conclusions.
- Document thresholds, graph mode, node/edge/sample counts, and dataset source in outputs.
- Avoid social or psychological causal claims; phrase results as graph/statistical observations.

Current active research modules:

- Signed Balance: `engine/signed_balance.rs`, `SignedBalancePage.tsx`, docs in `docs/signed-balance-theory.md` and `docs/thesis-framework-signed-balance-and-assortativity.md`.
- Assortativity: `engine/assortativity.rs`, `engine/experiments.rs`, `AssortativityPage.tsx`, docs in `docs/assortativity-analysis.md`.
- Betweenness Centrality: `engine/centrality.rs`, `BetweennessCentralityPage.tsx`, docs in `docs/parallel-brandes-implementation-plan.md`.
- Dataset expansion: `backend/collector_configs/`, `backend/match_collector.py`, docs in `docs/apex-flex-collection-strategy.md`, `docs/master-soloq-eune-collection-strategy.md`, and `docs/multi-dataset-architecture.md`.
- Genetic NeuroSim v2 planning: docs in `docs/premadegraph-x-genetic-neurosim-integration-plan.md`.

## Development Commands

From the repository root:

```bash
npm install
npm run dev
```

This starts:

- backend: `http://localhost:3001`
- frontend: `http://localhost:5173`

Frontend only:

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
```

Backend only:

```bash
node backend/server.js
```

Rust:

```bash
cd backend/pathfinder-rust
cargo build
cargo run -- spec
```

Example Rust analysis commands:

```bash
echo '{"minEdgeSupport":2,"tiePolicy":"exclude","maxTopNodes":10,"includeClusterSummaries":true}' | cargo run -- signed-balance
echo '{"minEdgeSupport":1,"includeClusterBreakdown":true}' | cargo run -- assortativity
echo '{"pathMode":"battle-path","weightedMode":true,"parallel":true,"runSerialBaseline":true}' | cargo run -- betweenness-centrality
```

## Before Editing

- Check `AGENTS.md` for scope constraints before adding research features.
- Prefer `rg`/`rg --files` for navigation.
- Be careful with existing user changes; this repo may have a dirty worktree.
- Do not refactor broad files like `backend/server.js` unless the task requires it.
- Prefer `GraphState` and existing Rust models for graph analytics.
- Keep result contracts explicit and JSON-serializable.
- For UI work, follow existing page/component patterns and avoid UI-first algorithm design.

## Good First Places To Look

- Need API behavior? Start in `backend/server.js`, then `backend/pathfinder/rustBridge.js`.
- Need graph semantics? Start in `backend/pathfinder-rust/src/engine/graph.rs`.
- Need request/response contracts? Start in `backend/pathfinder-rust/src/models.rs` and the matching `frontend/src/*Types.ts`.
- Need pathfinding behavior? Start in `engine/search.rs` and `PathfinderLabPage.tsx`.
- Need signed balance? Start in `engine/signed_balance.rs` and `SignedBalancePage.tsx`.
- Need assortativity? Start in `engine/assortativity.rs`, `engine/experiments.rs`, and `AssortativityPage.tsx`.
- Need centrality? Start in `engine/centrality.rs` and `BetweennessCentralityPage.tsx`.
- Need 3D graph artifacts? Start in `engine/birdseye.rs`, `engine/graph_v2.rs`, `GraphSpherePage.tsx`, and `GraphV2Scene.tsx`.

