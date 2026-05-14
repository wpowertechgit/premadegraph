# NeuroSim Neural Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Rust NeuroSim backend the single authoritative simulation for neural decision-making, migration, diplomacy, evolution, and lineage, while keeping the MonoGame visualization layer fully in sync and removing behavior drift from the C# local simulation path.

**Architecture:** The plan treats Rust as the only source of simulation truth and C# as a faithful renderer/inspector. We first freeze the cross-language contract and kill backend/client behavior divergence, then upgrade the neural decision system, migration, dispute/war/alliance logic, and evolution loop in Rust, and finally expose the new state cleanly to MonoGame for verification and thesis-facing inspection.

**Tech Stack:** Rust (`axum`, current simulation engine, binary FrameV1 transport), C# MonoGame client, Node bridge, existing lineage/tombstone systems, current FrameV1 protocol.

---

## Self-Contained Handoff

This document is intentionally written so that a future AI worker does **not** need to read the rest of the markdown corpus before starting. Treat this file as the authoritative implementation brief.

The only other files that must be read before coding are the landing-zone source files:

- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/backend/src/tribes.rs`
- `backend/genetic-neurosim/backend/src/world.rs`
- `backend/genetic-neurosim/backend/src/war.rs`
- `backend/genetic-neurosim/backend/src/lineage_registry.rs`
- `backend/genetic-neurosim/backend/src/tombstone.rs`
- `backend/genetic-neurosim/backend/src/frame_v1.rs`
- `backend/genetic-neurosim/backend/src/main.rs`
- `backend/genetic-neurosim/client-monogame/Protocol/FrameDecoder.cs`
- `backend/genetic-neurosim/client-monogame/Models/SimulationViewModel.cs`
- `backend/genetic-neurosim/client-monogame/GameRoot.cs`
- `backend/genetic-neurosim/client-monogame/UI/DebugHud.cs`
- `backend/genetic-neurosim/client-monogame/UI/SelectionPanel.cs`

Do **not** fan out into old markdowns unless blocked by missing code context.

## Settled Decisions

These decisions are already made. Do not reopen them unless the owner explicitly changes them.

- Rust is the only authoritative simulation engine.
- C# MonoGame is the visualization, inspection, and operator layer.
- Node is only a bridge/bootstrap/export layer.
- The C# `PlayableSimulation` path is not allowed to define production behavior rules that drift from Rust.
- `County = Duchy`. We use **Duchy** in code and presentation. There are only 5 tiers:
  - Tribe
  - City
  - Duchy
  - Kingdom
  - Empire
- Population-only tier downgrade does **not** happen automatically.
- Rebellion can split a polity into smaller valid sovereign parts if that split is mechanically justified.
- `a_map_objective` and `a_team` are neural behavior inputs. They are not just passive metadata.
- Artifact blending language should be treated as mutation/inheritance, not vague flavor text.
- The simulation target is aggressive consolidation with eventual last-man-standing pressure.
- The UI is already good enough visually. Do not spend this project window reinventing the renderer. Only make semantic/UI fixes needed for sync and inspection.

## What Already Works

This is not a greenfield rewrite. The following foundations already exist and should be reused:

- Rust backend simulation loop
- world grid and biome system
- war records and event system
- lineage registry
- tombstone ledger
- generation boundaries
- tribe state machine
- alliance/merger scaffolding
- FrameV1 binary transport
- MonoGame FrameV1 decoder
- MonoGame network mode rendering
- MonoGame debug HUD
- MonoGame lineage/tombstone UI scaffolding

## Current Critical Failures

These are the real blockers. The implementation must fix these, not dance around them.

1. **Two-brain architecture drift**
   - Rust is supposed to be the simulation truth.
   - C# still contains a parallel `PlayableSimulation` behavior path.
   - This makes parity fragile and confuses what the real product actually is.

2. **Broken neural input authority**
   - `INPUT_COUNT` in Rust is larger than the hardcoded `Genome::new(8, 3)` initialization.
   - The NN does not actually consume all stored inputs.
   - Spatial signals are therefore partly fake.

3. **Dead migration**
   - Tribes can enter `Migrating`.
   - They do not actually relocate in a meaningful mechanical way.

4. **Weak NN authority**
   - The current NN mostly emits 3 generic drives.
   - The hardcoded state machine still decides almost everything.

5. **Bad artifact normalization**
   - Cluster-derived artifact values are currently distorted by tanh-based squashing.
   - Spawned tribes become unrealistically maxed.
   - The owner requirement is simple: if the weighted artifact average is `6.3`, the in-sim stat should be `0.63`.

6. **No real selection pressure**
   - Generation boundaries mostly mutate everyone equally.
   - That is drift, not meaningful evolution.

7. **Dispute resolution is too passive**
   - Disputes can linger too long.
   - Surrounded tribes do not escalate hard enough.
   - War/opportunity sensing is too weak.

8. **Protocol visibility is still thin for brain inspection**
   - MonoGame can render the world, but the brain/migration/fitness state is not yet fully inspectable.

## Product Target

The target behavior is:

- tribes feel relentless, opportunistic, and persistent
- most important macro-consolidation happens early, roughly by tick 200
- disputes resolve into retreat, alliance, merger, or war
- migration is real and visible
- stronger tribes opportunistically absorb weaker neighbors
- wars weaken winners enough that third parties can exploit them
- alliances are possible and easier than before, but are still strategic, not random
- evolution produces directional pressure rather than random drift
- the client can explain why a tribe did what it did

## Hard Constraints

- Do not build a second logic system in C#.
- Do not spend the remaining project window on a UI beauty pass.
- Do not read dozens of old markdowns unless a code path is genuinely ambiguous.
- Do not solve problems with vague “future work” notes.
- Do not leave migration, fitness, crossover, or lineage integration half-real.
- Do not make unsupported social-science claims. Keep interpretation mechanical and inspectable.

## Landing Zone

Most of the real work lands in these files:

- `backend/genetic-neurosim/backend/src/simulation.rs`
- `backend/genetic-neurosim/backend/src/tribes.rs`
- `backend/genetic-neurosim/backend/src/world.rs`
- `backend/genetic-neurosim/backend/src/war.rs`

Second-order support files:

- `backend/genetic-neurosim/backend/src/lineage_registry.rs`
- `backend/genetic-neurosim/backend/src/tombstone.rs`
- `backend/genetic-neurosim/backend/src/frame_v1.rs`
- `backend/genetic-neurosim/backend/src/main.rs`

Client sync files:

- `backend/genetic-neurosim/client-monogame/Protocol/FrameDecoder.cs`
- `backend/genetic-neurosim/client-monogame/Models/SimulationViewModel.cs`
- `backend/genetic-neurosim/client-monogame/GameRoot.cs`
- `backend/genetic-neurosim/client-monogame/UI/DebugHud.cs`
- `backend/genetic-neurosim/client-monogame/UI/SelectionPanel.cs`
- `backend/genetic-neurosim/client-monogame/UI/LineageInspectorPanel.cs`
- `backend/genetic-neurosim/client-monogame/UI/TombstonePanel.cs`

## Final Definition Of Done

This effort is only done when all of the following are true:

- Rust is the clear simulation authority
- the NN consumes the full intended input vector
- the NN outputs action-level intent, not just vague mood drives
- migration physically relocates tribes
- disputes cannot linger forever
- alliances and mergers happen earlier and more often when strategically viable
- selection/fitness/crossover are real, not decorative
- lineage and tombstones remain queryable and accurate
- C# displays the same semantics Rust produces
- at least one convincing run demonstrates aggressive consolidation and interpretable tribe behavior

## Execution Order

Do the work in this order. Do not reorder casually.

1. Freeze authority contract and eliminate backend/client rule drift.
2. Fix artifact normalization from dataset scale.
3. Fix NN input/output authority and expose richer brain state.
4. Implement real migration.
5. Fix dispute, war, alliance, and merger tempo.
6. Implement fitness, selection, crossover, and lineage integration.
7. Sync MonoGame inspection and HUD with the new Rust semantics.
8. Verify with targeted harnesses and one full convincing run.

## Notes For Future AI Worker

- If time pressure forces cuts, cut cosmetic client work first.
- Do not cut Rust authority cleanup.
- Do not cut migration.
- Do not cut selection/fitness.
- Do not cut client semantic visibility for the new brain state.
- If a design choice is unclear, prefer the option that makes tribe behavior more aggressive, inspectable, and deterministic enough to debug.

---

### Task 1: Freeze The Operating Model

**Files:**
- Modify: `AGENTS.md`
- Modify: `backend/genetic-neurosim/docs/tribe-behavior-diff.md`
- Modify: `backend/genetic-neurosim/docs/veto.md`
- Modify: `backend/genetic-neurosim/docs/tribal-neurosim-v3-desktop-contract-v1.md`
- Create: `backend/genetic-neurosim/docs/neural-authority-contract-2026-05-11.md`

- [ ] **Step 1: Write the design note that settles ownership**

```md
# Neural Authority Contract

- Rust backend owns:
  - tribe decisions
  - migration
  - war/alliance/merger logic
  - fitness/selection/crossover
  - lineage and tombstones
  - authoritative world state

- C# MonoGame owns:
  - rendering
  - inspection UI
  - debug HUD
  - local tooling that consumes Rust-defined state

- C# must not maintain a second canonical simulation ruleset for production runs.
- Any remaining `PlayableSimulation` logic is demo-only until either:
  - removed, or
  - explicitly marked as a sandbox harness with different goals.
```

- [ ] **Step 2: Record the repo contradictions explicitly**

```md
## Confirmed contradictions

- Rust docs and contracts say Rust is the simulation motor.
- `client-monogame/Models/PlayableSimulation.cs` still contains independent behavior logic.
- Task M6 confirms network mode renders Rust, but local demo preserves a separate simulation path.
- Task R8 confirms Rust/C# parity is manual and therefore fragile.
```

- [ ] **Step 3: Save the contract and contradiction note**

Run:
```powershell
Get-Content backend\genetic-neurosim\docs\neural-authority-contract-2026-05-11.md
```

Expected: file exists with Rust-authoritative ownership rules and divergence callouts.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md backend/genetic-neurosim/docs/tribe-behavior-diff.md backend/genetic-neurosim/docs/veto.md backend/genetic-neurosim/docs/tribal-neurosim-v3-desktop-contract-v1.md backend/genetic-neurosim/docs/neural-authority-contract-2026-05-11.md
git commit -m "docs: freeze neurosim backend authority contract"
```

### Task 2: Normalize Cluster Artifacts From Real Dataset Semantics

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/db.rs`
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/tribes.rs`
- Modify: `backend/genetic-neurosim/docs/neural_network_05-10_state.md`
- Test: `backend/genetic-neurosim/backend/src/tribes.rs` unit tests block or new `backend/genetic-neurosim/backend/tests/cluster_stats.rs`

- [ ] **Step 1: Write the failing test for database-faithful artifact normalization**

```rust
#[test]
fn from_profile_preserves_database_scale_without_tanh_squash() {
    let profile = crate::simulation::ClusterProfile {
        id: "cluster-x".into(),
        size_ratio: 1.0,
        mean_opscore: 0.0,
        opscore_stddev: 0.0,
        cohesion: 0.0,
        internal_edge_ratio: 0.0,
        a_combat: 6.3,
        a_risk: 4.2,
        a_resource: 7.0,
        a_map_objective: 5.5,
        a_team: 3.1,
        fight_conversion: 0.0,
        damage_pressure: 0.0,
        death_cost: 0.0,
        survival_quality: 0.0,
        economy: 0.0,
        tempo: 0.0,
        vision_control: 0.0,
        objective_conversion: 0.0,
        setup_control: 0.0,
        protection_support: 0.0,
        feed_risk: 0.2,
        cluster_size: 10,
        founder_puuids: vec![],
    };

    let stats = crate::tribes::TribeStats::from_profile(&profile);
    assert!((stats.a_combat - 0.63).abs() < 0.001);
    assert!((stats.a_team - 0.31).abs() < 0.001);
}
```

- [ ] **Step 2: Run test to verify it fails under the current tanh mapping**

Run:
```powershell
cargo test from_profile_preserves_database_scale_without_tanh_squash --manifest-path backend\genetic-neurosim\backend\Cargo.toml
```

Expected: FAIL because current code uses `tanh(v / 3.0)`.

- [ ] **Step 3: Implement scale-preserving normalization**

```rust
impl TribeStats {
    fn scale_artifact_0_10_to_0_1(v: f32) -> f32 {
        (v / 10.0).clamp(0.0, 1.0)
    }

    pub fn from_profile(p: &crate::simulation::ClusterProfile) -> TribeStats {
        let a = Self::scale_artifact_0_10_to_0_1;
        TribeStats {
            a_combat: a(p.a_combat),
            a_risk: a(p.a_risk),
            a_resource: a(p.a_resource),
            a_map_objective: a(p.a_map_objective),
            a_team: a(p.a_team),
            feed_risk: p.feed_risk.clamp(0.0, 1.0),
            fight_conversion: a(p.fight_conversion),
            damage_pressure: a(p.damage_pressure),
            death_cost: a(p.death_cost),
            survival_quality: a(p.survival_quality),
            economy: a(p.economy),
            tempo: a(p.tempo),
            vision_control: a(p.vision_control),
            objective_conversion: a(p.objective_conversion),
            setup_control: a(p.setup_control),
            protection_support: a(p.protection_support),
        }
    }
}
```

- [ ] **Step 4: Run tests**

Run:
```powershell
cargo test --manifest-path backend\genetic-neurosim\backend\Cargo.toml
```

Expected: PASS, including the new normalization test.

- [ ] **Step 5: Commit**

```bash
git add backend/genetic-neurosim/backend/src/db.rs backend/genetic-neurosim/backend/src/simulation.rs backend/genetic-neurosim/backend/src/tribes.rs backend/genetic-neurosim/docs/neural_network_05-10_state.md
git commit -m "fix: normalize tribe artifacts from dataset scale"
```

### Task 3: Repair Neural Input Authority And Expand The Brain Contract

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/tribes.rs`
- Modify: `backend/genetic-neurosim/backend/src/frame_v1.rs`
- Modify: `backend/genetic-neurosim/backend/src/desktop_protocol.rs`
- Modify: `backend/genetic-neurosim/client-monogame/Protocol/SimulationFrame.cs`
- Modify: `backend/genetic-neurosim/client-monogame/Protocol/FrameDecoder.cs`
- Modify: `backend/genetic-neurosim/client-monogame/Models/SimulationViewModel.cs`
- Test: new backend tests for input count and sensor activation

- [ ] **Step 1: Write the failing test for the 10-input genome initialization bug**

```rust
#[test]
fn seeded_tribes_compile_genomes_with_full_input_count() {
    let sim = crate::simulation::TribeSimulation::shared(Default::default());
    let sim = sim.read();
    for tribe in sim.tribes.iter().filter(|t| t.alive) {
        let genome = tribe.genome.as_ref().expect("genome");
        assert_eq!(genome.input_count(), crate::simulation::INPUT_COUNT);
    }
}
```

- [ ] **Step 2: Run test to verify current failure**

Run:
```powershell
cargo test seeded_tribes_compile_genomes_with_full_input_count --manifest-path backend\genetic-neurosim\backend\Cargo.toml
```

Expected: FAIL because `Genome::new(8, 3)` is still used.

- [ ] **Step 3: Replace hardcoded input arity and define the new sensor set**

```rust
pub const INPUT_COUNT: usize = 12;
pub const OUTPUT_COUNT: usize = 8;

pub const INPUT_LABELS: [&str; INPUT_COUNT] = [
    "food_ratio",
    "pop_ratio",
    "territory_pressure",
    "feed_risk",
    "a_combat",
    "a_risk",
    "a_resource",
    "a_map_objective",
    "a_team",
    "nearest_rival",
    "nearest_ally",
    "dispute_pressure",
];
```

- [ ] **Step 4: Replace all hardcoded genome constructors**

```rust
tribe.genome = Some(crate::simulation::Genome::new(INPUT_COUNT, OUTPUT_COUNT));
```

- [ ] **Step 5: Add neural outputs that map to action scoring**

```rust
pub const OUTPUT_LABELS: [&str; OUTPUT_COUNT] = [
    "forage_score",
    "expand_score",
    "migrate_score",
    "war_score",
    "ally_score",
    "merge_score",
    "hold_score",
    "risk_commit_score",
];
```

- [ ] **Step 6: Expose the richer brain data to C#**

```csharp
public sealed record TribeBrainSnapshot(
    float[] Inputs,
    float[] Outputs,
    string[] InputLabels,
    string[] OutputLabels
);
```

- [ ] **Step 7: Run tests and protocol compile checks**

Run:
```powershell
cargo test --manifest-path backend\genetic-neurosim\backend\Cargo.toml
dotnet build backend\genetic-neurosim\client-monogame\TribalNeuroSim.Client.csproj
```

Expected: PASS, with full input/output arity enforced.

- [ ] **Step 8: Commit**

```bash
git add backend/genetic-neurosim/backend/src/simulation.rs backend/genetic-neurosim/backend/src/tribes.rs backend/genetic-neurosim/backend/src/frame_v1.rs backend/genetic-neurosim/backend/src/desktop_protocol.rs backend/genetic-neurosim/client-monogame/Protocol/SimulationFrame.cs backend/genetic-neurosim/client-monogame/Protocol/FrameDecoder.cs backend/genetic-neurosim/client-monogame/Models/SimulationViewModel.cs
git commit -m "feat: make neurosim brain consume full sensors and action outputs"
```

### Task 4: Replace Fake Migration With A Real Territorial Relocation Mechanic

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/world.rs`
- Modify: `backend/genetic-neurosim/backend/src/events.rs`
- Modify: `backend/genetic-neurosim/client-monogame/Models/SimulationViewModel.cs`
- Modify: `backend/genetic-neurosim/client-monogame/GameRoot.cs`
- Test: backend movement/migration tests

- [ ] **Step 1: Write the failing migration test**

```rust
#[test]
fn migrating_tribe_changes_target_and_relocates_when_origin_is_nonviable() {
    // Arrange a starving tribe with a better reachable tile.
    // Act for N ticks.
    // Assert main_camp_tile changes and behavior exits Migrating.
}
```

- [ ] **Step 2: Add explicit migration fields**

```rust
pub struct TribeState {
    pub migration_target_tile: Option<u16>,
    pub migration_progress_tile: Option<u16>,
    pub migration_reason_code: u8,
}
```

- [ ] **Step 3: Implement destination scoring**

```rust
score =
    food_potential * 0.35
  + safety_score * 0.20
  + expansion_headroom * 0.20
  + water_access * 0.10
  + ally_support * 0.05
  - rival_pressure * 0.20
  - distance_cost * 0.15;
```

- [ ] **Step 4: Implement per-tick migration progression**

```rust
if tribe.behavior == BehaviorState::Migrating {
    if let Some(next_tile) = self.next_step_toward_target(tribe_idx) {
        tribe.main_camp_tile = next_tile;
        tribe.migration_progress_tile = Some(next_tile);
    }
}
```

- [ ] **Step 5: Emit and render migration state**

```rust
MigrationStarted = 60,
MigrationStep = 61,
MigrationSettled = 62,
MigrationAborted = 63,
```

```csharp
public ushort? MigrationTargetTile { get; init; }
public ushort? MigrationProgressTile { get; init; }
```

- [ ] **Step 6: Run tests**

Run:
```powershell
cargo test migration --manifest-path backend\genetic-neurosim\backend\Cargo.toml
dotnet build backend\genetic-neurosim\client-monogame\TribalNeuroSim.Client.csproj
```

Expected: migrating tribes physically move and settle or abort.

- [ ] **Step 7: Commit**

```bash
git add backend/genetic-neurosim/backend/src/simulation.rs backend/genetic-neurosim/backend/src/world.rs backend/genetic-neurosim/backend/src/events.rs backend/genetic-neurosim/client-monogame/Models/SimulationViewModel.cs backend/genetic-neurosim/client-monogame/GameRoot.cs
git commit -m "feat: implement real tribe migration mechanics"
```

### Task 5: Make Disputes, War, Alliances, And Mergers Resolve Fast And Brutally

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/war.rs`
- Modify: `backend/genetic-neurosim/backend/src/events.rs`
- Modify: `backend/genetic-neurosim/docs/neural_network_05-10_state.md`
- Test: backend diplomacy/combat/dispute tests

- [ ] **Step 1: Write the failing dispute-escalation test**

```rust
#[test]
fn disputed_tile_cannot_remain_in_passive_acceptance_forever() {
    // Arrange two tribes contesting a tile.
    // Advance enough ticks.
    // Assert one of: war, alliance, retreat, merger.
}
```

- [ ] **Step 2: Replace passive indefinite disputes with timed escalation**

```rust
const DISPUTE_GRACE_TICKS: u32 = 120;

if dispute_age > DISPUTE_GRACE_TICKS {
    if ally_score > 0.62 && both_high_team {
        Action::ProposeAlliance
    } else if war_score > 0.55 || surrounded {
        Action::DeclareWar
    } else {
        Action::ForcedRetreat
    }
}
```

- [ ] **Step 3: Fix combat formula semantics**

```rust
attacker_strength = pop_a as f32 * a.stats.a_combat * noise;
defender_strength = pop_b as f32 * b.stats.a_combat * noise * biome_bonus * homeland_bonus;
```

- [ ] **Step 4: Reduce passive dwell and increase early-game tempo**

```rust
const ALLIANCE_CHECK_INTERVAL: u64 = 15;
const MERGER_ELIGIBILITY_TICKS: u32 = 120;
const PEACE_TIMEOUT_TICKS: u32 = 160;
const OCCUPY_TIMEOUT_TICKS: u32 = 80;
```

- [ ] **Step 5: Add surrounded-tribe escalation**

```rust
if no_neutral_tiles && food_ratio < 0.4 {
    surrounded_pressure += 1;
    if surrounded_pressure > 40 {
        force_action_bias = Action::DeclareWar;
    }
}
```

- [ ] **Step 6: Run tests**

Run:
```powershell
cargo test dispute --manifest-path backend\genetic-neurosim\backend\Cargo.toml
cargo test war --manifest-path backend\genetic-neurosim\backend\Cargo.toml
```

Expected: disputes resolve, wars use `a_combat` on both sides, early consolidation starts before tick 200.

- [ ] **Step 7: Commit**

```bash
git add backend/genetic-neurosim/backend/src/simulation.rs backend/genetic-neurosim/backend/src/war.rs backend/genetic-neurosim/backend/src/events.rs backend/genetic-neurosim/docs/neural_network_05-10_state.md
git commit -m "feat: accelerate dispute, war, alliance, and merger resolution"
```

### Task 6: Replace Drift With Real Selection, Fitness, Crossover, And Lineage Integration

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/lineage_registry.rs`
- Modify: `backend/genetic-neurosim/backend/src/tombstone.rs`
- Modify: `backend/genetic-neurosim/backend/src/events.rs`
- Modify: `backend/genetic-neurosim/docs/Tribal NeuroSim v3_ Offspring Mechanics & Evolutionary Lineage.md`
- Test: backend generation/fitness tests

- [ ] **Step 1: Write the failing generation-boundary test**

```rust
#[test]
fn generation_boundary_applies_selection_not_uniform_mutation() {
    // Arrange tribes with clearly different outcomes.
    // Advance generation.
    // Assert survivors do not all receive identical mutation-only treatment.
}
```

- [ ] **Step 2: Define explicit tribe fitness**

```rust
fitness =
    survival_score * 0.25
  + territory_score * 0.20
  + population_health * 0.15
  + food_stability * 0.15
  + war_success * 0.10
  + merger_success * 0.10
  + resilience_score * 0.05;
```

- [ ] **Step 3: Replace uniform mutation with ranked selection**

```rust
let mut alive: Vec<_> = self.tribes.iter().enumerate().filter(|(_, t)| t.alive).collect();
alive.sort_by(|a, b| b.1.fitness.partial_cmp(&a.1.fitness).unwrap());

let elite_count = (alive.len() / 5).max(1);
```

- [ ] **Step 4: Implement alliance/merger crossover**

```rust
fn crossover_governing_genome(governor: &Genome, partner: &Genome) -> Genome {
    // Prefer fitter governing genes, but inherit stronger partner weights/stats where beneficial.
}
```

- [ ] **Step 5: Integrate lineage and tombstones into merger ancestry**

```rust
tribe.lineage.push(format!("merge-parent-{}", absorbed_cluster_id));
tribe.lineage.push(format!("fitness-{:.3}", tribe.fitness));
```

- [ ] **Step 6: Surface fitness and ancestry summaries to the client**

```csharp
public float FitnessScore { get; init; }
public int Generation { get; init; }
public int MergerLineageDepth { get; init; }
```

- [ ] **Step 7: Run tests**

Run:
```powershell
cargo test generation --manifest-path backend\genetic-neurosim\backend\Cargo.toml
cargo test lineage --manifest-path backend\genetic-neurosim\backend\Cargo.toml
```

Expected: generation boundaries use fitness, merger crossover is recorded, lineage/tombstones remain queryable.

- [ ] **Step 8: Commit**

```bash
git add backend/genetic-neurosim/backend/src/simulation.rs backend/genetic-neurosim/backend/src/lineage_registry.rs backend/genetic-neurosim/backend/src/tombstone.rs backend/genetic-neurosim/backend/src/events.rs backend/genetic-neurosim/docs/Tribal\ NeuroSim\ v3_\ Offspring\ Mechanics\ \&\ Evolutionary\ Lineage.md
git commit -m "feat: add tribe fitness, selection, crossover, and ancestry reporting"
```

### Task 7: Bring MonoGame Into Full Semantic Sync

**Files:**
- Modify: `backend/genetic-neurosim/client-monogame/Models/PlayableSimulation.cs`
- Modify: `backend/genetic-neurosim/client-monogame/GameRoot.cs`
- Modify: `backend/genetic-neurosim/client-monogame/UI/DebugHud.cs`
- Modify: `backend/genetic-neurosim/client-monogame/UI/SelectionPanel.cs`
- Modify: `backend/genetic-neurosim/client-monogame/UI/LineageInspectorPanel.cs`
- Modify: `backend/genetic-neurosim/client-monogame/UI/TombstonePanel.cs`
- Modify: `backend/genetic-neurosim/docs/taskrun/TaskM6Run.md`

- [ ] **Step 1: Mark `PlayableSimulation` as harness-only or remove production behavior authority**

```csharp
// Production network mode: all behavior data must come from Rust.
// PlayableSimulation may remain only for isolated visual or performance harnesses.
```

- [ ] **Step 2: Extend Selection/Debug UI to show the real brain and migration state**

```csharp
// Show:
// - input labels + values
// - output labels + values
// - migration target / progress
// - dispute pressure
// - fitness score
// - parent polity / constituent count
```

- [ ] **Step 3: Wire lineage/tombstone panels to network data**

```csharp
// Fetch:
// GET /api/lineage/resolve/{entityId}
// GET /api/lineage/seed/{entityId}
// GET /api/tombstones
```

- [ ] **Step 4: Build and smoke-test**

Run:
```powershell
dotnet build backend\genetic-neurosim\client-monogame\TribalNeuroSim.Client.csproj
```

Expected: client builds and visualizes Rust-only semantics cleanly.

- [ ] **Step 5: Commit**

```bash
git add backend/genetic-neurosim/client-monogame/Models/PlayableSimulation.cs backend/genetic-neurosim/client-monogame/GameRoot.cs backend/genetic-neurosim/client-monogame/UI/DebugHud.cs backend/genetic-neurosim/client-monogame/UI/SelectionPanel.cs backend/genetic-neurosim/client-monogame/UI/LineageInspectorPanel.cs backend/genetic-neurosim/client-monogame/UI/TombstonePanel.cs backend/genetic-neurosim/docs/taskrun/TaskM6Run.md
git commit -m "feat: sync monogame UI with authoritative rust simulation"
```

### Task 8: Validate The Whole System Against Thesis And Demo Goals

**Files:**
- Create: `backend/genetic-neurosim/docs/verification-2026-05-11-neural-sync.md`
- Modify: `backend/genetic-neurosim/docs/neural_network_05-10_state.md`
- Modify: `backend/genetic-neurosim/docs/tribe-behavior-diff.md`

- [ ] **Step 1: Define fixed validation scenarios**

```md
1. Two-tribe border war harness
2. Four-tribe dispute escalation harness
3. Six-tribe alliance and merger harness
4. Starvation-driven migration harness
5. Full dataset run to tick 200
6. Full dataset run to generation boundary
```

- [ ] **Step 2: Define required evidence**

```md
- input/output arity verified
- migration physically moves tribes
- nearest rival sensing affects action choice
- disputes never linger forever
- alliance and merger occur earlier than before
- fitness and crossover are observable in logs
- C# displays the same semantics Rust reports
```

- [ ] **Step 3: Run verification commands**

Run:
```powershell
cargo test --manifest-path backend\genetic-neurosim\backend\Cargo.toml
dotnet build backend\genetic-neurosim\client-monogame\TribalNeuroSim.Client.csproj
dotnet build backend\genetic-neurosim\client-monogame-tests\client-monogame-tests.csproj
```

Expected: green builds and documented runtime checks in the new verification note.

- [ ] **Step 4: Commit**

```bash
git add backend/genetic-neurosim/docs/verification-2026-05-11-neural-sync.md backend/genetic-neurosim/docs/neural_network_05-10_state.md backend/genetic-neurosim/docs/tribe-behavior-diff.md
git commit -m "docs: record neurosim neural sync verification"
```

## Self-Review

### Spec coverage

- Rust/C# authority split: covered by Task 1 and Task 7
- artifact normalization from database semantics: covered by Task 2
- input mismatch and richer neural decision system: covered by Task 3
- real migration: covered by Task 4
- dispute/war/alliance tempo and trapped tribes: covered by Task 5
- fitness/selection/crossover/lineage/tombstones: covered by Task 6
- client sync and visibility: covered by Task 7
- thesis/demo verification: covered by Task 8

### Placeholder scan

- No `TODO` or `TBD` placeholders intentionally left in the plan
- Remaining implementation details are constrained by concrete files, commands, and acceptance targets

### Type consistency

- Plan assumes `INPUT_COUNT`, `OUTPUT_COUNT`, `INPUT_LABELS`, and `OUTPUT_LABELS` remain authoritative in Rust
- C# consumer types are framed as snapshots/records, not a second simulation domain

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-neurosim-neural-sync.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
