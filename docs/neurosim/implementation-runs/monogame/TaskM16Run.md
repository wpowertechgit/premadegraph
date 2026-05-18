# Task M16 — Selection, Inspection, And Interaction Cleanup

**Date:** 2026-05-06
**Status:** Done

## Summary

Replaced pixel-art debug HUD with proper system font rendering (Consolas). Added hex-precise click selection system using point-in-hex math instead of distance-from-center approximation. Created separate selection info panel distinct from debug HUD. Removed unused circle drawing methods from WorldRenderer. Selection highlight now uses translucent hex fill + exact hex outline.

## Files Created

| File | Purpose |
|------|---------|
| `client-monogame/Input/SelectionSystem.cs` | Hex-precise point-in-hex click→tile selection using offset coordinate math |
| `client-monogame/UI/SelectionPanel.cs` | Clean overlay panel (top-right) showing selected tribe: tier, population, food, territory, disputes, 5 artifact values with bars |
| `client-monogame/Rendering/FontRenderer.cs` | Runtime text→Texture2D rendering via System.Drawing.Common, uses Consolas font, caches rendered strings |

## Files Modified

| File | Change |
|------|--------|
| `client-monogame/UI/DebugHud.cs` | Complete rewrite: replaced 358-line pixel glyph system (~40 glyph patterns) with FontRenderer-based text rendering. Same dark panel layout, same data fields, real anti-aliased text. ~250 lines removed. |
| `client-monogame/Rendering/WorldRenderer.cs` | Removed `DrawCircle`/`DrawCircleOutline` methods. Selection highlight now draws translucent hex fill + brighter hex outline (was hex outline only, no fill). |
| `client-monogame/GameRoot.cs` | Added `_selectionSystem` and `_selectionPanel` fields. `SelectTribeAtScreenPosition` now uses `SelectionSystem.Pick()` for hex-precise picking. SelectionPanel rendered top-right before debug HUD. |
| `client-monogame/TribalNeuroSim.Client.csproj` | Added `System.Drawing.Common` 8.0.0 package reference |

## Acceptance Verification

- [x] Click selects a tile or tribe reliably (hex-precise point-in-hex test, checks candidate + 6 neighbors)
- [x] Selected hex outline follows the exact hex border (uses `DrawHexOutline` with hex corner math)
- [x] Selected tribe panel shows: tier, population, food, territory count, 5 artifact profiles with bars, disputes
- [x] Debug HUD and gameplay inspection are visually separate (debug top-left, selection top-right)
- [x] No large unexplained circles remain in normal rendering (`DrawCircle`/`DrawCircleOutline` removed)
- [x] Pixel debug screen replaced with proper Consolas font (anti-aliased system font via System.Drawing)
- [x] Build: 0 errors
- [x] Tests: passed

## Key Design Decisions

- **Font choice**: Consolas (monospace, professional, available on all Windows). No Google Fonts download needed for debug/inspection. Task M10 (Cinzel/Noto Serif) still pending for display/body fonts.
- **Hex picking**: Uses offset "odd-r" coordinate system matching PlayableRenderAdapter.TileCenter. Converts screen→world→hex coords, checks candidate + 6 neighbors with exact point-in-hex test.
- **FontRenderer caching**: Rendered strings cached in ConcurrentDictionary keyed by (size, color, text). Cache cleared on Dispose. No per-frame re-render cost for static text.
- **System.Drawing.Common CA1416 warnings**: Expected — library is Windows-only; project targets DesktopGL on Windows. Suppress or add platform guard if cross-platform needed later.

## Risks / Follow-ups

- `FontRenderer` uses `System.Drawing.Common` which is Windows-only. Cross-platform (Linux/macOS) would need SkiaSharp or SixLabors.Fonts.
- Consolas font hardcoded; should be configurable or fall back if font missing. Currently no fallback — if Consolas not found, System.Drawing throws.
- SelectionPanel and DebugHud each do separate `spriteBatch.Begin/End` — fine for now, single batch would be more efficient.
- M10 (Font & UI Art Direction) should build on this: Cinzel/Noto Serif for display/body, keep Consolas for debug.
- Point-in-hex test assumes flat-top or pointy-top; verified matching the project's pointy-top layout via `HexCorners` in WorldRenderer.
