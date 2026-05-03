# Task Run: Track F — Hex Map Migration (F1 + F2)

**Date:** 2026-05-03  
**Agent constraint:** Frontend only. Backend not touched.

---

## Tasks Implemented

### F1 — Hex Coordinate Utility Module

**Created:** `frontend/src/neurosimHex.ts`

Exports:

| Symbol | Purpose |
|---|---|
| `AxialCoord` | `{q, r}` interface |
| `PixelPoint` | `{x, y}` interface |
| `SQRT3` | `Math.sqrt(3)` constant |
| `tileIdToAxial(tileId, gridW)` | Row-major tile ID → axial hex (odd-r offset, pointy-top) |
| `axialToPixel(q, r, hexSize)` | Axial → pixel center |
| `hexCorners(cx, cy, hexSize)` | 6 corner `PixelPoint[]` for a pointy-top hex |
| `computeHexSize(gridW, gridH, maxPx)` | Largest integer hexSize fitting grid within maxPx |
| `hexCanvasDims(gridW, gridH, hexSize)` | Canvas `{w, h, originX, originY}` |
| `tileCenter(tileId, gridW, hexSize, originX, originY)` | Pixel center of a tile |
| `drawHexPath(ctx, cx, cy, hexSize)` | Trace hex polygon path into canvas 2D context |

Coordinate system: pointy-top hexagons, odd-r offset.  
Row-major → axial: `q = col - (row - (row & 1)) / 2`, `r = row`.

No test runner in the frontend (no vitest/jest in package.json). `neurosimHex.test.ts` not created.

---

### F2 — Render Square Grid As Hex-Like Frontend Layer

**Modified:** `frontend/src/pages/TribalSimulationPage.tsx`

Changes:

1. **Import added** — `tileIdToAxial`, `axialToPixel`, `drawHexPath`, `computeHexSize`, `hexCanvasDims` from `../neurosimHex`.

2. **`draw` function** — replaced `fillRect` square tile rendering with hex polygon rendering:
   - `hexSize = computeHexSize(gw, gh, 800)` — for default 40×40 grid → hexSize=11.
   - `{w, h, originX, originY} = hexCanvasDims(gw, gh, hexSize)` — canvas is ~774×667 px for 40×40.
   - `canvas.width = canvasW; canvas.height = canvasH;` set imperatively each frame (resize clears canvas, equivalent to old clear strategy).
   - Tile loop now: `tileIdToAxial` → `axialToPixel` → `drawHexPath` + `ctx.fill()` for biome, food overlay, and territory tint.
   - Tribe home tile markers (behavior dot + population label) positioned at hex centers.

3. **Canvas JSX** — removed `width={CANVAS_SIZE}` and `height={CANVAS_SIZE}` props so React does not override the imperatively-set dimensions on re-render.

Existing WebSocket frame parser unchanged. All fallbacks (all-plains biome, empty territory) still work. Dynamic grid dims from E3 world snapshot (gridWRef/gridHRef) feed through to `computeHexSize`, so any non-40×40 grid renders correctly.

### F3 — Backend Hex Neighbor Abstraction

Skipped — backend not touched per task constraint.

---

## Files Changed

- `frontend/src/neurosimHex.ts` — **created**
- `frontend/src/pages/TribalSimulationPage.tsx` — **modified** (import + draw function rewrite + canvas JSX)

---

## Validation

```
npm --prefix frontend run build -> ✓ built in 9.49s (0 TypeScript errors, 0 build errors)
```

`TribalSimulationPage-eL62javg.js` emitted at 26.31 kB, includes neurosimHex helpers.

---

## Notes / Deferred

- F3 (backend hex neighbor abstraction) not implemented — backend constraint.
- No test file — no test runner in frontend.
- Canvas starts at browser default (300×150) until first WebSocket frame triggers `draw()`. Acceptable prototype behavior.
- For dynamic grid sizes from the world snapshot (via E3), `computeHexSize` scales hexSize correctly. Large grids (e.g. 200×200) produce smaller hexes but remain within 800px canvas bounds.
- Hex rendering visual correctness requires a live backend connection to verify; build validates types and bundling only.
