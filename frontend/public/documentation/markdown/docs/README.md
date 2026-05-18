---
title: PremadeGraph Documentation Hub
tags:
  - index
  - obsidian
  - thesis
aliases:
  - Docs Hub
  - PremadeGraph Docs
---

# PremadeGraph Documentation Hub

This vault is organized by feature area. Start from the folder hubs below, then jump into the specific evidence or implementation notes needed for LaTeX writing.

## Feature Hubs

| Feature Area | Start Here | Purpose |
|--------------|------------|---------|
| Dataset Collection | [[features/data-collection/README]] | Riot API collection, Flex Queue, SoloQ, rate limits, key rotation, and mock datasets. |
| Graph Analytics | [[features/graph-analytics/README]] | Graph V2, Flex/SoloQ interpretation, assortativity, Brandes centrality, signed-balance retirement, and experiment runners. |
| Scoring | [[features/scoring/README]] | `opscore`, feedscore boundaries, local formulas, and scoring revisions. |
| Backend Runtime | [[features/backend-runtime/README]] | Multi-dataset architecture, cluster persistence, Rust bridge, A*, and pathfinder backend shape. |
| Frontend And UX | [[features/frontend-ux/README]] | GUI architecture, analytics UX, player cards, route transitions, landing page, and 3D visualization. |
| NeuroSim | [[neurosim/README]] | Genetic / Tribal NeuroSim architecture, mechanics, validation, media, and thesis-writing notes. |
| Thesis Planning | [[features/thesis-planning/README]] | Scope reviews and forward-looking thesis planning. |
| Documentation Status | [[status/README]] | Final vs working docs, plus `mainraw.tex` inclusion tracking. |
| Workflow Provenance | [[status/workflow-provenance-map]] | Task runs, old versions, executor prompts, archives, and process history. |
| Modular LaTeX | [[latex/README]] | Active modular thesis build with chapters, references, preamble, and local assets. |
| Evidence | [[chapter-evidence-map]] | Chapter-to-source provenance map for LaTeX writing. |
| Database Project | [[databaseproject/README]] | Supplementary database-project docs. |

## Root Indexes

- [[DOCUMENT_MAP]] is the agent-readable global document index.
- [[chapter-evidence-map]] maps thesis chapters to evidence notes.
- [[status/mainraw-inclusion-map]] shows which docs are reflected in `mainraw.tex`.
- [[latex/README]] explains the modular LaTeX build.

## Writing Rule Of Thumb

Use feature folders for technical context and `evidence/` for chapter provenance. If a note is thesis-facing synthesis, link it from the nearest feature hub and from the chapter evidence map.
