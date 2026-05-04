# Task N Run — Track N: Performance And Memory

## Summary

Track N contains four tasks: N1, N2, N3, and N4.

The session constraint was: **Do not touch backend.**

N1 (tick timing), N2 (frame size metric), and N3 (event buffer memory bound test) all modify `backend/genetic-neurosim/backend/src/simulation.rs` or backend event storage. They were skipped per constraint.

N4 (Python Boundary Documentation) is docs-only. It was implemented.

---

## Task N4: Python Boundary Documentation

**Accomplished:**

- Created `docs/neurosim-python-ml-boundary.md` — concise reference defining allowed/disallowed Python patterns for the NeuroSim system.
- Linked the new doc from `docs/neurosim-tribal-simulation-critical-redesign.md` in the Language Boundary section.

**Content of the boundary doc:**

- Allowed Python: offline analysis, report generation, parameter search, training scripts that export static artifacts, notebook exploration, ML prototyping, offline model comparison.
- Artifacts consumed by Rust: compact JSON/binary weight files, genome seed data, cluster profile arrays — loaded at startup, not per-tick.
- Prohibited: per-tick Python calls, Python driving live tribe decisions, Python in WebSocket frame construction, Python-side ML inference during running simulation, Python object graphs for replay/event storage.
- When to move Python to Rust: logic that runs in the tick loop, touches tile/tribe state, is required for deterministic replay, or is a measured bottleneck.
- Benchmark requirement: any candidate per-tick Python usage must be measured under 100-tribe and 500-tribe scenarios before committing.

---

## Files Changed

- `docs/neurosim-python-ml-boundary.md` (created)
- `docs/neurosim-tribal-simulation-critical-redesign.md` (added link in Language Boundary section)

## Validation Run

```
rg "neurosim-python-ml-boundary" docs
  docs\neurosim-tribal-simulation-critical-redesign.md: link line present
  docs\superpowers\plans\...\agent-tasks.md: task reference present
  -> PASS

npm --prefix frontend run build
  ✓ 970 modules transformed
  ✓ built in 5.36s
  -> PASS (warnings are pre-existing chunk size notices, not errors)
```

## Notes

- N1, N2, N3 deferred — all require `simulation.rs` or backend event storage modifications excluded by session constraint.
- N3 also has a hard dependency on G2 (event buffer implementation), which was not confirmed present.
- N4 complete and sufficient as a standalone deliverable for future ML agents.
