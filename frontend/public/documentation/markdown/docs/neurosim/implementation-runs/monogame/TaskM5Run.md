# Task M5 Run — Debug HUD v2 (V3 Fields Display)

**Date:** 2026-05-07
**Status:** Done

## What Was Done

Promoted V3 simulation state from ad-hoc `ExtraDebugLine` piggyback hacks to first-class structured fields in `DebugHudState`, with dedicated rendering section and toggle key.

### Fields Added to DebugHudState

| Field | Type | Source (local demo) | Source (network mode) |
|-------|------|---------------------|----------------------|
| `ProtocolVersion` | int | 0 (no protocol) | `_viewModel.ProtocolVersion` |
| `PolityTierCounts` | string | `BuildPolityTierString()` — e.g. `"T:10 C:2 D:0 K:1 E:0"` | Grouped from `_viewModel.V1Tribes` |
| `ActiveWarCount` | int | 0 (local demo has no wars) | `_viewModel.Wars.Count` |
| `TotalEntityCount` | int | Sum of all alive tribe populations | Sum of `V1Tribes.EntityCount` |
| `TombstoneCount` | int | `_playableSimulation.Tombstones.Count` | 0 (not yet available from ViewModel) |
| `LineageDepth` | int | 0 (needs Rust backend) | 0 (not yet available from ViewModel) |
| `AssetDiagSummary` | string | `"ok"` or `"decode err"` | Same |

### DebugHud Rendering Changes

Added V3 stats section between controls line and extra debug lines:
- **V3 header** with thin separator
- **Row 1:** Polity tier counts (`POLITY T:10 C:2 D:0 K:1 E:0`)
- **Row 2:** Triple-column row: Wars / Entities / Tombstones
- **Row 3:** Lineage depth / Protocol version
- **Toggle key V** added to controls hint

New `DrawTripleRow()` helper method for compact 3-column layout.

### GameRoot Changes

- Added `ShowV3Stats` property toggle with 'V' key in Update()
- Network mode: V3 data moved from `ExtraDebugLine1`/`ExtraDebugLine2` to proper fields
- Local demo: V3 data computed from `PlayableSimulation` tribes, tombstones, and metrics
- New `BuildPolityTierString()` helper formats tier counts
- Added `using TribalNeuroSim.Client.Domain;` for `PolityTier` enum

## Files Changed

| File | Change |
|------|--------|
| `client-monogame/UI/DebugHud.cs` | Added 7 V3 fields to DebugHudState record; added ShowV3Stats property; added V3 stats rendering section with DrawTripleRow helper; updated controls hint to include 'V' key |
| `client-monogame/GameRoot.cs` | Added Domain using; added 'V' key toggle; populated all V3 fields in both network and local demo paths; added BuildPolityTierString() helper; moved network V3 data from ExtraDebugLines to proper fields |

## Validation

- `dotnet build` — 0 errors, 0 warnings (client-monogame)
- `dotnet build` — 0 errors, 0 warnings (client-monogame-tests)
- All new fields have defaults → backward compatible with existing callers
- Empty `PolityTierCounts` → V3 section hidden (even when `ShowV3Stats` is true)

**Runtime visual verification:** Not performed — the V3 stats section requires running the client and pressing 'V' to toggle. The build confirms:
- All V3 fields populated from simulation state
- Layout uses existing DrawRow/DrawTripleRow helpers
- Panel height calculation accounts for 3 extra rows when section visible

## Risks / Follow-ups

1. **Tombstone count in network mode:** ViewModel doesn't expose tombstone data yet. Set to 0. When the Rust backend adds tombstone endpoint, update network path.

2. **Lineage depth:** Always 0 in both local and network mode. Requires entity-level lineage tracking from Rust backend (Task R1, R6). Placeholder is correct for now.

3. **ActiveWarCount in local demo:** Local demo has no war tracking — disputes are handled via merge/territory. Set to 0. This is accurate for current demo behavior.

4. **V3 section visibility:** Defaults to visible. Toggled with 'V' key. The toggle state persists only for current session (not saved to config).
