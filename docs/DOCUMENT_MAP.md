---
title: Document Map
tags:
  - index
  - agent-reference
  - navigation
aliases:
  - Index
  - DocMap
  - Document Index
created: 2026-04-30
---

# Document Map

Agent-readable index of all docs in this vault. Each entry: path (relative to `docs/`), one-line description, topic tags.

> [!tip] For Agents
> Start here. Pick the section matching your task. Use wikilinks to jump to the target note.

---

## Thesis Core

Primary research documents. Start here for algorithm design, theoretical framing, and scope decisions.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[signed-balance-methodological-retirement]] | `signed-balance-methodological-retirement.md` | Authoritative scope decision — signed balance is downgraded to an experimental limitation case, not a central thesis result | `thesis` `signed-balance` `methodology` `retired-feature` |
| [[thesis-framework-signed-balance-and-assortativity]] | `thesis-framework-signed-balance-and-assortativity.md` | Superseded thesis framing — earlier signed balance + assortativity narrative; read the retirement note first | `thesis` `signed-balance` `assortativity` `graph-theory` `superseded` |
| [[signed-balance-theory]] | `signed-balance-theory.md` | Implementation note — triads, signed edges, ally/enemy classification; interpretation superseded by retirement note | `thesis` `signed-balance` `graph-theory` `backend` `superseded` |
| [[assortativity-analysis]] | `assortativity-analysis.md` | Assortativity experiment design — whether connected players have similar opscore/feedscore values | `thesis` `assortativity` `graph-theory` `analytics` |
| [[parallel-brandes-implementation-plan]] | `parallel-brandes-implementation-plan.md` | Rust parallel Brandes betweenness centrality — bridge nodes, community brokers, Rayon parallelism | `thesis` `betweenness` `rust` `graph-theory` `backend` |
| [[experiment-runners]] | `experiment-runners.md` | Rust experiment layer — signed-balance sensitivity diagnostics and assortativity significance tests | `thesis` `signed-balance` `assortativity` `rust` `backend` |
| [[project-feasibility-review-and-additions]] | `project-feasibility-review-and-additions.md` | Scope review — thesis direction validation and additions (parallel Brandes, experiment baselines) | `thesis` `planning` `betweenness` `architecture` |

---

## Data Collection

Dataset strategy, Riot API usage, and collection automation.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[apex-flex-collection-strategy]] | `apex-flex-collection-strategy.md` | Master+ Ranked Flex Queue EUNE collection using 10 seed players — primary premade dataset | `data-collection` `dataset` `planning` `thesis` |
| [[master-soloq-eune-collection-strategy]] | `master-soloq-eune-collection-strategy.md` | Master+ SoloQ EUNE collection — orthogonal performance baseline for genetic-neurosim seeding | `data-collection` `dataset` `planning` `genetic-neurosim` |
| [[riot-api-rate-limit-analysis]] | `riot-api-rate-limit-analysis.md` | Rate limit analysis — limits not the bottleneck; player discovery efficiency is the real constraint | `data-collection` `api` `performance` |
| [[multi-key-implementation-prompt]] | `multi-key-implementation-prompt.md` | Multi-key rotation for Riot API — combine rate limit buckets across keys to reduce collection time | `api` `backend` `data-collection` |
| [[mock-datasets-and-chaos-design]] | `mock-datasets-and-chaos-design.md` | Synthetic datasets for dev/demo/UI testing when full real dataset is unavailable | `dataset` `ux` `frontend` `data-collection` |

---

## Architecture & Backend

System design, data flow, and backend implementation docs.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[multi-dataset-architecture]] | `multi-dataset-architecture.md` | Multi-dataset architecture — independent datasets with separate DBs and analysis caches | `architecture` `database` `backend` `planning` |
| [[unified-cluster-persistence-and-astar]] | `unified-cluster-persistence-and-astar.md` | SQLite cluster persistence + Rust A* integration — canonical post-prototype architecture | `backend` `database` `architecture` `pathfinder` |
| [[graph-builder-v2]] | `graph-builder-v2.md` | Rust-first graph artifact pipeline replacing Python/PyVis — clusters, progressive WebGL rendering | `backend` `rust` `graph-theory` `architecture` |
| [[dynamic-opscore-system]] | `dynamic-opscore-system.md` | Dataset-scoped, role-aware player scoring — what does a player's performance profile look like | `backend` `analytics` `database` |
| [[pathfinder-backend-prototype]] | `pathfinder-backend-prototype.md` | Early backend-migration stage for pathfinding — request/response contracts, optional backend exec | `backend` `pathfinder` `architecture` `rust` |
| [[birdseye-3d-sphere]] | `birdseye-3d-sphere.md` | 3D global-view sphere — Rust artifact pipeline + frontend WebGL rendering layout | `frontend` `backend` `rust` `architecture` |

---

## Frontend & UX

UI pages, design system, and user-facing implementation docs.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[new-gui-overview]] | `new-gui-overview.md` | Frontend architecture overview — historical note; signed-balance page is no longer thesis-facing | `frontend` `architecture` `ux` |
| [[frontend-plan-signed-balance-assortativity]] | `frontend-plan-signed-balance-assortativity.md` | Superseded frontend plan for combined signed balance + assortativity analytics visualization | `frontend` `analytics` `signed-balance` `assortativity` `ux` `superseded` |
| [[ux-design-system-analytics]] | `ux-design-system-analytics.md` | Design system — color semantics and interpretation palette for analytics pages | `frontend` `ux` `analytics` |
| [[route-transition-overlay]] | `route-transition-overlay.md` | Page transition orchestration — animated navigation between screens | `frontend` `ux` `architecture` |
| [[player-details-impact-benchmarking]] | `player-details-impact-benchmarking.md` | Player-details card revision — dataset-grounded impact metrics relative to player pool | `frontend` `ux` `analytics` `performance` |

---

## Graph Analytics & Reports

Analysis outputs, validation reports, and AI-assisted analysis tooling.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[graph-v2-claude-analysis-report]] | `graph-v2-claude-analysis-report.md` | Graph V2 validation report — flexset and soloq datasets pass signed-network analysis checks | `analytics` `graph-theory` `dataset` `thesis` |
| [[flexset-associative-graph-interpretation]] | `flexset-associative-graph-interpretation.md` | Interpretation note — flexset as a core-periphery player association graph with bridge-rich core and peripheral ally islands | `analytics` `graph-v2` `flexset` `visualization` `thesis` |
| [[soloq-associative-graph-interpretation]] | `soloq-associative-graph-interpretation.md` | Interpretation note — soloq as an apex matchmaking-recurrence control graph with singleton/duo periphery | `analytics` `graph-v2` `soloq` `visualization` `thesis` |
| [[claude-graph-v2-analysis-prompt]] | `claude-graph-v2-analysis-prompt.md` | Prompt template for analyzing Graph V2 outputs and identifying pipeline improvements | `graph-theory` `planning` `analytics` |

---

## Future Planning

Forward-looking integration docs. Out of active scope unless owner reopens.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[premadegraph-x-genetic-neurosim-integration-plan]] | `premadegraph-x-genetic-neurosim-integration-plan.md` | Integration plan — seed Genetic NeuroSim v2 from validated player cluster profiles | `thesis` `genetic-neurosim` `planning` `graph-theory` |

---

## Database Project (Coursework)

Hungarian university database course deliverables. Separate from main thesis scope.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[databaseproject/README]] | `databaseproject/README.md` | Database project package — SQL schemas, views, procedures, and ASP.NET interface docs | `database` `architecture` `planning` |
| [[databaseproject/presentation_outline]] | `databaseproject/presentation_outline.md` | 10-minute presentation outline (Hungarian) — thesis topic, motivation, DB model, query implementation | `planning` `thesis` |
| [[databaseproject/week_plan]] | `databaseproject/week_plan.md` | Compliance mapping — PostgreSQL schema and ASP.NET interface against course requirements | `database` `planning` `architecture` |
| [[databaseproject/simple-interface/README]] | `databaseproject/simple-interface/README.md` | ASP.NET Core database browser — reads from backend SQLite databases with manual import | `frontend` `database` `architecture` |

---

## Diagrams

PlantUML source files. Render with PlantUML or Obsidian PlantUML plugin.

| File | Description |
|------|-------------|
| `full_project_component_diagram.puml` | Full system component diagram — all major subsystems and their connections |
| `pathfinder-class-diagram.puml` | Pathfinder class structure diagram |
| `pathfinder-replays-erd.puml` | ERD for pathfinder replay storage |
| `pathfinder-rust-activity-diagram.puml` | Rust pathfinder activity/flow diagram |
| `playersrefined-db-model.puml` | Logical DB model for playersrefined database |
| `playersrefined-er.puml` | ER diagram for playersrefined schema |

---

## Quick Lookup by Tag

| Tag | Notes |
|-----|-------|
| `thesis` | thesis-framework, signed-balance-theory, assortativity-analysis, parallel-brandes, experiment-runners, project-feasibility, apex-flex, graph-v2-report |
| `rust` | parallel-brandes, experiment-runners, graph-builder-v2, pathfinder-backend-prototype, birdseye-3d-sphere |
| `frontend` | new-gui-overview, frontend-plan, ux-design-system, route-transition, player-details, birdseye, mock-datasets, databaseproject/simple-interface |
| `backend` | multi-dataset-architecture, unified-cluster-persistence, graph-builder-v2, dynamic-opscore, pathfinder-backend, signed-balance, experiment-runners |
| `graph-theory` | thesis-framework, signed-balance-theory, assortativity-analysis, parallel-brandes, graph-builder-v2, graph-v2-report, premadegraph-x-genetic-neurosim |
| `data-collection` | apex-flex, master-soloq, riot-api-rate-limit, multi-key, mock-datasets |
| `signed-balance` | thesis-framework, signed-balance-theory, experiment-runners, frontend-plan |
| `assortativity` | thesis-framework, assortativity-analysis, experiment-runners, frontend-plan |
| `betweenness` | parallel-brandes, project-feasibility |
| `database` | multi-dataset, unified-cluster, dynamic-opscore, databaseproject/* |
| `genetic-neurosim` | premadegraph-x-genetic-neurosim, master-soloq |
| `planning` | project-feasibility, apex-flex, master-soloq, multi-key, multi-dataset, databaseproject/* |
| `api` | riot-api-rate-limit, multi-key |

---

%%
Auto-generated 2026-04-30. Update when adding or removing docs. Tags mirror CLAUDE.md research feature boundaries.
%%
