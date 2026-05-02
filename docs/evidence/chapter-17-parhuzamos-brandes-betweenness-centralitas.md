---
title: "Chapter 17 Evidence: Parhuzamos Brandes Betweenness Centralitas"
tags: [evidence, thesis, chapter-17, centrality, rust]
chapter: 17
chapter_title: "Parhuzamos Brandes-fele betweenness centralitas"
---

# Chapter 17 Evidence: Parhuzamos Brandes Betweenness Centralitas

## Thesis Sections

- `docs/mainraw.tex` lines 2460-2609

## Source Notes

- [[parallel-brandes-implementation-plan]]
- [[project-feasibility-review-and-additions]]
- [[graph-builder-v2]]

## Code Evidence

- [backend/pathfinder-rust/src/engine/centrality.rs](../../backend/pathfinder-rust/src/engine/centrality.rs)
- [backend/pathfinder-rust/src/models.rs](../../backend/pathfinder-rust/src/models.rs)
- [frontend/src/BetweennessCentralityPage.tsx](../../frontend/src/BetweennessCentralityPage.tsx)
- [frontend/src/betweennessTypes.ts](../../frontend/src/betweennessTypes.ts)

## Figure Evidence

- [docs/assets/diagrams/parallel brandes activity diagram.pdf](../assets/diagrams/parallel%20brandes%20activity%20diagram.pdf)
- [docs/assets/diagrams/parallel-brandes.puml](../assets/diagrams/parallel-brandes.puml)
- [docs/assets/demo_shots/brandes-config.png](../assets/demo_shots/brandes-config.png)
- [docs/assets/demo_shots/brandes-result.png](../assets/demo_shots/brandes-result.png)

## External References

- `brandes2001`
- `sandve2013`
- `rustlang`

## Claim Supported

The Brandes chapter is backed by the implementation plan, weighted centrality Rust code, response contracts, frontend centrality page, the parallel Brandes activity diagram, and captured configuration/result screenshots.
