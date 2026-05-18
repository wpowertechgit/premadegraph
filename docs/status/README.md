---
title: Documentation Status Hub
tags:
  - index
  - documentation-status
  - thesis
aliases:
  - Documentation Status
  - Doc Status
---

# Documentation Status Hub

Ez a mappa azt követi, hogy a dokumentumok milyen állapotban vannak a szakdolgozatírás szempontjából.

## Státuszok

| Státusz | Jelentés |
|---------|----------|
| `final` | Thesis-facing, stabil forrás. Használható LaTeX-fejezet írásához vagy védekezéshez. |
| `working` | Folyamatban lévő terv, implementációs jegyzet, prompt vagy support anyag. Hasznos, de nem végleges állításforrás. |
| `retired` | Megőrzött, de a fő narratívából visszavont feature vagy módszertani háttér. |
| `superseded` | Régi terv vagy framing, amelyet újabb döntés felülírt. Csak történeti kontextusnak használd. |
| `workflow` | Munkafolyamatot, futtatási naplót, promptot, task listát vagy provenance-t jelöl. |
| `archive` | Megőrzött régi/importált kontextus. Csak visszakeresésre használd. |

## Jelölés

A feature-dokumentumok front matterében ezek a mezők szerepelnek:

```yaml
status: final
mainraw_included: true
mainraw_chapters: [10, 20]
document_role: thesis-source
```

`mainraw_included: true` nem azt jelenti, hogy a dokumentum szó szerint be van másolva a LaTeX-be. Azt jelenti, hogy a dokumentum tartalma, eredménye vagy döntése megjelenik a `docs/mainraw.tex` jelenlegi narratívájában.

## Térképek

- [[mainraw-inclusion-map]] - mely dokumentumok épültek be a `docs/mainraw.tex` fejezeteibe.
- [[working-documents-map]] - folyamatban lévő, support, retired és superseded dokumentumok.
- [[workflow-provenance-map]] - task runok, régi verziók, promptok, executor tervek és archive/import doksik.
