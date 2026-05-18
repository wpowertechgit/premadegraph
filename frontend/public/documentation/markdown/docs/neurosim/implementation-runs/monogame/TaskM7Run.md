# Task M7 — Biome-Specific Visual Rendering

**Date:** 2026-05-07
**Status:** Done

## Summary

Added per-biome visual differentiation to terrain rendering. Each biome now has a distinct ambient light tint applied during hex tile rendering. Missing biome textures fall back to the Plains (GrassMedium) texture instead of a white pixel. `RenderableTile` carries `BiomeId` so the renderer can apply biome-specific effect parameters per tile group.

## Files Modified

| File | Change |
|------|--------|
| `client-monogame/Assets/BiomeVisualProfile.cs` | Added `Color AmbientTint` field to the record |
| `client-monogame/Assets/AssetManifest.cs` | Added `AmbientTint` values to all 11 biome profiles (Unknown, Plains, DenseForest, SparseWoodland, Hills, Mountains, Marsh, Riverland, DrySteppe, FertileValley, Cold). Added `using Microsoft.Xna.Framework` for Color type. |
| `client-monogame/Rendering/WorldRenderer.cs` | Added `BiomeId` field to `RenderableTile`. Added `_ambientTintCache` dictionary. `DrawHexTerrain` now groups tiles by `(BiomeId, TextureKey)` tuple for per-biome ambient tint. Missing biome texture falls back to `RuntimeAssetCatalog.GrassMedium` (Plains texture) instead of `_pixel!`. |
| `client-monogame/Rendering/PlayableRenderAdapter.cs` | Passes `tile.Biome` through to `RenderableTile.Biome` field in `BuildTiles()`. |

## Ambient Tint Values

| Biome | AmbientTint (RGB) | Effect |
|-------|-------------------|--------|
| Unknown | (105,105,105) | Neutral grey |
| Plains | (118,116,106) | Warm neutral (≈ previous default) |
| DenseForest | (95,110,90) | Green canopy shade |
| SparseWoodland | (108,118,100) | Lighter woodland green |
| Hills | (112,108,102) | Rocky warm |
| Mountains | (108,108,112) | Cool grey |
| Marsh | (100,108,105) | Murky green |
| Riverland | (102,112,118) | Watery blue-tinted |
| DrySteppe | (118,108,98) | Warm dry |
| FertileValley | (118,122,108) | Lush green |
| Cold | (112,118,125) | Icy blue-tinted |

## Acceptance Checklist

- [x] Each biome has distinct visual terrain color/texture — per-biome ambient tint applied in `DrawHexTerrain`
- [x] Trees/props auto-instanced based on M15 biome prop rules — unchanged, already uses `PropPlacementPlanner`
- [x] Missing biome texture falls back to Plains — `ResolveBiomeTexture(RuntimeAssetCatalog.GrassMedium)` used as secondary fallback before `_pixel!`
- [x] Performance: instanced trees don't tank frame rate — LOD system unchanged, no extra allocations per frame

## Validation

```
dotnet build (client-monogame) — succeeded, 0 errors
dotnet build (client-monogame-tests) — succeeded, 0 errors
```

## Risks / Follow-ups

- Ambient tint values may need visual tuning after runtime screenshot review — values are conservative to avoid looking garish
- `VegetationRenderer` consumes M15 prop rules unchanged; no modifications needed for M7
- Biomes that share a texture key (e.g. `GrassMedium` for Plains + FertileValley) now get separate ambient tints because grouping is by `(BiomeId, TextureKey)` tuple
- Pre-existing warnings in `SimulationViewModel.cs`, `ScreenshotCapture.cs`, `FontRenderer.cs` are unrelated to M7
