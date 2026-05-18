---
title: NeuroSim Documentation Hub
tags:
  - genetic-neurosim
  - index
  - thesis
  - obsidian
aliases:
  - NeuroSim Hub
  - Tribal NeuroSim
---

# NeuroSim Documentation Hub

This folder is the root documentation home for Genetic / Tribal NeuroSim. Backend-local notes were moved here so Obsidian and the LaTeX writing workflow have one stable context tree.

## Start Here

| Need | Read |
|------|------|
| NeuroSim document status | [[status-map]] |
| Thesis prose and subchapter framing | [[chapter-writing/tribal-neurosim-subchapter-fit-draft]] |
| LaTeX section evidence map | [[chapter-writing/latex-chapter-map]] |
| System redesign narrative | [[architecture/critical-redesign]] |
| V3 architecture and mechanics | [[architecture/v3-architecture-and-mechanics-redesign]] |
| Real run evidence | [[validation/first-complete-simulation-run-2026-05-16]] |
| Validated F2 story | [[validation/f2-validation-story/index]] |
| Neural controller state | [[mechanics/neural-network-state-2026-05-12]] |
| Desktop / MonoGame boundary | [[architecture/desktop-contract-v1]] |

## Folder Guide

| Folder | Purpose |
|--------|---------|
| `architecture/` | System shape, runtime boundaries, neural authority, MonoGame migration, HUD and desktop contracts. |
| `mechanics/` | Simulation rules: neural controller state, behavior differences, territory, offspring, lineage compression, scoring formulas. |
| `validation/` | Empirical run notes, post-run fixes, liveness fixes, F2 validation story, and optimization evidence. |
| `implementation-runs/` | Task-run logs grouped by Rust backend, MonoGame desktop, web prototype, and plans. Use as provenance, not polished prose. |
| `visual-assets/` | Asset plans, vegetation rendering, terrain/model-loading notes. |
| `chapter-writing/` | Thesis-facing synthesis drafts and LaTeX chapter scaffolding. |
| `media/` | Screenshots and diagrams referenced by the notes. |
| `archive/` | Full context dumps, veto/legacy notes, and backend imports preserved to avoid losing material. |

## Thesis Writing Path

Use this order when turning the docs into LaTeX:

1. Start with [[chapter-writing/latex-chapter-map]] for the chapter structure.
2. Use [[chapter-writing/tribal-neurosim-subchapter-fit-draft]] for the academic fields and safest claims.
3. Ground the system description in [[architecture/critical-redesign]], [[architecture/v3-architecture-and-mechanics-redesign]], and [[architecture/neural-authority-contract-2026-05-11]].
4. Pull mechanism details from `mechanics/`.
5. Pull evidence from `validation/`, especially the first complete run and F2 validation story.
6. Use `implementation-runs/` only when you need task provenance, implementation history, or proof that a behavior was tested.

## Interpretation Guardrails

- Present NeuroSim as an exploratory evolutionary, multi-agent simulation seeded from graph/player profiles.
- Do not claim the simulation proves real player psychology.
- Keep Flex Queue graph conclusions separate from SoloQ individual-performance conclusions.
- Treat game theory, MAS, ABM, neuroevolution, graph theory, geometry/pathfinding, EDA, visualization, and HPC as supporting academic frames.
- Signed Balance remains retired from the thesis-facing product narrative; see `../features/graph-analytics/signed-balance-methodological-retirement.md`.

## Backend Docs Status

The old `backend/genetic-neurosim/docs/` location should no longer be used for thesis notes. New documentation belongs under this `docs/neurosim/` tree unless it is code-local API documentation.
