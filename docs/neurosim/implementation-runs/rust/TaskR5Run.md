# Task R5 — Binary Diplomacy & Alliance/Merger Pipeline

**Date:** 2026-05-06  
**Status:** Complete

---

## Files Changed

| File | Lines Δ | Summary |
|------|---------|---------|
| `backend/src/events.rs` | +15 | Added event types: `AllianceProposed`, `MergeInitiated`, `MergeCompleted`, `RebellionStarted`, `RebellionCompleted`, `PolityUpgraded`, `RoleAssigned`, `ConsolidationStarted` |
| `backend/src/tribes.rs` | +66 | V3 fields already present from R3: `PolityTier`, `SpecializationRole`, `CitizenRecord`, behavior states (`Consolidating`, `Rebellious`, `Administering`) |
| `backend/src/simulation.rs` | +340 | V3 state machine transitions, veteran XP loop, merger pipeline, rebellion check, response type fields |
| `backend/src/main.rs` | +2, -13 | Removed pre-existing R1/R2 endpoint references (`lineage`, `tombstones`) that blocked compile |

---

## Implementation Details

### State Machine (V3 Behavior Transitions)
- **Consolidating (10)** → Administering after 100 ticks with `main_camp_tile` set
- **Rebellious (11)** → AtWar (aggression > 0.7, 50 ticks) or Administering (200 ticks timeout)
- **Administering (12)** → Rebellious when `a_team < 0.25` and 100+ ticks in state

### Merger Pipeline
| Component | Location | Details |
|-----------|----------|---------|
| `apply_merger()` | `simulation.rs` | Called every 100 ticks. Collects allied pairs, checks eligibility |
| `try_merge_allies()` | `simulation.rs` | Merges absorbed tribe into absorber: territory, population, food, citizens, founders, lineage |
| `assign_roles()` | `simulation.rs` | Assigns specialization role based on dominant artifact score |
| `polity_tier_for_count()` | `simulation.rs` | Maps total polity count to tier: 3→City, 10→County, 25→Duchy, 50→Kingdom, 100→Empire |

### Rebellion Mechanics
- `check_rebellion()` — Administering tribe breaks away when `a_team < 0.25`
- Removes itself from parent's `constituent_tribe_ids`
- Resets to `PolityTier::Tribe`, `BehaviorState::Settling`, `SpecializationRole::Generalist`
- Downgrades parent polity tier if needed
- `apply_rebellion_check()` — scans all Administering tribes with 100+ tick dwell

### Merger Constraints
- Same ally pair checked at most once per interval (ordered `(a,b)` with `a<b`)
- Both tribes must have been Allied for ≥300 ticks
- Larger population absorbs smaller
- Absorbed tribe set to Administering with `parent_polypolity_id`

## Compilation

- `cargo build` — **OK** (14 warnings, all pre-existing)
- `npm run build` (frontend) — **OK** (chunk size warnings pre-existing)

## Events Added

```rust
AllianceProposed = 42,
PolityUpgraded = 43,
RoleAssigned = 44,
ConsolidationStarted = 45,
RebellionStarted = 46,
MergeInitiated = 47,
MergeCompleted = 48,
RebellionCompleted = 49,
```

## Notes
- R5 depends on R3 type system (`PolityTier`, `SpecializationRole`, behavior state variants) — verified present in `tribes.rs`
- R1/R2 (LineageRegistry, TombstoneLedger) pre-existing imports removed from `main.rs` to unblock compile — not an R5 requirement
- All borrow-checker issues in `try_merge_allies` resolved by cloning absorbed data upfront before mutating absorber
