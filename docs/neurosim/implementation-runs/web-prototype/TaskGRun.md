# TaskG Run Report — G1: Define SimulationEvent Types

## Task completed: G1 — Define SimulationEvent Types

## Files changed

- **Created:** `backend/genetic-neurosim/backend/src/events.rs`
- **Modified:** `backend/genetic-neurosim/backend/src/main.rs` (added `pub mod events;`)

## What was implemented

Created `events.rs` with three public items:

### Sentinel constants
- `NO_TRIBE: u32 = u32::MAX` — absent tribe_id / other_tribe_id
- `NO_TILE: u32 = u32::MAX` — absent tile_id
- `NO_WAR: u32 = u32::MAX` — absent war_id

### `EventSeverity` enum (`#[repr(u8)]`)
Values: `Debug(0)`, `Info(1)`, `Important(2)`, `Critical(3)`

### `EventType` enum (`#[repr(u16)]`)
Covers all lifecycle, resource, territory, war, diplomacy, neural/genetic, tech, and intervention event categories:
- Lifecycle: TribeSpawned, GenerationAdvanced, TribeExtinct, SimulationReset, TribeSurvived
- Resources: FoodGained, FoodShortage, StarvationEntered, ResourceBloomReceived
- Territory: TileClaimed, TileLost, TribeAbsorbed, TileFortified, TribeMigrated
- War: WarDeclared, CombatRound, WarEnded, WarTimeout
- Diplomacy: AllianceFormed, AllianceBroken
- Neural/Genetic: BehaviorChanged, GenomeMutated, NeuralDecision
- Tech: BridgesUnlocked, BoatsUnlocked, RiverCrossed
- Intervention: InterventionApplied

### `SimulationEvent` struct
Compact record with:
- `event_id: u64`, `tick: u64`, `generation: u32`
- `event_type: EventType`, `severity: EventSeverity`
- `tribe_id: u32`, `other_tribe_id: u32` (NO_TRIBE sentinel)
- `tile_id: u32` (NO_TILE sentinel), `war_id: u32` (NO_WAR sentinel)
- `value_a: f32`, `value_b: f32` — numeric payloads
- `flags: u32` — packed boolean/categorical data
- `SimulationEvent::new(...)` constructor sets all optional fields to sentinels

All types derive `Serialize, Deserialize` for REST/debug output.

## Validation

```
cargo check -> Finished `dev` profile [unoptimized + debuginfo] target(s) in 26.01s
  (only pre-existing warnings, no new errors)

npm --prefix frontend run build -> ✓ built in 10.78s
  (no errors, only pre-existing chunk size warnings)
```

## Notes

- No behavior change. Event types compile only; no emission wired yet.
- G2 (event buffers) and G3 (lifecycle emission) are the natural follow-on tasks.
- `EventType` numeric slots are spaced by category (0s lifecycle, 10s resources, 20s territory, etc.) to allow inserting new variants without renumbering.
