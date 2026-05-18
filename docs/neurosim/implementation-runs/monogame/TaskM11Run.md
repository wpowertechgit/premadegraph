# Task M11 Run — Map Presentation: Parchment On Table, No Black Skybox

**Date:** 2026-05-06
**Status:** Done

## Files Changed

| File | Action |
|------|--------|
| `client-monogame/Rendering/TabletopRenderer.cs` | Created |
| `client-monogame/GameRoot.cs` | Modified |

## What Was Done

Created `TabletopRenderer` that draws two world-space 3D quads underneath the hex map:

1. **Table quad** — Large dark wood-colored plane (10000×10000 world units) at Y=-1.2, centered on the map. Large enough that the camera never sees its edges at any zoom level. Uses flat unlit brown color (`0.14, 0.12, 0.09`).

2. **Parchment quad** — Textured plane at Y=-0.55 (just below lowest hex terrain), sized to map bounds + 90 unit margin. Loads `Content/Image/parchment-bg.jpg` (4500×300 parchment wallpaper). Falls back to warm beige diffuse color if texture missing.

Both quads use `BasicEffect` with `LightingEnabled=false` (flat presentation), `RasterizerState.CullNone`, and `DepthStencilState.Default`. They are drawn before hex terrain in the render order, so terrain, vegetation, and settlements sit on top.

GameRoot changes:
- Added `_tabletopRenderer` field
- Initializes + loads parchment texture in `LoadContent()`
- Computes map bounds (min/max X/Z from tile centers ± hex radius) each frame
- Draws table + parchment before terrain layers in `Draw()`
- Disposes in `Dispose(bool)`

`ParchmentMapRenderer.cs` was not created separately — the task's own implementation block puts both `DrawTable` and `DrawParchment` in `TabletopRenderer`. A separate parchment renderer can be extracted later when deckled edges, curled paper, or bevels are added.

## Design Decisions

- **Y layering**: Table at -1.2, parchment at -0.55, hex terrain at visual elevation (~ -0.28 to +1.15). Terrain always sits on top.
- **Table size**: 10000×10000 units. At max camera distance (1800) and min pitch (15°), far plane (5000) could clip edges, but normal strategy angles never expose void. Clear color `(18,19,17)` acts as fallback.
- **Parchment UVs**: Full 0-1 range so the 4500×300 texture stretches across the map. LinearWrap sampler for edge handling.
- **No lighting**: Both quads use flat unlit rendering to read as a physical tabletop, not a 3D-lit surface.

## Scope Guardrails Respected

- Only flat quads — no curled parchment, bevels, shadow-catcher tricks, ornate table dressing
- No decorative gradient/orb backgrounds — physical tabletop scene only
- Parchment edge refinement deferred until camera clipping, world bounds, depth sorting, and lighting consistency are stable
- HUD remains readable since SpriteBatch overlay draws after 3D geometry

## Validation

- `dotnet build` succeeds with 0 errors (1 pre-existing CS0649 warning unrelated)
- Parchment texture confirmed at `Content/Image/parchment-bg.jpg`
- Manual review: depth ordering correct (table → parchment → terrain → vegetation → settlements → overlays → HUD)
- No state leaks between tabletop rendering and hex terrain rendering (each sets own rasterizer/blend/depth states)

## Risks / Follow-ups

- **Far plane clipping**: At extreme zoom-out (distance >1000 at low pitch) the 10000×10000 table corners may clip at far plane 5000. Mitigation: clear color is dark and matches table color. Fix later: increase far plane or use fog.
- **Parchment texture stretching**: 4500×300 image stretched across map may look low-res on very large maps. Fine for default 12-tribe demo (~900×600 world units).
- **Parchment edge refinement**: The task's scope guardrail defers deckled edges, curled paper, and bevels. Extract `ParchmentMapRenderer` when that work begins.
- **Dynamic map size**: Map bounds recomputed every frame from tiles, so the system works when tribe count changes map size.
