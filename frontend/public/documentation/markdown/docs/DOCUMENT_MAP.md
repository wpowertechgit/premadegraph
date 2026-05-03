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
| [[neurosim-tribal-simulation-critical-redesign]] | `neurosim-tribal-simulation-critical-redesign.md` | Critical redesign proposal — current tribal page is a prototype; this doc supersedes the design and implementation docs for future work | `genetic-neurosim` `planning` `architecture` `frontend` `backend` |
| [[superpowers/plans/2026-05-03-neurosim-tribal-simulation-agent-tasks]] | `superpowers/plans/2026-05-03-neurosim-tribal-simulation-agent-tasks.md` | Agent task plan — narrow vertical slices for implementing the critical redesign, one task per session | `genetic-neurosim` `planning` `agent-reference` |

---

## Evidence & Provenance

Chapter-level proof map for thesis defense, Obsidian graph navigation, and agent traceability.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[chapter-evidence-map]] | `chapter-evidence-map.md` | Master chapter-to-source provenance index — links each thesis chapter to source notes, code evidence, diagrams, datasets, and external citation keys | `evidence` `provenance` `thesis` `agent-reference` |
| [[evidence/chapter-01-bevezetes]] | `evidence/chapter-01-bevezetes.md` | Evidence node for Chapter 1 — project overview, screenshots, and scope proof | `evidence` `chapter-01` |
| [[evidence/chapter-02-problemafelvetes-es-motivacio]] | `evidence/chapter-02-problemafelvetes-es-motivacio.md` | Evidence node for Chapter 2 — motivation, scope rationale, and non-goals | `evidence` `chapter-02` |
| [[evidence/chapter-03-szakirodalmi-hatter]] | `evidence/chapter-03-szakirodalmi-hatter.md` | Evidence node for Chapter 3 — bibliography and graph-theory references | `evidence` `chapter-03` |
| [[evidence/chapter-04-riot-api-adatforrasok-es-adatgyujtesi-strategia]] | `evidence/chapter-04-riot-api-adatforrasok-es-adatgyujtesi-strategia.md` | Evidence node for Chapter 4 — Riot API, collector configs, and collection code | `evidence` `chapter-04` |
| [[evidence/chapter-05-korai-rendszer-es-eredeti-pipeline]] | `evidence/chapter-05-korai-rendszer-es-eredeti-pipeline.md` | Evidence node for Chapter 5 — legacy Python and early pipeline proof | `evidence` `chapter-05` |
| [[evidence/chapter-06-rendszerarchitektura-evolucioja]] | `evidence/chapter-06-rendszerarchitektura-evolucioja.md` | Evidence node for Chapter 6 — architecture docs, diagrams, and runtime split | `evidence` `chapter-06` |
| [[evidence/chapter-07-tobb-adatkeszletes-architektura]] | `evidence/chapter-07-tobb-adatkeszletes-architektura.md` | Evidence node for Chapter 7 — dataset registry and dataset separation | `evidence` `chapter-07` |
| [[evidence/chapter-08-sqlite-perzisztencia-es-klasztermodellezes]] | `evidence/chapter-08-sqlite-perzisztencia-es-klasztermodellezes.md` | Evidence node for Chapter 8 — SQLite persistence and cluster model | `evidence` `chapter-08` |
| [[evidence/chapter-09-opscore-teljesitmenymetrika]] | `evidence/chapter-09-opscore-teljesitmenymetrika.md` | Evidence node for Chapter 9 — opscore docs and scoring code | `evidence` `chapter-09` |
| [[evidence/chapter-10-grafepites-klaszterezes-es-perzisztencia]] | `evidence/chapter-10-grafepites-klaszterezes-es-perzisztencia.md` | Evidence node for Chapter 10 — graph builders and Graph V2 artifacts | `evidence` `chapter-10` |
| [[evidence/chapter-11-orszag-es-regioelemzes-korabbi-modul]] | `evidence/chapter-11-orszag-es-regioelemzes-korabbi-modul.md` | Evidence node for Chapter 11 — retired country/region module | `evidence` `chapter-11` |
| [[evidence/chapter-12-rust-futtatokornyezet-es-utvonalkereses]] | `evidence/chapter-12-rust-futtatokornyezet-es-utvonalkereses.md` | Evidence node for Chapter 12 — Rust runtime and pathfinding code | `evidence` `chapter-12` |
| [[evidence/chapter-13-pathfinder-lab-es-algoritmus-osszehasonlitas]] | `evidence/chapter-13-pathfinder-lab-es-algoritmus-osszehasonlitas.md` | Evidence node for Chapter 13 — pathfinder UI, replay, and algorithm comparison | `evidence` `chapter-13` |
| [[evidence/chapter-14-3d-birdseye-sphere-es-globalis-vizualizacio]] | `evidence/chapter-14-3d-birdseye-sphere-es-globalis-vizualizacio.md` | Evidence node for Chapter 14 — 3D graph sphere and artifact pipeline | `evidence` `chapter-14` |
| [[evidence/chapter-15-strukturalis-egyensuly-modszertani-hatareset]] | `evidence/chapter-15-strukturalis-egyensuly-modszertani-hatareset.md` | Evidence node for Chapter 15 — signed balance as methodological boundary case | `evidence` `chapter-15` |
| [[evidence/chapter-16-asszortativitasi-elemzes]] | `evidence/chapter-16-asszortativitasi-elemzes.md` | Evidence node for Chapter 16 — assortativity design and implementation | `evidence` `chapter-16` |
| [[evidence/chapter-17-parhuzamos-brandes-betweenness-centralitas]] | `evidence/chapter-17-parhuzamos-brandes-betweenness-centralitas.md` | Evidence node for Chapter 17 — Brandes centrality and Rayon implementation | `evidence` `chapter-17` |
| [[evidence/chapter-18-kiserleti-futtatasok-validacio-es-eredmenyek]] | `evidence/chapter-18-kiserleti-futtatasok-validacio-es-eredmenyek.md` | Evidence node for Chapter 18 — experiment runners and validation outputs | `evidence` `chapter-18` |
| [[evidence/chapter-19-rendszerszintu-ertekeles-es-megvitatasa]] | `evidence/chapter-19-rendszerszintu-ertekeles-es-megvitatasa.md` | Evidence node for Chapter 19 — system evaluation and limitations | `evidence` `chapter-19` |
| [[evidence/chapter-20-flexset-versus-soloq-empirikus-osszehasonlitas]] | `evidence/chapter-20-flexset-versus-soloq-empirikus-osszehasonlitas.md` | Evidence node for Chapter 20 — Flex/SoloQ comparison proof | `evidence` `chapter-20` |
| [[evidence/chapter-21-osszegzes]] | `evidence/chapter-21-osszegzes.md` | Evidence node for Chapter 21 — conclusion and scope synthesis | `evidence` `chapter-21` |
| [[evidence/chapter-22-databaseproject-kiegeszito-alprojekt]] | `evidence/chapter-22-databaseproject-kiegeszito-alprojekt.md` | Evidence node for Chapter 22 — databaseproject coursework and C# browser | `evidence` `chapter-22` |
| [[evidence/chapter-23-jovobeli-fejlesztesek]] | `evidence/chapter-23-jovobeli-fejlesztesek.md` | Evidence node for Chapter 23 — future work, deferred scope, and retired features | `evidence` `chapter-23` |

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
