# Task M14 — Heightmap And Terrain Relief Without Chunk Mountains

**Completed:** 2026-05-06
**Status:** Done, all 25 tests pass

## Files Modified

| File | Change |
|------|--------|
| `client-monogame/Models/PlayableWorldGenerator.cs` | Refined `VisualElevation()`: reduced noise amplitude from 2.8→0.70, biome lifts: Hills 1.8→0.40, Mountains 3.0→0.65, Cold 0.8→0.18, Riverland -0.35→-0.15, Marsh -0.20→-0.10. Clamp range tightened from [-0.45, 4.6] to [-0.28, 1.15]. Added doc comment explaining map-like relief policy. |
| `client-monogame/Rendering/WorldRenderer.cs` | Removed `_propEffect` field and initialization. Removed `DrawElevationProps()`, `ShouldRenderElevationProp()`, `RenderPropModel()`, `ComputeModelScale()` methods — all terrain chunk model rendering. Removed `modelsByKey` parameter from `DrawWorld()` and `DrawTerrainLayers()`. |
| `client-monogame/GameRoot.cs` | Removed `_terrainModels` field. Removed `LoadRuntimeModels()` method and its call site. Updated `DrawTerrainLayers()` call to not pass terrain models. Updated comment from "mountain props" to "heightmap relief, no chunk models". |
| `client-monogame-tests/Program.cs` | Updated `PlayableRenderAdapterExposesSubtleVisualElevation` test: range assertion >1.0→>0.40, bounds [-0.5,5.0]→[-0.35,1.35] to match new subtle elevation policy. |

## What Was Done

### VisualElevation Refinement
- Noise-driven elevation reduced to subtle map-like amplitude
- Per-biome lift values cut to ~25% of original
- Mountains expressed as gentle +0.65 lift (was +3.0)
- Hills as +0.40 lift (was +1.8)
- Riverland (-0.15) and Marsh (-0.10) as gentle depressions
- Overall clamp range [-0.28, 1.15] keeps map readable as parchment/board
- Hex radius of 28 units → max slope between adjacent tiles ≈ 1.15/28 ≈ 2.3° at worst

### Terrain Chunk Model Removal
- All `DrawElevationProps` rendering pipeline removed
- `_propEffect` BasicEffect removed
- `ShouldRenderElevationProp`, `RenderPropModel`, `ComputeModelScale` helpers removed
- `RuntimeAssetCatalog.TerrainModels` definitions kept as inert catalog data (asset files remain on disk)
- Terrain model loading (`LoadRuntimeModels`) removed from GameRoot initialization
- `ModelKey` always null in demo `BuildTiles()` — no chunk model paths reachable
- `PlayableRenderAdapterDoesNotSpawnTerrainChunkModels` test continues to pass

### Elevation Architecture (V0)
- Each hex tile is a flat disc translated in Y by `VisualElevation`
- Continuous terrain mesh (per-vertex elevation, neighbor-aware smoothing) is deferred as optional future work per M14 spec
- At refined amplitudes, seams between adjacent tiles of different elevation are visually negligible at strategy camera angles
- Prop objects (trees, grass, rocks from M15) and settlements (from M13) sit on terrain at per-tile elevation

## Validation

```
dotnet build — 0 errors, 0 warnings
dotnet run (tests) — 25/25 PASS
```

Key passing tests:
- `playable render adapter does not spawn terrain chunk models`
- `playable render adapter exposes subtle visual elevation`
- `playable render adapter uses proper terrain material textures`
- All M12/M13/M15 tests pass (no regression)

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| At low camera angle, terrain has visible relief | Yes — elevation range ~1.3 units gives readable relief |
| At normal strategy angle, terrain reads as coherent map | Yes — max lift 1.15 on 28-unit hex radius is subtle |
| No large terrain chunks appear as mountains | Yes — all chunk model rendering code removed |
| Rocks/grass/trees spawned as small prop elements with own textures | Yes — already handled by M15 prop placement rules |
| Deterministic visual elevation from seeded noise | Yes — same seed = same elevation, via Fbm/Noise01/Hash01 |
| Low elevation amplitude (board/parchment map feel) | Yes — clamp [-0.28, 1.15] |
| Props at tile's visual elevation | Yes — `VisualElevation` in `RenderableTile` consumed by prop/settlement renderers |

## Risks / Follow-Ups

1. **Hex seams at low camera angles**: Flat-per-tile hex approach means adjacent tiles of different biomes have vertical seams. At current amplitudes (~1.15 max), seams are subtle. If seams become visually objectionable later, implement continuous terrain mesh (per M14 "optional later" note).
2. **TerrainModels catalog still exists**: `RuntimeAssetCatalog.TerrainModels` entries are still defined and included in `AssetsByKey`. They're inert (no code loads them), but a future cleanup pass could remove them.
3. **Mountain biome readability**: Mountains are now expressed only by texture (GrayRocks/StoneWall), subtle +0.65 elevation, and prop density rules (M15). If mountains need more visual distinctiveness, consider tint or icon overlays rather than restoring chunk models.
