# NeuroSim Tribal Simulation Critical Redesign

## Document Role

This document is a critical redesign proposal for the current NeuroSim Tribal Simulation.

It is intentionally planning-only. It should guide the next implementation pass, not claim that the current simulation already satisfies the intended design.

The current version proves that a Rust backend can stream tribe frames into the premadegraph frontend. It does **not** yet deliver the intended tribal simulation experience: controlled experimentation, inspectable cluster behavior, territory-first visualization, biome strategy, war readability, or run-level event analysis.

## Core Diagnosis

The implementation currently behaves like a live status monitor for moving simulation state, not like a research-grade tribal strategy simulation.

The biggest problem is not visual polish. The deeper issue is that the simulation has no strong observation model. Important state either does not exist, is only partially implemented, or is not sent to the frontend. Because of this, the user cannot answer basic questions during a run:

- Which tribe controls which tiles?
- Why did a tribe migrate, starve, ally, or declare war?
- What territory is contested?
- Which biomes are strategically valuable?
- What did a tribe do over the last 100 ticks?
- Which cluster-derived traits explain a tribe's behavior?
- How did a tribe grow, collapse, absorb others, or lose ground?

Until those questions are answerable, the simulation cannot support thesis-facing interpretation or a convincing demo.

## Reference Baseline: The Original Genetic NeuroSim

The redesign should explicitly use the older project at:

```text
C:\Users\karol\OneDrive\Dokumentumok\mystuff\genetic-neurosim
```

as the quality baseline for the experience.

The interface standard should specifically follow:

```text
C:\Users\karol\OneDrive\Dokumentumok\mystuff\genetic-neurosim\DESIGN.md
```

much more strictly than the current premadegraph tribal page does. That design direction was chosen because it fits NeuroSim: cinematic, dark, technical, mission-control-like, and simulation-first. The redesign should treat it as the visual and interaction north star, not as loose inspiration.

That older NeuroSim was stronger in several important ways:

- it had a real full-screen simulation cockpit, not a small page widget
- it used a React Three Fiber viewport with orbit, pan, zoom, and reset view
- it rendered large populations through instancing
- it successfully targeted roughly 50,000 live agents without the interface falling apart
- it kept the hot path efficient through Rust-side simulation, Rayon parallelism where useful, compact binary WebSocket frames, and GPU instancing
- it had floating overlay panels for controls, analytics, and saved sessions
- it had runtime controls for mutation severity, tick rate, population, and generations
- it had session saving and replay controls
- it had live analytics charts with alive count, top fitness, and complexity
- it had clear run metadata: seed, replay mode, dirty recording state, active recording
- it had a coherent black/spectral-white visual language
- it treated the simulation as the main event, not as an embedded side panel

The tribal rewrite should not discard these strengths. It should translate them.

The old agent/food/poison model does not need to return as-is. The important thing to recover is the product architecture:

- full-screen immersive viewport
- strong control deck
- live analytics
- session/replay system
- camera controls
- compact high-performance binary protocol
- visual confidence and atmosphere
- inspection-oriented overlay panels
- visible genetic/neural evolution mechanics

The current premadegraph tribal page is a regression from that standard.

## Performance Standard From The Old System

The old NeuroSim was not only visually stronger. It was also technically more convincing.

It was designed around a demanding performance target: rendering and updating up to roughly **50,000 agents** in a live simulation. That worked because the architecture respected the data path:

- Rust owned the simulation loop
- independent agent updates and collision candidate generation used Rayon where appropriate
- spatial hashing reduced naive proximity checks
- WebSocket frames used compact binary data instead of JSON payloads
- the frontend decoded with `DataView` and typed arrays
- React Three Fiber rendered agents, food, and poison through `InstancedMesh`
- UI state updates were throttled so React did not fight the render loop

That is the standard the tribal rewrite should preserve.

The current tribal version is much smaller visually and behaviorally, yet it feels less capable. It streams a thin binary frame, but it does not use that efficiency to deliver a richer simulation surface. It also sends too little information to render the actual world state. In other words, the current version has the complexity cost of a custom protocol without the payoff of a high-density, inspectable simulation.

The redesign should be explicit: NeuroSim already proved that high-volume binary simulation streaming can work. The tribal version should not regress to a low-detail dot map. It should use the same optimization discipline to stream the right state:

- world snapshot
- tile ownership
- biome data
- territory deltas
- active wars
- event deltas
- tribe inspection snapshots
- analytics summaries

Optimization should serve readability. Binary transport is valuable because it makes a rich live simulation possible, not because it is impressive by itself.

## Interface Design Standard

The tribal simulation interface should follow the old NeuroSim `DESIGN.md` more strictly.

Required interface principles:

- full-screen cinematic simulation surface
- pure black or near-black background
- spectral white text and instrumentation
- uppercase technical labels with positive letter spacing
- sparse, high-confidence controls
- translucent overlays only where needed for readability
- no generic Material UI dashboard feeling
- no ordinary card-heavy admin layout
- no bright application-shell look
- no small embedded simulation widget
- no decorative panels that compete with the world
- simulation canvas as the dominant first-viewport element

The old design's SpaceX-inspired direction works because NeuroSim is not a CRUD page or analytics table. It is an experimental simulation cockpit. The interface should feel like a controlled live system, not like a generic web app that happens to contain a canvas.

For the tribal rewrite, the design language should be adapted rather than abandoned:

- the map becomes the cinematic background layer
- hex territory and terrain replace agent/food/poison particles as the primary spectacle
- overlays remain compact, dark, and technical
- charts should feel like instrumentation
- event logs should feel like mission telemetry
- controls should feel deliberate and operational
- text should stay concise, uppercase where appropriate, and visually disciplined

This does not mean every rule from the old SpaceX-inspired document must be copied blindly. The tribal simulation needs more controls and inspection than a landing page. But the mood, hierarchy, typography discipline, dark cockpit framing, and simulation-first composition should be preserved.

## What Was Lost In The Current Tribal Port

The current tribal implementation kept part of the Rust/WebSocket idea but lost the old NeuroSim experience.

Lost or weakened:

- React Three Fiber scene replaced by a flat Canvas2D map
- orbit/pan/zoom/reset camera replaced by a fixed 800x800 canvas
- control/analytics/session panels replaced by one small sidebar
- Chart.js live analytics removed
- saved session list removed from the page
- replay interaction removed from the page
- strong visual identity replaced by generic Material UI controls
- population-scale rendering replaced by a small dot layer
- the old 50,000-agent performance ambition is no longer visible in the experience
- the current binary frame is efficient but underpowered, because it omits the data needed for territory, biomes, wars, logs, and inspection
- run metadata reduced to tick, generation, and alive count
- action messages and user feedback mostly removed

The redesign should treat this as a product regression, not merely an incomplete feature list.

## Translation Rule From Old NeuroSim To Tribal NeuroSim

Old NeuroSim concepts should be mapped into tribal equivalents:

| Old NeuroSim | Tribal NeuroSim Equivalent |
|---|---|
| Agents | Tribes, occupied tiles, and optional citizen detail at zoom |
| Food/poison points | Biome resources, hazards, disease, scarcity zones |
| Fitness | Survival, territory share, war success, lineage persistence |
| Brain complexity | Strategy complexity, decision entropy, mutation depth |
| Agent brain | Tribe-level neural controller |
| Genome mutation | Tribe strategy mutation and inherited behavior drift |
| Innovation tracking | Traceable neural topology/strategy changes |
| Generation history | Tribe survival/growth history by generation |
| Saved sessions | Saved tribal runs with event timeline and map snapshots |
| Replay mode | Replayable tribal history with war/extinction jumps |
| God mode | Scenario intervention tools: resource blooms, droughts, disasters, mutation pulses, forced war/peace, selective culls |
| Orbitable 3D viewport | Full-screen hex world with pan/zoom, optionally 3D terrain extrusion |
| Cluster color | Tribe color and territory fill |

This keeps the emotional and technical strength of the old project while replacing the biological agent model with a territory-control tribal model.

## Current Implementation Problems

### 1. Run Controls Are Not Sufficient

The frontend currently exposes connection state, tick count, generation count, alive tribe count, a tick-rate slider, and a "God Mode" button.

Missing controls:

- pause and resume
- step one tick
- step one generation
- restart with same seed
- restart with new seed
- reset to dataset baseline
- save snapshot
- load snapshot
- replay timeline
- scrub through recorded events
- change active dataset or scenario preset
- inspect deterministic run metadata
- controlled intervention tools beyond killing half the population

This makes the run difficult to study. A user can watch the simulation happen, but cannot stop it at an interesting moment and investigate.

### 2. The Frontend Cannot Draw Real Territory

The backend tracks `TribeState.territory: Vec<u16>`, but the binary WebSocket frame only sends `territory_count`.

That means the frontend knows how many tiles a tribe owns, but not which tiles they are. It therefore cannot draw:

- controlled regions
- borders
- contested areas
- occupation zones
- tribe expansion paths
- territory loss
- captured territory
- strategic chokepoints

The frontend even contains a `tribeTerritory` map, but it is never populated from the frame. The intended territory layer is structurally impossible with the current protocol.

### 3. Biomes Exist In Rust But Not In The Viewer

`WorldGrid` has biome types and biome properties, but the frontend initializes every biome as plains:

- `biomeRef` starts as a `Uint8Array` filled with `0`
- no full world snapshot is sent
- no biome tile packet is decoded
- only food deltas are streamed

This is why the map reads as a flat green field. Forests, deserts, mountains, rivers, and swamps may exist in backend memory, but the visual interface cannot represent them.

### 4. The World Size Is Too Static

The current design assumes a fixed 2000x2000 world and 40x40 tile grid. That cannot be the final model.

The world must scale dynamically from:

- number of tribes
- cluster sizes
- total simulated population
- expected territory pressure
- target density
- scenario type
- selected seed

Five hundred clusters should not be squeezed into the same world scale as thirty clusters. Large clusters should not spawn under the same assumptions as tiny clusters. The map generator must create enough space, resources, conflict zones, and expansion room for the chosen dataset/scenario.

The fixed grid should be treated as a prototype constant, not a thesis-facing design decision.

### 5. Hex Territory Is The Correct Representation, Not Dots

The current cluster representation is small colored state dots on square tiles. This does not communicate tribal control.

The intended representation should be territory-first:

- each tribe controls visible hex tiles
- tile fill shows owner
- tile border shows contested frontier
- tile texture/color shows biome
- zoomed-out view emphasizes territory share
- zoomed-in view reveals occupants, war fronts, resources, and current actions

Dots may still exist, but only as a detail layer. They should not be the primary representation of a tribe.

### 6. No Semantic Zoom

The simulation needs different information at different zoom levels.

Current view:

- one fixed 800x800 canvas
- one visual scale
- dots and tiny labels always rendered the same way

Required view:

- strategic zoom: hex territory, tribe colors, borders, dominance share
- operational zoom: biomes, resources, rivers, chokepoints, active front lines
- tactical zoom: occupied tiles, battle sites, citizen clusters, movement arrows
- inspection zoom: selected tribe details, local neighbors, decision history

Without semantic zoom, the simulation becomes cluttered at high tribe counts and meaningless at low detail.

### 7. War Is Not Readable

War currently appears mostly as a red state dot.

Missing war representation:

- attacker and defender labels
- target tribe
- casus belli
- battle location
- front line
- contested tiles
- casualties per combat round
- war duration
- peace/surrender outcome
- territory transfer
- absorbed lineage
- alliance participation

War should be a visible territorial event, not a color change.

### 7. No Event Log Or Tribe Action Journal

The simulation has internal lineage strings, but no structured event stream.

The UI needs both:

1. A global event log for the whole run.
2. A per-tribe action journal for selected tribes.

The per-tribe journal is mandatory. Without it, the simulation cannot support conclusions about why a tribe survived, collapsed, migrated, expanded, formed alliances, or lost wars.

Important events should include:

- spawn
- settle
- forage
- migrate
- claim tile
- lose tile
- enter starvation
- declare war
- combat round
- sue for peace
- form alliance
- break alliance
- occupy territory
- absorb tribe
- unlock bridges
- unlock boats
- mutate at generation boundary
- collapse or go extinct

Without logs, the user cannot understand what each individual tribe is doing in the run.

Without per-tribe logs, the project cannot defend any tribe-level interpretation. A final territory map is not evidence by itself; the run needs an auditable sequence of actions and state changes for each tribe.

### 8. Tribe Inspection Is Missing

A user should be able to click any tribe or tile and inspect it.

Minimum selected-tribe panel:

- cluster id
- population
- territory count and territory share
- current behavior state
- current goal
- current target
- ally or enemies
- food stores
- biome composition of territory
- combat/resource/risk/map/team stats
- latest neural inputs and outputs
- founder lineage summary
- recent events
- wars participated in
- tiles gained/lost

Current UI only shows aggregate run counters and a legend.

### 9. Neural Inputs Are Too Placeholder-Like

The state machine currently fills nearest enemy distance and nearest ally distance with fixed `0.5` placeholders.

That weakens the NEAT layer because tribes do not actually sense:

- nearby enemies
- nearby allies
- food gradients
- biome risk
- territory pressure
- contested borders
- starvation threats
- war opportunity

If neural decisions are part of the thesis/demo story, the inputs must represent real world state.

### 9A. The Genetic/Neural Layer Is Not Visible Enough

This is supposed to be a **Genetic NeuroSim**, not only a tribal territory simulator.

Each tribe's neural network should be one of the main subjects of the interface and experiment design. Currently, the neural layer is mostly hidden behind behavior states and three output drives. The user cannot inspect:

- the active neural inputs
- the output activations
- the tribe's current decision vector
- the genome structure
- mutation history
- inherited strategy changes
- brain complexity
- selection pressure
- fitness criteria
- parent/offspring strategy lineage
- why one tribe's strategy outcompetes another

If the neural networks are not inspectable, then the simulation becomes a hand-coded state machine with hidden random mutation. That is not enough for the intended NeuroSim identity.

The redesign must make tribe brains visible and analyzable.

### 10. Migration Is Not A Real Mechanic Yet

The state machine can transition to `Migrating`, but migration is not implemented as meaningful movement, path selection, or territory change.

A real migration system should define:

- destination tile
- reason for migration
- path cost
- biome movement cost
- river crossing cost
- abandonment or retention of old territory
- arrival condition
- new claim behavior
- migration log events

Currently, migration risks becoming a dead or visually empty state.

### 11. Territory Growth Is Underdeveloped

Tribes start with one tile. Territory mostly changes through absorbing a defeated tribe.

This is too thin for a territory-control simulation. Tribes need ordinary tile expansion mechanics:

- claim adjacent neutral tiles
- strengthen owned tiles
- contest enemy border tiles
- occupy defeated tiles
- abandon unsustainable tiles
- lose tiles under starvation or war
- split territory pressure across fronts

Territory must evolve continuously, not only after extinction.

### 12. Terrain Has Little Strategic Meaning

Biome properties exist, but because migration and territory occupation are weak, terrain has limited strategic impact.

Terrain should affect:

- food production
- movement cost
- defense
- disease/population drain
- visibility/scouting
- fortification value
- war outcomes
- migration routes
- settlement desirability

The map should make these effects legible visually and through logs.

### 13. River Crossing Is Currently A Proxy

River technology is not tied to actual river adjacency or crossing behavior. The implementation uses territory size as a proxy for being near a river, and `river_crossings` is not a real movement counter.

This should be replaced with:

- actual adjacency checks against river tiles
- path decisions that include river crossings
- crossing events
- failed crossing or high-cost crossing outcomes
- bridge/boat unlock reasons
- visible river infrastructure on the map

### 14. Binary Protocol Is Too Thin

The current binary frame is efficient, but it is too narrow for the intended product.

This is especially frustrating because the old NeuroSim already demonstrated the correct principle: binary streaming can support very large live simulations when the payload is designed around what the renderer and analysis panels actually need.

It sends:

- tick
- generation
- alive tribe records
- changed food tiles

It does not send:

- biome map
- tile ownership
- tile contested state
- tile occupation intensity
- current centroid/position
- target tribe
- ally tribe
- active wars
- event deltas
- selected tribe detail
- world seed metadata

The next version needs a versioned protocol with separate snapshot and delta messages.

The target should not be "use binary because the old project used binary." The target should be "use binary to make a high-density, inspectable territorial simulation smooth."

### 15. No Validation Surface

The current UI does not expose enough data to validate whether mechanics are working.

Validation requires:

- known seed replay
- deterministic run metadata
- small hand-checkable scenario presets
- event logs that explain state transitions
- per-tribe debug inspection
- serializable snapshots
- comparison between expected and observed territory changes

Without these, bugs in war, migration, food, or evolution can hide behind moving dots.

### 16. God Mode Is Too Narrow

The current "God Mode" only kills half the population. That is useful as a destructive stress test, but it is not enough for a simulation sandbox.

God Mode should become an intervention toolkit for controlled experiments and natural chaos events.

It should include:

- kill percentage of selected tribe or all tribes
- spawn food in selected region
- trigger drought in selected region
- trigger resource bloom in selected biome
- trigger disease outbreak in swamp or overcrowded regions
- trigger natural disaster on selected tiles
- force migration pressure from one area
- force two tribes into war
- force peace or ceasefire
- create or break alliance
- mutate selected tribe
- apply global mutation pulse
- spawn neutral resource objective
- freeze selected tribe
- boost selected tribe food or population for testing
- collapse selected bridge or river crossing

These interventions should be logged as run events so recorded sessions remain explainable.

The point is not to cheat the simulation. The point is to create reproducible stress tests and scenario probes.

## Redesign Goal

The redesigned NeuroSim should be a territory-first, inspectable, deterministic tribal simulation seeded by premadegraph cluster profiles.

The user should be able to watch the world at a strategic level, zoom into an active region, pause the run, click a tribe, inspect why it is acting, and read the event history that led to the current state.

The simulation should feel less like "many dots on a map" and more like "cluster-derived tribes competing for space, resources, and survival in a readable world."

## Target Experience

### Strategic View

The default view should show:

- hex map
- biome colors/textures
- tribe-controlled territory
- borders
- contested tiles
- active wars
- alliance links
- dominance ranking
- run controls
- global event feed

At this level, the user should immediately understand which tribes are large, which are collapsing, and where conflict is happening.

### Operational View

When zooming in, the map should reveal:

- tile food levels
- settlement strength
- occupation intensity
- migration arrows
- active battle markers
- river crossings
- local terrain effects
- territory ownership history

This view explains what the tribe is physically doing.

### Tribe Inspection View

Clicking a tribe opens a dossier:

- identity and cluster source
- cluster-derived starting profile
- current mutated profile
- population and food
- owned tile count
- biome breakdown
- current behavior and current goal
- latest neural inputs and outputs
- current target/ally/enemy
- recent event journal
- war history
- lineage/absorption history

This view explains why the tribe behaves the way it does.

### Replay And Analysis View

Recorded runs should support:

- pause
- resume
- step
- timeline scrub
- jump to next war
- jump to next extinction
- filter events by tribe
- compare tribe state across generations
- export run summary

This is essential for thesis discussion and debugging.

## Required Architecture Changes

### 1. Rebuild Around The Old NeuroSim Dashboard Pattern

Before adding details, restore the old product structure:

- full-screen simulation viewport
- top floating toolbar
- left live-session panel
- right control deck
- bottom analytics panel
- bottom/side saved-session and replay panel
- selectable overlays
- reset view
- live action message

The frontend does not need to remain Next.js if premadegraph stays Vite/React, but the component architecture should follow the old `NeuroSimDashboard` pattern.

The old dashboard should be treated as a reference design, not copied blindly:

- keep the cockpit structure
- keep analytics and session workflow
- adapt controls to tribal simulation
- replace agent instancing with hex/territory rendering
- replace fitness charts with tribe/world metrics
- preserve the old performance mindset: compact frames, typed-array decoding, GPU-friendly rendering, and throttled React state updates

### 2. Introduce A Versioned Simulation Protocol

Replace the single thin frame with typed messages.

Recommended message types:

| Message | Purpose |
|---|---|
| `WorldSnapshotV1` | Sent once on connect or reset. Contains map dimensions, hex layout, biome per tile, terrain properties, seed. |
| `RunStateV1` | Tick/generation/alive counts/halted/paused/current scenario. |
| `TileDeltaV1` | Changed owner, food, contested state, occupation, settlement strength. |
| `TribeDeltaV1` | Changed population, state, target, ally, centroid, stats, territory count. |
| `WarDeltaV1` | Active wars, battle sites, casualties, war state. |
| `EventDeltaV1` | Append-only structured event records. |
| `SelectedTribeSnapshotV1` | Full detail for an inspected tribe. |

The binary format can remain, but it needs a message header:

```text
u16 protocol_version
u16 message_type
u32 payload_length
u64 tick
payload bytes
```

This makes the protocol extensible without breaking the frontend every time one field is added.

### 3. Move To Hex Tile Coordinates

The map should use hexes because the intended mental model is territorial control.

Recommended representation:

- axial coordinates `(q, r)` internally
- stable `tile_id` for binary encoding
- neighbor lookup with six directions
- frontend renderer converts axial coordinates to pixels
- world dimensions expressed as hex width/height

Hexes improve:

- border readability
- territory shape
- combat front representation
- expansion mechanics
- strategic map feel

### 4. Build A Real Territory Model

Each tile should have its own state:

```text
tile_id
q
r
biome
food
owner_tribe_id
occupier_tribe_id
contested_by
settlement_strength
occupation_strength
last_changed_tick
```

Tribes should no longer own only a `Vec<u16>` without tile-level semantics. The world should be the authority for tile ownership, and tribes should cache territory counts for fast summaries.

### 5. Add Dynamic World Generation

The world generator should create a map based on cluster count, cluster size distribution, and scenario configuration.

Inputs:

- `tribe_count`
- `cluster_size_distribution`
- `total_initial_population`
- `target_tiles_per_tribe`
- `target_population_density`
- `resource_abundance`
- `conflict_intensity`
- `biome_profile`
- `world_seed`

Derived outputs:

- map width and height in hexes
- total tile count
- spawn regions
- biome regions
- resource distribution
- river/mountain/desert barriers
- neutral objectives
- expected starting density

Example scaling rule:

```text
target_tile_count =
  max(
    minimum_tile_count,
    tribe_count * target_tiles_per_tribe,
    total_initial_population / target_population_density
  )
```

The exact formula can change, but the principle should not: map size and resource layout are derived from the experiment, not hardcoded.

World generation should remain seeded and reproducible. Random world generation is welcome, but it must be deterministic from seed and recorded settings.

### 6. Add A Structured Event System

Create an append-only event bus in Rust.

Event fields:

```text
event_id
tick
generation
event_type
severity
tribe_id
other_tribe_id
tile_id
war_id
message_key
numeric_payload
```

The frontend can render user-facing text, but the backend should emit structured facts.

Event severity:

- debug
- info
- important
- critical

The UI should allow filtering by severity and selected tribe.

Every event should be indexable by tribe. Events involving two tribes should appear in both tribes' journals.

Required event indexes:

- global event stream by tick
- per-tribe event stream
- per-war event stream
- per-tile recent history

The per-tribe stream should be queryable even after a tribe goes extinct.

### 7. Implement Real Simulation Actions

Replace vague states with concrete actions.

Examples:

- `Forage(tile_id)`
- `ClaimTile(tile_id)`
- `MigrateTo(tile_id)`
- `Fortify(tile_id)`
- `DeclareWar(target_tribe_id, casus_belli)`
- `AttackTile(tile_id)`
- `DefendTile(tile_id)`
- `SueForPeace(war_id)`
- `FormAlliance(tribe_id)`
- `CrossRiver(tile_id)`

Behavior states can remain, but they should summarize active actions rather than hide them.

### 8. Make Genetic/Neural Mechanics First-Class

The tribe-level neural network should drive decisions, and the UI should expose enough of it to understand strategy.

Each tribe should have:

- genome id
- neural topology summary
- input vector
- output vector
- active action selected from outputs
- mutation history
- brain complexity
- strategy lineage
- fitness score
- selection outcome per generation

Recommended neural inputs:

- food reserve ratio
- population ratio
- territory saturation
- nearby food gradient
- local biome risk
- nearest enemy distance
- nearest ally distance
- visible enemy strength
- border pressure
- contested tile pressure
- war exhaustion
- alliance opportunity
- migration opportunity
- current biome advantage

Recommended outputs:

- forage intensity
- settle/fortify drive
- expansion drive
- migration drive
- aggression drive
- defense drive
- alliance drive
- retreat/peace drive
- risk tolerance
- exploration drive

The output layer should map to explicit actions such as `ClaimTile`, `MigrateTo`, `DeclareWar`, `DefendTile`, `FormAlliance`, or `SueForPeace`.

Mutation should affect both:

- neural connection weights
- neural topology, if NEAT-style mutation is retained

The system should track whether a generation improved through selection or merely drifted through random mutation.

### 9. Add Scenario Presets For Validation

Before testing with hundreds of real clusters, create deterministic toy scenarios:

| Scenario | Purpose |
|---|---|
| `two_tribes_one_border` | Verify war, tile contest, casualties, peace. |
| `river_crossing` | Verify river cost, bridges, boats. |
| `food_gradient_migration` | Verify migration toward better tiles. |
| `starvation_collapse` | Verify starvation, desperation, implosion. |
| `alliance_shared_enemy` | Verify alliance formation and joint war. |
| `apex_vs_large_resilient` | Verify thesis-relevant cluster contrast. |

These scenarios should be selectable from the UI and reproducible by seed.

## Implementation Phases

### Phase 0 — Freeze Current Version As Prototype

Goal: Stop treating the current implementation as the final NeuroSim v2.

Tasks:

- document current limitations
- keep current route/page as prototype if useful
- avoid thesis-facing claims from current screenshots
- rename current UI mentally as "tribal simulation prototype"

Definition of done:

- the team agrees that the current version is a backend streaming proof, not the final design

### Phase 1 — Restore The Old NeuroSim Cockpit Structure

Goal: Rebuild the page around the old NeuroSim dashboard experience before adding deeper simulation mechanics.

Reference files:

- `C:\Users\karol\OneDrive\Dokumentumok\mystuff\genetic-neurosim\frontend\components\neuro-sim-dashboard.tsx`
- `C:\Users\karol\OneDrive\Dokumentumok\mystuff\genetic-neurosim\frontend\lib\simulation-types.ts`
- `C:\Users\karol\OneDrive\Dokumentumok\mystuff\genetic-neurosim\frontend\lib\binary-protocol.ts`
- `C:\Users\karol\OneDrive\Dokumentumok\mystuff\genetic-neurosim\frontend\app\globals.css`
- `C:\Users\karol\OneDrive\Dokumentumok\mystuff\genetic-neurosim\DESIGN.md`

Frontend tasks:

- make the tribal simulation a full-screen cockpit
- restore floating overlay panels
- restore a top toolbar for panel visibility and reset view
- restore live-session metrics panel
- restore right-side run controls panel
- restore analytics panel
- restore saved sessions/replay panel
- follow the old `DESIGN.md` visual language strictly: black/spectral palette, uppercase technical labels, restrained overlays, cinematic simulation-first composition
- remove generic Material UI page styling from the core simulation surface

Backend tasks:

- expose enough status fields to populate old-style live session, analytics, and session panels
- include seed, replay mode, dirty recording state, and active recording in status
- preserve recording summary fields for saved tribal sessions

Definition of done:

- the tribal page again feels like NeuroSim, not like a small embedded MUI demo

### Phase 2 — Control Deck And Pause Semantics

Goal: Make the run controllable before adding visual complexity.

Backend tasks:

- add `paused` to simulation state
- add `pause`, `resume`, `step_tick`, `step_generation`, `reset`, and `restart_with_seed` endpoints
- make halted and paused separate states
- include `paused` in status
- preserve deterministic seed metadata

Frontend tasks:

- add pause/resume button
- add step tick button
- add step generation button
- add restart same seed
- add restart new seed
- replace single-purpose God Mode with an interventions menu
- display seed, tick, generation, paused/halted state

Definition of done:

- user can pause an active run, inspect it, step forward, and resume

### Phase 3 — World Snapshot And Biome Visibility

Goal: Make the map actually represent the backend world.

Backend tasks:

- emit `WorldSnapshotV1` on WebSocket connect
- include tile id, coordinates, biome, max food, move cost, defense bonus, disease rate
- keep food changes as deltas after snapshot

Frontend tasks:

- decode and store world snapshot
- draw biome map from backend data
- add biome legend
- show tile tooltip with biome stats

Definition of done:

- the frontend no longer assumes all tiles are plains
- rivers, mountains, deserts, forests, swamps, and plains are visible

### Phase 4 — Dynamic World Generation

Goal: Size and generate the world from the active dataset/scenario instead of forcing every run into a fixed 2000x2000 map.

Backend tasks:

- compute tribe count and cluster size distribution before world creation
- derive map dimensions from tribe count, total population, and target density
- expose world generation settings in run metadata
- generate seeded biome regions, barriers, resources, and spawn regions
- keep random generation reproducible from `world_seed`
- support scenario overrides for map size, density, resource abundance, and conflict intensity

Frontend tasks:

- read map dimensions from `WorldSnapshotV1`
- scale pan/zoom bounds to actual world size
- display world seed and generator settings
- avoid hardcoded 40x40 or 2000x2000 assumptions

Definition of done:

- a run with 30 tribes and a run with 500 tribes produce appropriately different map sizes, spawn density, and resource distribution

### Phase 5 — Hex Territory Layer

Goal: Replace dot-first representation with territory-first representation.

Backend tasks:

- introduce hex tile coordinate model or a hex-compatible tile abstraction
- track owner per tile
- emit tile owner deltas
- emit contested tile state
- emit tile occupation strength

Frontend tasks:

- render hex tiles
- color owned tiles by tribe
- draw borders between owners
- draw contested border style
- keep tribe dots/labels as secondary detail

Definition of done:

- zoomed-out simulation reads as tribe-controlled territory, not scattered dots

### Phase 6 — Tribe Inspection

Goal: Let the user analyze individual clusters and tribes.

Backend tasks:

- add selected tribe snapshot endpoint or WebSocket request/response
- expose cluster source, stats, mutated stats, current behavior, current action, targets, allies, enemies, territory, food, lineage, recent events
- avoid exposing raw PUUIDs in public UI unless explicitly allowed; use safe labels or aggregate founder summaries

Frontend tasks:

- click tribe or owned tile to select tribe
- show tribe dossier panel
- show territory share and biome composition
- show latest neural inputs/outputs
- show recent tribe action journal

Definition of done:

- user can click a tribe and understand what it is doing and why

### Phase 7 — Event Log And Run Narrative

Goal: Make the simulation explain itself.

Backend tasks:

- implement structured event bus
- emit event deltas over WebSocket
- store recent event ring buffer
- store per-tribe event index
- persist or snapshot full per-tribe logs for replay/export
- keep logs for extinct tribes
- add event filtering endpoint if needed

Frontend tasks:

- global event log
- selected tribe event log
- extinct tribe event log access from final rankings or timeline
- severity filters
- event type filters
- click event to focus map location/tribe

Definition of done:

- user can follow wars, migrations, alliances, collapses, occupations, neural changes, and tech unlocks through both global logs and per-tribe journals

### Phase 7A — Scenario Intervention Toolkit

Goal: Turn God Mode into a controlled experimental tool.

Backend tasks:

- replace or extend `/api/god-mode` with typed intervention requests
- support global interventions and selected tribe/tile/region interventions
- emit structured events for every intervention
- preserve intervention records in saved sessions and replay
- keep deterministic seed behavior understandable by recording all manual interventions

Intervention request examples:

```text
CullPopulation(scope, percent)
SpawnFood(region, amount)
Drought(region, duration)
ResourceBloom(region, duration)
DiseaseOutbreak(region, severity, duration)
NaturalDisaster(region, damage)
ForceWar(tribe_a, tribe_b, reason)
ForcePeace(war_id)
ForceMigration(tribe_id, target_region)
MutationPulse(scope, severity)
BoostTribe(tribe_id, food, population)
BreakAlliance(tribe_a, tribe_b)
```

Frontend tasks:

- add intervention menu to the control deck
- allow target selection from map or selected tribe panel
- show confirmation for destructive interventions
- show intervention result message
- add intervention filter in event log

Definition of done:

- user can create controlled chaos, resource changes, forced conflicts, and mutation events without losing replay explainability

### Phase 8 — Real Territory Actions

Goal: Make territory change continuously and meaningfully.

Backend tasks:

- implement claim adjacent tile
- implement fortify tile
- implement abandon tile
- implement contest enemy tile
- implement occupy captured tile
- implement migration destination and arrival
- update tile owner/occupier fields
- emit events for tile changes

Frontend tasks:

- animate tile claims
- show migration arrows
- show occupation markers
- show recent tile changes

Definition of done:

- tribe territory changes during normal play, not only after extinction

### Phase 9 — War Representation

Goal: Turn war into a visible territorial process.

Backend tasks:

- create `WarState`
- assign war id
- store attacker, defender, casus belli, start tick, battle tiles, casualties, status
- resolve battles around contested tiles
- emit war deltas and combat events

Frontend tasks:

- draw active war lines/fronts
- mark battle tiles
- show war cards in sidebar
- show casualties and duration
- show peace/occupation/absorption outcome

Definition of done:

- a user can identify who is fighting, where, why, and with what result

### Phase 10 — Meaningful Sensing And Decision Inputs

Goal: Make tribe decisions depend on real world state.

Backend tasks:

- replace fixed nearest enemy/ally placeholders
- compute nearest enemy distance
- compute nearest ally distance
- compute food gradient
- compute local biome risk
- compute border pressure
- compute visible enemy strength
- compute territory saturation
- log decision inputs for selected tribe

Frontend tasks:

- show selected tribe's decision input vector
- explain current action in terms of dominant inputs

Definition of done:

- neural/state-machine decisions are inspectable and based on actual simulation state

### Phase 11 — Genetic/Neural Evolution Layer

Goal: Make the "Neuro" and "Genetic" parts of Genetic NeuroSim visible, testable, and central.

Backend tasks:

- define the canonical tribe brain input vector
- define the canonical tribe brain output vector
- preserve NEAT-style genome mutation where practical
- track genome id per tribe
- track brain complexity per tribe
- track mutation events per generation
- track selection/fitness outcome per tribe
- expose latest inputs and outputs in selected tribe snapshots
- expose genome summary without requiring full graph rendering in every frame
- store brain history in replay/session data
- log every significant neural decision and mutation into the tribe's own journal

Frontend tasks:

- add a Brain tab to the selected tribe panel
- show latest input vector with labels and values
- show latest output vector with labels and values
- show selected action derived from outputs
- show brain complexity and mutation count
- show strategy history over generations
- show top evolved brains leaderboard
- show comparison between starting cluster profile and current evolved strategy
- show neural/mutation events inside the selected tribe journal

Definition of done:

- the user can click a tribe and inspect its neural decision state, mutation history, and evolutionary trajectory

### Phase 12 — Replay, Snapshots, And Analysis

Goal: Support research-style review of completed runs.

Backend tasks:

- snapshot full simulation state
- load snapshot
- save run metadata
- save event timeline
- save periodic tribe summaries
- add replay playback mode

Frontend tasks:

- replay scrubber
- jump to next war/extinction/alliance
- selected tribe timeline
- export run summary

Definition of done:

- a run can be paused, saved, replayed, inspected, and summarized

### Phase 13 — Dataset-Seeded Research Scenarios

Goal: Reconnect NeuroSim to the thesis scope in a defensible way.

Tasks:

- create `apex_vs_large_resilient` scenario
- create cluster-profile scenario selection
- compare compact high-performance clusters against larger resilient clusters
- record seed, dataset, cluster profile mapping, and run settings
- export summary metrics

Required metrics:

- survival ticks
- max territory share
- final territory share
- wars won/lost
- alliances formed
- tiles gained/lost
- starvation duration
- extinction cause
- absorption lineage

Definition of done:

- NeuroSim can produce reproducible exploratory outputs grounded in cluster profiles

## Frontend Layout Recommendation

The redesigned page should use a three-zone layout:

### Left Or Center: Map

- large responsive hex map
- pan and zoom
- semantic zoom layers
- hover tile tooltip
- click tribe/tile selection
- active war overlays

### Right: Inspection Panel

Tabs:

- Run
- Tribe
- Brain
- Wars
- Events
- Replay

The panel should update based on selection.

### Top Or Bottom: Control Deck

Controls:

- pause/resume
- step tick
- step generation
- speed
- reset
- restart seed
- scenario preset
- intervention menu
- snapshot
- replay

The controls should be compact and always accessible.

## God Mode / Intervention Design

God Mode should be renamed or reframed as **Interventions** in the serious UI. The old "God Mode" label can remain as an informal button label if desired, but the feature should behave like a scenario control system.

Intervention categories:

| Category | Examples | Purpose |
|---|---|---|
| Population | cull, boost, freeze, revive test tribe | Stress survival and collapse logic |
| Resource | spawn food, drought, resource bloom | Test foraging, settlement, migration |
| Terrain | disaster, river blockage, bridge collapse | Test pathing and territory adaptation |
| Diplomacy | force alliance, break alliance, force peace | Test social/war state transitions |
| War | force war, escalate war, end war | Test combat and occupation |
| Evolution | mutation pulse, lock mutation, trait boost | Test genetic adaptation |
| Scenario | apex challenge, famine season, border crisis | Create repeatable demo moments |

Every intervention must produce a structured event:

```text
event_type = intervention_applied
intervention_type
target_scope
target_ids
parameters
tick
generation
```

This keeps manual chaos scientifically honest. A replay should show exactly when the user intervened and what changed.

If an intervention targets a tribe, it must also be written into that tribe's own journal.

## Analytics To Recover From Old NeuroSim

The old project had live and generation analytics. The tribal version should restore that idea with new metrics.

Live chart candidates:

- living tribes
- total population
- controlled tiles
- contested tiles
- active wars
- active alliances
- extinction count
- starvation count
- average brain complexity
- mutation events

Generation chart candidates:

- max territory share
- average territory share
- top tribe population
- average survival duration
- wars per generation
- territory changes per generation
- average strategy complexity
- mutation count
- best tribe fitness
- average neural output entropy

Selected tribe chart candidates:

- population over time
- territory over time
- food reserves over time
- war casualties over time
- biome composition over time
- current profile drift from starting profile
- brain complexity over time
- aggression/resource/alliance output over time
- mutation history over time

The analytics panel should be a first-class part of the interface, not an afterthought.

## Genetic/Neural Simulation Requirements

The neural networks should be central to the simulation design.

Minimum requirements:

- every living tribe has a neural controller
- neural input and output schemas are documented
- decisions are traceable from inputs to outputs to selected action
- mutation events are logged
- generation boundaries record strategy changes
- fitness function is explicit
- selection pressure is measurable
- brain complexity is tracked
- replay preserves neural decisions and mutation events
- selected tribe inspection exposes brain state
- every tribe has its own persistent event journal

Possible fitness components:

- survival duration
- population growth
- territory growth
- food stability
- successful defense
- successful expansion
- war success
- alliance stability
- low collapse risk
- long-term lineage persistence

The fitness function should be documented as simulation logic, not as a claim about real League of Legends player quality.

Important distinction:

- `opscore`, `feedscore`, and cluster artifacts seed initial traits
- the neural network controls simulated decisions
- genetic evolution mutates and selects strategies inside the simulation
- simulation outcomes are exploratory model behavior

This keeps the ML/evolution layer honest and interpretable.

## Per-Tribe Logging Requirements

Each tribe must maintain an auditable journal from spawn to extinction or final survival.

The journal should answer:

- what did this tribe do?
- why did it do it?
- what changed in its state?
- what external events affected it?
- which neural outputs drove major decisions?
- which mutations happened?
- which wars and alliances changed its trajectory?
- why did it survive or die?

Required per-tribe log event categories:

| Category | Examples |
|---|---|
| Lifecycle | spawned, generation advanced, extinct, survived final tick |
| Resources | food gained, food shortage, starvation entered, resource bloom received |
| Territory | tile claimed, tile lost, tile contested, tile fortified, migrated |
| War | war declared, attacked, defended, casualties, peace, surrendered, occupied |
| Diplomacy | alliance formed, alliance broken, joint war, ceasefire |
| Neural | input snapshot, output decision, selected action, decision confidence |
| Genetic | mutation applied, topology changed, weight changed, fitness changed |
| Intervention | user cull, food spawn, drought, forced war, mutation pulse |
| Tech | bridge unlocked, boat unlocked, crossing completed |
| Lineage | absorbed tribe, founder contribution changed, descendants survived |

Storage model:

- keep recent per-tribe logs in memory for live inspection
- persist full logs in saved sessions
- include extinct tribes in replay/export
- support filtering by event type and severity
- include tick and generation on every entry

Frontend requirements:

- selected tribe journal tab or panel
- filter by event type
- jump from event to map tile/war/tribe
- show important events in compact timeline form
- expose extinct tribe logs from final rankings

Conclusion rule:

- no tribe-level conclusion should be written unless the corresponding tribe journal supports it

## Visual Standard To Recover

The old NeuroSim had a strong atmospheric identity: black background, spectral white text, uppercase labels, floating translucent panels, and simulation-first composition.

The tribal redesign should recover that identity by following the old `DESIGN.md` as the primary interface guide. The current MUI sidebar/card treatment should be considered temporary prototype styling.

The tribal map should adapt the old seriousness:

- dark full-screen world
- restrained overlays
- territory colors that stand out against biome terrain
- no generic card-heavy dashboard feel
- compact cockpit controls
- high-contrast event text
- charts styled like instrumentation
- map first, panels second

The visual goal is not "cute strategy game." It is "research cockpit for an evolutionary territorial simulation."

Specific style requirements:

- use black as the dominant background, not green map color as the entire visual field
- keep text near spectral white rather than generic gray/white app text
- use uppercase labels for cockpit controls and telemetry where readable
- use positive letter spacing for labels and compact headings
- keep overlays translucent and thin-bordered
- avoid high-radius cards and heavy filled panels
- avoid Material UI default visual language on the main simulation page
- let the map and live simulation occupy the emotional center of the screen

## Data Contract Priorities

Implement these in order:

1. status shape compatible with old cockpit panels
2. world snapshot
3. tile ownership delta
4. tribe detail snapshot
5. structured event delta
6. war delta
7. replay/snapshot data

Do not start by polishing the UI before these contracts exist. The current UI is weak mainly because the data contract is weak.

## Performance Requirements

The tribal redesign should inherit the old NeuroSim performance ambition.

Minimum expectations:

- binary protocol remains the default for live state
- full snapshots are sent only when needed
- per-tick updates are sent as deltas
- frontend stores world state in typed arrays or similarly compact structures
- rendering avoids React-per-tile or React-per-tribe DOM loops
- tile and territory rendering uses Canvas/WebGL/Three.js-friendly batching
- event logs are buffered and virtualized
- analytics updates are throttled
- high tribe counts remain interactive

Performance validation should report:

- tribe count
- tile count
- generated map dimensions
- target density and actual starting density
- active war count
- event throughput
- WebSocket frame size
- frontend FPS under load
- backend tick time
- CPU/thread configuration

The old 50,000-agent result should be treated as proof that the project can do serious real-time simulation when the architecture is disciplined. The new tribal version should aim for equivalent confidence, even though its entities are different.

## Memory And Low-Level Optimization Requirements

The redesigned NeuroSim should target a practical desktop memory budget of roughly **4-6 GB RAM** for the full running system.

This includes:

- Rust simulation backend
- WebSocket buffers
- frontend world state
- render buffers
- event logs
- replay/snapshot state
- analytics history
- operating overhead from the browser and Node/Express bridge

The simulation should be designed with a RollerCoaster Tycoon-like mindset: dense simulation state, low-level data layout discipline, careful update loops, compact IDs, deterministic ticks, and minimal waste. The goal is not to write clever low-level code everywhere. The goal is to keep the core simulation cheap enough that richer behavior does not collapse under memory pressure.

### Language Boundary

Rust should remain the default implementation language for the simulation core.

Reasons:

- memory safety without garbage collection
- strong control over allocation
- good performance for data-oriented systems
- Rayon support for safe parallelism
- easier integration with the existing Rust backend

C or C++ should only be considered for a very small isolated subsystem if profiling proves Rust cannot meet the target. That should be treated as an exceptional optimization step, not a starting point.

Python is allowed and may be necessary for ML workflows, but it should be used carefully.

Acceptable Python use:

- offline experiment analysis
- post-run report generation
- parameter search outside the live app
- training/tuning scripts that export static parameters
- notebook-style thesis exploration
- ML prototyping before porting stable logic into Rust
- offline model comparison and hyperparameter sweeps

Use caution with:

- per-tick Python calls
- Python in WebSocket frame construction
- Python driving live tribe decisions
- Python-side ML inference during the running simulation
- Python object graphs for replay/event storage

If Python ML tooling is needed, prefer exporting compact model, genome, coefficient, or config data consumed by Rust during live simulation.

Python can still be part of the project. The important boundary is that Python should not accidentally become the real-time engine unless that choice is explicitly benchmarked and justified.

### Data-Oriented State Layout

Avoid storing the world as nested objects with strings and heap allocations everywhere.

Preferred:

- struct-of-arrays or compact arrays for tile state
- stable numeric IDs for tribes, tiles, wars, events, genomes
- `u16`/`u32` IDs where safe
- compact enums with `repr(u8)` for states and biomes
- fixed-size records for hot-path data
- string tables for labels instead of repeated strings
- ring buffers for recent events
- separate cold debug data from hot simulation data

Example hot tile arrays:

```text
tile_biome: Vec<u8>
tile_owner: Vec<u32>
tile_occupier: Vec<u32>
tile_food: Vec<f32>
tile_flags: Vec<u16>
tile_settlement_strength: Vec<f32>
```

Example tribe arrays:

```text
tribe_population: Vec<u32>
tribe_food: Vec<f32>
tribe_state: Vec<u8>
tribe_home_tile: Vec<u32>
tribe_target: Vec<u32>
tribe_ally: Vec<u32>
tribe_brain_id: Vec<u32>
```

High-level structs can exist for APIs and snapshots, but the tick loop should not depend on heap-heavy nested objects.

### Logging Memory Discipline

Per-tribe logs are mandatory, but they must be memory-bounded.

Recommended model:

- in-memory recent ring buffer per tribe
- global recent event ring buffer
- append full logs to replay/session storage when saving
- compress or chunk old events
- store event type and IDs compactly
- resolve human-readable text in the frontend or export layer
- keep large narrative strings out of the hot path

Event payloads should prefer:

```text
event_type: u16
tick: u64
tribe_id: u32
other_id: u32
tile_id: u32
value_a: f32
value_b: f32
flags: u32
```

over repeated JSON-like structures during the live simulation.

### Genome And Neural Memory Discipline

The neural layer must be inspectable, but not wasteful.

Requirements:

- store genomes in compact Rust structs
- use genome IDs and shared references where possible
- avoid cloning full genomes every tick
- compile/calculate neural networks without repeated allocations
- cache compiled brain execution plans if useful
- separate full genome history from current live genome state
- log mutation summaries instead of storing full copies for every generation

Possible strategy:

- current genome: compact live representation
- mutation event: small diff record
- replay/export: reconstruct from seed + mutation diffs where practical
- selected tribe inspection: expand only the selected brain into detailed UI data

Do not render or serialize every full neural graph every frame.

### Frontend Memory Discipline

The frontend should not mirror the entire simulation as React component state.

Preferred:

- typed arrays for world/tile state
- refs for rapidly changing frame data
- throttled React state updates for panels and charts
- Canvas/WebGL/Three.js drawing from buffers
- virtualized event logs
- bounded chart history
- selected-entity detail fetched or expanded on demand

Avoid:

- one React component per tile
- one React component per tribe on the map
- storing every frame in browser memory
- unbounded event arrays in React state
- decoding binary frames into large nested JS objects every tick

### Replay And Snapshot Memory Discipline

Replay should not mean keeping every full world frame in memory.

Preferred:

- initial snapshot
- deterministic seed
- control/intervention events
- periodic keyframes
- compressed deltas
- event timeline
- optional export summary

For long runs, use chunked replay storage:

```text
run metadata
world snapshot
chunk 000: ticks 0-999
chunk 001: ticks 1000-1999
...
summary metrics
```

The live app should load only the chunk needed for playback.

### Memory Budget Validation

Every serious implementation pass should measure memory.

Required benchmark scenarios:

- small validation scenario: 5-10 tribes
- medium scenario: 100 tribes
- large scenario: 500 tribes
- stress scenario: high tile count, high event rate, active wars

Report:

- backend RSS memory
- frontend browser memory if measurable
- Node/Express memory
- tile count
- tribe count
- event count
- genome count
- replay buffer size
- average WebSocket frame size
- backend tick time
- frontend FPS

Definition of done:

- the large scenario remains usable within a 4-6 GB total RAM target
- memory growth is bounded during long runs
- event logs and replay do not grow without limit
- Python usage is intentionally bounded, benchmarked, and kept away from accidental per-tick bottlenecks

## Processor Optimization Requirements

CPU performance must be designed, measured, and protected. The simulation should not rely on "modern computers are fast" as an architecture plan.

The target is a smooth live simulation under large scenarios while leaving enough headroom for rendering, WebSocket streaming, logs, analytics, and user interaction.

### Fixed Tick Budget

Use a fixed simulation tick model with a measurable budget.

Track:

- tick duration
- world update duration
- tribe decision duration
- neural inference duration
- territory update duration
- combat update duration
- event/logging duration
- frame packing duration
- WebSocket broadcast duration

The simulation should expose these as debug metrics in development builds or an optional performance panel.

### Do Less Work Per Tick

Large simulations should avoid full-world scans whenever possible.

Preferred tactics:

- dirty tile lists
- active tribe lists
- active war lists
- active border lists
- changed food tile lists
- event queues
- staggered low-priority updates
- update intervals for expensive systems

Examples:

- food regeneration can run by biome chunk or dirty region, not necessarily every tile every tick
- alliance checks can run every N ticks
- expensive pathfinding can be cached or scheduled
- neural decisions can run at a lower frequency than rendering if needed
- territory border recomputation should update only changed regions

### Spatial Indexing

Avoid naive all-pairs checks between tribes, tiles, and wars.

Use:

- grid/hex chunk indexes
- per-chunk tribe occupancy
- frontier tile sets
- nearby enemy caches
- war-region indexes
- resource hotspot indexes

This is especially important for:

- nearest enemy/ally sensing
- border pressure
- combat target selection
- migration destination search
- food gradient search
- event-to-map focusing

### Parallelism Strategy

Prefer coarse-grained parallelism before fine-grained complexity.

Good candidates:

- independent tribe brain evaluations
- per-tribe decision scoring
- per-war combat resolution where wars do not overlap
- chunked food/resource updates
- analytics summarization
- scenario batch runs
- replay/export summarization

Be careful with:

- lock contention on shared world state
- nondeterministic event ordering
- parallel writes to tile ownership
- many tiny Rayon tasks
- cloning large state into worker closures

Parallel outputs must remain deterministic where thesis/replay reproducibility depends on them.

### Data Layout For CPU Cache

The hot path should be cache-friendly.

Preferred:

- contiguous arrays
- compact numeric fields
- dense active lists
- separate hot and cold data
- branch-light loops
- small enums
- stable indexing

Avoid:

- chasing nested `Vec<String>` or heap objects in the tick loop
- per-tick allocation
- repeated hash map lookups where array indexes would work
- compiling neural networks every tick if the genome has not changed
- rebuilding full frontend payloads when only deltas changed

### Neural Inference Optimization

The ML/neural layer must not dominate CPU cost.

Requirements:

- cache compiled neural networks
- recompute compiled form only after mutation
- batch tribe inference where practical
- keep input vectors fixed-size and stack/array-backed
- avoid dynamic allocation during inference
- optionally run brain inference every N ticks if behavior remains stable
- profile topology mutation separately from inference

If brain complexity grows, the simulation should track:

- average brain nodes
- average brain links
- inference time per tribe
- mutation time per generation
- top slowest brains

### Pathfinding And Territory CPU Budget

Pathfinding can become expensive quickly.

Rules:

- avoid full A* for every tribe every tick
- cache paths when target and terrain remain stable
- invalidate paths only when relevant tiles change
- use local greedy movement for cheap low-stakes actions
- reserve full pathfinding for migration, war, and river crossing decisions
- cap pathfinding jobs per tick
- queue remaining path jobs

For territory:

- maintain frontier sets incrementally
- update borders only around changed tiles
- cache biome composition per tribe and update by tile delta

### Rendering/Backend Separation

The backend should not slow down because the frontend wants richer visuals.

Rules:

- backend sends compact state, not drawing instructions
- frontend computes visual interpolation where possible
- high-frequency packets use deltas
- selected tribe detail is fetched separately or sent at lower frequency
- analytics summaries are throttled
- event text formatting happens outside the hot path

### Profiling Before C/C++

C or C++ should only be considered after profiling proves a specific Rust subsystem cannot meet the target.

Before considering C/C++:

- profile with release builds
- remove avoidable allocations
- improve data layout
- reduce algorithmic complexity
- use Rayon appropriately
- cache expensive results
- use typed arrays/binary deltas correctly
- check frontend bottlenecks

If C/C++ is used, keep it isolated:

- one narrow library
- clear FFI boundary
- no ownership ambiguity
- benchmark proving benefit
- Rust wrapper remains the public simulation interface

### CPU Performance Validation

Required reports:

- average tick time
- p95 tick time
- p99 tick time
- neural inference time
- event processing time
- frame packing time
- active war processing time
- pathfinding jobs per tick
- CPU utilization by thread
- Rayon thread count
- frontend FPS

Definition of done:

- large scenarios remain interactive
- tick time does not degrade uncontrollably over long runs
- parallel and serial deterministic checks match where required
- CPU bottlenecks are measured before adding low-level complexity

## Thesis-Safe Interpretation

NeuroSim should remain framed as an exploratory transfer experiment.

Valid phrasing:

- cluster-derived profiles produce different survival and expansion behavior under the chosen simulation rules
- compact high-performance clusters can be compared against larger resilient clusters in a shared environment
- the simulation demonstrates how graph/player profiles can seed agent-based experimentation

Avoid:

- claiming the simulation proves real player superiority
- claiming tribes represent actual psychology
- claiming war behavior maps directly to League behavior
- claiming outcomes are empirical evidence without discussing assumptions

## Immediate Next Work

The next implementation plan should not start with visual polish. It should start with observability and protocol repair.

Recommended next sequence:

1. Restore the old NeuroSim cockpit layout and visual standard.
2. Add pause/resume/step/reset controls.
3. Add dynamic world generation from tribe count, cluster sizes, and target density.
4. Send a world snapshot with biome data and generated map dimensions.
5. Send tile ownership data.
6. Render owned hexes as territory.
7. Restore analytics with tribal metrics.
8. Restore saved sessions and replay controls in the page.
9. Replace single-button God Mode with a serious intervention menu.
10. Add selected tribe inspection.
11. Add structured event log.
12. Implement real tile claiming and migration.
13. Implement visible war state.
14. Replace placeholder sensing inputs.
15. Make tribe neural networks inspectable and central.
16. Add genetic mutation/selection analytics.
17. Add deterministic validation scenarios.

## Final Standard

The redesign is successful only when a user can pause the simulation, click a tribe, see its controlled hexes, understand its current action, inspect its recent log, identify active wars, and replay the sequence of events that led to the current territorial map.

Anything less is still a prototype.
