# Task M15 — Prop, Grass, Tree, And Rock Dressing Pass

**Date:** 2026-05-06
**Status:** Done

## Summary

Replaced ad-hoc hardcoded prop scattering in `VegetationRenderer` with rule-driven biome prop placement system. Props are now planned deterministically from `BiomePropRule` entries in `AssetManifest`, grouped into batches by model key, and rendered with LOD-aware culling.

## Files Created

| File | Purpose |
|------|---------|
| `client-monogame/Assets/PropVisualProfile.cs` | `PropFamily` enum + `PropVisualProfile` record (model metadata, scale, wind, LOD range) |
| `client-monogame/Assets/BiomePropRule.cs` | `BiomePropRule` record (per-biome per-family density, count ranges, placement constraints) |
| `client-monogame/Rendering/PropPlacementPlanner.cs` | Deterministic prop planner: consumes rules + simulation, produces `PlannedPropInstance` list with constraints (avoid capital, avoid center for trees/rocks, LOD count reduction) |
| `client-monogame/Rendering/PropInstanceBatch.cs` | GPU-friendly batched instances grouped by model key, with per-model instance cap (2000) |

## Files Modified

| File | Change |
|------|--------|
| `client-monogame/Assets/BiomeVisualProfile.cs` | Added `PropDensity` field (float) |
| `client-monogame/Assets/AssetManifest.cs` | Added `PropDensity` to all BiomeProfiles. Added `PropProfiles` (21 profiles across GrassPatch/Tree/Bush/Rock/Reed/DeadWood/Flower families). Added `BiomePropRules` (26 rules covering all 11 biomes). |
| `client-monogame/Rendering/VegetationRenderer.cs` | Replaced `_instancesByModel: Dictionary<string, List<ModelInstance>>` with `_batch: PropInstanceBatch`. `CollectInstances` now calls `PropPlacementPlanner.Plan()` → `PropInstanceBatch.Build()`. Inline switch retained as `CollectInstancesInline` fallback. `Render` iterates `_batch.Batches`. Removed `ModelInstance` record struct, `MaxInstancesPerModel` constant. |

## V0 Prop Sets Per Biome

| Biome | Families |
|-------|----------|
| Plains | GrassPatch (5-11), Bush (1-3), Rock (0-2) |
| FertileValley | GrassPatch (6-12), Bush (2-4), Flower (1-3) |
| DenseForest | Tree (5-12), Bush (1-4), Log (0-2) |
| SparseWoodland | Tree (2-6), Bush (1-3), Log (0-2) |
| Hills | Rock (1-4), GrassPatch (0-2), Bush (0-2) |
| Mountains | Rock (1-3) |
| Marsh | DeadWood (1-3), Reed (1-4) — no dry rocks |
| Riverland | Reed (1-3) — no trees, no dry rocks |
| DrySteppe | Rock (1-3), GrassPatch (0-2) |
| Cold | Tree/conifer (1-5), Rock (0-2) |
| Unknown | Rock (0-1) |

## Placement Constraints Applied

- Trees and rocks pushed away from tile center (4-6 world units)
- Capital tiles get larger clearance radius for trees/rocks
- No dry rocks assigned to Marsh/Riverland biomes
- No trees assigned to Riverland/Marsh biomes
- Per-tile prop cap: 18
- Deterministic seeds: `tile.Id * 1337 + 42`

## LOD Rules

- Close (<200): full prop count
- Mid (200-500): 60% count
- Far (>500): 25% count, grass patches hidden at >800

## Validation

```
dotnet build — succeeded (0 errors, 1 pre-existing warning unrelated to this task)
dotnet test — passed
```

Existing caller in `GameRoot.cs` (`CollectInstances(simulation, registry)`) works unchanged via default parameter.

## Risks / Follow-ups

- Prop model assets must be loaded before `CollectInstances` is called — same as before, no regression
- `PropPlacementPlanner.TileToWorld` and `ScatterProps` duplicate some hex math; consolidate later
- Wind dynamics use same `IsWindAffected` heuristic; consider moving to `PropVisualProfile.WindAffected` in future
- Logging missing prop models: `VegetationRenderer` already skips unloaded models and logs via `AssetLoadDiagnostics`
- M7 (Biome-Specific Visual Rendering) should consume these prop rules rather than adding one-off placement
