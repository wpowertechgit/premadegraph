# Task R3 Run Report — V3 State Machine & Behavior Upgrade

**Date:** 2026-05-06
**Status:** Complete

## Summary

Implemented V3 state machine upgrades for the Civ6-style societal hierarchy. Added polity tiers, specialization roles, main camp tile, citizen records, and new behavior states to the Rust simulation backend.

## Files Changed

| File | Change |
|------|--------|
| `backend/src/tribes.rs` | Added `PolityTier`, `SpecializationRole`, `CitizenRecord` enums/structs; added `Consolidating`, `Rebellious`, `Administering` to `BehaviorState`; added V3 fields to `TribeState`; updated `from_cluster()` defaults |
| `backend/src/events.rs` | Added `PolityUpgraded`, `RoleAssigned`, `ConsolidationStarted`, `RebellionStarted` event types |
| `backend/src/simulation.rs` | Added V3 behavior transitions in `apply_state_machine()`; added `apply_veterancy_xp()` per-tick role fulfillment; added `assign_specialization_role()` helper; added `polity_tier_counts` to `StatusResponse`/`RunSummary`/`TribeSummaryRecord`; added V3 fields to `TribeSnapshotResponse`/`tribe_snapshot()`; added `v3_polity_summary()` method + `V3PolitySummaryResponse`/`V3TribeRecord` types |
| `backend/src/main.rs` | Added `GET /api/v3/polity-summary` route + handler |
| `frontend/src/features/simulation/TribalSimulationPage.tsx` | Fixed pre-existing broken import path (`../neurosimHex` → `../../neurosimHex`) |

## V3 State Machine Behavior Flow

```
Consolidating (tick 0-100) → Administering (after 100 ticks)
Administering (a_team < 0.25, ticks > 100) → Rebellious
Rebellious (ticks > 50, aggression > 0.7) → AtWar
Rebellious (ticks > 200) → Administering (suppressed)
```

## Specialty Role XP Per Tick

| Role | Bonus Condition | XP |
|------|----------------|-----|
| Generalist | Always | 0.5 |
| Military | AtWar behavior | 2.0 |
| Economy | food_ratio > 0.8 | 2.0 |
| Governance | territory > 20 tiles | 2.0 |
| Logistics | river_crossings > 0 or Migrating | 2.0 |
| InternalAffairs | has ally | 2.0 |
| (any) | condition not met | 0.5 base |

## New API Endpoint

`GET /api/v3/polity-summary` — returns:
- `tribe_count`, `polity_counts`, `role_counts`
- `total_veterancy_xp`, `total_citizens`
- Per-tribe records with polity tier, role, XP, camp tile, constituent/citizen counts

Mid-compatible: existing endpoints (`/api/status`, `/api/simulation/summary`, `/api/tribes/{id}`) now include V3 fields.

## Validation

- **Rust backend:** `cargo build` — clean (0 errors, warnings only for pre-existing dead code)
- **Frontend:** `npm --prefix frontend run build` — clean (after fixing pre-existing import path bug)
- Frontend build fix was in `TribalSimulationPage.tsx` (not part of R3 scope, but unblocked validation)

## WAIT-FOR Dependencies

- Task R5 (Binary Diplomacy) — needs `polity_tier`, `constituent_tribe_ids`, `SpecializationRole` fields
- Task R6 (Reproduction) — needs `citizens: Vec<CitizenRecord>` field
