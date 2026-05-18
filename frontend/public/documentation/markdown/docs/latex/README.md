---
title: Modular LaTeX Thesis
status: final
mainraw_included: true
mainraw_chapters: [1, 23]
document_role: latex-build-index
tags:
  - latex
  - thesis
  - mainraw
aliases:
  - LaTeX Thesis
---

# Modular LaTeX Thesis

This folder is the self-contained LaTeX workspace for the thesis.

## Entry Point

- `main.tex` is the active modular build entry point.
- `mainraw-monolith-snapshot.tex` is a copied snapshot of the old monolithic `docs/mainraw.tex`.
- The original `docs/mainraw.tex` is intentionally left in place.

## Structure

| Path | Purpose |
|------|---------|
| `preamble.tex` | Document class, packages, fonts, commands, graphic paths. |
| `frontmatter.tex` | Title page and table of contents. |
| `chapters/` | One `.tex` file per thesis chapter. |
| `references.tex` | Embedded bibliography from the original monolithic file. |
| `assets/` | Local copy of LaTeX images and diagrams from `docs/assets/`. |

## Build

Run from this directory:

```powershell
tectonic main.tex
```

The active graphic path is:

```tex
\graphicspath{{assets/demo_shots/}{assets/diagrams/}}
```

This means chapter files can use image names directly, such as `match-analysis-page.png` or `full system diagram.pdf`.
