# NeuroSim Visual Worldgen Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MonoGame demo world look and behave like a deterministic generated strategy map with readable capital structures and vegetation.

**Architecture:** Extract world generation into `PlayableWorldGenerator`, let `PlayableSimulation` consume it, and keep renderer improvements scoped to current renderers. The rendering pass keeps existing assets and avoids new dependencies.

**Tech Stack:** C# 12, .NET 8, MonoGame DesktopGL, SharpGLTF, hand-rolled console tests.

---

### Task 1: Deterministic World Generation

**Files:**
- Create: `backend/genetic-neurosim/client-monogame/Models/PlayableWorldGenerator.cs`
- Modify: `backend/genetic-neurosim/client-monogame/Models/PlayableSimulation.cs`
- Modify: `backend/genetic-neurosim/client-monogame-tests/Program.cs`

- [ ] Add failing tests for scaled demo size, non-ring spawn placement, biome variety, and six-way hex neighbors.
- [ ] Implement `PlayableWorldGenerator.CalculateDemoSize`, `GenerateTiles`, and `BuildSpawnTiles`.
- [ ] Update `PlayableSimulation.CreateDemo`, `Reset`, `GenerateTiles`, `GenerateTribes`, `NeighborTileIds`, and `ScoreExpansionTile`.
- [ ] Run `dotnet run --project backend/genetic-neurosim/client-monogame-tests/TribalNeuroSim.Client.Tests.csproj`.

### Task 2: Capital Structures And Prop Shading

**Files:**
- Modify: `backend/genetic-neurosim/client-monogame/Rendering/VegetationRenderer.cs`
- Modify: `backend/genetic-neurosim/client-monogame/GameRoot.cs`

- [ ] Add GLB structure models used for capital compounds.
- [ ] Place deterministic tents, structure, fences, campfire, resources, and workbench around each living tribe capital.
- [ ] Fix model shading so vegetation and camp objects render with lit diffuse colors instead of black silhouettes.
- [ ] Add simple wind sway for grass/plant models during render.

### Task 3: Terrain Readability And Renderer Stage Cleanup

**Files:**
- Modify: `backend/genetic-neurosim/client-monogame/Rendering/HexTerrainMesh.cs`
- Modify: `backend/genetic-neurosim/client-monogame/Rendering/WorldRenderer.cs`
- Modify: `backend/genetic-neurosim/client-monogame/Rendering/PlayableRenderAdapter.cs`

- [ ] Reduce hex inset and texture stamp repetition.
- [ ] Filter elevation models to mountain/hill tiles only, with conservative scale.
- [ ] Keep stage order explicit and readable: terrain, elevation, vegetation/settlements, borders, overlays.
- [ ] Build the client project.
