# VegetationRenderer — Runtime Vegetation Instancing

**Date:** 2026-05-05
**Branch:** main
**Build:** 0 errors, 0 warnings

## Summary

Added `VegetationRenderer` to the MonoGame 3D client. Loads glTF/GLB vegetation and structure models at runtime via SharpGLTF, scatters them on biome hexes, and renders with batched per-instance draw calls (shared VertexBuffer/IndexBuffer, per-instance World matrix).

## Files Changed

### New: `Rendering/VegetationRenderer.cs`

- **Model loading** — `LoadModel(key, relativePath)` auto-discovers `.gltf` then `.glb` extension. Uses SharpGLTF `ModelRoot.Load()` to parse glTF, extracts `VertexPositionNormalTexture` arrays, creates eager GPU `VertexBuffer`/`IndexBuffer` via private `ModelMeshData` class.
- **Instance collection** — `CollectInstances(simulation, registry)` iterates all tiles, reads biome from `AssetRegistry.ResolveBiome()`, deterministically scatters props within hex radius:
  - DenseForest: 5–12 props per tile
  - SparseWoodland: 2–6
  - Plains/FertileValley: 0–3
  - Marsh/Cold/Hills: 1–4/1–5/1–4
  - Mountains/DrySteppe: 1–3
  - Riverland/Unknown: none (structures only)
- **Camp rendering** — Tiles with alive tribe `MainCampTileId` get KenneySurvivalKit tent + campfire-pit.
- **Rendering** — Binds shared `VertexBuffer`/`IndexBuffer` once per model key, loops instance `Matrix` list setting `BasicEffect.World` per instance. No hardware instancing — batched same-buffer draws.
- **Scale system** — `TreeScale=0.16`, `BushScale=0.12`, `TentScale=0.20`, `RockScale=0.10` with ±15% random variation. Auto-detects type from model key name.
- **Performance cap** — Max 2000 instances per model key.

### Modified: `GameRoot.cs`

- Added `_vegetationRenderer` field
- `LoadContent()` — creates `VegetationRenderer(GraphicsDevice)`, calls `LoadVegetationModels()` which loads all unique prop keys from `AssetManifest.BiomeProfiles` + KenneySurvivalKit tent/campfire-pit.
- `Draw()` — calls `CollectInstances()` then `Render()` before `WorldRenderer.DrawWorld()` so vegetation draws under sprite overlays.
- `Dispose()` — disposes vegetation renderer.

## Model Format Coverage

| Asset Kit | Format | Loadable |
|---|---|---|
| StylizedNatureMegaKit | `.gltf` + `.bin` | Yes |
| KenneySurvivalKit | `.glb` | Yes |
| UltimateNaturePack | `.fbx` | **No** — SharpGLTF cannot load FBX |
| LowPolyEnvironmentPack | `.fbx` | **No** |
| RetroNaturePack Winter | `.fbx` | **No** |
| LowpolyForestPack | `.fbx` | **No** |
| ModularTerrainCollection | `.obj` | Loaded separately via ObjParser |

`LoadModel` silently skips missing files — unimplemented biome prop slots fall through gracefully.

## Architecture Notes

- `TileToWorld()` matches `PlayableRenderAdapter.TileCenter()` hex layout: pointy-hex with `sqrt(3)*28` horizontal spacing, `1.5*28` vertical, odd-row offset.
- Deterministic scatter uses `Random(tile.Id * 1337 + 42)` — same seed each frame, stable vegetation placement.
- `EnsureEffect()` handles `GraphicsDevice` reset (same pattern as `WorldRenderer`).
- Vegetation renders before SpriteBatch overlays — 3D models sit on ground plane, tribe markers/HUD draw on top.
