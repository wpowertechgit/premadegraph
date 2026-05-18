# F2 Full Run Validation — The Story

This is the story of how we took a broken NeuroSim validation run and fixed it.

Four chapters, four log files, one arc:

| Chapter | Log | Ticks | Verdict |
|---|---|---|---|
| [1 — The Bugged Run](chapter-1-bugged-run.md) | `f2-flexset-run.jsonl` | 1200 | FAIL — 4 critical bugs |
| [2 — The Smoke Test (Wrong Schema)](chapter-2-smoke-wrong-schema.md) | `f2-flexset-neural-audit-smoke-60.jsonl` | 60 | False positives from parsing error |
| [3 — The Correction](chapter-3-correction.md) | `f2-flexset-neural-audit-decoded-60.jsonl` | 60 | All 7 outputs actually active |
| [4 — The Validated Run](chapter-4-validated-run.md) | `f2-flexset-neural-audit-decoded-1200.jsonl` | 1200 | PASS — all fixes confirmed |

**Moral of the story:** Understand your schema before drawing conclusions. Fix the right thing. Trust your data — but verify your parser first.
