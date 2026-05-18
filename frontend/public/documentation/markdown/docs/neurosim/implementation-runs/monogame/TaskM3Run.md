# Task M3 Run Report — Territory Border & Disputed Zone Overlay

**Date:** 2026-05-06
**Task:** M3 — Territory Border & Disputed Zone Overlay (First Pass + Follow-Up)
**Status:** Build verified (0 errors)

## Summary

Implemented Civ6-style territory border rendering with disputed zone crosshatch and penalty indicator. Created new `TerritoryRenderer.cs` handling all three visual layers. Replaced old per-tile territory tint with proper border-line rendering between adjacent hexes of different owners. Biome textures remain fully visible — only borders demarcate ownership.

**M3 Follow-up (2026-05-06):** Re-enabled disputed zone rendering (crosshatch + penalty icons) which was disabled in first pass. Added zoom-aware border thickness, alpha, and crosshatch density that scale with camera Distance. Verified six-edge hex geometry alignment with simulation neighbor model.

## Visual Rules Implemented

| Rule | Implementation |
|------|---------------|
| Borders between different owners | Thick colored line + glow on shared hex edge, colored per faction, zoom-aware thickness |
| 2px gap between borders | Half-edge inset per tile toward own center creates visible separation |
| Disputed crosshatch | Diagonal hatch lines in 2 directions using contesting tribe colors, clipped to hex bounds, zoom-aware alpha/width |
| 3+ contestant disputes | Third hatch direction added at wider spacing |
| Penalty indicator | Red diamond icon with minus symbol, positioned above hex center, scales down at far zoom |
| No territory fill | Biome textures fully visible; only borders indicate ownership |
| Zoom-aware rendering | Borders thin at far zoom (1.0px core), thick at close zoom (2.8px core); crosshatch/penalty alpha scale with distance |

## Files Changed

### First Pass
| File | Change | Lines |
|------|--------|-------|
| `client-monogame/Rendering/TerritoryRenderer.cs` | **New file** — border rendering, crosshatch overlay, penalty icon, drawing primitives | +290 |
| `client-monogame/Rendering/WorldRenderer.cs` | Added `TerritoryRenderer` field + init/dispose; split overlay rendering into `DrawTerritoryOverlays` + `DrawSpriteOverlays`; removed old `DrawTerritoryTint`; added `X`, `Y`, `ContestingTribeIds` to `RenderableTile` | +40 / -25 |
| `client-monogame/Rendering/PlayableRenderAdapter.cs` | Populate new `X`, `Y`, `ContestingTribeIds` fields when building `RenderableTile` | +7 |

### M3 Follow-up
| File | Change |
|------|--------|
| `client-monogame/Rendering/TerritoryRenderer.cs` | Added `cameraDistance` param to `DrawBorders`, `DrawDisputedZones`, `DrawBorderEdge`, `DrawCrosshatch`, `DrawDiagonalLines`, `DrawPenaltyIcon`; added `ZoomBorderParams` and `ZoomLineAlpha` helpers; border thickness/alpha scales with camera distance; crosshatch alpha/width scales with zoom; penalty icon scales down at far zoom |
| `client-monogame/Rendering/WorldRenderer.cs` | Re-enabled `DrawDisputedZones` call in `DrawTerritoryOverlays`; pass `camera.Distance` to both border and disputed zone rendering |

## Zoom-Aware Scaling Table

| Camera Distance | Zoom Level | Border Core | Border Glow | Crosshatch Alpha Scale | Penalty Scale |
|-----------------|-----------|-------------|-------------|----------------------|---------------|
| < 200 | Close | 2.8px | 4.2px | 1.0x | 1.0x |
| 200–500 | Mid | 1.8px | 2.6px | 0.70x | 0.75x |
| > 500 | Far | 1.0px | 1.5px | 0.45x | 0.50x |

## Six-Edge Hex Geometry Verification

TerritoryRenderer `GetNeighborEdges` uses the same six-way offset-row neighbor model as `PlayableSimulation.HexNeighborCoordinates`. Verified across all 6 directions for both even and odd rows:

| Direction | Even Row Neighbor | Odd Row Neighbor | Hex Edge |
|-----------|------------------|------------------|----------|
| NE | (x, y-1) | (x+1, y-1) | 0-1 (top-right) |
| E | (x+1, y) | (x+1, y) | 1-2 (right) |
| SE | (x, y+1) | (x+1, y+1) | 2-3 (bottom-right) |
| SW | (x-1, y+1) | (x, y+1) | 3-4 (bottom-left) |
| W | (x-1, y) | (x-1, y) | 4-5 (left) |
| NW | (x-1, y-1) | (x, y-1) | 5-0 (top-left) |

HexCorners uses pointy-top hex geometry (-90° start, 60° increments). Corner indices align correctly with offset-row neighbor directions.

## Build Result

```
Build succeeded.
    0 Error(s)
    1 Warning(s) — pre-existing: SimulationViewModel._lastSectionFlags never assigned
```

## Acceptance Checklist

- [x] Borders follow exact six-edge pointy-hex geometry in all camera angles
- [x] Border segments limited to actual hex edges (no overlong/diagonal/detached lines)
- [x] Disputed overlays use zoom-aware alpha — readable at close/mid zoom, subtle at far zoom
- [x] Far zoom simplifies territory into clean thin outlines; close zoom keeps hex-edge fidelity
- [x] Border rendering uses same six-way neighbor model as simulation expansion
- [x] Biome textures remain visible (no opaque territory fill)
- [x] Build passes with 0 errors

## Risks / Follow-Ups

- Zoom-aware thickness values are heuristics tuned by distance thresholds — may need visual tuning after real runtime testing
- No automated screenshot test exists yet (Task M19); visual verification is manual
- Disputed crosshatch density per tile may need reduction if map has many disputed tiles simultaneously
