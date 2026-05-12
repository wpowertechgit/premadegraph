# NeuroSim v4 Master Task List — Neural Sync Scope

**Created:** 2026-05-11  
**Purpose:** Replace the old broad V3 task list with a tighter execution list for the current finish scope.  
**Primary target:** A Rust-authoritative NeuroSim with real neural decision-making, real migration, real evolutionary pressure, and MonoGame fully in semantic sync.

---

## How To Use This Document

This is the execution-facing master list for the current scope.

Use this file as the main task source for AI workers.

A worker should only need:

- this file
- `docs/superpowers/plans/2026-05-11-neurosim-neural-sync.md`
- the landing-zone code files named there

Do **not** send workers through the old markdown set unless blocked by code ambiguity.

## Ground Rules

- Rust is the only simulation authority.
- C# MonoGame is the visualization and inspection layer.
- Node is the bridge, not the brain.
- No new parallel behavior logic in C#.
- No UI beauty pass except small fixes needed for clarity.
- No speculative side quests.
- No “future work” fake-completions for migration, selection, crossover, or lineage integration.

---

## Current Position

### Already Good Enough

- MonoGame visualization works and is useful.
- FrameV1 transport exists.
- Network mode exists.
- Lineage registry exists.
- Tombstone ledger exists.
- War/alliance/merger scaffolding exists.
- The current UI is acceptable as a base.

### Fixed This Session (as of 2026-05-12)

- `Genome::new(8, 3)` hardcoding replaced with `Genome::new(INPUT_COUNT, OUTPUT_COUNT)` = (11, 7)
- artifact normalization corrected to linear `v / 10.0`
- neural outputs expanded from 3 mood drives to 7 semantic action drives
- migration is real: destination scoring + hex-step camp movement
- fitness function defined (5-component weighted score)
- fitness-ranked mutation pressure at generation boundary
- genome crossover on polity merger
- C# `PlayableSimulation` marked harness-only with authority contract banner
- `GameRoot` network mode path clarified as production path
- dispute registry with 120-tick grace period; resolves to war / alliance / retreat
- opportunity war: tribes with high raid/aggression target weakest adjacent rival
- surrounded tribe escalation: boxed-in tribes fight, ally desperately, or enter Desperate
- target selection in combat fixed from tile-index distance to weakest-adjacent-first
- C4: cadence tuned for tick-200 consolidation (alliance check 50→15 ticks, MERGE_TICK_THRESHOLD 300→80, MERGE_CHECK_INTERVAL 100→20, DISPUTE_GRACE 120→60, war timeout 300→120, occupying dwell 60→25, peace dwell 80→35, expansion cooldown 25→8, alliance goal thresholds lowered)

- dispute war-path now removes pair from registry (bug fix found during F1 harness)
- 5 controlled harness tests added to `simulation.rs::harness_tests`: migration, dispute, opportunity war, alliance/merger, generation boundary

### Still Incomplete
- F2–F3: full run validation and final doc pass (pending)

---

## Final Product Target

By the end of this task list:

- tribes should act like persistent, opportunistic agents
- most important consolidation should happen early, around tick 200
- migration should visibly relocate tribes
- disputes should resolve into war, retreat, alliance, or merger
- stronger tribes should opportunistically absorb weaker ones
- wars should create openings for third parties
- alliances should be easier and more meaningful
- evolution should have real directional pressure
- MonoGame should clearly show what Rust is deciding

---

## SECTOR A — Authority And Scope Lock

### Task A1 — Freeze Rust Authority

**Status:** done

**Goal:** Make it explicit in docs and execution flow that Rust is the only production simulation authority.

**Files:**
- `docs/superpowers/plans/2026-05-11-neurosim-neural-sync.md`
- `backend/genetic-neurosim/docs/taskrun/MASTER-TASK-LIST-v4-neurosim-neural-sync.md`
- optional doc touch-ups only if needed for clarity

**Definition of done:**
- worker instructions clearly forbid reopening architecture debates
- C# local simulation is treated as harness/demo only, not truth

### Task A2 — Kill Rule Drift Between Rust And C#

**Status:** done

**Goal:** Ensure no production behavior logic remains split across Rust and C#.

**Primary files:**
- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/client-monogame/Models/PlayableSimulation.cs`
- `backend/genetic-neurosim/client-monogame/GameRoot.cs`

**Definition of done:**
- network mode is the real product path
- `PlayableSimulation` is clearly harness-only or reduced in responsibility
- no future tuning requires mirrored rule edits in two places

---

## SECTOR B — Neural Core Repair

### Task B1 — Fix Artifact Normalization

**Status:** done

**Goal:** Replace tanh-based tribe artifact loading with database-faithful scale mapping.

**Owner intent locked in:**
- if the weighted artifact average is `6.3`, the in-sim stat should be `0.63`

**Primary files:**
- `backend/genetic-neurosim/backend/src/tribes.rs`
- `backend/genetic-neurosim/backend/src/db.rs`
- `backend/genetic-neurosim/backend/src/simulation.rs`

**Definition of done:**
- spawn tribes no longer start near-maxed from squash distortion
- all 5 artifacts remain usable and interpretable

### Task B2 — Fix Neural Input Count And Sensor Authority

**Status:** done

**Goal:** Ensure the compiled network consumes the full intended input vector.

**Primary files:**
- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/backend/src/tribes.rs`

**Must fix:**
- remove `Genome::new(8, 3)` hardcoding
- audit every input-count assumption
- add tests so this mismatch cannot silently return

**Definition of done:**
- every stored input is actually consumed by the network
- nearest rival / ally sensing is real, not decorative

### Task B3 — Upgrade The Brain From 3 Drives To Action Scoring

**Status:** done

**Goal:** Move from weak mood outputs to a richer action-level decision surface.

**Primary files:**
- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/backend/src/frame_v1.rs`

**Target direction:**
- score actions such as forage, expand, migrate, war, ally, merge, hold, risk-commit
- keep hardcoded rails only where absolutely necessary

**Definition of done:**
- the NN materially influences what tribes do
- the state machine becomes lighter, not dominant

---

## SECTOR C — Real Behavior Mechanics

### Task C1 — Real Migration

**Status:** done

**Goal:** Turn migration into actual territorial relocation.

**Primary files:**
- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/backend/src/world.rs`
- `backend/genetic-neurosim/backend/src/events.rs`

**Must include:**
- destination scoring
- path/step progression
- relocation pressure
- settle/abort outcomes
- migration visibility in client state

**Definition of done:**
- migrating tribes physically move
- migration can save, reposition, or expose tribes

### Task C2 — Dispute Escalation And Casus Belli

**Status:** done

**Goal:** Make disputes resolve instead of lingering passively.

**Primary files:**
- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/backend/src/war.rs`

**Must include:**
- grace period, not infinite tolerance
- dispute -> war path
- dispute -> alliance path
- dispute -> retreat path
- relative strength logic, not only absolute thresholds

**Definition of done:**
- disputed tiles cannot sit unresolved forever

### Task C3 — Aggressive Opportunity War And Surrounded-Tribe Escalation

**Status:** done

**Goal:** Make nearby weakness and entrapment produce real conflict pressure.

**Primary files:**
- `backend/genetic-neurosim/backend/src/simulation.rs`

**Must include:**
- nearby rival sensing before formal war
- weaker-neighbor conquest pressure
- surrounded tribe escalation
- desperate tribe fallback that is not just passive implosion

**Definition of done:**
- boxed-in tribes fight, negotiate, or die trying
- the world feels less deadlocked

### Task C4 — Faster Early Consolidation

**Status:** done

**Goal:** Make major alliance/war/merger structure emerge earlier.

**Primary files:**
- `backend/genetic-neurosim/backend/src/simulation.rs`

**Likely knobs:**
- alliance check interval
- merger eligibility dwell
- peace timeout
- occupying dwell
- expansion cadence
- starvation/recovery cadence

**Definition of done:**
- by around tick 200, runs are already strategically interesting

---

## SECTOR D — Evolution That Actually Evolves

### Task D1 — Fitness Evaluation

**Status:** done

**Goal:** Define a real tribe fitness score.

**Primary files:**
- `backend/genetic-neurosim/backend/src/simulation.rs`

**Fitness should reflect:**
- survival
- stable growth
- territory control
- war success
- merger success
- resilience
- non-pathological food/pop balance

**Definition of done:**
- fitness can be explained and inspected

### Task D2 — Population-Level Selection

**Status:** done

**Goal:** Replace equal mutation drift with ranked or elite-biased selection.

**Primary files:**
- `backend/genetic-neurosim/backend/src/simulation.rs`

**Definition of done:**
- all tribes no longer receive the same evolutionary treatment
- better tribes shape the next generation more strongly

### Task D3 — Crossover For Union / Merger

**Status:** done

**Goal:** Implement governing-genome inheritance during long unions or full mergers.

**Primary files:**
- `backend/genetic-neurosim/backend/src/simulation.rs`

**Owner intent locked in:**
- after long enough union, or earlier if the NN decides full merge, the better governing traits carry forward

**Definition of done:**
- merger inheritance is real, not just narrative

### Task D4 — Lineage And Tombstone Integration

**Status:** done

**Goal:** Use the existing lineage/tombstone infrastructure instead of inventing another ancestry system.

**Primary files:**
- `backend/genetic-neurosim/backend/src/lineage_registry.rs`
- `backend/genetic-neurosim/backend/src/tombstone.rs`
- `backend/genetic-neurosim/backend/src/simulation.rs`

**Definition of done:**
- ancestry, merger history, death history, and generation info stay queryable

---

## SECTOR E — MonoGame Semantic Sync

### Task E1 — Extend FrameV1 For Brain / Migration / Fitness Visibility

**Status:** done

**Goal:** Expose enough state for MonoGame to explain tribe behavior.

**Primary files:**
- `backend/genetic-neurosim/backend/src/frame_v1.rs`
- `backend/genetic-neurosim/backend/src/main.rs`
- `backend/genetic-neurosim/client-monogame/Protocol/SimulationFrame.cs`
- `backend/genetic-neurosim/client-monogame/Protocol/FrameDecoder.cs`
- `backend/genetic-neurosim/client-monogame/Models/SimulationViewModel.cs`

**Expose at minimum:**
- neural inputs/outputs or summarized brain snapshot
- migration target/progress
- fitness score
- richer dispute/war/ally state

**Definition of done:**
- MonoGame can inspect the reasons behind behavior, not just surface state

### Task E2 — HUD / Selection / Lineage / Tombstone Sync

**Status:** done

**Goal:** Make the existing UI semantically useful for the new backend.

**Primary files:**
- `backend/genetic-neurosim/client-monogame/UI/DebugHud.cs`
- `backend/genetic-neurosim/client-monogame/UI/SelectionPanel.cs`
- `backend/genetic-neurosim/client-monogame/UI/LineageInspectorPanel.cs`
- `backend/genetic-neurosim/client-monogame/UI/TombstonePanel.cs`
- `backend/genetic-neurosim/client-monogame/GameRoot.cs`

**Definition of done:**
- selected tribe inspection shows the new brain/migration/fitness state
- lineage/tombstone views remain useful under the Rust-authoritative model

---

## SECTOR F — Verification And Finish

### Task F1 — Controlled Harness Verification

**Status:** done

**Goal:** Verify core mechanics in small deterministic scenarios before full-run tuning.

**Required harnesses:**
- migration rescue case
- dispute escalation case
- opportunistic conquest case
- alliance/merger case
- generation boundary selection case

**Definition of done:**
- each mechanic works in isolation

### Task F2 — Full Run Validation

**Status:** pending

**Goal:** Prove the integrated sim is alive, aggressive, and inspectable.

**Success markers:**
- early consolidation by around tick 200
- visible migration where appropriate
- non-passive dispute resolution
- fewer deadlocked tribes
- real lineage/fitness visibility
- C# view matches Rust state

### Task F3 — Final Doc Pass

**Status:** pending

**Goal:** Leave behind a clean thesis/demo-ready explanation of the final system.

**Primary docs to refresh:**
- `docs/superpowers/plans/2026-05-11-neurosim-neural-sync.md`
- `backend/genetic-neurosim/docs/neural_network_05-10_state.md`
- this master list

---

## Recommended Execution Order

Run the sectors in this order:

1. `A1`
2. `A2`
3. `B1`
4. `B2`
5. `B3`
6. `C1`
7. `C2`
8. `C3`
9. `C4`
10. `D1`
11. `D2`
12. `D3`
13. `D4`
14. `E1`
15. `E2`
16. `F1`
17. `F2`
18. `F3`

---

## DeepSeek / Claude / Codex Routing

Use smaller or cheaper models for:

- doc refreshes
- protocol field plumbing
- UI/HUD field display
- task status updates

Use stronger models for:

- `simulation.rs` brain redesign
- migration logic
- dispute/war/alliance tempo redesign
- selection/fitness/crossover
- Rust/C# authority cleanup

Do not waste expensive context on old historical docs unless a code path is unclear.

---

## Non-Goals For This Pass

- full visual art-direction overhaul
- major asset pipeline changes
- new grand architectural pivots
- browser runtime resurrection
- random extra mechanics outside neural behavior, migration, evolution, sync, and verification

---

## Done Means Done

This scope is complete only when:

- the NN is no longer a decorative 3-output mood ring
- migration is real
- evolution is real
- MonoGame is in semantic sync
- the sim produces convincing, interpretable, aggressive runs

