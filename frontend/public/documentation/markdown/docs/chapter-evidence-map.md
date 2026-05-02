---
title: Chapter Evidence Map
tags:
  - evidence
  - provenance
  - thesis
  - agent-reference
aliases:
  - Evidence Map
  - Provenance Map
created: 2026-05-02
---

# Chapter Evidence Map

This note is the Obsidian-facing provenance index for the thesis.

Purpose:

- show which source documents, code modules, diagrams, datasets, and external references support each chapter
- make the thesis defensible: each chapter should point to concrete evidence, not vibes
- give agents and humans a stable entry point before editing or defending a chapter

How to use it:

- open the chapter note matching the LaTeX chapter
- follow `Source notes` for internal markdown evidence
- follow `Code evidence` for implementation proof
- follow `External references` for bibliography or internet/API sources already cited in `docs/mainraw.tex`

## Chapter Nodes

| Chapter | Evidence note | Main proof type |
| --- | --- | --- |
| 1 | [[evidence/chapter-01-bevezetes]] | project overview, screenshots, scope |
| 2 | [[evidence/chapter-02-problemafelvetes-es-motivacio]] | scope rationale, non-goals |
| 3 | [[evidence/chapter-03-szakirodalmi-hatter]] | bibliography, graph-theory sources |
| 4 | [[evidence/chapter-04-riot-api-adatforrasok-es-adatgyujtesi-strategia]] | Riot API docs, collector configs, collector code |
| 5 | [[evidence/chapter-05-korai-rendszer-es-eredeti-pipeline]] | legacy Python pipeline |
| 6 | [[evidence/chapter-06-rendszerarchitektura-evolucioja]] | architecture docs, diagrams, backend/frontend split |
| 7 | [[evidence/chapter-07-tobb-adatkeszletes-architektura]] | dataset registry and multi-dataset docs |
| 8 | [[evidence/chapter-08-sqlite-perzisztencia-es-klasztermodellezes]] | database schema, persistence code |
| 9 | [[evidence/chapter-09-opscore-teljesitmenymetrika]] | scoring docs and scoring code |
| 10 | [[evidence/chapter-10-grafepites-klaszterezes-es-perzisztencia]] | graph builders and Graph V2 artifacts |
| 11 | [[evidence/chapter-11-orszag-es-regioelemzes-korabbi-modul]] | country/region legacy module |
| 12 | [[evidence/chapter-12-rust-futtatokornyezet-es-utvonalkereses]] | Rust graph runtime and search code |
| 13 | [[evidence/chapter-13-pathfinder-lab-es-algoritmus-osszehasonlitas]] | pathfinder UI and replay code |
| 14 | [[evidence/chapter-14-3d-birdseye-sphere-es-globalis-vizualizacio]] | 3D graph docs and frontend scene code |
| 15 | [[evidence/chapter-15-strukturalis-egyensuly-modszertani-hatareset]] | retirement note and diagnostic implementation |
| 16 | [[evidence/chapter-16-asszortativitasi-elemzes]] | assortativity docs and Rust implementation |
| 17 | [[evidence/chapter-17-parhuzamos-brandes-betweenness-centralitas]] | Brandes docs and Rust implementation |
| 18 | [[evidence/chapter-18-kiserleti-futtatasok-validacio-es-eredmenyek]] | experiment runners and validation reports |
| 19 | [[evidence/chapter-19-rendszerszintu-ertekeles-es-megvitatasa]] | feasibility, scope, limitations |
| 20 | [[evidence/chapter-20-flexset-versus-soloq-empirikus-osszehasonlitas]] | dataset comparison docs |
| 21 | [[evidence/chapter-21-osszegzes]] | final synthesis and current scope |
| 22 | [[evidence/chapter-22-databaseproject-kiegeszito-alprojekt]] | database coursework docs and C# browser |
| 23 | [[evidence/chapter-23-jovobeli-fejlesztesek]] | future scope and retired/deferred work |

## Global Evidence Anchors

- [[DOCUMENT_MAP]] is the agent-readable index of the documentation vault.
- [[signed-balance-methodological-retirement]] is the scope authority for signed balance.
- [[project-feasibility-review-and-additions]] is the current thesis-scope review.
- [[graph-v2-claude-analysis-report]] is the Graph V2 validation report.
- [[flexset-associative-graph-interpretation]] and [[soloq-associative-graph-interpretation]] support the dataset comparison narrative.

