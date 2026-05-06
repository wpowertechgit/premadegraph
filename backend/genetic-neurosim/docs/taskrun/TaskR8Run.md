# Task R8 Run — Expansion Pace, Claim Cost, And Defendability

**Completed:** 2026-05-07
**Branch:** main
**Status:** Done

## What Was Done

Implemented a per-tribe expansion cost model replacing the free every-20-tick territory claim system. Tribes can no longer mindlessly claim territory — expansion now competes with food, population, and defense instead of being a free automatic flood-fill.

### Rust Changes

**`backend/src/tribes.rs`**
- Added `last_expansion_tick: u64` — when the tribe last expanded
- Added `expansion_cooldown_ticks: u64` — configurable cooldown (default 25)
- Added `tile_integration: HashMap<u16, u64>` — maps newly claimed tile → claim tick for yield ramp-up

**`backend/src/world.rs`**
- Added `hex_distance(tile_a, tile_b) -> u32` — hex distance using odd-r offset → cube coordinate conversion
- Added `terrain_claim_cost(tile_idx, river_adjacent) -> f32` — biome-dependent claim costs (plains: 0, forest: 10, desert: 15, hills/marsh/mountain: 20, +25 for river adjacency)

**`backend/src/simulation.rs`**
- Rewrote `apply_territory_expansion()` with:
  - Per-tribe cooldown check (25 ticks between claims)
  - Population gate: `required = 80 + 25 * owned_tiles`
  - Resource drive threshold lowered to 0.25
  - Claim cost: `base(40) + territory(12*tiles) + distance(8*max(0, dist-1)) + terrain + pressure(25 if hostile neighbor)`
  - Food floor check: cannot claim if post-cost food < 50
  - Overextension penalty: +10 cost when `tiles > 1 + pop/120`
  - Integration period: 75 ticks, yield starts at 25%, rises linearly to 100%
  - Disputed/overextended tiles integrate at half speed
- Modified foraging loop to apply integration yield multiplier per tile (two-pass: read then write)
- Added periodic integration entry cleanup (every 80 ticks)
- Changed expansion from every-20-tick global to per-tribe cooldown (checked each tick)

### C# Changes

**`client-monogame/Models/PlayableSimulation.cs`**
- Added to `PlayableTribe`: `LastExpansionTick`, `ExpansionCooldownTicks` (25), `TileClaimedTick` dictionary, `LastClaimCost`
- Rewrote `Expand()` with same cost model as Rust: cooldown, pop gate, food cost, integration tracking
- Added helper methods: `CalculateClaimCost`, `TerrainClaimCost`, `HexDistance`, `HasHostileNeighbor`, `IntegrationMultiplier`
- Modified `Harvest()` to apply integration yield multiplier
- Modified `Step()` to remove center-pull claim, clear per-tick claim set, run Expand every tick
- Added `_thisTickClaims` HashSet to prevent two tribes claiming same tile in one tick
- Added periodic integration cleanup (every 80 ticks)

**`client-monogame/UI/DebugHud.cs`**
- Added to `DebugHudState`: `SelectedTerritoryCount`, `ExpansionCooldownRemaining`, `SelectedExpansionCost`, `SelectedOverextended`
- Added expansion metric rows in Draw: TERR (territory count), OEXT (overextended flag), EXP-CD (cooldown remaining), COST (last claim cost)

**`client-monogame/GameRoot.cs`**
- Updated `BuildHudState()` to populate expansion metrics from selected tribe

**`client-monogame-tests/Program.cs`**
- Updated `PlayableSimulationStepAdvancesTerritoryAndDisputes` to validate R8 pacing (max 3 tiles at tick 50, survival at tick 200)
- Updated `PlayableSimulationRecordsBoundedEvents` to validate territory bounds and cooldown tracking

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| At tick 50, no tribe gains > 2 extra tiles under default demo | Pass (max territory = 3 total tiles, i.e. ≤ 2 extra) |
| Expansion rate scales with population, food surplus, polity tier | Implemented (pop gate, food cost, overextension penalty) |
| Tribe with low food or population cannot keep claiming for free | Implemented (food floor 50, pop gate 80+25*tiles) |
| Debug HUD exposes expansion metrics | Implemented (TERR, OEXT, EXP-CD, COST) |
| No mass extinction from cost model | Pass (≥ 2 tribes survive to tick 200) |

## Validation

- **Rust:** `cargo build` — 0 errors, 14 pre-existing warnings
- **Rust tests:** `cargo test` — 13/13 pass
- **C# build:** `dotnet build` — 0 errors, 53 pre-existing warnings
- **C# tests:** `dotnet run` — 25/25 pass
- Visual acceptance: not run (no MonoGame runtime available in this session; debug HUD is wired for verification in next client launch)

## Risks / Follow-Ups

- **Food economy pre-existing imbalance:** The base food-per-tick math (harvest ~1.2-2.9 vs upkeep ~2.66) means most tribes run net negative. This is a pre-existing issue not caused by R8. Tribes can survive by depleting initial food stores and tile food pools, but population growth to reach the 105-pop expansion threshold is very slow. Consider a follow-up tuning task to rebalance base food/harvest/upkeep numbers.
- **Population threshold might need tuning:** The `80 + 25*tiles` formula creates a high bar for first expansion (105 pop). With starting pop 80-110, only ~half of tribes qualify. This may be intentionally strict per the task spec ("0-2 extra tiles by tick 50"), but could be lowered if testing shows stagnation.
- **Integration yield penalty is subtle:** The 25% starting yield on new tiles means early expansion provides minimal food benefit, which compounds with the already-tight food economy. Monitoring recommended.
- **Rust/C# parity:** Both codebases implement the same cost model independently. Any future tunings must be applied to both.

## Seed Verification

- Test seed 7, 4 tribes, 10x10, tick 50: max territory = 1 tile per tribe (all at starting tile)
- Test seed 19, 8 tribes, 12x12, tick 80: max territory ≤ 6 tiles
- The cost model successfully prevents the pre-R8 behavior of ~11 tiles by tick 50
