# NeuroSim Visual Worldgen Stabilization Design

## Goal

Improve the MonoGame demo map so it reads as a generated world instead of a debug board, while keeping the work repo-native and compatible with the existing asset set.

## Scope

- Replace ring-based tribe spawns with deterministic noise-ranked spawn selection across viable biomes.
- Scale demo map dimensions from the requested tribe count.
- Generate smooth biome regions from seeded value noise instead of mostly rectangular bands with random speckles.
- Keep terrain, settlement, vegetation, and overlay rendering as separate stages.
- Render actual capital/camp structure compounds from existing GLB assets.
- Reduce ambiguous dark prop silhouettes by fixing untextured model shading and filtering inappropriate elevation props.
- Add denser grass/vegetation dressing on grass biomes with simple deterministic wind sway.

## Non-Scope

- No new external asset downloads.
- No 2k/4k asset pipeline.
- No full custom PBR shader pipeline in this pass.
- No simulation-rule rewrite beyond spawn/map generation and hex-neighbor correctness.

## Architecture

Add a deterministic world-generation helper in `Models/PlayableWorldGenerator.cs`. `PlayableSimulation` delegates demo sizing, biome selection, and spawn selection to it. Rendering remains in MonoGame, but the visual stages become explicit: terrain, elevation props, vegetation/settlement structures, territory overlays, and HUD/symbol overlays.

## Validation

The hand-rolled C# test project will verify deterministic generation behavior, map scaling, non-central spawn placement, biome variety, and hex-neighbor correctness. Build verification will cover renderer/API integration.
