# Chapter 3: The Correction

**Log:** `f2-flexset-neural-audit-decoded-60.jsonl`
**Ticks:** 60
**Verdict:** Schema corrected — all 7 outputs active

---

## What We Learned

Someone pointed out our mistake. The schema documentation said:

> For event_type = "behavior_changed":
> - event.value_a = **old behavior state id**
> - event.flags low byte = new behavior state id
> - decoded.old_behavior = old behavior state id
> - decoded.new_behavior = new behavior state id
> - decoded.dominant_output_index = **winning NN output index**
> - decoded.dominant_output_label = **winning NN output label**
> - decoded.dominant_output_strength = **winning NN output strength**

We were reading `event.value_a` and calling it the NN output. It was the behavior state. The real NN output was in the `decoded` object we'd been ignoring.

## The Moment of Truth

We re-ran the analysis using `decoded.dominant_output_label` instead of `event.value_a`.

The result changed everything:

| Output | Count | Share |
|---|---|---|
| migration_drive | 540 | 32.4% |
| goal_drive | 277 | 16.6% |
| expansion_speed | 253 | 15.2% |
| raid_drive | 208 | 12.5% |
| resource_drive | 193 | 11.6% |
| isolation | 180 | 10.8% |
| aggression | 16 | 1.0% |

**All 7 outputs.** Active. Good distribution. The most common winning output was **migration_drive** — the exact one we said was "never firing."

## The Correction Spreadsheet

| Claim in previous report | Truth | Error |
|---|---|---|
| "4 of 7 outputs never fire" | **All 7 fire** | Read value_a instead of decoded |
| "migration_drive never fires" | **migration_drive is #1 (32%)** | Same error |
| "NN diversity FAIL" | **NN diversity PASS** | Wrong field |
| "value_b range only 0.017" | **Range is 0.309** | value_b is output strength, not value_a |
| "Fitness 0.0 for 900 ticks" | Fitness grows from tick 1 | This was a real bug — now fixed |

## What the Correction Meant

The developers hadn't wasted all their time fixing NN initialization. The NN was fine. The problems were:

1. **Fitness function** — wasn't computing before generation boundary. **Fixed.**
2. **Migration/territory** — some engine bug, now fixed.
3. **Our analysis** — we pointed fingers at the wrong subsystem.

The real (and only) simulation bugs were:
- Fitness computation timing
- Migration/territory engine logic
- Polity advancement rate

None of these were NN-related.

## What Changed in the Smoke Test

The corrected data showed a healthy simulation even at 60 ticks:

| Metric | Value |
|---|---|
| All 7 outputs active | YES |
| Migration persisting | 84 migrating at tick 60 |
| Territory claims | 1,464 in 60 ticks (24/tick) |
| Fitness growing | 0.008 → 0.054 |
| Behavior variety | 6 states (incl. Foraging, Starving) |
| War ramp | 99 declared, steady rate |

## The Lesson

**"4 of 7 outputs never fire" was never true.** It was an analysis bug, not a simulation bug. The simulation's neural diversity was fine the whole time. We spent Chapter 2 confidently declaring a problem that existed only in our parser.

Schema documentation exists for a reason. Read it before drawing conclusions.

---

*Next: [Chapter 4 — The Validated Run](chapter-4-validated-run.md)*
