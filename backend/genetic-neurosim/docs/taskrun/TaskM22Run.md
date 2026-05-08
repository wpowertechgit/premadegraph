# Task M22 Run — Post-Process Render Target Pass (Vignette + Color Grade)

**Completed:** 2026-05-07
**Status:** Done

## Summary

Added CPU-based post-process pass: scene renders to a RenderTarget2D, then a warm parchment color grade + soft vignette are composited via SpriteBatch before UI is drawn on top. No custom HLSL shaders.

## Files Changed

| File | Action |
|------|--------|
| `client-monogame/Rendering/PostProcessRenderer.cs` | **Created** — RT management, vignette generation, Apply() composite |
| `client-monogame/GameRoot.cs` | **Modified** — integrated post-process pipeline into Draw(), added 'P' toggle, resize hook, dispose |
| `client-monogame/Input/KeyboardCommandController.cs` | **Modified** — added `TogglePostProcess` to command set |

## Implementation Details

### PostProcessRenderer
- `EnsureTargets(width, height)` — creates/recreates `RenderTarget2D` and vignette `Texture2D` at current viewport size; no-op if size unchanged
- `Apply()` — draws scene RT with `Color(255, 248, 235) * 0.90f` warm parchment tint, then overlays vignette with `BlendState.AlphaBlend`
- Vignette: CPU-generated radial gradient — black at edges, transparent center, pow-2.2 falloff, 0.45 inner radius

### Draw Pipeline (restructured in GameRoot.Draw)
1. Clear back buffer (warm wood-table `Color(74, 54, 33)`)
2. If post-process enabled (no screenshot): `SetRenderTarget(sceneRT)`, clear same color
3. If screenshot capture active: `SetRenderTarget(captureRt)` (post-process skipped)
4. Draw scene (tabletop → terrain → vegetation → shadows → settlements → banners → symbols)
5. `SetRenderTarget(null)` — restore back buffer
6. If post-process: `Apply()` composites tinted scene + vignette
7. If screenshot: `EndDraw()` saves raw scene PNG
8. Draw UI on top (selection panel, lineage, tombstone, debug HUD) — **unaffected by post-process**

### Toggle
- `P` key toggles post-process on/off for before/after comparison
- Enabled by default (`_postProcessEnabled = true`)

### Window Resize
- `Window.ClientSizeChanged` handler calls `EnsureTargets()` to regenerate RT + vignette at new size

## Validation

- `dotnet build` — client-monogame: 0 errors, 0 warnings
- `dotnet build` — client-monogame-tests: 0 errors, 0 warnings
- No runtime verification (Windows MonoGame desktop app requires GPU — build-only validation)

## Visual Acceptance (Pending Runtime)

- [ ] Soft darkened edges (vignette) visible at all zoom levels
- [ ] Warm parchment color grade unifies palette without harsh orange
- [ ] No performance regression (one extra SpriteBatch pass at end of frame)
- [ ] HUD renders on top, not darkened by vignette
- [ ] P key toggles before/after comparison
- [ ] Window resize re-generates vignette correctly

## Risks / Follow-ups

- **M22 visual acceptance** requires screenshots in-game — not possible in build-only environment. Deferred to runtime testing.
- Vignette texture is `width × height` RGBA — ~8MB at 1920×1080. Acceptable for a desktop app. Could be reduced to 1/4 res with bilinear upscale if needed.
- Post-process skips when screenshot capture (F6) is active — screenshots show raw scene for visual acceptance testing.
- No bloom pass added (scope guardrail: "Only add a bloom pass if V0 compiles clean and the vignette alone looks good").
