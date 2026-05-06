# Task M4 Run Report — Semantic Zoom and Camera Bounds (Civ6-Style Camera)

**Date:** 2026-05-06
**Status:** Done
**Files changed:** 4

## What Was Done

### IsometricCamera.cs — Semantic Zoom + Bug Fixes
- Added `ZoomLevel` enum: `Far` (>500 dist), `Mid` (200-500), `Close` (<200)
- Added `CurrentZoom` property auto-calculated from `Distance`
- Pitch-shifting zoom: far distance → ~78° pitch (top-down), close distance → ~40° pitch (tactical). Auto-lerps toward distance-derived target.
- Cursor-directed zoom: shifts focal point toward/away from cursor ground point when scrolling. No temporary state swap (avoids one-frame camera jumps / red flashes).
- Zoom damping: `_targetDistance` with smooth lerp (sharpness 8x).
- Map bounds clamping: `SetMapBounds()` + `ClampFocalPoint()` each frame. Tight margin (20-60 units, zoom-dependent).
- WASD pan: yaw-relative ground-plane movement. Forward = where camera looks (+Z at Yaw=0), right = screen-right (+X at Yaw=0).
- Bug fix: removed temporary Distance swap in zoom handler that caused red flash artifacts.
- Bug fix: A/D were using the wrong direction. Now D moves focal +X (screen-right), A moves focal -X (screen-left) — verified against middle-mouse grab-drag mapping.
- MaxPitch 75°→80°, MinDistance 80, MaxDistance 1800.

### GameRoot.cs — Bounds + Clear Color
- **Critical fix**: Z-bounds were inverted (`minZ` > `maxZ`). topLeft.Y = 0 was passed as `maxZ`, bottomRight.Y (~798) as `minZ`. This clamped Z to ~42 (top of map), making bottom half unreachable. Fixed: `minZ = topLeft.Y - pad`, `maxZ = bottomRight.Y + pad`.
- Map bounds computed from tile grid each frame before camera.Update().
- Clear color changed from `(18,19,17)` pure black to `(28,22,15)` dark wood-table brown — any void blends with tabletop.

### PlayableRenderAdapter.cs
- Exposed `TileSize` as public property.

### TerritoryRenderer.cs — Crosshatch Edge-to-Edge Fix
- Crosshatch hex radius changed from `tile.Size * 0.82f` to `tile.Size * 0.995f`, matching border edge radius. No gap between disputed zone crosshatch and territory border edges.

## Validation

- `dotnet build`: 0 errors, only pre-existing CA1416/CS0649 warnings

## Bugs Found & Fixed (Post-Initial M4)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Cannot pan to bottom half of map | minZ > maxZ (parameter swap in SetMapBounds) | Correct parameter order: minZ=topLeft.Y, maxZ=bottomRight.Y |
| A goes right, D goes left | Wrong sign on right-vector pan contribution | Flipped: W unchanged, A=-X, D=+X (matches grab-drag convention) |
| Red flashes during zoom | Temporary Distance swap + matrix recompute caused one-frame jumps | Removed temporary state swap; use direct FocalPoint shift |
| Can pan half a map into void | Padding too generous (120–280 units) | Reduced to 20–60 units (zoom-dependent) |
| Crosshatch gap from border edges | Different hex radii (0.82f vs 0.995f) | Unified to 0.995f |
| Black void at edges | Clear color was near-black | Changed to dark wood-brown (28,22,15) |

## Files Changed

| File | Change |
|------|--------|
| `client-monogame/Rendering/IsometricCamera.cs` | ZoomLevel enum, pitch-shifting zoom, cursor-directed zoom, zoom damping, map bounds clamping, A/D sign fix, zoom flash fix, tight padding |
| `client-monogame/Rendering/PlayableRenderAdapter.cs` | Exposed TileSize public property |
| `client-monogame/GameRoot.cs` | Map bounds from grid with correct Z order, dark-wood clear color |
| `client-monogame/Rendering/TerritoryRenderer.cs` | Crosshatch hex radius 0.82→0.995 for edge-to-edge fill |
