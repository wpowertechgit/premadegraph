# Task M17 Run — Render Performance And Draw Budget

**Date:** 2026-05-06
**Status:** Done

## What Was Done

Added per-frame render performance diagnostics and exposed them in the Debug HUD. The performance panel shows live metrics on the right side of the screen during gameplay.

### Files Changed

| File | Change |
|------|--------|
| `client-monogame/Rendering/RenderMetrics.cs` | **Created** — per-frame metrics container (FPS, tile/prop/settlement counts, primitives estimate, camera distance, zoom level, VSync) |
| `client-monogame/Rendering/SettlementRenderer.cs` | **Modified** — exposes `LastStats` (SettlementRenderStats) with per-LOD counts and total primitives after each `Render()` call |
| `client-monogame/Rendering/VegetationRenderer.cs` | **Modified** — added `BatchTotalInstances` property exposing `_batch.TotalInstanceCount` |
| `client-monogame/UI/DebugHud.cs` | **Modified** — extended `DebugHudState` with 11 performance fields; added `DrawPerformancePanel()` rendering a separate perf panel (right side, 240px wide) with FPS, VSync, camera distance/zoom, terrain tiles, settlement LOD breakdown (C:/M:/F:), vegetation instances, estimated primitives, decode latency, asset failures, and a visual draw budget bar |
| `client-monogame/GameRoot.cs` | **Modified** — added EMA-smoothed FPS tracking (α=0.10), `UpdateRenderMetrics()` collector called each frame, `EstimatePrimitives()` helper, metrics piped into `BuildHudState()` |

### Performance Panel Layout

```
PERFORMANCE
FPS        60.0 (green)
VSync      ON
Camera     320 (mid)
Terrain    144 tiles
Settlements C:1 M:3 F:0
Vegetation 412 inst
Primitives 23,840
Decode     N/A
Asset fails 0
BUDGET     [====      ] 45%
```

### Existing LOD Verification

Settlement LOD was already implemented before M17 (Task M13). Verified:
- `SettlementLodCatalog` defines per-tier thresholds (Tribe Close=180f/Mid=450f, Empire Close=280f/Mid=700f)
- `SettlementRenderer.SelectLod()` returns Far for distances beyond Mid threshold
- `Render()` filters out Far LOD via `.Where(x => x.Lod != SettlementLodLevel.Far)`
- `SettlementLodCatalog.MaxSettlementDraws = 8` caps total 3D draws per frame
- Selected tribe always renders at Close LOD regardless of distance
- Far zoom (>500f) shows zero 3D settlements (all sprite overlays only)
- Vegetation LOD already filters prop families by camera distance in `PropPlacementPlanner`

### Primitive Budget Estimate

Default demo (10-14 tribes):
- Hex terrain: ~144 tiles × 2 primitives = ~288
- Settlements: ~1 Close + ~3 Mid ≈ 5k-25k primitives (varies by model)
- Vegetation: ~400 instances × ~50 primitives avg = ~20k
- Total estimated: ~25k-45k primitives (well within budget for integrated GPU)
- Soft budget indicator set at 18k primitives (~50%)

## Validation

- **Build:** Both `TribalNeuroSim.Client.csproj` and `TribalNeuroSim.Client.Tests.csproj` compile with 0 errors.
- **Runtime:** Cannot validate visually in this session (requires Windows MonoGame runtime with GPU). Expected behavior:
  - Perf panel appears at top-right corner during gameplay
  - FPS color-coded: green ≥30, yellow 15-30, red <15
  - Budget bar fills red when estimated primitives exceed 18k
  - Camera distance and zoom label update with scroll wheel
  - At camera distance >500f, settlement close/mid counts drop to near-zero (selected excepted)

## Risks / Follow-ups

- **Primitive estimate is approximate.** Uses constant factors (2 prim/tile, 50 prim/veg instance). Real counts depend on model complexity. Could be refined by storing actual primitive counts per model key and summing during draw.
- **Asset load failure count is binary** (0 or 1) — tracks only decode/connection errors. A proper counter would need per-model load failure tracking in AssetLoadDiagnostics.
- **Frame decode latency** shows time since last received frame, not actual decode time. Only meaningful when connected to Rust backend via Node.
- **No GPU timer queries.** MonoGame BasicEffect pipeline doesn't expose GPU timestamps. The FPS counter measures CPU frame time including GPU driver submission, not true GPU wall time.
- **Budget bar threshold (18k primitives)** is an educated guess for integrated laptop GPUs. Should be tuned against real hardware.
