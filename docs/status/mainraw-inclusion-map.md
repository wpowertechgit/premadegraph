---
title: Mainraw Inclusion Map
tags:
  - thesis
  - mainraw
  - documentation-status
aliases:
  - Mainraw Map
---

# Mainraw Inclusion Map

Ez a térkép azt jelöli, mely dokumentumok tartalma épült be a `docs/mainraw.tex` aktuális szakdolgozati narratívájába.

## Beépült, Stabil Források

| Dokumentum | Fejezetek | Szerep |
|------------|-----------|--------|
| [[../features/data-collection/apex-flex-collection-strategy]] | 4, 20 | Flex Queue adatgyűjtési stratégia és dataset-szerep |
| [[../features/data-collection/master-soloq-eune-collection-strategy]] | 4, 20 | SoloQ kontroll-dataset stratégia |
| [[../features/data-collection/riot-api-rate-limit-analysis]] | 4 | Riot API rate-limit és gyűjtési kompromisszumok |
| [[../features/graph-analytics/graph-builder-v2]] | 10, 12, 14 | Rust Graph V2, artifact pipeline, globális export |
| [[../features/graph-analytics/graph-v2-claude-analysis-report]] | 10, 18, 20 | Graph V2 validációs eredmények |
| [[../features/graph-analytics/flexset-associative-graph-interpretation]] | 10, 20, 21 | Flexset core-periphery értelmezés |
| [[../features/graph-analytics/soloq-associative-graph-interpretation]] | 20 | SoloQ kontrollgráf értelmezés |
| [[../features/graph-analytics/assortativity-analysis]] | 16, 18, 20, 21 | Asszortativitási eredmények |
| [[../features/graph-analytics/experiment-runners]] | 18 | Kísérleti futtatók és validáció |
| [[../features/graph-analytics/signed-balance-methodological-retirement]] | 15, 19, 23 | Signed Balance visszaminősítés |
| [[../features/scoring/dynamic-opscore-system]] | 9, 16, 20, 21 | `opscore` / `feedscore` metrikai alap |
| [[../features/backend-runtime/multi-dataset-architecture]] | 7 | Több-adatkészletes architektúra |
| [[../features/backend-runtime/unified-cluster-persistence-and-astar]] | 8, 12, 13 | SQLite perzisztencia, klasztermodell, exact A* |
| [[../features/frontend-ux/birdseye-3d-sphere]] | 14 | 3D globális vizualizáció |
| [[../features/frontend-ux/new-gui-overview]] | 6, 14 | Frontend architektúra és navigáció |
| [[../features/frontend-ux/ux-design-system-analytics]] | 14, 19 | Analitikai UX és interpretálhatóság |

## Beépült, De Nem Végleges Források

| Dokumentum | Fejezetek | Miért nem final? |
|------------|-----------|------------------|
| [[../features/data-collection/multi-key-implementation-prompt]] | 4 | Implementációs prompt / gyűjtési support, nem végleges kutatási eredmény |
| [[../features/graph-analytics/parallel-brandes-implementation-plan]] | 17, 19, 23 | A Brandes-téma szerepel a dolgozatban, de ez a dokumentum terv jellegű |
| [[../features/backend-runtime/pathfinder-backend-prototype]] | 12, 13 | Backend-migrációs/prototípus jegyzet |
| [[../features/thesis-planning/project-feasibility-review-and-additions]] | 19, 23 | Scope review, nem implementációs bizonyíték |

## Módszertani Háttérként Beépült

| Dokumentum | Fejezetek | Megjegyzés |
|------------|-----------|------------|
| [[../features/graph-analytics/signed-balance-theory]] | 3, 15 | Elméleti háttér és történeti implementációs kontextus; a fő empirikus szerepet a retirement note váltotta fel |

## Nem Beépült A Jelenlegi Mainraw Verzióba

Ezek hasznosak lehetnek később, de a jelenlegi `docs/mainraw.tex` nem épít rájuk közvetlenül:

- [[../features/data-collection/mock-datasets-and-chaos-design]]
- [[../features/graph-analytics/claude-graph-v2-analysis-prompt]]
- [[../features/graph-analytics/thesis-framework-signed-balance-and-assortativity]]
- [[../features/scoring/opscore-v2-local-formula]]
- [[../features/scoring/opscore-v2-vs-current-model]]
- [[../features/frontend-ux/frontend-plan-signed-balance-assortativity]]
- [[../features/frontend-ux/player-details-impact-benchmarking]]
- [[../features/frontend-ux/route-transition-overlay]]
- [[../features/frontend-ux/landingpagedesign]]
- [[../neurosim/README]]
