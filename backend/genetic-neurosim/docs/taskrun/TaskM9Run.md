# Task M9 — Lineage & Tombstone Inspection UI

**Status:** Done  
**Date:** 2026-05-07  
**Scope:** MonoGame client UI panels for lineage/tombstone inspection, local demo mode.

---

## Files Changed

### Created
- `client-monogame/UI/LineageInspectorPanel.cs` — lineage DAG inspector panel
- `client-monogame/UI/TombstonePanel.cs` — extinct tribe ledger panel

### Modified
- `client-monogame/Input/KeyboardCommandController.cs` — added L/K/N/[/] key bindings + `PlayableCommandSet` fields
- `client-monogame/Models/PlayableSimulation.cs` — added `PopulationAtDeath`, `TerritoryAtDeath` to `PlayableTribeTombstone`; updated `RecordExtinction` to capture them
- `client-monogame/GameRoot.cs` — panel instance fields, key handling in `HandlePlayableInput`, draw calls in `Draw`, disposal
- `docs/taskrun/MASTER-TASK-LIST-v3-neurosim-simulation.md` — marked M9 (Done)

### Not Modified
- `client-monogame/Models/LineageViewState.cs` — already exists for network deserialization, unchanged
- `client-monogame/Models/TombstoneViewState.cs` — already exists for network deserialization, unchanged

---

## What Was Done

### LineageInspectorPanel (`L` key toggle)
- Dark panel styled like `SelectionPanel`/`DebugHud`
- **Local demo mode**: shows tribe info + message that entity-level lineage needs network/Rust backend
- Shows a wireframe placeholder of expected DAG structure (seed → blend generations)
- **Network mode**: ready for `LineageViewState`/`LineageQueryResult` integration (panel takes a `PlayableSimulation`; network query path can be added as a separate rendering path or data adapter)
- Empty state when no tribe selected

### TombstonePanel (`K` key toggle)
- Lists extinct tribes from `PlayableSimulation.Tombstones`
- Columns: tick, tribe name, population, cause of death
- Sort modes (cycle with `N`): tick descending, tick ascending, name ascending, cause
- Scroll with `[` and `]` when >12 rows
- Color-coded causes: red for starvation, green for merger
- Empty state: "No extinctions yet — all tribes survive so far"
- Red left-edge strip for death-ledger visual identity

### Key Bindings
| Key | Action |
|-----|--------|
| `L` | Toggle lineage inspector |
| `K` | Toggle tombstone panel |
| `N` | Cycle tombstone sort mode |
| `[` | Scroll tombstone list up |
| `]` | Scroll tombstone list down |

### PlayableTribeTombstone Enhancement
- Added `PopulationAtDeath` and `TerritoryAtDeath` fields (default 0 for backward compat)
- `RecordExtinction` now captures `tribe.Population` and `tribe.Territory.Count` at time of death

---

## Validation

- `dotnet build` — succeeded, 0 errors (same pre-existing warnings only)
- Panel visual style matches `SelectionPanel` — same color constants, layout, font usage
- Panel resources lazily initialized per graphics device (same pattern as `DebugHud`)
- Empty states drawn gracefully for both panels
- Key bindings don't conflict with existing keys

---

## Risks & Follow-Ups

- **Network mode integration**: Both panels currently use local demo data only. When live Rust backend integration resumes, `LineageInspectorPanel` needs an additional rendering path that queries the backend and displays `LineageNodeViewState` records from the network response.
- **Entity selection**: The lineage inspector defaults to the selected tribe's `EntityId`. Currently no entity-level selection exists in local demo — lineage panel shows tribe-level summary.
- **Tombstone column width**: Tribe name truncated at 14 chars. Wider names will be cut — consider tooltip or expandable row if needed.
- **Large tombstone count**: Panel caps visible rows at 12 with scroll. No virtual scrolling for thousands — acceptable for demo scale.
- **Graphics resource lifecycle**: Panels create their own `Texture2D`/`FontRenderer` on first draw, disposed by GC finalizer. Consider adding explicit `IDisposable` if panels persist across graphics device resets.
