# Task M23 Run — Settlement Ground Shadows (Blob AO)

**Date:** 2026-05-07
**Status:** Done

## What was done

Created `BlobShadowRenderer.cs` that draws soft radial-gradient shadow ellipses under settlement models in screen space. The shadow pass runs between terrain/vegetation and settlement 3D model passes, giving settlements visual ground contact at near-zero cost.

### Files changed

| File | Change |
|------|--------|
| `client-monogame/Rendering/BlobShadowRenderer.cs` | New — pre-bakes 64×64 radial gradient shadow texture; `DrawShadows()` projects settlement positions to screen space, draws foreshortened ellipses with light-direction offset |
| `client-monogame/Rendering/SettlementRenderer.cs` | Made `SettlementDraw` public, added `HorizontalExtent` field, exposed `DrawList` property, populated `HorizontalExtent` in `CollectInstances` |
| `client-monogame/GameRoot.cs` | Added `_blobShadowRenderer` field, initialized in `LoadContent()`, draws shadows between vegetation (step 2) and settlements (step 3), disposed in `Dispose()` |

### Shadow behavior

- **Texture:** 64×64 CPU-generated radial gradient (white opaque center → transparent edge), tinted `Color.Black * alpha` via SpriteBatch
- **Alpha:** 0.35f default, 0.50f for selected tribe
- **Size:** horizontal radius = `modelHorizontalExtent * drawScale * 1.2f`, vertical = horizontal * 0.4f (isometric foreshortening)
- **Offset:** +8px right, +4px down (matches `SceneLighting.KeyDirection`)
- **LOD:** Shadows skip for negative tribe IDs (Kenney compound pieces) and when `cameraDistance > SettlementLodProfile.MidDistance` (same cutoff as 3D settlement model culling)
- **Position:** Drawn with `DepthStencilState.None` in screen-space SpriteBatch pass — no z-fighting with terrain

### Validation

- `dotnet build` — 0 warnings, 0 errors
- `dotnet run --project client-monogame-tests` — all 37 tests PASS
- No new test added (M23 is visual-only; runtime screenshot verification needed)

### Risks / Follow-ups

- Visual acceptance needs runtime screenshot at close/mid zoom to verify shadow placement, size, and opacity
- Shadow texture is 64×64 — adequate for current screen sizes; may want 128×128 for 4K displays
- No toggle key wired yet (suggest `Shift+S` for shadow on/off in future pass)
- Kenney compound pieces (tents, fences) don't cast shadows — intentionally, they're small ground-level props
