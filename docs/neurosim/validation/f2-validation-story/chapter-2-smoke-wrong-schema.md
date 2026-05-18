# Chapter 2: The Smoke Test (Wrong Schema)

**Log:** `f2-flexset-neural-audit-smoke-60.jsonl`
**Ticks:** 60
**Verdict:** False positives from parsing error

---

## What We Thought

Good news first: some fixes were clearly working. The `decoded` sub-object appeared in the log, adding per-event NN output data. But we still parsed `event.value_a` as the neural output index.

The report confidently stated:

> "Previous run's '4 of 7 outputs never fire' conclusion is confirmed. Still only 3 outputs firing: aggression (944), goal_drive (715), resource_drive (8). migration_drive (3), raid_drive (4), isolation (5), expansion_speed (6) still at 0."

This was **wrong**.

## What Actually Changed (The Real Fixes)

Some things genuinely improved:

| Metric | Old run (tick 60) | New run (tick 60) | Status |
|---|---|---|---|
| avg_fitness | 0.0 | 0.054 | **FIXED** |
| max_fitness | 0.0 | 0.158 | **FIXED** |
| Tile claims per tick | 0.87 | 24.4 | **FIXED** |
| Migration count | ~0-1 | 84 | **FIXED** |
| Behavior states | Allied/AtWar only | 6 states active | **FIXED** |
| Resource pressure | None | 8 Starving, 29 Foraging | **FIXED** |
| value_b range | 0.017 (saturated) | 0.309 (healthy) | **FIXED** |

Fitness was alive. Tribes were moving. Territory was being claimed. The fixes to the simulation engine were working.

## The Parsing Error

The `decoded` sub-object in the log contained the real NN output data:

```json
{
  "decoded": {
    "dominant_output_index": 4,
    "dominant_output_label": "raid_drive",
    "dominant_output_strength": 0.817,
    "new_behavior": 2,
    "old_behavior": 0
  },
  "event": {
    "event_type": "behavior_changed",
    "value_a": 0.0,
    "flags": 1026,
    ...
  }
}
```

But we read `event.value_a = 0.0` and said "that's output index 0 = aggression." Wrong. `value_a` is the **old behavior state ID** (in this case, 0 = Settling). The real NN output is in `decoded.dominant_output_index = 4`, which is `raid_drive`.

The report's NN output conclusion was based on the column labeled `val_a` in the raw event, not the decoded field. We didn't realize value_a was a behavior state.

## The False Alarm

We told the developers: "4 of 7 NN outputs never fire. migration_drive=0. This is the root cause of the old run's failures."

They spent time investigating NN weight initialization, output layer wiring, and the activation function — all for a problem that didn't exist.

## Verdict

The smoke test proved the simulation engine fixes were working:
- Fitness was alive
- Migration persisted
- Territory expanded
- Resource pressure existed

But the report drew a false conclusion about NN output diversity. We were looking at behavior states, not neural outputs.

---

*Next: [Chapter 3 — The Correction](chapter-3-correction.md)*
