# Task M18C — Local Demo Dispute Behavior Harness

**Date:** 2026-05-07
**Status:** Done

## Problem

Tribes were completely AFK — no population changes, no food/foraging, no territory expansion, nothing happened for hundreds of ticks. Root cause: broken food economy. Single-tile harvest (~0.9/tick) was far below population upkeep (~2.24/tick). Tribes could never accumulate enough food to expand, couldn't afford claim costs, and slowly starved.

## Root Cause Fix — Food Economy Rebalancing

File: `client-monogame/Models/PlayableSimulation.cs`

| Constant | Old Value | New Value | Reason |
|----------|-----------|-----------|--------|
| `GrowFood()` rate | 0.012 | 0.030 | Tile food regrowth 2.5x faster |
| Population upkeep | 0.028 | 0.016 | Per-pop food consumption lowered |
| Harvest rate (base + Resource coeff) | 0.012 + 0.018×R | 0.018 + 0.022×R | Harvest keeps pace with regrowth |
| `ClaimBaseCost` | 40 | 28 | Early expansion affordable |
| `ClaimFoodFloor` | 50 | 30 | Lower floor for first claims |
| `ClaimPopBase` | 80 | 72 | Slightly easier pop gate |
| `ClaimPopPerTile` | 25 | 20 | Slightly easier per-tile gate |
| `ExpansionCooldownTicks` | 25 | 20 | Faster expansion cadence |

**Result:** Plains tile (maxFood 76) at Resource 0.5: regrowth 2.28/tick, harvest cap 2.20/tick, upkeep 1.28/tick (80 pop). Net +0.92/tick per tile. First expansion affordable at ~tick 22, within R8 spec (20-35 ticks).

## Dispute Stress Preset

### New files / sections
- `client-monogame/Models/PlayableSimulation.cs`:
  - `DemoMode.DisputeStress` enum value
  - `CreateDisputeStress(seed=5173, tribeCount=12)` factory
  - `DisputedTileCount` property
  - `ForceDispute()` method for on-demand dispute creation
  - High Combat (0.55-1.0) / High Risk (0.55-1.0) / Low Team (0.15-0.45) artifact bias
- `client-monogame/Models/PlayableWorldGenerator.cs`:
  - `CalculateDisputeStressSize()` — ~42 tiles/tribe, very dense map
- `client-monogame/Launcher/LaunchOptions.cs`: `IsDisputeStress` flag, `--dispute-stress` CLI arg
- `client-monogame/Input/KeyboardCommandController.cs`: `ForceDispute` command (Keys.F, changed from Keys.D due to WASD camera conflict)
- `client-monogame/GameRoot.cs`: Dispute stress mode wiring, camera setup, force dispute handler

### Demo mode semantics
| Mode | Map density | Artifact bias | Goal |
|------|------------|---------------|------|
| Normal | 95 tiles/tribe | Uniform random | Believable demo |
| EmpireStress | 65 tiles/tribe | Clustered high Team | Merger/polity tier testing |
| DisputeStress | 42 tiles/tribe | High Combat/Risk, low Team | Disputed border testing |

### Hotkeys
- **D**: Force dispute — finds a neutral tile bordering two different-owner territories and claims it for both at 50% each, creating a disputed tile. Selects the first disputing tribe.

## Validation

- `dotnet build` client-monogame: **0 errors, 0 warnings**
- `dotnet build` client-monogame-tests: **0 errors, 0 warnings**
- Food economy math verified: 1-tile net positive, expansion affordable within R8 spec
- Visual acceptance requires runtime: `dotnet run -- --dispute-stress` or press 'D' in normal mode

## Visual Acceptance Checklist Updates

The following checklist items from `visual-acceptance-checklist.md` should now be testable:

- Disputed zones visible (close/mid zoom)
- Disputed overlay subtle (terrain texture still readable)
- Disputed tile count in HUD
- Selected tribe dispute count in selection panel
- Disputed tiles render colored crosshatch using actual contesting tribe IDs

## Files Changed

| File | Change |
|------|--------|
| `client-monogame/Models/PlayableSimulation.cs` | Food economy rebalance, DisputeStress mode, ForceDispute method |
| `client-monogame/Models/PlayableWorldGenerator.cs` | CalculateDisputeStressSize method |
| `client-monogame/Launcher/LaunchOptions.cs` | IsDisputeStress flag, --dispute-stress CLI |
| `client-monogame/Input/KeyboardCommandController.cs` | ForceDispute command (D key) |
| `client-monogame/GameRoot.cs` | Dispute stress wiring, force dispute handler, camera setup |

## Risks / Follow-ups

- **Runtime verification needed**: Actual screenshot validation with `--dispute-stress` flag to confirm disputes render correctly
- **Tuning**: Claim costs and food rates may need further adjustment at higher tribe counts
- **Performance**: Dense map (42 tiles/tribe) should be fine for 12 tribes, but watch draw budgets
- **Merge threshold**: Low Team artifacts in dispute stress may still allow mergers if two tribes share enough disputed border contacts (4+); this is acceptable for visual testing
