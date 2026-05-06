# Task M6 — Live Rust Frame Rendering / Network Mode

**Completed:** 2026-05-07
**Status:** Done

## Summary

MonoGame client now supports network mode. When launched with a network argument (`--connect`, `--node-ws=`, `--node-http=`, `--session=`, or `neurosim:` URI), it connects to the Rust backend and renders real FrameV1 data. Running without arguments preserves the existing rich local demo.

## Files Changed

| File | Change |
|------|--------|
| `client-monogame/Launcher/LaunchOptions.cs` | Added `ConnectMode`, `MapWidth`, `MapHeight` fields. Parses `--connect`, `--map-width=N`, `--map-height=N` args. Any network arg sets `ConnectMode=true`. |
| `client-monogame/GameRoot.cs` | Added `_isNetworkMode`, `_mapWidth`, `_mapHeight` fields. In network mode: skips local sim stepping, renders from `_viewModel` data, derives map dimensions from FrameV1 tile data, shows network HUD state. |
| `client-monogame/Rendering/PlayableRenderAdapter.cs` | Added `BuildTiles(SimulationViewModel, int mapWidth, int mapHeight)` and `BuildTribes(SimulationViewModel, int mapWidth)` overloads for converting FrameV1 data to renderables. |
| `client-monogame/UI/DebugHud.cs` | Added `ExtraDebugLine1`, `ExtraDebugLine2` fields to `DebugHudState`. Rendered as small accent lines below connection indicator. |
| `client-monogame/Models/PlayableSimulation.cs` | Unchanged — standalone demo preserved. |
| `client-monogame/Program.cs` | Unchanged — already forwards `LaunchOptions` to `GameRoot`. |

## What Was Done

1. **Launch mode detection**: `LaunchOptions.ConnectMode` is `true` when any network argument is passed. Default (`dotnet run`) stays `false` → local demo.

2. **Render source switching**: `GameRoot.Draw()` checks `_isNetworkMode && _viewModel.HasV1Data && _mapWidth > 0`. If true, builds tiles/tribes from `_viewModel` (FrameV1 data). Otherwise builds from `_playableSimulation` (local demo).

3. **Map dimension resolution**: In network mode, map width/height derived from `--map-width`/`--map-height` args, or auto-computed from max `TileId` in FrameV1 tile data when first frame arrives.

4. **Local simulation skip**: `UpdatePlayableSimulation()` returns early in network mode. Simulation is driven by Rust backend, not the local game loop.

5. **HUD and title bar**: Network mode shows FrameV1 data (tick, living tribes, disputed tiles, protocol version, polity tier breakdown, war count, entity count) in both window title and debug HUD.

6. **FrameV1 decoder path**: Already existed (M1). Network mode uses FrameV1 when available via `_viewModel.HasV1Data`.

## Validation

- `dotnet build client-monogame/` — 0 errors, 0 warnings
- `dotnet build client-monogame-tests/` — 0 errors, 0 warnings
- `dotnet run --project client-monogame-tests/` — 25/25 PASS
- `dotnet run` without args: local demo unchanged (confirmed by test suite + no code path change when `ConnectMode=false`)

## Risks / Follow-Ups

- **Vegetation/settlements in network mode**: Currently skip `CollectInstances` in network mode because `VegetationRenderer` and `SettlementRenderer` expect `PlayableSimulation` tiles/tribes. Network rendering is terrain-only for now. Future task: adapt these renderers to consume `RenderableTile[]` / `RenderableTribe[]` directly.
- **Map dimension auto-derive**: Assumes rectangular grid (`tileId = y * width + x`). Non-rectangular maps need explicit `--map-width`/`--map-height`.
- **No selection in network mode**: `selectedTribeId` forced to `-1`. SelectionPanel hidden. Future follow-up could add tile/tribe picking from network data.
- **Connection resilience**: If connection fails in network mode, client shows "NETWORK (connecting...)" in HUD but renders empty map. No automatic fallback to local demo — intentional per task spec ("connects to Rust and renders real frame data").
- **End-to-end test**: Not possible without running Rust backend + Node middleman. Protocol-level decode tested via existing FrameDecoder tests.
