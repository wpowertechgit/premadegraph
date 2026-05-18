---
title: Workflow Provenance Map
tags:
  - documentation-status
  - workflow
  - provenance
  - thesis
aliases:
  - Workflow Map
  - Provenance Map
---

# Workflow Provenance Map

Ez a térkép azokat a dokumentumokat jelöli, amelyek a munkafolyamatot, korábbi verziókat, implementációs futásokat, agent taskokat, promptokat vagy visszavont irányokat dokumentálják.

Ezek nem elsődleges thesis-források. Akkor használd őket, ha azt kell visszakeresni, hogyan jutott el a projekt egy döntésig vagy implementációs állapotig.

## Provenance Kategóriák

| Kategória | Jelentés |
|-----------|----------|
| `task-run-log` | Egy konkrét fejlesztési futás vagy task eredménye. |
| `execution-plan` | Korábbi implementációs terv vagy agentfeladat-lista. |
| `executor-prompt` | Más modellnek/agentnek szánt futtatási prompt. |
| `validation-provenance` | Validációs futás, CLI-run vagy ellenőrzési jegyzet. |
| `archive-import` | Régi helyről áthozott, megőrzött dokumentum. |
| `superseded-plan` | Újabb döntés által felülírt terv. |
| `retired-feature` | Megőrzött, de fő narratívából kivett feature. |

## Feature-Level Workflow Documents

| Dokumentum | Provenance típus | Megjegyzés |
|------------|------------------|------------|
| [[../features/data-collection/multi-key-implementation-prompt]] | `execution-plan` | Több Riot API kulcsos gyűjtés promptja |
| [[../features/data-collection/mock-datasets-and-chaos-design]] | `execution-plan` | Mock/chaos dataset fejlesztési háttér |
| [[../features/graph-analytics/parallel-brandes-implementation-plan]] | `execution-plan` | Brandes/Rayon fejlesztési terv |
| [[../features/graph-analytics/claude-graph-v2-analysis-prompt]] | `executor-prompt` | Graph V2 külső elemzési prompt |
| [[../features/graph-analytics/thesis-framework-signed-balance-and-assortativity]] | `superseded-plan` | Korábbi thesis framing |
| [[../features/frontend-ux/frontend-plan-signed-balance-assortativity]] | `superseded-plan` | Korábbi combined analytics UI terv |
| [[../features/graph-analytics/signed-balance-theory]] | `retired-feature` | Módszertani háttérként marad, nem fő empirikus eredmény |
| [[../features/backend-runtime/pathfinder-backend-prototype]] | `execution-plan` | Backend migrációs/prototípus jegyzet |
| [[../features/scoring/opscore-v2-local-formula]] | `execution-plan` | V2 formula draft |
| [[../features/scoring/opscore-v2-vs-current-model]] | `execution-plan` | Deferred scoring revision |
| [[../features/frontend-ux/player-details-impact-benchmarking]] | `task-run-log` | Player-details UI support |
| [[../features/frontend-ux/route-transition-overlay]] | `task-run-log` | Frontend transition implementation note |
| [[../features/frontend-ux/landingpagedesign]] | `execution-plan` | Demo/landing copy and layout work |

## NeuroSim Workflow Directories

| Directory | Provenance típus | Mire való |
|-----------|------------------|-----------|
| [[../neurosim/implementation-runs/README]] | `task-run-log` | NeuroSim futtatási naplók és task provenance |
| [[../neurosim/implementation-runs/rust/README]] | `task-run-log` | Rust backend NeuroSim task futások |
| [[../neurosim/implementation-runs/monogame/README]] | `task-run-log` | MonoGame kliens task futások |
| [[../neurosim/implementation-runs/web-prototype/README]] | `task-run-log` | Korai web-prototype futások |
| [[../neurosim/implementation-runs/plans/README]] | `execution-plan` / `executor-prompt` | Master task listek, executor promptok, validation CLI notes |
| [[../neurosim/archive/README]] | `archive-import` | Régi vagy duplikált/importált NeuroSim kontextus |

## Szabály

Ha egy dokumentum főleg azt mondja el, hogy mit kellene csinálni, mit csinált egy agent, milyen prompt alapján futott valami, vagy milyen régi terv lett felülírva, akkor workflow/provenance dokumentum. Ne használd önálló végső állításforrásként a szakdolgozatban; keresd meg mögötte a stabil evidence vagy final source dokumentumot.
