# DeepSeek Pro Executor Prompt — NeuroSim Neural Sync Support

You are working in:

`C:\Users\karol\OneDrive\Dokumentumok\Dolgozat\premadegraph`

Your target area is:

`backend/genetic-neurosim`

## Read Order

Read these two files first:

1. `docs/superpowers/plans/2026-05-11-neurosim-neural-sync.md`
2. `backend/genetic-neurosim/docs/taskrun/MASTER-TASK-LIST-v4-neurosim-neural-sync.md`

Then read only the specific source files needed for the tasks assigned below.

Do **not** read the old markdown archive unless blocked by missing code context.

## Core Rules

- Rust is the only production simulation authority.
- C# MonoGame is only visualization/inspection for the real product path.
- Do not invent parallel rules in C#.
- Stay token-efficient.
- Prefer narrow, concrete edits.
- If a task touches core simulation architecture, stop and leave that to Claude unless explicitly told otherwise.

## Your Assignment

You own the lighter, bounded support tasks and plumbing tasks around the main architecture work.

Good DeepSeek Pro tasks from `MASTER-TASK-LIST-v4-neurosim-neural-sync.md`:

- support work for `A1` doc cleanup if needed
- support work for `A2` marking `PlayableSimulation` as harness-only
- protocol/client plumbing for `E1`
- HUD/selection/inspection field display work for `E2`
- support work for `F3` final doc cleanup

Specific examples of suitable work:

- extend FrameV1 decode structs cleanly
- wire new backend fields into `SimulationViewModel`
- expose migration/fitness/brain fields in MonoGame HUD and selection panels
- update lineage/tombstone panels to consume richer backend data
- tighten docs after the backend behavior is already implemented

## Tasks To Avoid Unless Explicitly Assigned

Do **not** take ownership of these unless explicitly asked:

- `B2` neural input authority redesign
- `B3` action-scoring brain redesign
- `C1` migration algorithm design
- `C2` dispute/war escalation architecture
- `C3` conquest/surrounded-tribe escalation logic
- `C4` early-consolidation tuning strategy
- `D1` fitness function design
- `D2` selection loop design
- `D3` crossover design
- `D4` lineage/tombstone architecture decisions

Those are Claude-tier tasks for this project.

## Best Landing Zone For Your Work

Prefer these files:

- `backend/genetic-neurosim/client-monogame/Protocol/FrameDecoder.cs`
- `backend/genetic-neurosim/client-monogame/Protocol/SimulationFrame.cs`
- `backend/genetic-neurosim/client-monogame/Models/SimulationViewModel.cs`
- `backend/genetic-neurosim/client-monogame/GameRoot.cs`
- `backend/genetic-neurosim/client-monogame/UI/DebugHud.cs`
- `backend/genetic-neurosim/client-monogame/UI/SelectionPanel.cs`
- `backend/genetic-neurosim/client-monogame/UI/LineageInspectorPanel.cs`
- `backend/genetic-neurosim/client-monogame/UI/TombstonePanel.cs`
- small doc files under `backend/genetic-neurosim/docs/taskrun/`

Touch Rust backend files only for narrow field/plumbing changes if explicitly required by the contract and already designed.

## What Success Looks Like

By the end of your slice:

- C# decodes and displays the backend’s new semantics cleanly
- migration/brain/fitness data is visible in the client
- docs are concise and aligned with code
- no new authority drift is introduced

## Execution Style

1. Read only the assigned plan and target files.
2. Keep context narrow.
3. Make bounded edits.
4. Leave architecture invention to Claude.
5. Verify builds after your changes.

## Final Instruction

Be a precise finisher, not a philosopher. Keep the task small, sharp, and synchronized with the Rust-authoritative design.

