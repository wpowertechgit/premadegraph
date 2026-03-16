# Premade Graph

[English](README.md) | [Magyar](README.hu.md)

`premadegraph` is a thesis project for building, analyzing, and visualizing player relationship graphs from League of Legends match data.

The repository combines:

- match collection and player normalization
- Python-based graph generation and clustering
- a Node/Express backend
- a React/Vite frontend
- a Rust pathfinding engine for real graph search

## Overview

The project turns repeated player co-occurrence into a graph and uses it for two related goals:

- population analysis and cluster visualization
- pathfinding between players with interactive frontend playback

The current system supports:

- filtered graph generation with `min_weight >= 2`
- SQLite-backed cluster persistence
- Rust-backed BFS, Dijkstra, Bidirectional search, and exact A*
- global graph, player focus, and route-oriented runtime views

## Repository Structure

### Root

- `package.json`: root dev entrypoint for frontend + backend
- `docker-compose.yml`: containerized frontend/backend setup
- `playersrefined.db`: enriched SQLite database used by graph generation and Rust runtime
- `docs/`: technical documentation

### Backend

- `backend/server.js`: Express API shell
- `backend/build_graph.py`: graph builder with connected-component style clustering
- `backend/new_build_graph.py`: newer modularity/community-based graph builder
- `backend/cluster_persistence.py`: shared SQLite cluster persistence helper
- `backend/match_collector.py`: Riot API crawler
- `backend/add_new_players.js`: raw player ingestion
- `backend/normalize_players_by_puuid.js`: player normalization
- `backend/pathfinder/`: Node pathfinder implementation and Rust bridge
- `backend/pathfinder-rust/`: Rust graph runtime and search engine
- `backend/data/`: raw match JSON files
- `backend/clusters/`: exported cluster JSON files
- `backend/output/`: generated HTML graph output

### Frontend

- `frontend/`: React + Vite application
- `frontend/src/PathfinderLabPage.tsx`: main pathfinder view
- `frontend/src/PathfinderGraphOverlay.tsx`: fullscreen graph exploration overlay

## Graph And Cluster Model

The project now stores clusters as first-class database entities.

Two cluster families coexist:

- `python_population`
  - produced by the Python graph pipeline
  - used for population analysis and country inference
- `rust_pathfinding`
  - produced by the Rust runtime
  - used for filtered runtime graph structure, player focus, and A* heuristics

Both are persisted in SQLite through:

- `clusters`
- `cluster_members`

Weak one-off noise is filtered by default through repeated-tie thresholds, currently centered on `weight >= 2`.

## Pathfinder Model

The pathfinder currently supports:

- `social-path`
  - ally-only traversal
- `battle-path`
  - traversal across both ally and enemy relationships

Weighted mode means stronger repeated relationships become cheaper to traverse.

In practice:

- unweighted mode treats every valid edge equally
- weighted mode prefers stronger repeated ties

Rust A* uses:

- landmark-based lower bounds
- cluster-hop lower bounds
- layout distance only as a tie-break

## Quick Start

### Local Development

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

This starts the frontend and backend containers together.

## Main Workflows

### 1. Collect Match Data

Run from `backend/`:

```bash
python match_collector.py
```

Important script-level settings include:

- `MATCHES_PER_PLAYER`
- `MAX_ITERATIONS`
- `QUEUE_TYPE`
- Riot API pacing / rate limit controls

### 2. Add And Normalize Players

Run from `backend/`:

```bash
node add_new_players.js
node normalize_players_by_puuid.js
```

### 3. Generate The Filtered Graph

Run from `backend/`:

```bash
python new_build_graph.py --connected-only --min-weight 2
```

This will:

- build the co-presence graph from real matches
- enrich nodes from `playersrefined.db`
- detect communities
- write JSON artifacts into `backend/clusters/`
- persist `python_population` clusters into SQLite
- generate `backend/output/premade_network.html`

### 4. Country Prediction Pipeline

Optional scripts in `backend/`:

```bash
python fetch_clusters.py
python assign_countries.py
```

These use cluster exports plus player names to estimate regional origin and update player records in SQLite.

### 5. Rust Pathfinder Runtime

Run from `backend/pathfinder-rust/`:

```bash
cargo run -- options
```

To run a search:

```bash
echo '{"sourcePlayerId":"...","targetPlayerId":"...","algorithm":"astar","pathMode":"social-path","weightedMode":true,"options":{"includeTrace":false,"maxSteps":5000}}' | cargo run -- run
```

## Environment Variables

Useful variables across the project:

- `RIOT_API_KEY`
- `GRAPH_DB_PATH`
- `DB_PATH`
- `OPENROUTER_API_KEY`
- `PATHFINDER_MATCH_DIR`
- `PATHFINDER_RUST_BIN`

## Documentation

- [Rust Backend Prototype Notes](docs/pathfinder-backend-prototype.md)
- [Unified Cluster Persistence And Exact A*](docs/unified-cluster-persistence-and-astar.md)

## License

This repository is licensed under the [MIT License](LICENSE).
