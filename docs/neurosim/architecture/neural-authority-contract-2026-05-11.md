# Neural Authority Contract

**Date:** 2026-05-11  
**Scope:** NeuroSim v4 Neural Sync — binding for all workers in this scope.

---

## Ownership Split

### Rust backend owns

- tribe decisions (every tick)
- migration logic
- war / alliance / merger resolution
- fitness evaluation, selection pressure, crossover
- lineage registry and tombstone ledger
- authoritative world state

### C# MonoGame owns

- rendering and isometric visualization
- inspection UI (HUD, selection panel, lineage panel, tombstone panel)
- debug tooling that consumes Rust-defined state
- local harness / stress demos (`--empire-stress`, `--dispute-stress`) for visual testing only

### Node owns

- thin bridge between MonoGame and Rust WebSocket
- bootstrap and export helpers
- nothing else

---

## Hard Rules

- C# must not maintain a second canonical simulation ruleset for production runs.
- `PlayableSimulation.cs` is a local demo harness. It is not the real product. Do not tune behavior there and treat it as done.
- Any future behavior tuning goes into `backend/src/simulation.rs` first and only.
- Network mode (`dotnet run -- --connect`) is the real product path. Local demo mode is a visual sanity check, not a simulation authority.
- Do not reopen architecture debates about which runtime owns behavior. This is settled.

---

## Confirmed Contradictions At Time Of Writing

- Rust docs and contracts say Rust is the simulation authority.
- `client-monogame/Models/PlayableSimulation.cs` still contains independent behavior logic (food economy, war triggers, merger triggers) that has drifted from Rust.
- TaskR8Run confirmed: Rust/C# parity requires manual mirroring and is fragile.
- Task M18C fixed the C# food economy but did not propagate the fix to Rust.

These contradictions are tracked in `tribe-behavior-diff.md` §7 and §11. Resolving them is the job of Task A2 and the broader v4 scope.

---

## What This Contract Does Not Change

- The simulation design itself (tribe mechanics, evolution rules, polity tiers) is governed by `AGENTS.md` and the v4 master task list.
- C# local harness runs are still allowed for visual debugging and stress testing.
- The Node bridge is still required for the desktop client to reach Rust.

---

## Non-Goals

- Do not use this document to justify removing the C# client.
- Do not use this document to justify adding game logic to Node.
- Do not reopen discussions about browser runtime or alternate backends.
