# AGENTS.md

## Purpose

This subtree serves Tribal NeuroSim — currently executing the v4 Neural Sync scope.

The active direction is:

- Rust backend as the **only** authoritative simulation engine
- C# MonoGame desktop client as visualization and inspection layer only
- Node as the required thin bridge between MonoGame and Rust
- Assets stored externally (Google Drive); `client-monogame/Content/` is gitignored

## Authority Contract (v4 — binding)

Read `docs/neural-authority-contract-2026-05-11.md` before making any behavior changes.

The short version:

- **Rust owns:** tribe decisions, migration, war/alliance/merger, fitness, selection, crossover, lineage, tombstones, world state.
- **C# owns:** rendering, inspection UI, debug HUD, local visual harnesses.
- **Node owns:** bridge and bootstrap only. No game logic.
- `PlayableSimulation.cs` is a local harness, not a production simulation. Do not treat behavior tuned there as done.
- Network mode (`dotnet run -- --connect`) is the real product path.
- Do not reopen architecture debates about runtime ownership. This is settled.

## Current Scope (v4 Neural Sync)

Active task list: `docs/taskrun/MASTER-TASK-LIST-v4-neurosim-neural-sync.md`  
Implementation plan: `docs/superpowers/plans/2026-05-11-neurosim-neural-sync.md`

Work in this scope must:

1. Fix Rust behavior mechanics (dispute escalation, migration, aggression, consolidation tempo)
2. Keep MonoGame in semantic sync with what Rust produces
3. Leave lineage and tombstone infrastructure queryable and accurate
4. Produce at least one convincing, inspectable, aggressive run before the scope closes

## Architecture Rules
- Keep Rust focused on simulation execution, compact data handling, protocol output, and analytics support.
- Keep C# focused on the desktop client, rendering, inspection UI, and asset-facing registries.
- Keep Node thin as the required middleman and bootstrap layer.
- Any behavior tuning goes into `backend/src/simulation.rs` first. Do not mirror changes manually into C# and call it done.

## Domain Direction

The C# side should be prepared to model:

- `Tribe`
- `City`
- `Duchy`
- `Kingdom`
- `Empire`

It should also be prepared to define:

- artifact metadata
- biome visual mappings
- settlement visual mappings
- icon and insignia registries

## Assets

`client-monogame/Content/` is **gitignored** — store assets on Google Drive and download locally when needed.

Code belongs under:

- `backend/genetic-neurosim/client-monogame/Assets/`
- `backend/genetic-neurosim/client-monogame/Domain/`
- `backend/genetic-neurosim/client-monogame/Net/`
- `backend/genetic-neurosim/client-monogame/Protocol/`

Do not mix raw downloaded assets into code folders.

## Source Of Truth

For v4 Neural Sync work, follow these docs first:

- `docs/neural-authority-contract-2026-05-11.md` — authority ownership (binding)
- `docs/taskrun/MASTER-TASK-LIST-v4-neurosim-neural-sync.md` — active task list
- `docs/superpowers/plans/2026-05-11-neurosim-neural-sync.md` — implementation plan
- `docs/neural_network_05-10_state.md` — current NN state and gap analysis

V3 design docs are background reference only. Do not fan out into them unless a code path is genuinely ambiguous.

## What Not To Do

- Do not add mechanics outside the v4 scope (neural behavior, migration, evolution, MonoGame sync, verification).
- Do not tune behavior in C# and treat it as the canonical fix.
- Do not reopen architecture debates about which runtime owns simulation.
- Do not spend time on UI beauty passes — semantic correctness first.

## Practical Priority

When in doubt, favor:

1. Rust simulation correctness
2. MonoGame semantic sync with Rust state
3. inspectability of tribe decisions
4. visual fidelity last
