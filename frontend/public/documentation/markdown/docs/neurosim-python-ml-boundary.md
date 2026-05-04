# NeuroSim Python / ML Boundary

## Purpose

This document defines where Python is allowed and where it is not in the NeuroSim Tribal Simulation system. It exists so ML agents and contributors know exactly which work belongs in Python versus Rust.

## Allowed Python Use

Python is welcome for work that happens **outside the live simulation loop**:

- Offline experiment analysis and report generation
- Post-run summary metrics and charts
- Parameter search, hyperparameter sweeps, and grid search
- Training and tuning scripts that export compact static artifacts consumed by Rust
- Notebook-style thesis exploration and visualization
- ML prototyping before porting stable logic to Rust
- Offline model comparison and evaluation
- Generating or validating cluster profiles used as seeding input

The key rule: Python work produces **static artifacts** (weight files, config JSON, coefficient arrays, model exports) that Rust loads at startup or at generation boundaries. Python does not drive live ticks.

## Allowed Python Artifacts Consumed By Rust

If Python ML tooling produces a model or tuned set of parameters, Rust should consume them as:

- Compact JSON or binary weight/coefficient files loaded at init
- Static genome seed data derived from offline training
- Cluster profile files with pre-computed trait arrays

Rust reads these once at startup or when reloading a dataset. Python does not run during the tick loop.

## Caution: Do Not Do This

These patterns are **not allowed** in the live system:

| Pattern | Why Not |
|---|---|
| Per-tick Python call via subprocess or FFI | Adds IPC overhead every frame; can explode tick time |
| Python driving live tribe decisions | Bypasses Rust's deterministic simulation loop |
| Python in WebSocket frame construction | Adds serialization latency on the critical path |
| Python-side ML inference during running simulation | Not measurably safe without explicit benchmarking; likely GIL-bound |
| Python object graphs for replay/event storage | Unbounded memory growth risk; bypasses Rust's memory discipline |
| Python as the real-time engine | Acceptable only if explicitly benchmarked and justified in writing |

## When To Move Python Logic To Rust

Move Python logic into Rust when:

- The logic runs or could run in the live tick loop
- It touches tile ownership, tribe state, or event emission
- It is required for deterministic replay
- Profiling shows it is a bottleneck at medium/large tribe counts
- It must be reproducible from a seed

## Benchmark Before Committing

If Python live inference is ever evaluated:

1. Measure average and p99 tick time with and without the Python call
2. Measure under 100-tribe and 500-tribe scenarios
3. Document the benchmark in the evidence folder
4. Only proceed if tick time stays within the fixed budget target

Undocumented per-tick Python calls are treated as a regression.

## References

- Language boundary section: `docs/neurosim-tribal-simulation-critical-redesign.md` (Memory And Low-Level Optimization Requirements)
- Agent task plan: `docs/superpowers/plans/2026-05-03-neurosim-tribal-simulation-agent-tasks.md` (Task N4)
- Global rules: `AGENTS.md`
