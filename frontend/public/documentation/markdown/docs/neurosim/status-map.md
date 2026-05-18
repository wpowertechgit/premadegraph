---
title: NeuroSim Documentation Status Map
status: working
mainraw_included: false
mainraw_chapters: []
document_role: neurosim-status-map
tags:
  - genetic-neurosim
  - documentation-status
  - thesis
aliases:
  - NeuroSim Status
---

# NeuroSim Documentation Status Map

A jelenlegi `docs/mainraw.tex` nem építi be külön fejezetként a NeuroSim anyagot. Ezért a NeuroSim dokumentáció most külön, jövőbeli / mellékes thesis-scope blokként kezelendő.

## Thesis-Writing Drafts

Ezek íráshoz hasznosak, de nincsenek beemelve a jelenlegi `mainraw.tex` verzióba:

- [[chapter-writing/latex-chapter-map]]
- [[chapter-writing/tribal-neurosim-subchapter-fit-draft]]
- [[chapter-writing/premadegraph-x-genetic-neurosim-integration-plan]]

## Stable Evidence Inside NeuroSim

Ezek validációs vagy futási bizonyítékok. Akkor használd őket, ha később NeuroSim fejezet kerül a dolgozatba:

- [[validation/bp-patch-convergence-2026-05-18]] ← **LEGFRISSEBB**: BP-patched 599-cluster run, 3309 ticks, tribe_285 győztes, determinizmus megerősítve
- [[validation/first-complete-simulation-run-2026-05-16]]
- [[validation/post-first-run-fixes-2026-05-16]]
- [[validation/flexset-empire-599-optimization]]
- [[validation/f2-validation-story/index]]
- [[validation/tribes-v2-first-run-takeaways]]

## Working Architecture And Mechanics

Ezek aktív terv/architektúra jellegűek:

- [[architecture/critical-redesign]]
- [[architecture/v3-architecture-and-mechanics-redesign]]
- [[architecture/monogame-migration-plan]]
- [[architecture/desktop-contract-v1]]
- [[architecture/neural-authority-contract-2026-05-11]]
- [[mechanics/v3-territory-and-expansion-mechanics]]
- [[mechanics/v3-offspring-mechanics-and-evolutionary-lineage]]
- [[mechanics/v3-information-theory-lineage-compression]]
- [[mechanics/neural-network-state-2026-05-12]]
- [[mechanics/tribe-behavior-diff]]
- [[mechanics/v4-border-pressure-and-dispute-mechanics]]

## Provenance / Run Logs

Az `implementation-runs/` mappa futtatási napló és task-provenance. Ezeket ne használd közvetlen thesis állításforrásként, csak akkor, ha pontos implementációs történetet vagy ellenőrzési útvonalat kell visszakeresni.

Entry point: [[implementation-runs/README]]

## Archive

Az `archive/` mappa megőrzésre szolgál. Innen csak akkor dolgozz, ha elveszett kontextust kell visszanyerni.

Entry point: [[archive/README]]
