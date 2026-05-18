# Task M13 — Settlement Renderer And LOD Strategy

**Completed:** 2026-05-06
**Status:** Done, all 25 tests pass

## Files Created

| File | Purpose |
|------|---------|
| `client-monogame/Assets/ModelMeshData.cs` | Shared GPU buffer holder extracted from `VegetationRenderer` inner class. Holds `VertexBuffer`, `IndexBuffer`, bounds, and static `FromFbx()`/`FromGltf()` extraction methods. |
| `client-monogame/Assets/SettlementLodProfile.cs` | LOD types: `SettlementLodLevel` enum (Close/Mid/Far), `SettlementLodProfile` record with distance thresholds, and `SettlementLodCatalog` with per-tier profiles and `MaxSettlementDraws` cap. |
| `client-monogame/Rendering/SettlementRenderer.cs` | New renderer: loads settlement FBX models, collects instances from simulation with tier/biome resolution and fallback chain, renders with LOD selection based on camera distance and tribe selection. |

## Files Modified

| File | Change |
|------|--------|
| `client-monogame/Rendering/VegetationRenderer.cs` | Removed `ModelMeshData` inner class (extracted to shared file). Removed `ExtractFbxMeshData`, `ExtractGltfMeshData` static methods (moved to `ModelMeshData`). Removed settlement methods: `PlaceTierSettlement`, `PlaceKenneyCompound`, `ResolveLoadedSettlementKey`, `AddStaticInstance`, `FitModelToTile`. Removed settlement placement from `CollectInstances`. Removed unused `StructureScale` constant and `TryLoadSiblingDiffuseTexture`. Removed `using Assimp`. |
| `client-monogame/GameRoot.cs` | Added `_settlementRenderer` field. Created `SettlementRenderer` in `LoadContent`. Added `LoadSettlementModels()` method loading settlement FBX + Kenney fallback models. Moved Kenney structure model loading out of `LoadVegetationModels()`. `Draw()` now calls `SettlementRenderer.CollectInstances` + `Render` between vegetation and 2D overlays. Isolated viewer combines model keys from both renderers. |

## What Was Done

### Settlement Renderer (`SettlementRenderer.cs`)
- Loads settlement FBX models via shared `ModelMeshData.FromFbx()`
- `CollectInstances()` iterates living tribes, resolves settlement model by `PolityTier` + biome via `AssetRegistry`, walks tier fallback chain (Empire→Kingdom→Duchy→City→Tribe)
- Kenney compound fallback when no tier model loads (tents, fence, campfire, etc.)
- Models scaled to hex tile footprint using `HorizontalExtent` from model bounds
- Owns its texture loading (diffuse discovery, fallback diffuse color)

### LOD Strategy
- **Close** (< 180–280 units, tier-dependent): full 3D model. Selected tribe always Close.
- **Mid** (180–700 units): full 3D model, lower draw priority.
- **Far** (beyond Mid threshold): skip 3D entirely. WorldRenderer 2D spritebatch pass handles camp markers.
- **Cap**: max 8 settlement draws per frame (`SettlementLodCatalog.MaxSettlementDraws`).
- Draw order: selected first, then by LOD level, then by tier. Ensures selection always visible.

### LOD Distance Thresholds Per Tier

| Tier | Close | Mid |
|------|-------|-----|
| Tribe | 180 | 450 |
| City | 200 | 500 |
| Duchy | 220 | 550 |
| Kingdom | 250 | 600 |
| Empire | 280 | 700 |

### VegetationRenderer Cleanup
- All settlement-specific code removed from `VegetationRenderer`. It now handles only vegetation props (trees, grass, bushes, rocks).
- `CollectInstances` still takes `AssetRegistry` for biome profile resolution (prop keys).
- Kenney structure model loading moved to `SettlementRenderer`.

### Shared ModelMeshData
- `ModelMeshData` extracted from `VegetationRenderer` inner class to `Assets/ModelMeshData.cs` as public class.
- Static `FromFbx()` and `FromGltf()` factory methods included.
- Used by both `VegetationRenderer` and `SettlementRenderer`.

## Validation

```
PASS fallback registry has explicit biome profiles
PASS asset diagnostics reports complete baseline coverage
PASS tribal green settlement fbx is importable with diffuse texture
PASS client diagnostics records connection state
PASS frame receiver queues decoded frames and updates diagnostics
PASS frame receiver records decode errors without queueing bad frame
PASS playable simulation initializes deterministic tribes and tiles
PASS playable simulation scales demo map from tribe count
PASS playable simulation scatters capitals away from center ring
PASS playable simulation uses six way hex neighbors
PASS playable simulation step advances territory and disputes
PASS playable render adapter maps simulation to renderables
PASS playable render adapter uses proper terrain material textures
PASS playable render adapter does not spawn terrain chunk models
PASS playable render adapter hides abstract territory radii
PASS playable render adapter exposes subtle visual elevation
PASS playable render adapter uses pointy hex geometry
PASS playable render adapter hides debug food dots
PASS keyboard command controller uses press once semantics
PASS tile control view state caps and normalizes claims
PASS playable simulation records bounded events
PASS M12 isolated viewer toggle is wired to F5
PASS M12 fbx material texture siblings cover diffuse normal metallic roughness
PASS M12 settlement fbx model bounds are finite in reasonable world space
PASS M12 asset load diagnostics log covers transform policy and index format
```

Client builds with 0 errors (1 pre-existing warning: `SimulationViewModel._lastSectionFlags` unused).

### Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| Tribe capitals render as settlement models, not circles | Implemented — `SettlementRenderer` places 3D models on capital tiles |
| City/Duchy/Kingdom/Empire can render different models | Implemented — tier-aware model resolution with fallback |
| More than 10 tribes do not draw 10 full meshes at once | Implemented — `MaxSettlementDraws = 8` cap |
| Selected settlement uses highest detail | Implemented — selected tribe always `Close` LOD |
| Settlement draw order does not hide selection or territory borders | Implemented — settlement 3D pass runs between terrain and 2D spritebatch overlays |
| Kenney compound fallback when FBX fails | Implemented — via `AddKenneyCompound()` |
| Tier fallback chain works | Implemented — Empire→Kingdom→Duchy→City→Tribe |

## Technical Decisions

| Decision | Value | Reason |
|----------|-------|--------|
| Settlement LOD levels | Close/Mid/Far (3 levels) | Far skips 3D entirely; 2D camp markers suffice at distance |
| Max draws per frame | 8 | Safety cap for high-poly FBX settlement models |
| Selected tribe always Close | Yes | Selected settlement must always be visually prominent |
| Culling | `CullNone` | Inherited from M12; verified winding not yet complete |
| Model scale | `FitModelToTile()` via `HorizontalExtent` | Consistent with M12 scale policy |
| Draw pass order | Terrain → vegetation → settlements → 2D overlays | Settlements above grass/trees, below UI markers |

## Risks / Follow-Ups

1. **No simplified LOD meshes**: Mid level currently uses the same full model as Close. True mesh simplification/LOD proxy models would save GPU. Currently handled by the draw cap.
2. **Kenney fallback negative IDs**: Kenney compound pieces use `TribeId = -1000 - random` to avoid collision with real tribe IDs. This works for rendering but is not type-safe.
3. **Far zoom settlement billboards**: Not implemented — at Far zoom, settlements rely on WorldRenderer 2D camp markers. A true billboard system (M8 faction insignia) would improve far readability.
4. **Isolated viewer**: Now shows both vegetation and settlement models. Arrow keys cycle all models. F5 toggles as before.
5. **Biome-specific settlement variants**: Only tribe tier has biome variants (green/desert/winter). Higher tiers use a single model per tier.
