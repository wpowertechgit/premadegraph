# Claude Executor Prompt — NeuroSim Neural Sync

You are working in:

`C:\Users\karol\OneDrive\Dokumentumok\Dolgozat\premadegraph`

Your target area is:

`backend/genetic-neurosim`

## Read Order

Read these two files first and treat them as the primary authority:

1. `docs/superpowers/plans/2026-05-11-neurosim-neural-sync.md`
2. `backend/genetic-neurosim/docs/taskrun/MASTER-TASK-LIST-v4-neurosim-neural-sync.md`

Then read only the landing-zone code files named in the plan.

Do **not** go spelunking through the old markdown archive unless blocked by missing code context.

## Core Rules

- Rust is the only production simulation authority.
- C# MonoGame is the visualization and inspection layer.
- Node is only the bridge/bootstrap/export layer.
- Do not create or preserve a second production behavior system in C#.
- Do not spend time on beauty-polish UI work except small fixes needed for semantic clarity.
- Implement in the order defined by the plan and master task list.
- Verify after each major slice.
- Keep responses concise and execution-focused.

## Your Assignment

You own the high-complexity backend and cross-system tasks.

Prioritize these tasks from `MASTER-TASK-LIST-v4-neurosim-neural-sync.md`:

- `A1` Freeze Rust Authority
- `A2` Kill Rule Drift Between Rust And C#
- `B1` Fix Artifact Normalization
- `B2` Fix Neural Input Count And Sensor Authority
- `B3` Upgrade The Brain From 3 Drives To Action Scoring
- `C1` Real Migration
- `C2` Dispute Escalation And Casus Belli
- `C3` Aggressive Opportunity War And Surrounded-Tribe Escalation
- `C4` Faster Early Consolidation
- `D1` Fitness Evaluation
- `D2` Population-Level Selection
- `D3` Crossover For Union / Merger
- `D4` Lineage And Tombstone Integration
- `F1` Controlled Harness Verification
- `F2` Full Run Validation
- `F3` Final Doc Pass

DeepSeek or cheaper models can help with simple doc/UI/protocol plumbing, but you own the architecture-critical work and final integration decisions.

## Landing Zone

Focus your code work mainly in:

- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/backend/src/tribes.rs`
- `backend/genetic-neurosim/backend/src/world.rs`
- `backend/genetic-neurosim/backend/src/war.rs`
- `backend/genetic-neurosim/backend/src/lineage_registry.rs`
- `backend/genetic-neurosim/backend/src/tombstone.rs`
- `backend/genetic-neurosim/backend/src/frame_v1.rs`
- `backend/genetic-neurosim/backend/src/main.rs`

Coordinate with these client files only as needed for sync:

- `backend/genetic-neurosim/client-monogame/Protocol/FrameDecoder.cs`
- `backend/genetic-neurosim/client-monogame/Models/SimulationViewModel.cs`
- `backend/genetic-neurosim/client-monogame/GameRoot.cs`
- `backend/genetic-neurosim/client-monogame/UI/DebugHud.cs`
- `backend/genetic-neurosim/client-monogame/UI/SelectionPanel.cs`
- `backend/genetic-neurosim/client-monogame/UI/LineageInspectorPanel.cs`
- `backend/genetic-neurosim/client-monogame/UI/TombstonePanel.cs`

## What Success Looks Like

By the end:

- the NN consumes the full intended inputs
- the NN outputs action-level intent, not just vague drives
- migration is real and visible
- disputes do not linger forever
- wars, alliances, and mergers happen earlier and more decisively
- evolution has real fitness and selection pressure
- lineage/tombstones remain accurate
- C# stays in semantic sync with Rust
- the sim produces convincing, aggressive, interpretable runs

## Execution Style

1. Audit only what the plan and landing files require.
2. Implement one sector at a time in the listed order.
3. Run verification after each major slice.
4. Update docs only when the code reality is settled.
5. Do not drown the task in huge status essays.

## Final Instruction

Do the work. Do not stop at analysis. Do not reopen settled design choices unless the code makes them impossible.

