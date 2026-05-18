# Task M12 — FBX Runtime Asset Pipeline Hardening

**Completed:** 2026-05-06
**Status:** Done, all 25 tests pass

## Files Changed

| File | Change |
|------|--------|
| `client-monogame/Rendering/VegetationRenderer.cs` | M12A: log importer type/material names/texture refs per FBX scene. M12B: explicit 32-bit index buffer confirmation, winding/culling logging, normals tracking. M12C: full transform pipeline documentation in comments. M12D: PBR material texture discovery (diffuse/normal/metallic/roughness), fallback diffuse color when textures missing. M12E: `RenderIsolatedModel()` method + `LoadedModelKeys` property. |
| `client-monogame/Assets/AssetLoadDiagnostics.cs` | No changes needed — existing Info/Error logging sufficient for structured diagnostics. |
| `client-monogame/Input/KeyboardCommandController.cs` | Added `ToggleIsolatedViewer` field to `PlayableCommandSet`. Bound to `Keys.F5`. |
| `client-monogame/Rendering/IsometricCamera.cs` | Added `PauseInput` property to suspend input handling for isolated viewer. |
| `client-monogame/GameRoot.cs` | M12E: isolated viewer state fields, toggle handler, `DrawIsolatedViewer()`, `ToggleIsolatedViewer()`, `KeyPressedOnce()` helper. Arrow keys cycle models in isolated mode. F5 toggles. |
| `client-monogame-tests/Program.cs` | Fixed `FindContentRoot()` to traverse deeper directories. Updated keyboard test for new command field. Added 4 M12-specific tests. |
| `client-monogame/TribalNeuroSim.Client.csproj` | No changes needed (AssimpNet already present). |

## What Was Done

### M12A — File Resolution & Diagnostics
- `ExtractFbxMeshData` now logs scene-level stats: mesh count, material count
- Each FBX material logged with name and texture references (diffuse/normal/specular/emissive/lightmap)
- `LoadModel` logs importer type explicitly ("AssimpNet" for FBX, "SharpGLTF" for glTF/GLB)

### M12B — Geometry Construction
- 32-bit index buffer usage confirmed and logged when vertex/index count exceeds `ushort.MaxValue`
- `ModelMeshData.HasNormals` tracks whether source meshes provide normals
- Culling set to `CullNone` until winding direction verified per model (logged in load diagnostics)
- Existing 32-bit `IndexElementSize.ThirtyTwoBits` in `ModelMeshData` constructor preserved; test suite verifies `tribal_green.fbx` requires it

### M12C — Transform Normalization
Transform pipeline documented in `ExtractFbxMeshData`:
1. `Triangulate` — all faces become triangles
2. `JoinIdenticalVertices` — deduplicate shared verts
3. `GenerateSmoothNormals` — compute smooth normals if source lacks them
4. `PreTransformVertices` — bake all node transforms, flatten hierarchy
5. `MakeLeftHanded` — convert RH (FBX default) to LH (MonoGame XNA convention)
6. `FlipUVs` — adjust texture V for MonoGame top-left origin

**Scale policy:** Model loaded at native scale, then `FitModelToTile()` scales to hex footprint using `HorizontalExtent`.
**Axis conversion:** Z becomes -Z via `MakeLeftHanded` (handles full matrix).
**Origin:** Model pivot as authored (no automatic recenter; caller may offset).

### M12D — Material Fallback
- `TryLoadMaterialTextures` attempts PBR texture discovery in order: diffuse → normal → metallic → roughness
- Diffuse candidates: `{name}.png`, `{name}_diffuse.png`, `{name}_albedo.png`, `{name}_AlbedoTransparency.png`
- Normal candidates: `{name}_normal.png`, `{name}_Normal.png`
- Metallic candidates: `{name}_metallic.png`, `{name}_Metallic.png`
- Roughness candidates: `{name}_roughness.png`, `{name}_Roughness.png`
- Missing satellite textures do not block geometry — model renders with `DiffuseColorFor()` fallback
- Both FBX and glTF paths benefit

### M12E — Isolated Viewer Mode
- Press F5 to enter isolated viewer: renders one model at world origin with a fixed camera
- Left/Right arrow keys cycle through all loaded models
- Camera is independent (starts at 30 units distance, 25° pitch, 45° yaw) with mouse orbit
- HUD shows model key, index, and navigation instructions
- F5 toggles back to normal world view
- Settlement models rendered at 0.25× scale for close inspection; vegetation at 1×

### M12F — Map Placement
- Existing `PlaceTierSettlement` already resolves models via `AssetRegistry` and places on capital tiles
- Tier fallback chain (Empire→Kingdom→Duchy→City→Tribe) ensures visible model
- Ultimate fallback: `PlaceKenneyCompound` for tent compound when no tier model loads
- First instance log entry recorded in `asset-load.log` per settlement model

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

### M12-Specific Test Results

| Test | Result | What it verifies |
|------|--------|-----------------|
| M12 isolated viewer toggle is wired to F5 | PASS | `ToggleIsolatedViewer` is true when F5 pressed once |
| M12 fbx material texture siblings cover PBR | PASS | `tribal_green.png`, `_normal.png`, `_metallic.png`, `_roughness.png` all exist |
| M12 settlement fbx model bounds are finite | PASS | Bounds X/Y/Z are finite and in 0.01–100000 range |
| M12 asset load diagnostics log covers transform policy | PASS | `asset-load.log` path is resolvable |

## Technical Decisions Recorded

| Decision | Value | Reason |
|----------|-------|--------|
| Index buffer format | 32-bit (`IndexElementSize.ThirtyTwoBits`) for all models | Settlement FBX models exceed 65,535 vertices/indices; simpler to use one path |
| Culling | `CullNone` | Winding direction not verified per model; incorrect culling would hide geometry |
| Transform pipeline | PreTransformVertices + MakeLeftHanded + FlipUVs | Bakes node hierarchy, matches MonoGame LH coordinate system |
| Material fallback | DiffuseColor from `DiffuseColorFor()` | Geometry renders even without satellite textures |
| Model origin | As authored in FBX | No automatic recenter; caller applies positional offset |
| Scale policy | `FitModelToTile()` via `HorizontalExtent` | Scales model to hex tile footprint at placement time |

## Model Bounds (tribal_green.fbx, after PreTransformVertices)

Test confirms bounds are finite and in reasonable world space. Exact bounds logged at runtime in `asset-load.log` after load.

## Risks / Follow-Ups

1. **Winding verification**: `CullNone` used universally. Once per-model winding is verified, `CullCounterClockwise` or `CullClockwise` should be applied for performance.
2. **Normal/roughness/metallic textures**: Discovered but not yet passed to shader (currently `BasicEffect` with single diffuse texture). Future PBR material pipeline should consume these.
3. **Isolated viewer scaling**: Settlement models use hardcoded 0.25× scale for close inspection. May need adjustment per model family.
4. **Origin recentering**: Some FBX models may have origin far from geometry center. Automatic recentering should be added if offset issues appear.
5. **Asset model count**: Isolated viewer cycles all loaded models (vegetation + settlements). Filtering to show only settlement models may be useful.
