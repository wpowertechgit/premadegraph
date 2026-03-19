# <img src="frontend/public/mushroom-icon-256.png" alt="Premade Graph logo" width="42" align="left"> Premade Graph

<br />

[English](README.md) | [Magyar](README.hu.md)

![Thesis](https://img.shields.io/badge/focus-thesis%20project-1f6feb?style=flat-square)
![Frontend](https://img.shields.io/badge/ui-React%20%2B%20Vite-0f766e?style=flat-square)
![Backend](https://img.shields.io/badge/backend-Node%20%2B%20Rust-7c3aed?style=flat-square)
![Analytics](https://img.shields.io/badge/analytics-signed%20graphs%20%2F%20pathfinding-c2410c?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-111827?style=flat-square)

**Premade Graph** is a League of Legends player-network thesis project for collecting match history, building repeated co-play graphs, analyzing signed relationships, and exploring the result through a polished interactive frontend.

![Match analysis surface](docs/assets/demo_shots/match-analysis-page.png)

![3D bird's-eye sphere](docs/assets/demo_shots/birds-eye-current-state.png)

It combines:

- match collection and player normalization
- Python graph generation and clustering
- SQLite-backed cluster persistence
- a Node/Express API layer
- a Rust runtime for exact pathfinding and graph analytics
- a React/Vite frontend for immersive exploration

## Why This Project Is Interesting

This repository is not just a static network viewer. It is a research-and-systems playground built around an unusual dataset: a **signed social graph** where repeated ally and enemy interactions can both be analyzed.

The current project direction emphasizes:

- interpretable graph analytics
- reproducible Rust-side computation
- thesis-friendly experiments
- visually strong interactive demos

## Recent UI And Analytics Upgrades

The current build now includes a much richer 3D graph presentation and analysis flow:

- a precomputed **full 3D graph sphere** for large-scale exploration
- a **lit globe / gas-giant style shell** so the sphere stays readable from far away
- a **background star field** for cleaner spatial depth
- **denser cluster rendering** with soft outline shells for visual separation
- **zoom-reactive edge visibility** so actual match links become more legible up close
- a **collapsible info card** in the sphere view, tucked behind an info icon
- Rust-backed **signed structural-balance analysis**
- cluster-aware pathfinding views with BFS, Dijkstra, Bidirectional search, and exact A*

## Frontend Experience

| Surface | What it is for |
| --- | --- |
| `Pathfinder Lab` | interactive shortest-path exploration with playback and algorithm comparison |
| `Full 3D Graph Sphere` | bird's-eye exploration of the whole named-player network |
| `Signed Balance` | structural-balance experiment over ally/enemy relationships |
| player focus / global graph views | runtime graph inspection from the Rust engine |

The current frontend includes both analysis-heavy data surfaces and more visual graph exploration views:

![Pathfinder replay panel](docs/assets/demo_shots/pathfinder-replay-panel.png)

## Architecture Snapshot

| Layer | Responsibility |
| --- | --- |
| Python pipeline | match-derived graph building, clustering, export workflows |
| SQLite | shared persistence for clusters and enriched player metadata |
| Node/Express backend | API shell, orchestration, frontend-facing endpoints |
| Rust runtime | exact pathfinding, runtime graph views, signed-balance analysis |
| React/Vite frontend | graph UI, controls, overlays, 3D exploration |

<details open>
<summary><strong>Quick Start</strong></summary>

### Local development

From the repository root:

```bash
npm install
npm run dev
```

This starts:

- frontend on `http://localhost:5173`
- backend on `http://localhost:3001`

### Docker

If Docker Desktop is running:

```bash
docker compose up --build
```

</details>

<details>
<summary><strong>Main Workflows</strong></summary>

### 1. Collect match data

Run from `backend/`:

```bash
python match_collector.py
```

Important script-level knobs include:

- `MATCHES_PER_PLAYER`
- `MAX_ITERATIONS`
- `QUEUE_TYPE`
- Riot API pacing / rate-limit controls

### 2. Add and normalize players

Run from `backend/`:

```bash
node add_new_players.js
node normalize_players_by_puuid.js
```

### 3. Generate the filtered graph

Run from `backend/`:

```bash
python new_build_graph.py --connected-only --min-weight 2
```

This will:

- build the co-presence graph from real matches
- enrich players from `playersrefined.db`
- detect communities
- write JSON artifacts into `backend/clusters/`
- persist `python_population` clusters into SQLite
- generate `backend/output/premade_network.html`

### 4. Country-prediction pipeline

Optional scripts in `backend/`:

```bash
python fetch_clusters.py
python assign_countries.py
```

### 5. Rust runtime commands

Run from `backend/pathfinder-rust/`:

```bash
cargo run -- options
```

Example search run:

```bash
echo '{"sourcePlayerId":"...","targetPlayerId":"...","algorithm":"astar","pathMode":"social-path","weightedMode":true,"options":{"includeTrace":false,"maxSteps":5000}}' | cargo run -- run
```

Signed structural-balance analysis:

```bash
echo '{"minEdgeSupport":2,"tiePolicy":"exclude","maxTopNodes":10,"includeClusterSummaries":true}' | cargo run -- signed-balance
```

Backend endpoint:

```text
POST /api/pathfinder-rust/signed-balance
```

</details>

<details>
<summary><strong>Repository Map</strong></summary>

### Root

- `package.json`: root development entrypoint
- `docker-compose.yml`: frontend/backend container setup
- `playersrefined.db`: enriched SQLite database
- `docs/`: technical notes and architecture writeups

### Backend

- `backend/server.js`: Express API shell
- `backend/build_graph.py`: original graph builder
- `backend/new_build_graph.py`: modularity/community-based graph builder
- `backend/cluster_persistence.py`: shared cluster persistence helper
- `backend/match_collector.py`: Riot crawler
- `backend/add_new_players.js`: raw player ingestion
- `backend/normalize_players_by_puuid.js`: player normalization
- `backend/pathfinder/`: Node pathfinder and Rust bridge
- `backend/pathfinder-rust/`: Rust graph runtime and analytics
- `backend/data/`: raw match JSON files
- `backend/clusters/`: exported cluster JSON files
- `backend/output/`: generated HTML/network artifacts

### Frontend

- `frontend/`: React + Vite application
- `frontend/src/PathfinderLabPage.tsx`: pathfinder experience
- `frontend/src/GraphSpherePage.tsx`: full 3D graph sphere
- `frontend/src/SignedBalancePage.tsx`: signed-balance UI

</details>

## Graph And Cluster Model

The project stores clusters as first-class database entities.

Two cluster families coexist:

- `python_population`
  - produced by the Python pipeline
  - used for population analysis and country inference
- `rust_pathfinding`
  - produced by the Rust runtime
  - used for runtime graph structure, player focus, and heuristic support

Persistence tables:

- `clusters`
- `cluster_members`

Weak one-off noise is filtered by repeated-tie thresholds, currently centered on `weight >= 2`.

## Pathfinder Model

Supported path modes:

- `social-path`
  - ally-only traversal
- `battle-path`
  - traversal across ally and enemy relationships

Weighted mode makes stronger repeated relationships cheaper to traverse.

Rust A* currently uses:

- landmark-based lower bounds
- cluster-hop lower bounds
- layout distance only as a tie-break

## Environment Variables

Useful variables across the project:

- `RIOT_API_KEY`
- `GRAPH_DB_PATH`
- `DB_PATH`
- `OPENROUTER_API_KEY`
- `PATHFINDER_MATCH_DIR`
- `PATHFINDER_RUST_BIN`

## Documentation

The documentation set is intentionally cross-linked so the project can later be lifted into a thesis-style LaTeX structure with minimal reshuffling.

- start from [New GUI Overview](docs/new-gui-overview.md) for the frontend narrative
- use [Route Transition Overlay](docs/route-transition-overlay.md) for the motion-system subsection
- use [Bird's-Eye 3D Sphere](docs/birdseye-3d-sphere.md) for the global 3D visualization subsection
- use [Signed Balance Theory And Implementation](docs/signed-balance-theory.md) for the signed-network experiment subsection
- use [Mock Datasets And Chaos Design](docs/mock-datasets-and-chaos-design.md) for synthetic evaluation and demo methodology
- use [Unified Cluster Persistence And Exact A*](docs/unified-cluster-persistence-and-astar.md) for storage/runtime architecture
- use [Pathfinder Backend Prototype Notes](docs/pathfinder-backend-prototype.md) for backend migration history

- [New GUI Overview](docs/new-gui-overview.md)
- [Route Transition Overlay](docs/route-transition-overlay.md)
- [Bird's-Eye 3D Sphere](docs/birdseye-3d-sphere.md)
- [Signed Balance Theory And Implementation](docs/signed-balance-theory.md)
- [Mock Datasets And Chaos Design](docs/mock-datasets-and-chaos-design.md)
- [Rust Backend Prototype Notes](docs/pathfinder-backend-prototype.md)
- [Unified Cluster Persistence And Exact A*](docs/unified-cluster-persistence-and-astar.md)

## License

This repository is licensed under the [MIT License](LICENSE).

## Conclusions

At this stage, the repository is best understood as a combined research and systems project:

- the Rust runtime carries the algorithmic core
- the frontend turns that core into a coherent interactive experience
- the analytics and mock layers make the system easier to validate, explain, and later adapt into thesis chapters
