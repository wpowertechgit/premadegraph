# Task M10 Run — Font & UI Art Direction Pass

**Date:** 2026-05-07
**Status:** Done

## What Was Done

Applied the three-font scheme from the v3 asset plan across all UI panels:

| Font Role | Font Family | TTF Source | Used In |
|-----------|------------|------------|---------|
| Display (Header) | Cinzel Bold 16px | `Cinzel/static/Cinzel-Bold.ttf` | SelectionPanel tribe names, panel titles |
| Display (Body/Small) | Noto Serif 14px/11px | `Noto_Serif/static/NotoSerif-Regular.ttf` | SelectionPanel data, TombstonePanel, LineageInspectorPanel |
| Debug (all sizes) | Trykker 13px/10px | `Trykker/Trykker-Regular.ttf` | DebugHud (all text) |
| Fallback | Consolas (system) | N/A | Any size where TTF load fails |

### FontRenderer Refactor

- Added `FontRole` enum (`Display`, `Debug`) — constructor parameter selects font family set
- `FontRole.Display`: Cinzel (Header) + Noto Serif (Body, Small) — for polity names, panels, dossiers
- `FontRole.Debug`: Trykker (all sizes) — for debug HUD overlay
- TTF loading via `System.Drawing.Text.PrivateFontCollection`
- Path resolution: walks up from `AppContext.BaseDirectory` looking for `Content/UI/Fonts/` (matches `RuntimeAssetLoader.ResolveContentRoot` pattern)
- Graceful fallback to `Consolas` if any TTF file missing or unreadable
- Line height recalculated from actual font pixel size (not hardcoded constants)

### DebugHud Changes

- Creates `FontRenderer(GraphicsDevice, FontRole.Debug)` — Trykker font for all debug text
- Debug font sizes: Header 13px Bold, Body 13px Regular, Small 10px Regular (compact for overlay)

### GameRoot Changes

- Added `_panelFontRenderer` field — `FontRenderer(GraphicsDevice, FontRole.Display)` created in `LoadContent`
- Panels (SelectionPanel, TombstonePanel, LineageInspectorPanel) now receive `_panelFontRenderer` instead of `_debugHud.Font`
- Proper disposal of `_panelFontRenderer` in `Dispose()`

### TombstonePanel & LineageInspectorPanel Fix

- Removed redundant self-created `FontRenderer` instances (were never disposed — GDI+ leak)
- Both panels now cache the shared `FontRenderer` passed via `Draw()` parameter (same pattern as SelectionPanel)

## Files Changed

| File | Change |
|------|--------|
| `client-monogame/Rendering/FontRenderer.cs` | Full refactor: `FontRole` enum, TTF loading via `PrivateFontCollection`, per-role font families, walk-up path resolution, `Consolas` fallback, dynamic line height |
| `client-monogame/UI/DebugHud.cs` | `FontRole.Debug` in `EnsureResources` — Trykker font |
| `client-monogame/GameRoot.cs` | `_panelFontRenderer` field + creation + panel routing + disposal |
| `client-monogame/UI/TombstonePanel.cs` | Removed redundant self-created `FontRenderer`; caches shared instance |
| `client-monogame/UI/LineageInspectorPanel.cs` | Removed redundant self-created `FontRenderer`; caches shared instance |

## Validation

- `dotnet build` — 0 errors, 0 warnings (client-monogame)
- `dotnet build` — 0 errors, 0 warnings (client-monogame-tests)
- All three TTF files verified on disk: `Cinzel-Bold.ttf`, `NotoSerif-Regular.ttf`, `Trykker-Regular.ttf`
- Fallback path confirmed: if TTF load fails, `Consolas` system font used

**Runtime visual verification:** Not performed — requires running the MonoGame client and visually inspecting font rendering. The build-only verification confirms:
- Code compiles without errors
- Font loading paths resolve correctly
- Fallback chain is wired
- No GDI+ resource leaks from duplicate FontRenderer instances

## Risks / Follow-ups

1. **PrivateFontCollection lifetime:** The `PrivateFontCollection` objects created in `LoadFontFamily()` are not explicitly disposed. They become eligible for GC when the `FontFamily` reference is released. In practice this is fine because FontRenderer lives for the entire application lifetime, but a purist could wrap them in a field-level collection.

2. **Font metric differences:** Trykker, Cinzel, and Noto Serif have different glyph metrics than Consolas. Panel layouts that assume monospace-like character widths (e.g., DebugHud column positions at fixed pixel offsets) may need minor tuning after visual verification.

3. **Runtime visual verification deferred:** Font rendering should be visually checked at runtime. The debug HUD column alignment (hardcoded `x + 62`, `x + 164`, `x + 72` offsets) may need adjustment since Trykker has different character widths than Consolas.

4. **Non-Windows platforms:** `System.Drawing` with GDI+ `PrivateFontCollection` is Windows-only. Cross-platform MonoGame builds would need a different font loading strategy (e.g., MonoGame SpriteFont or FreeType-based rendering). The fallback to system "Consolas" would also fail on non-Windows. This is a known constraint of the current GDI+ approach, not new to M10.
