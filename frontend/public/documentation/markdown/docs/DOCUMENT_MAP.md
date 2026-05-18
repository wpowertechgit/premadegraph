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
| [[features/graph-analytics/signed-balance-methodological-retirement]] | `features/graph-analytics/signed-balance-methodological-retirement.md` | Authoritative scope decision — signed balance is downgraded to an experimental limitation case, not a central thesis result | `thesis` `signed-balance` `methodology` `retired-feature` |
| [[features/graph-analytics/thesis-framework-signed-balance-and-assortativity]] | `features/graph-analytics/thesis-framework-signed-balance-and-assortativity.md` | Superseded thesis framing — earlier signed balance + assortativity narrative; read the retirement note first | `thesis` `signed-balance` `assortativity` `graph-theory` `superseded` |
| [[features/graph-analytics/signed-balance-theory]] | `features/graph-analytics/signed-balance-theory.md` | Implementation note — triads, signed edges, ally/enemy classification; interpretation superseded by retirement note | `thesis` `signed-balance` `graph-theory` `backend` `superseded` |
| [[features/graph-analytics/assortativity-analysis]] | `features/graph-analytics/assortativity-analysis.md` | Assortativity experiment design — whether connected players have similar opscore/feedscore values | `thesis` `assortativity` `graph-theory` `analytics` |
| [[features/graph-analytics/parallel-brandes-implementation-plan]] | `features/graph-analytics/parallel-brandes-implementation-plan.md` | Rust parallel Brandes betweenness centrality — bridge nodes, community brokers, Rayon parallelism | `thesis` `betweenness` `rust` `graph-theory` `backend` |
| [[features/graph-analytics/experiment-runners]] | `features/graph-analytics/experiment-runners.md` | Rust experiment layer — signed-balance sensitivity diagnostics and assortativity significance tests | `thesis` `signed-balance` `assortativity` `rust` `backend` |
| [[features/thesis-planning/project-feasibility-review-and-additions]] | `features/thesis-planning/project-feasibility-review-and-additions.md` | Scope review — thesis direction validation and additions (parallel Brandes, experiment baselines) | `thesis` `planning` `betweenness` `architecture` |

---

## Data Collection

Dataset strategy, Riot API usage, and collection automation.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[features/data-collection/README]] | `features/data-collection/README.md` | Dataset collection feature hub | `data-collection` `dataset` `index` |
| [[features/data-collection/apex-flex-collection-strategy]] | `features/data-collection/apex-flex-collection-strategy.md` | Master+ Ranked Flex Queue EUNE collection using 10 seed players — primary premade dataset | `data-collection` `dataset` `planning` `thesis` |
| [[features/data-collection/master-soloq-eune-collection-strategy]] | `features/data-collection/master-soloq-eune-collection-strategy.md` | Master+ SoloQ EUNE collection — orthogonal performance baseline for genetic-neurosim seeding | `data-collection` `dataset` `planning` `genetic-neurosim` |
| [[features/data-collection/riot-api-rate-limit-analysis]] | `features/data-collection/riot-api-rate-limit-analysis.md` | Rate limit analysis — limits not the bottleneck; player discovery efficiency is the real constraint | `data-collection` `api` `performance` |
| [[features/data-collection/multi-key-implementation-prompt]] | `features/data-collection/multi-key-implementation-prompt.md` | Multi-key rotation for Riot API — combine rate limit buckets across keys to reduce collection time | `api` `backend` `data-collection` |
| [[features/data-collection/mock-datasets-and-chaos-design]] | `features/data-collection/mock-datasets-and-chaos-design.md` | Synthetic datasets for dev/demo/UI testing when full real dataset is unavailable | `dataset` `ux` `frontend` `data-collection` |

---

## Architecture & Backend

System design, data flow, and backend implementation docs.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[features/backend-runtime/README]] | `features/backend-runtime/README.md` | Backend runtime feature hub | `backend` `architecture` `index` |
| [[features/backend-runtime/multi-dataset-architecture]] | `features/backend-runtime/multi-dataset-architecture.md` | Multi-dataset architecture — independent datasets with separate DBs and analysis caches | `architecture` `database` `backend` `planning` |
| [[features/backend-runtime/unified-cluster-persistence-and-astar]] | `features/backend-runtime/unified-cluster-persistence-and-astar.md` | SQLite cluster persistence + Rust A* integration — canonical post-prototype architecture | `backend` `database` `architecture` `pathfinder` |
| [[features/graph-analytics/graph-builder-v2]] | `features/graph-analytics/graph-builder-v2.md` | Rust-first graph artifact pipeline replacing Python/PyVis — clusters, progressive WebGL rendering | `backend` `rust` `graph-theory` `architecture` |
| [[features/scoring/dynamic-opscore-system]] | `features/scoring/dynamic-opscore-system.md` | Dataset-scoped, role-aware player scoring — what does a player's performance profile look like | `backend` `analytics` `database` |
| [[features/backend-runtime/pathfinder-backend-prototype]] | `features/backend-runtime/pathfinder-backend-prototype.md` | Early backend-migration stage for pathfinding — request/response contracts, optional backend exec | `backend` `pathfinder` `architecture` `rust` |

---

## Frontend & UX

UI pages, design system, and user-facing implementation docs.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[features/frontend-ux/README]] | `features/frontend-ux/README.md` | Frontend and UX feature hub | `frontend` `ux` `index` |
| [[features/frontend-ux/new-gui-overview]] | `features/frontend-ux/new-gui-overview.md` | Frontend architecture overview — historical note; signed-balance page is no longer thesis-facing | `frontend` `architecture` `ux` |
| [[features/frontend-ux/frontend-plan-signed-balance-assortativity]] | `features/frontend-ux/frontend-plan-signed-balance-assortativity.md` | Superseded frontend plan for combined signed balance + assortativity analytics visualization | `frontend` `analytics` `signed-balance` `assortativity` `ux` `superseded` |
| [[features/frontend-ux/ux-design-system-analytics]] | `features/frontend-ux/ux-design-system-analytics.md` | Design system — color semantics and interpretation palette for analytics pages | `frontend` `ux` `analytics` |
| [[features/frontend-ux/route-transition-overlay]] | `features/frontend-ux/route-transition-overlay.md` | Page transition orchestration — animated navigation between screens | `frontend` `ux` `architecture` |
| [[features/frontend-ux/player-details-impact-benchmarking]] | `features/frontend-ux/player-details-impact-benchmarking.md` | Player-details card revision — dataset-grounded impact metrics relative to player pool | `frontend` `ux` `analytics` `performance` |
| [[features/frontend-ux/birdseye-3d-sphere]] | `features/frontend-ux/birdseye-3d-sphere.md` | 3D global-view sphere — Rust artifact pipeline + frontend WebGL rendering layout | `frontend` `backend` `rust` `architecture` |
| [[features/frontend-ux/landingpagedesign]] | `features/frontend-ux/landingpagedesign.md` | Landing-page and demo narrative design | `frontend` `ux` `demo` |

---

## Scoring

Performance-metric docs used by graph analytics, player detail views, and NeuroSim seeding.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[features/scoring/README]] | `features/scoring/README.md` | Scoring feature hub | `scoring` `opscore` `index` |
| [[features/scoring/dynamic-opscore-system]] | `features/scoring/dynamic-opscore-system.md` | Dataset-scoped, role-aware player scoring system | `scoring` `opscore` `analytics` |
| [[features/scoring/opscore-v2-local-formula]] | `features/scoring/opscore-v2-local-formula.md` | Local formula note for opscore V2 | `scoring` `opscore` `formula` |
| [[features/scoring/opscore-v2-vs-current-model]] | `features/scoring/opscore-v2-vs-current-model.md` | Comparison between current scoring and proposed V2 model | `scoring` `opscore` `planning` |

---

## Graph Analytics & Reports

Analysis outputs, validation reports, and AI-assisted analysis tooling.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[features/graph-analytics/README]] | `features/graph-analytics/README.md` | Graph analytics feature hub | `graph-theory` `analytics` `index` |
| [[features/graph-analytics/graph-v2-claude-analysis-report]] | `features/graph-analytics/graph-v2-claude-analysis-report.md` | Graph V2 validation report — flexset and soloq datasets pass signed-network analysis checks | `analytics` `graph-theory` `dataset` `thesis` |
| [[features/graph-analytics/flexset-associative-graph-interpretation]] | `features/graph-analytics/flexset-associative-graph-interpretation.md` | Interpretation note — flexset as a core-periphery player association graph with bridge-rich core and peripheral ally islands | `analytics` `graph-v2` `flexset` `visualization` `thesis` |
| [[features/graph-analytics/soloq-associative-graph-interpretation]] | `features/graph-analytics/soloq-associative-graph-interpretation.md` | Interpretation note — soloq as an apex matchmaking-recurrence control graph with singleton/duo periphery | `analytics` `graph-v2` `soloq` `visualization` `thesis` |
| [[features/graph-analytics/claude-graph-v2-analysis-prompt]] | `features/graph-analytics/claude-graph-v2-analysis-prompt.md` | Prompt template for analyzing Graph V2 outputs and identifying pipeline improvements | `graph-theory` `planning` `analytics` |

---

## NeuroSim

Genetic / Tribal NeuroSim documentation, now consolidated under `docs/neurosim/` for Obsidian navigation and thesis writing.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[neurosim/README]] | `neurosim/README.md` | NeuroSim documentation hub — start here for architecture, mechanics, validation, implementation runs, media, and chapter-writing notes | `genetic-neurosim` `index` `thesis` `obsidian` |
| [[neurosim/status-map]] | `neurosim/status-map.md` | NeuroSim document status map — separates writing drafts, stable validation evidence, working architecture, run logs, and archive material | `genetic-neurosim` `documentation-status` `thesis` |
| [[neurosim/chapter-writing/latex-chapter-map]] | `neurosim/chapter-writing/latex-chapter-map.md` | LaTeX chapter map — which NeuroSim docs support each thesis section | `genetic-neurosim` `thesis` `latex` `writing` |
| [[neurosim/chapter-writing/tribal-neurosim-subchapter-fit-draft]] | `neurosim/chapter-writing/tribal-neurosim-subchapter-fit-draft.md` | Thesis subchapter framing — ABM, MAS, game theory, neuroevolution, graph theory, geometry, EDA, visualization, and HPC | `genetic-neurosim` `thesis` `writing` |
| [[neurosim/chapter-writing/premadegraph-x-genetic-neurosim-integration-plan]] | `neurosim/chapter-writing/premadegraph-x-genetic-neurosim-integration-plan.md` | Integration plan — seed Genetic NeuroSim v2 from validated player cluster profiles | `thesis` `genetic-neurosim` `planning` `graph-theory` |
| [[neurosim/architecture/critical-redesign]] | `neurosim/architecture/critical-redesign.md` | Critical redesign proposal — current tribal page is a prototype; this doc supersedes the design and implementation docs for future work | `genetic-neurosim` `planning` `architecture` `frontend` `backend` |
| [[neurosim/validation/first-complete-simulation-run-2026-05-16]] | `neurosim/validation/first-complete-simulation-run-2026-05-16.md` | First complete simulation run — empirical evidence for the validated NeuroSim behavior story | `genetic-neurosim` `validation` `evidence` |
| [[neurosim/validation/f2-validation-story/index]] | `neurosim/validation/f2-validation-story/index.md` | F2 validation story — bug discovery, fix, and post-fix validation narrative | `genetic-neurosim` `validation` `evidence` |
| [[neurosim/mechanics/v4-border-pressure-and-dispute-mechanics]] | `neurosim/mechanics/v4-border-pressure-and-dispute-mechanics.md` | BP patch — border pressure system, war exhaustion, expansion pacing retuning; anti-chaos strategic mechanics | `genetic-neurosim` `mechanics` `simulation` `territory` |
| [[neurosim/implementation-runs/rust/TaskR10Run]] | `neurosim/implementation-runs/rust/TaskR10Run.md` | Task R10 — Border Pressure System + war exhaustion + endgame tuning; strategic arc restoration for thesis-quality convergence | `genetic-neurosim` `implementation-run` `simulation` `rust` |

## Documentation Status

Final/working/superseded tracking and `mainraw.tex` inclusion maps.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[status/README]] | `status/README.md` | Documentation status hub — explains `final`, `working`, `retired`, and `superseded` labels | `documentation-status` `index` `thesis` |
| [[status/mainraw-inclusion-map]] | `status/mainraw-inclusion-map.md` | Map of documents whose content is reflected in `docs/mainraw.tex` | `documentation-status` `mainraw` `thesis` |
| [[status/working-documents-map]] | `status/working-documents-map.md` | Map of working, retired, and superseded documents | `documentation-status` `working` `thesis` |
| [[status/workflow-provenance-map]] | `status/workflow-provenance-map.md` | Map of task runs, old versions, executor prompts, archive imports, and process-history documents | `documentation-status` `workflow` `provenance` |

## LaTeX Thesis

Modular thesis build files.

| Note | Path | Description | Tags |
|------|------|-------------|------|
| [[latex/README]] | `latex/README.md` | Modular LaTeX thesis workspace — active `main.tex`, per-chapter files, references, preamble, and local assets | `latex` `thesis` `mainraw` |
| `latex/main.tex` | `latex/main.tex` | Active modular thesis entry point | `latex` `thesis` |
| `latex/chapters/` | `latex/chapters/` | One `.tex` file per thesis chapter | `latex` `chapters` |
| `latex/assets/` | `latex/assets/` | Local copy of LaTeX image and diagram assets | `latex` `assets` |

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
