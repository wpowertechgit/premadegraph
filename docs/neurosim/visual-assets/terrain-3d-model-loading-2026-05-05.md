# Terrain 3D Model Loading — WorldRenderer Rewrite

**2026-05-05**

## Summary

Replaced flat `BasicEffect` triangle-fan hex rendering in `WorldRenderer` with actual 3D model loading and rendering from the ModularTerrainCollection `.obj` files. Created a runtime `.obj` parser (no Content Pipeline dependency), a GPU buffer model wrapper, updated the asset catalog and loader, and wired everything through `GameRoot`.

## Cross-reference: AssetRegistry vs Asset Plan

Audited `AssetManifest.cs` against `docs/neurosim/visual-assets/v3-asset-plan.md`:

| Area | Result |
|------|--------|
| 12 BiomeProfiles | All `BiomeId` values covered, no missing entries |
| Terrain texture keys (8) | All match files in `Content/Materials/Terrain/` |
| Prop asset keys (48) | All paths reference documented model imports |
| Settlement profiles (5 tiers) | Biome-null fallbacks only, no biome-specific settlements |
| ModularTerrainCollection | 20 `.obj` + 1 `.mtl` present, but nothing loaded them |
| Gap: 3D model loading | `RuntimeAssetLoader` only had `LoadTexture()`, no model path |

The `.mtl` file contains only material colors (`Kd`/`Ka`/`Ks`), not texture references — textures are applied at runtime.

## New files

### `Assets/ObjParser.cs`

Runtime ASCII Wavefront `.obj` parser:

- Parses `v` (position), `vt` (UV), `vn` (normal), `f` (face) lines
- Handles `f v/vt/vn` format with index sharing (duplicate vertices deduplicated per unique key)
- Auto-triangulates n-gon faces via triangle fan
- Computes model-space `BoundingBox`
- Outputs `ObjModelData` with `VertexPositionNormalTexture[]` + `ushort[]` indices

### `Assets/RuntimeModel.cs`

GPU buffer wrapper around loaded model data:

- Creates `VertexBuffer` and `IndexBuffer` from `ObjModelData`
- Exposes `Draw(GraphicsDevice)` which calls `DrawIndexedPrimitives`
- Implements `IDisposable` for buffer cleanup

## Modified files

### `Assets/RuntimeAssetLoader.cs`

- Added `_modelCache` dictionary (`Dictionary<string, RuntimeModel>`)
- Added `LoadModel(string key)` — same pattern as `LoadTexture`: resolve key → find file → parse `.obj` → create `RuntimeModel` → cache
- Updated `Dispose()` to clean up cached models

### `Assets/RuntimeAssetCatalog.cs`

- Added 18 terrain model key constants: `TerrainHillyGrass`, `TerrainMountain1` through `TerrainMountain4`, `TerrainBeachSand`, `TerrainHillyWaterFlat`, etc.
- Added `TerrainModels` list with 18 `RuntimeAssetDefinition` entries mapping keys to `Models/Biomes/ModularTerrainCollection/*.obj` paths
- Updated `AssetsByKey` to include `TerrainModels`

### `Rendering/WorldRenderer.cs`

Complete terrain rendering rewrite:

- `DrawTerrainHexes` → `DrawTerrainModels`
- **Model path**: each tile checks `ModelKey` → resolves `RuntimeModel` from dictionary. If found, renders with directional lighting via `BasicEffect` (`LightingEnabled=true`, one directional light from upper-right). If missing, falls back to flat hex triangle fan (existing geometry).
- **World transform**: `Matrix.CreateScale(tileSize) * Matrix.CreateTranslation(centerX, 0, centerZ)` — models scaled by tile radius to fill hex footprint.
- **Cull mode**: `CullNone` (safe for any OBJ winding order)
- Overlay rendering (territory tints, camp markers, tribe circles) unchanged — still 2D `SpriteBatch`
- Added `IReadOnlyDictionary<string, RuntimeModel>?` parameter to `DrawWorld()`
- Added `ModelKey` field to `RenderableTile` record

### `Rendering/PlayableRenderAdapter.cs`

- Added `TerrainModelKey(BiomeId, tileId)` method with biome-to-model mapping:
  - Mountains: `Mountain_1` through `Mountain_4` (round-robin by `tileId % 4`)
  - Hills: `EscarpmentTop`, `EscarpmentBase`, `HillyGrass` (round-robin)
  - Riverland: `BeachSand`, `HillyWaterSlope` (alternating)
  - Marsh: `HillyWaterFlat`
  - Cold: `Mountain_1`
  - Default (Plains, Forest, FertileValley, DrySteppe, etc.): `HillyGrass`
- `BuildTiles` now populates `ModelKey` on each `RenderableTile`

### `GameRoot.cs`

- Added `_terrainModels` dictionary
- Added `LoadRuntimeModels()` — iterates `RuntimeAssetCatalog.TerrainModels`, calls `_runtimeAssets.LoadModel()`
- `LoadContent()` calls `LoadRuntimeModels()` after `LoadRuntimeTextures()`
- `DrawWorld()` call passes `_terrainModels` as 7th argument
- Integrated `VegetationRenderer` lifecycle (user-added, pre-existing WIP):
  - Instantiated in `LoadContent()`: `_vegetationRenderer = new VegetationRenderer(GraphicsDevice)`
  - `CollectInstances()` + `Render()` called in `Draw()` before `DrawWorld()`
  - Disposed in `Dispose()`

### Drive-by fixes in `VegetationRenderer.cs` (pre-existing untracked WIP)

- Added `Dispose()` method to inner `ModelMeshData` class (was declaring `IDisposable` without implementation)
- Added `using PrimitiveType = Microsoft.Xna.Framework.Graphics.PrimitiveType` alias to resolve ambiguity with `SharpGLTF.Schema2.PrimitiveType`

## Loading method

**Direct file loading** — no MonoGame Content Pipeline. Same pattern as existing `RuntimeAssetLoader.LoadTexture()`:

1. `.obj` file parsed at startup into `VertexPositionNormalTexture[]` + `ushort[]`
2. `VertexBuffer` + `IndexBuffer` created eagerly at load time
3. Textures applied at render time via `BasicEffect.Texture` (models use runtime-applied terrain textures)
4. Model cache persists for lifetime of `RuntimeAssetLoader`

## Build result

```
Build succeeded.
0 Error(s), 0 Warning(s) (from authored code)
4 Warning(s) from VegetationRenderer.cs (pre-existing untracked WIP)
```

## Next steps

- Run the client and visually verify terrain models render correctly on hexes
- Tune model scale factor if models overlap or gap at hex edges
- Consider per-biome model scale adjustments (mountains taller than plains)
- Add `.obj` files for biome-specific terrain variants not yet in the collection (e.g., snow-capped mountains for Cold biome)
