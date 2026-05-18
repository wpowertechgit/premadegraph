# F2 Full Run Validation CLI

Status: implemented and smoke-tested.

## CLI Command

```powershell
cargo run --manifest-path backend\genetic-neurosim\backend\Cargo.toml -- --cli-run --ticks 1200 --checkpoint-interval 100 --log backend\genetic-neurosim\logs\f2-full-run.jsonl
```

The CLI runner advances the Rust-authoritative simulation without requiring a
WebSocket client. It writes JSONL records for:

- `run_started`
- every emitted simulation `event`
- periodic `checkpoint` summaries
- one `final_summary`

The default source is deterministic synthetic validation clusters. Add
`--use-dataset-export` to try the existing export path first and fall back to
synthetic clusters if no export is available.

For thesis/data-backed validation, prefer strict dataset mode:

```powershell
cargo run --manifest-path backend\genetic-neurosim\backend\Cargo.toml -- --cli-run --require-dataset-export --ticks 1200 --checkpoint-interval 100 --log backend\genetic-neurosim\logs\f2-dataset-run.jsonl
```

`--require-dataset-export` fails the run if no real exported cluster profiles
are available. This prevents accidentally validating synthetic tribes while
thinking the run used the 599 dataset-derived tribes.

## Evidence From Smoke Run

Run date: 2026-05-13

Command:

```powershell
cargo run --manifest-path backend\genetic-neurosim\backend\Cargo.toml -- --cli-run --ticks 1200 --checkpoint-interval 100 --log backend\genetic-neurosim\logs\f2-full-run.jsonl
```

Observed final markers:

- war declarations: 198
- merges completed: 32
- generation advances: 64
- offspring events: 1536
- genome mutations: 64
- final generation: 1
- final active wars: 32
- final lineage entities: 1710

Tick-200 checkpoint already showed active consolidation pressure:

- active wars: 5
- merges completed: 6
- alive tribes: 64
- top merged tribes had 5 territory tiles versus 2 for weaker partner tribes

The default synthetic full run did not force starvation migration or tile
dispute conditions. Those mechanics remain covered by the F1 controlled harness
tests; use scenario or dataset-driven runs when specifically validating those
conditions in the full log.

## 599-Tribe Scale Check

Command:

```powershell
cargo run --manifest-path backend\genetic-neurosim\backend\Cargo.toml -- --cli-run --clusters 599 --ticks 300 --checkpoint-interval 100 --log backend\genetic-neurosim\logs\f2-599-synthetic-check.jsonl
```

Observed by tick 300:

- total tribes: 599
- event lines: 6203
- checkpoint records: 4
- tribes per checkpoint: 599
- war declarations: 24
- combat round events: 257
- war ended events: 11

This proves the CLI log can scale to the expected tribe count and now records
combat progression, not only war declarations. It also shows why the real
dataset-backed run matters: at 599 tribes, many tribes may still be mostly
expanding quietly by tick 300, so the useful evidence is in the all-tribe
checkpoint summaries plus combat/war/event distributions.

## Quick Log Inspection

Read the final summary:

```powershell
Get-Content backend\genetic-neurosim\logs\f2-full-run.jsonl |
  Select-Object -Last 1 |
  ConvertFrom-Json |
  ConvertTo-Json -Depth 6
```

Count line types:

```powershell
Get-Content backend\genetic-neurosim\logs\f2-full-run.jsonl |
  ForEach-Object { ($_ | ConvertFrom-Json).type } |
  Group-Object
```

The log is intentionally machine-readable so thesis/demo analysis can be done
after the run rather than by watching the terminal stream.
