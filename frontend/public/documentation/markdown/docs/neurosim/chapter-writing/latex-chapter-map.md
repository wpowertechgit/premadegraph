---
title: NeuroSim LaTeX Chapter Map
tags:
  - genetic-neurosim
  - thesis
  - latex
  - writing
aliases:
  - NeuroSim Chapter Map
---

# NeuroSim LaTeX Chapter Map

This note maps the reorganized NeuroSim documentation to thesis sections. It is meant as a writing guide, not a new implementation plan.

## Recommended Chapter Arc

### 1. Motivation And Research Role

Core claim: Genetic NeuroSim connects graph-derived player profiles to a reproducible evolutionary simulation.

Use:

- [[premadegraph-x-genetic-neurosim-integration-plan]]
- [[tribal-neurosim-subchapter-fit-draft]]
- [[../architecture/critical-redesign]]

Writing boundary:

- say "exploratory transfer experiment"
- avoid saying "proof of real player psychology"

### 2. Agent-Based Simulation Model

Core claim: the simulation is an ABM where local tribe decisions create population-level dynamics such as expansion, conflict, starvation, and collapse.

Use:

- [[../architecture/v3-architecture-and-mechanics-redesign]]
- [[../mechanics/v3-territory-and-expansion-mechanics]]
- [[../mechanics/v3-offspring-mechanics-and-evolutionary-lineage]]
- [[../mechanics/v3-information-theory-lineage-compression]]

Useful keywords:

- Agent-Based Modeling
- Computational Social Science
- emergent behavior
- population dynamics

### 3. Multi-Agent Systems And Game Theory

Core claim: tribes operate as decentralized agents with strategic interaction under resource scarcity and territorial pressure.

Use:

- [[../mechanics/tribe-behavior-diff]]
- [[../validation/tribes-v2-first-run-takeaways]]
- [[../validation/first-complete-simulation-run-2026-05-16]]

Game theory angle:

- resource competition
- territorial conflict
- alliance and war state transitions
- local payoff-like behavior from food, survival, and territorial control

Boundary:

- frame this as strategic interaction in a simulation, not as a formal equilibrium proof unless the final model explicitly computes equilibria.

### 4. Neuroevolution And Neural Control

Core claim: decision-making is delegated to neural controllers whose authority and mutation/evolution rules can be inspected.

Use:

- [[../architecture/neural-authority-contract-2026-05-11]]
- [[../mechanics/neural-network-state-2026-05-12]]
- [[../media/diagrams/neural-network.puml]]
- [[../validation/flexset-empire-599-optimization]]

Useful keywords:

- NEAT
- neural authority
- mutation
- topology evolution
- fitness components

### 5. Spatial Model, Geometry, And Pathfinding

Core claim: the hex-grid world is a spatial graph where movement, territory, collision, and resource gradients require explicit computational geometry.

Use:

- [[../mechanics/v3-territory-and-expansion-mechanics]]
- [[../validation/simulation-liveness-fix-2026-05-14]]
- [[../visual-assets/terrain-3d-model-loading-2026-05-05]]

Useful keywords:

- hex grid
- spatial occupancy
- pathfinding
- distance heuristic
- map projection

### 6. Event-Driven Observability

Core claim: the event bus makes the simulation inspectable by turning state transitions into auditable records.

Use:

- [[../validation/tribes-v2-first-run-takeaways]]
- [[../validation/post-first-run-fixes-2026-05-16]]
- [[../validation/f2-validation-story/chapter-4-validated-run]]

Useful keywords:

- event-driven architecture
- append-only event stream
- starvation events
- state-transition logging
- replayability

### 7. Systems Implementation And Performance

Core claim: the Rust/desktop architecture supports high-frequency simulation loops, deterministic runs, and future large-agent rendering.

Use:

- [[../architecture/desktop-contract-v1]]
- [[../architecture/monogame-migration-plan]]
- [[../architecture/python-ml-boundary]]
- [[../implementation-runs/rust/TaskR8Run]]
- [[../implementation-runs/monogame/TaskM9Run]]

Useful keywords:

- Rust
- deterministic simulation
- binary protocol
- high-frequency tick loop
- render/simulation boundary

### 8. Validation Story

Core claim: the project records observed failures, fixes, and validated behavior rather than treating the simulation as a black box.

Use:

- [[../validation/first-complete-simulation-run-2026-05-16]]
- [[../validation/post-first-run-fixes-2026-05-16]]
- [[../validation/f2-validation-story/index]]
- [[../validation/f2-validation-story/chapter-5-bug-discovery-and-fix]]
- [[../validation/f2-validation-story/chapter-6-post-fix-validation]]

Include:

- initial failure mode
- fix rationale
- post-fix evidence
- remaining limitations

## Best One-Sentence Thesis Framing

Tribal NeuroSim is an exploratory evolutionary multi-agent simulation that transfers graph-derived player and cluster profiles into reproducible spatial agents, allowing the thesis to study how local neural decisions, resource pressure, and territorial interaction produce observable macro-level dynamics.
