# Task M24 Run — Tombstone Obituary Panel, Simulation Export, BP Patch (C# Client)

**Date:** 2026-05-20
**Status:** Done

## What was done

Three features implemented in the MonoGame local demo harness (`PlayableSimulation.cs` + UI layer):

1. **Tombstone Obituary Panel** — clicking an extinct tribe row in the ledger (K key) opens a detailed popup with full lifecycle data
2. **Simulation Export** — pressing E after the simulation completes (1 tribe alive) saves a JSON run record to disk
3. **Border Pressure + Dispute Resolution patch** — C# demo brought to parity with the v4 mechanics spec (`v4-border-pressure-and-dispute-mechanics.md` + `v3-territory-and-expansion-mechanics.md` §4–5)

---

## Files changed

| File | Change |
|------|--------|
| `client-monogame/Models/PlayableSimulation.cs` | Extended `PlayableTribeTombstone`, added `PlayableWarCause` enum, `WarExhaustionTicks` + `InitialArtifacts` + tracking fields on `PlayableTribe`, BP patch constants + `_borderPressure` dict, three new methods (`UpdateBorderPressure`, `DecrementWarExhaustion`, `TryIntimidateRetreat`), gated `TryDeclareWarBetween` + `CheckImperialisticWar` on exhaustion + pressure, partial-retreat logic in `RecordDispute`, war exhaustion assigned in `AbsorbTribe` + `ResolveCombatTick` |
| `client-monogame/UI/TombstonePanel.cs` | Added per-row hit rectangles, `SelectedTombstoneTribeId`, `ObituaryRequested` flag, `ConsumeObituaryRequest()` |
| `client-monogame/UI/TombstoneObituaryPanel.cs` | **New** — full obituary popup: fate label, death tick, war cause, absorbed-by, initial artifact bars, artifacts-at-death bars with delta (+/−), neural drive, polity tier, max population, max tiles; close button; draggable via `PanelDragController` |
| `client-monogame/Models/SimulationExporter.cs` | **New** — `Export(PlayableSimulation)` → JSON string; `SaveToFile()` → `neurosim-run-seed{N}-tick{T}.json` in working directory |
| `client-monogame/Input/KeyboardCommandController.cs` | Added `ExportSimulation` command (E key) to `PlayableCommandSet` |
| `client-monogame/UI/PanelDragController.cs` | Added `Obituary` to `DraggablePanelId` enum |
| `client-monogame/GameRoot.cs` | Obituary open/close routing, export handler, simulation-complete banner, export toast (5 s), obituary panel added to `UpdatePanelBounds()` |

---

## Obituary panel data

| Field | Source |
|-------|--------|
| Fate | `PlayableExtinctionReason` (Combat / Merger / Starvation) |
| War cause | `PlayableWarCause` (HighAggression / SurvivalPressure / OpportunityWar) — only shown for Combat |
| Absorbed by | Optional tribe name |
| Initial artifacts | Snapshot taken at tribe spawn, 5-bar display |
| Artifacts at death | Final values with +/− delta vs initial |
| Neural drive | Dominant artifact label at death |
| Polity tier reached | Highest tier achieved |
| Max population | Peak `MaxPopulationReached` |
| Max tiles | Peak `MaxTilesReached` |

---

## Export JSON schema

```jsonc
{
  "exportedAt": "ISO-8601",
  "seed": 12345,
  "mode": "Standard",
  "totalTicks": 4200,
  "mapSize": { "width": 80, "height": 60 },
  "winner": {
    "id": 3, "name": "...", "population": 2800,
    "polityTier": "Empire", "tiles": 240,
    "maxPopulation": 3100, "maxTiles": 255,
    "artifacts": { "combat": 0.72, "resource": 0.55, ... },
    "initialArtifacts": { ... },
    "neuralDrive": "Combat"
  },
  "extinct": [
    {
      "tribeId": 1, "name": "...", "extinctionTick": 1800,
      "cause": "Combat", "warCause": "HighAggression",
      "absorbedBy": "...", "polityTierReached": "City",
      "maxPopulation": 420, "populationAtDeath": 0,
      "maxTiles": 38, "tilesAtDeath": 0,
      "neuralDrive": "Combat",
      "initialArtifacts": { ... },
      "artifactsAtDeath": { ... }
    }
  ]
}
```

---

## BP patch — C# demo (parity with v4 spec)

### Constants added to `PlayableSimulation`

| Constant | Value | Purpose |
|----------|-------|---------|
| `PressureWarThreshold` | 80 | Border pressure required before war can be declared |
| `PressureCap` | 200 | Maximum pressure that can accumulate |
| `PressureDecayPerTick` | 2 | Decay rate when pair is no longer adjacent |
| `PostWarExhaustionTicks` | 150 | Post-war cooldown preventing immediate re-declaration |
| `IntimidationCombatRatio` | 1.5 | Combat advantage ratio required for intimidation retreat |
| `IntimidationRiskThreshold` | 0.45 | Weaker tribe's Risk must be below this to retreat |

### Three dispute resolution paths (v3 §5)

1. **Military intimidation** (`TryIntimidateRetreat`) — stronger tribe (≥1.5× Combat) pushes weaker low-Risk tribe off one contested tile; no war, dispute counter resets
2. **Merger** — high average Team score → tribes merge peacefully
3. **War** — dispute count exceeds threshold after intimidation and merger both fail

### War gates

- `TryDeclareWarBetween`: skips if aggressor `WarExhaustionTicks > 0`
- `CheckImperialisticWar`: skips if `!isEndgame && WarExhaustionTicks > 0`; also requires `_borderPressure >= PressureWarThreshold` in non-endgame; endgame bypass when alive ≤ `_initialTribeCount / 6`
- Post-war: `WarExhaustionTicks = PostWarExhaustionTicks` assigned in both `AbsorbTribe` (victor) and `ResolveCombatTick` attacker-destroyed branch (defender)

---

## Validation

- `dotnet build client-monogame/TribalNeuroSim.Client.csproj` — 0 errors, 0 warnings
- `dotnet build client-monogame-tests/TribalNeuroSim.Client.Tests.csproj` — 0 errors, 0 warnings
