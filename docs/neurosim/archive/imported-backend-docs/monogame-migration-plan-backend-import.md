# Tribal NeuroSim v3 MonoGame Migration Plan

## Status

Proposed.

## Purpose

This document defines the practical execution plan for migrating Tribal NeuroSim away from the browser frontend and into a standalone C# MonoGame application while keeping Rust as the simulation motor.

The goal is not just "new UI." The goal is to stabilize the simulation architecture, remove browser/runtime friction, preserve deterministic backend execution, define higher-level simulation entities in a modular C# domain model, and exchange simulation state over compact binary data.

## Decision Summary

We will:

- completely remove the browser cockpit from the NeuroSim runtime
- make C# MonoGame the canonical NeuroSim application shell
- define higher-level simulation element classes in C#
- define polity progression and merger semantics in C# using inheritance and composition where useful
- define artifacts in C#
- keep Rust responsible for neural-network background work, simulation stepping support, numeric-heavy processing, pathfinding support, event throughput, and binary data transport
- use the Node server as the required middleman between MonoGame and Rust
- exchange state and commands between C# and Rust using explicit versioned contracts
- support desktop launching through a `neurosim:` application model that opens the MonoGame app with the correct endpoint/session configuration

We will not:

- keep React/Next as any part of the primary NeuroSim runtime UI
- preserve the browser cockpit as a compatibility layer
- let browser constraints shape V3 decisions
- treat the four V3 mechanics and optimization markdowns as optional

The following four V3 guidance docs are non-negotiable implementation inputs:

- `docs/Tribal Neurosim v3_ Architecture & Mechanics Redesign.md`
- `docs/Tribal NeuroSim V3_ Territory & Expansion Mechanics.md`
- `docs/Tribal NeuroSim v3_ Offspring Mechanics & Evolutionary Lineage.md`
- `docs/Tribal NeuroSim v3 _ Information Theory Lineage Compression.md`

## Why This Direction Is Correct

The v2 post-mortem and the V3 guidance docs point to the same architectural truth:

- the main failure was not visual quality; it was state coherence
- the browser UI was good enough to reveal problems, but not a good long-term host for a heavy deterministic simulation
- higher-level simulation elements such as Tribe, City, Duchy, and Kingdom benefit from a modular C# object model
- the simulation needs stronger lifecycle control, memory discipline, and observability before it needs richer spectacle

MonoGame is therefore not just a renderer. It is the desktop host and domain-model layer for simulation element definitions, while Rust remains the high-performance simulation and neural execution backend.

## Architectural Target

### Core split

1. Rust Core Engine
   - simulation execution backend
   - tick loop support
   - ECS or SoA-style storage
   - neural-network background work
   - heavy numeric processing
   - pathfinding and world-processing support
   - binary snapshot/frame encoder
   - control/query API
   - event throughput and persistence support
   - memory-conscious execution within the 6 GB target budget

2. C# MonoGame Application
   - desktop host
   - `neurosim:` application entrypoint
   - simulation element class definitions
   - polity inheritance model
   - artifacts model
   - merge rules for tribe, city, duchy, kingdom, and higher formations
   - world-rule orchestration based on the V3 markdowns
   - camera
   - map rendering
   - entity rendering
   - overlays and debugging panels
   - input handling
   - frame decoding
   - user-issued control commands
   - GPU-side rendering optimizations where useful

3. Node.js Middle Layer
   - required application middleman
   - launch/bootstrap coordination
   - endpoint/session resolution for the desktop app
   - dataset bootstrap
   - export formatting
   - external storage integration
   - protocol mediation between MonoGame and Rust where needed

### Asset integration target

The runtime architecture must be prepared to consume the asset strategy defined in:

- `docs/tribal-neurosim-v3-asset-plan.md`

This means the system should not only render raw state. It should be designed so simulation state can map cleanly onto:

- biome-specific environment packs
- polity-tier settlement models
- artifact icons and symbols
- event markers
- faction insignia
- LOD variants
- instanced vegetation and prop sets

Asset integration is not just visual polish. It changes what metadata the runtime must expose and how the MonoGame client organizes rendering.

### Communication model

The long-term preferred runtime model is:

- the `neurosim:` URI launches the MonoGame application
- MonoGame resolves the configured Node endpoint from the `neurosim:` launch context
- MonoGame communicates with Node
- Node proxies or mediates traffic to Rust
- Rust streams binary frames and serves explicit commands behind the Node layer
- MonoGame owns application flow, visualization, domain objects, and operator tooling

Recommended integration order:

1. Keep the existing Rust server process model first.
2. Let MonoGame connect to Node during the first cutover.
3. Only evaluate FFI/DLL embedding later if process separation becomes the bottleneck.

This keeps the migration lower risk and preserves inspectability while we are still stabilizing mechanics and clarifying the C# to Rust responsibility split.

### Ownership model

This migration intentionally uses a hybrid ownership model.

C# owns:

- simulation element classes
- polity hierarchy semantics
- merge and inheritance structure
- artifact definitions
- application lifecycle
- renderer state models
- operator tools and inspection workflows

Rust owns:

- neural-network execution
- heavy per-tick computation
- compact world-state processing
- binary transport
- event streaming support
- memory-sensitive hot-path data structures

Shared contract:

- IDs
- enums
- artifact payloads
- polity tier identifiers
- binary frame schemas
- command schemas

This means we must maintain one explicit cross-language schema. The architecture only stays healthy if C# semantic definitions and Rust execution payloads stay version-locked.

Node is responsible for enforcing and routing that contract in the live application path.

The same applies to art-facing metadata. If the client is expected to render biome or polity-specific assets, the transport contract must carry the identifiers needed to choose them deterministically.

## Migration Principle

Use a decisive desktop cutover, but still preserve incremental validation where it helps.

The browser implementation has already paid for some important things:

- binary protocol experimentation
- control endpoint shape
- telemetry expectations
- world snapshot debugging concepts

We should preserve those wins while replacing the runtime shell around them. We should not preserve the cockpit itself.

## Non-Negotiable Engine Invariants

Before advancing V3 feature complexity, the C# plus Rust system must satisfy these invariants:

- a tribe or entity cannot be both dead and active
- wars terminate when participants die, merge, or lose contact
- migration intent must always resolve into either movement, a blocked result, or explicit cancellation
- food/resource spawning must be inspectable and reproducible
- every extinction must emit a reasoned event trail
- every frame must represent real world state, not UI-only intent
- lineage must be ID-based, not string-based
- state cleanup must be explicit and measurable
- C# class-level polity semantics and Rust execution payload semantics must not drift
- the non-negotiable V3 rules must be implemented, not sidelined

If any of these remain weak, new mechanics should wait.

## Execution Phases

## Phase 0: Freeze The Contract

Objective:
Define the C#-to-Rust contract before touching most UI work.

Deliverables:

- a versioned binary frame specification
- a small set of stable control endpoints/commands
- a minimal query surface for debugging
- a clear ownership table for Rust versus C#
- a shared schema for polity tiers, artifact payloads, and lineage references
- a Node mediation contract for how endpoints, sessions, and streaming are exposed to MonoGame
- an asset-facing metadata contract for biomes, polity tiers, visual states, and icon selection

Required outputs:

- `FrameV1` schema
- `ControlV1` command list
- `QueryV1` debug endpoints
- protocol version field in every streamed frame

Recommended `FrameV1` payload areas:

- simulation header
  - protocol version
  - world seed
  - generation
  - tick
  - paused/halted flags
  - active tribe count
  - active war count
- world summary
  - map width/height or hex radius metadata
  - biome/lightweight tile state counts
- tile payload
  - tile id or axial coordinate
  - biome type
  - food amount
  - occupier count
  - dispute flag
  - biome visual variant id if needed
  - resource structure markers if present
- tribe payload
  - tribe id
  - parent polity id if merged
  - polity tier
  - core tile
  - population
  - state
  - food reserve
  - artifact summary
  - selected visual color/banner id
  - settlement visual id
  - faction insignia id
- war payload
  - war id
  - attacker id
  - defender id
  - frontline or contested tile references
  - war visual state id
- event delta payload
  - recent event ids and compact types
  - event icon type

Commands that should survive the migration:

- pause
- resume
- step tick
- reset same seed
- restart with explicit seed
- inject food or intervention
- export run summary

Queries that should survive the migration:

- recent events
- tribe by id
- tribe lineage by id
- active wars
- world snapshot
- tile ownership snapshot
- run summary

Exit criteria:

- Rust can describe its state without any browser-specific assumptions
- C# can be implemented from the protocol spec alone
- the domain-model boundary between C# and Rust is explicit enough to avoid duplicate rule authoring
- the protocol already exposes enough metadata to support the first asset packs without redesign

## Phase 1: Slim The Rust Boundary

Objective:
Make the Rust backend transport- and execution-focused, and remove frontend-shaped assumptions from the simulation backend.

Tasks:

- audit `backend/genetic-neurosim/backend/src/main.rs`
- audit `simulation.rs`, `world.rs`, `tribes.rs`, `war.rs`, `events.rs`
- identify any packet shaping that exists only because the browser wanted it
- separate simulation snapshot structs from transport encoding
- separate control handlers from web-specific route naming
- separate Rust hot-path execution data from C# semantic class definitions

Recommended refactor targets:

- `SimulationSnapshot`
- `TileSnapshot`
- `TribeSnapshot`
- `WarSnapshot`
- `EventSnapshot`
- `LineageSnapshot`
- `RunSummarySnapshot`

These structs should be transport-agnostic. Encoding them into binary bytes is a separate step.

Rust should not be forced to mimic C# inheritance. Instead, Rust should consume compact tier/type identifiers and attribute payloads that C# defines at the semantic level.

Exit criteria:

- Rust can produce an application-ready snapshot independent of React/Three.js
- packet building is isolated and testable

## Phase 2: Build The MonoGame Shell

Objective:
Create the desktop host application and domain-model layer.

Suggested project layout:

- `clients/tribal-neurosim-monogame/`
  - `TribalNeuroSim.Client.csproj`
  - `Program.cs`
  - `GameRoot.cs`
  - `Net/`
- `Protocol/`
- `Models/`
- `Domain/`
- `Artifacts/`
- `Polities/`
- `Rendering/`
- `Assets/`
- `Content/`
- `UI/`
- `Input/`
- `Debugging/`

Suggested core MonoGame classes:

- `GameRoot`
  - MonoGame entry point
  - owns update/draw loop
  - owns application bootstrap from `neurosim:`

- `SimulationConnection`
  - manages Node socket/websocket lifecycle
  - reconnect policy
  - send commands
  - receive binary frames

- `FrameDecoder`
  - parses Rust binary packets into C# models

- `SimulationViewModel`
  - current decoded world state for rendering
  - separates network data from draw logic

- `SimulationDomainRegistry`
  - maps payload types from Rust into C# domain objects
  - owns tier/artifact registries

- `AssetRegistry`
  - maps biome ids, polity tiers, structure types, event types, and artifact ids to content assets

- `BiomeVisualProfile`
  - groups textures, props, and environmental dressing rules by biome

- `SettlementVisualProfile`
  - groups settlement assets by polity tier and biome adaptation

- `IconRegistry`
  - maps artifacts, events, diplomacy states, and warnings to icon content

- `ArtifactDefinition`
  - C# definition of artifact semantics

- `PolityBase`
  - abstract base class for shared polity behavior

- `Tribe`, `City`, `Duchy`, `Kingdom`
  - concrete domain entities
  - merger/inheritance semantics live here

- `LineageGraph`
  - C# representation of lineage relationships for inspection and analytics

- `WorldRenderer`
  - draws terrain, biome colors, tile overlays
  - resolves biome-specific terrain materials and prop rules

- `TerritoryRenderer`
  - draws ownership fills, borders, disputed zones

- `TribeRenderer`
  - draws camp markers, polity markers, banners, labels
  - resolves settlement tier assets and insignia

- `WarRenderer`
  - draws frontlines, contested tiles, active conflicts

- `CameraController`
  - pan, zoom, follow, semantic zoom thresholds

- `HudController`
  - top-level UI panels, telemetry, selected object details

- `SelectionSystem`
  - picking tiles, tribes, wars

- `DebugOverlay`
  - event feed, perf stats, protocol version, payload size
  - endpoint/session information from `neurosim:`

- `AssetDiagnostics`
  - reports missing asset bindings
  - reports fallback usage
  - helps verify biome and tier asset coverage

The first MonoGame milestone should look plain but be structurally correct.

Exit criteria:

- MonoGame can connect to Rust
- MonoGame can decode a live frame stream
- MonoGame can render map, tribes, and simple overlays
- operator can pause, resume, step, and inspect entities
- asset binding paths exist even if many assets are still placeholders

## Phase 3: Replace The Browser Runtime

Objective:
Make MonoGame the only NeuroSim runtime client.

Tasks:

- remove the current browser cockpit from the runtime workflow
- move all active simulation operation to the MonoGame client
- stop adding any NeuroSim runtime UI work in React
- remove or archive the browser renderer once the MonoGame replacement is functional

Recommended cutover sequence:

1. MonoGame renders the same core state the browser currently renders.
2. MonoGame supports the essential controls.
3. MonoGame supports event inspection and tribe selection.
4. `neurosim:` launches the desktop application against the expected Node endpoint.
5. Browser runtime is removed from the workflow.

Exit criteria:

- the team can run NeuroSim only through the desktop client
- the browser is no longer part of normal simulation debugging

## Phase 3.5: Decommission Legacy Web Infrastructure

Objective:
Remove old runtime infrastructure that will no longer be used after the desktop cutover.

Primary removal targets:

- `backend/genetic-neurosim/frontend/`
- the NeuroSim React page under `frontend/` that currently acts as the browser simulation surface
- browser-only websocket parsing and binary protocol helpers that exist only for the old cockpit
- browser-specific route wiring that only served the old NeuroSim UI

Tasks:

1. Identify which files are still needed for documentation versus runtime.
2. Remove the old runtime web frontend under `backend/genetic-neurosim/frontend/` once MonoGame has feature parity for core operation.
3. Remove the old NeuroSim React page from `frontend/` once the desktop flow is verified.
4. Delete browser-only protocol parsing code that no longer has any runtime consumer.
5. Remove stale UI assets, styles, and route registrations tied only to the old cockpit.
6. Update startup scripts so they launch Node, Rust, and MonoGame instead of browser tooling.
7. Update documentation so the official run path is the `neurosim:` desktop application flow.

Guardrails:

- do not remove dataset, analytics, or documentation assets that still serve the thesis workflow
- do not leave behind half-dead browser routes that imply the old cockpit still matters
- if a web artifact remains, it must have a clearly documented reason

Exit criteria:

- no browser simulation cockpit remains in the active runtime path, the button stays but it will open up the wired application
- old frontend folders are either removed or explicitly archived
- startup and developer instructions no longer mention the browser runtime

## Phase 4: Stabilize The Engine Before Fancy V3 Mechanics

Objective:
Fix the systemic failures exposed by v2 while implementing the non-negotiable V3 rules in a disciplined order.

Priority order:

1. Resource spawning correctness
2. Movement/pathfinding resolution
3. Tribe lifecycle cleanup
4. War lifecycle cleanup
5. Event bus completeness
6. Extinction summaries
7. Lineage registry persistence

Validation scenarios:

- tribe with no food nearby must either move, die, or log blocked movement
- extinct tribe must disappear from active arrays and all active wars
- paused simulation must remain interactive in the client
- repeated runs with same seed must reproduce core outcomes within deterministic rules

Exit criteria:

- no ghost wars
- no dead-but-rendered tribes
- no migrating-without-resolution limbo
- no zero-information extinctions

## Phase 4.5: Prepare The Asset Runtime

Objective:
Make sure the application can consume the planned art packs without renderer rewrites later.

Tasks:

1. Define stable asset identifiers for:
   - biome families
   - polity tiers
   - structure classes
   - artifact icons
   - event icons
   - diplomacy and war markers
2. Add fallback visual profiles so missing assets never break the client.
3. Prepare instancing paths for:
   - trees
   - rocks
   - repeated camp props
   - markers
4. Prepare LOD strategy for:
   - settlements
   - forests
   - population clusters
5. Keep material and texture loading organized by biome pack rather than by scattered ad hoc file references.
6. Ensure the simulation payload can request:
   - tribe tier visuals
   - biome variant visuals
   - event icon mapping
   - faction insignia mapping

Exit criteria:

- the MonoGame client can swap placeholder assets for real packs without structural changes
- the first biome-specific packs can be integrated cleanly
- missing assets degrade gracefully through fallback bindings

## Phase 5: Introduce V3 Mechanics In Safe Order

Objective:
Implement the full V3 rule set from the four non-negotiable markdowns without losing state coherence or the 6 GB memory target.

Required mechanic order:

1. Main camp plus adjacent claim model
2. Tile inspection and resource readability
3. Basic territorial expansion with hard ownership
4. Alliance and merger lifecycle
5. Tombstone ledger plus lineage inspection
6. Reproduction and parent-pointer lineage
7. Fractional control and disputed tiles
8. Higher polity tiers: city, duchy, kingdom, empire
9. Rebellion and civil war

This order is not a rejection of the V3 docs. It is the implementation sequence that gives the best chance of actually delivering all four documents correctly.

## MonoGame Data Model Guidance

These are application-side classes and domain-layer classes.

Recommended C# models:

- `WorldFrame`
- `WorldHeader`
- `TileViewState`
- `TribeViewState`
- `WarViewState`
- `EventViewState`
- `SelectionState`
- `CameraState`
- `ClientDiagnostics`

Recommended domain-layer classes:

- `SimulationArtifactSet`
- `ArtifactDefinition`
- `ArtifactModifier`
- `PolityBase`
- `Tribe`
- `City`
- `Duchy`
- `Kingdom`
- `Empire`
- `MergePolicy`
- `ExpansionPolicy`
- `LineageNode`
- `LineageRegistryView`

Recommended asset/runtime classes:

- `AssetRegistry`
- `BiomeVisualProfile`
- `SettlementVisualProfile`
- `StructureVisualProfile`
- `EventVisualProfile`
- `ArtifactIconProfile`
- `FactionInsigniaProfile`
- `LodPolicy`
- `InstanceBatchKey`
- `FallbackVisualProfile`

Renderer-side enums:

- `TribeState`
- `TileBiome`
- `TileDisputeState`
- `WarState`
- `PolityTier`

Do not allow C# and Rust to evolve separate incompatible truths. If C# defines a simulation concept, the Rust payload contract for that concept must be explicit and versioned.

## Protocol Recommendation

For the first MonoGame cutover, keep transport boring.

Recommended near-term choice:

- Rust Axum server remains
- Node remains the middleman
- MonoGame uses WebSocket or TCP socket client against Node
- binary little-endian frame format remains
- `neurosim:` URI launches the client with endpoint/session parameters

Why:

- easiest to verify
- easiest to debug with logs and packet captures
- lowest migration risk
- preserves current backend process model

Defer until later:

- direct FFI embedding
- shared memory transport
- deeper GPU-driven simulation offload

Those may become worthwhile later, but they are not the first bottleneck to solve.

GPU use inside MonoGame for rendering optimization is allowed and encouraged where it meaningfully improves draw performance within the 6 GB budget.

The client should be prepared from the beginning for:

- mesh instancing for repeated biome props
- texture atlases for UI icons and markers
- LOD swaps for settlements and forests
- shader-based territory, river, and dispute rendering
- placeholder-to-final asset swaps without code churn

## Node.js Role After Migration

Required position:

- middleman between MonoGame and Rust
- runtime endpoint/session broker
- launch/bootstrap coordinator for the `neurosim:` application model
- place for protocol adaptation if the desktop client and Rust evolve at different speeds

Expected duties:

- fetching or preparing dataset exports
- writing end-run analytics files
- formatting lineage/export reports
- launcher/bootstrap glue
- stream proxying or command proxying between MonoGame and Rust

## Validation Plan

Each migration phase should have explicit checks.

### Protocol validation

- same Rust frame decodes correctly in test harness and MonoGame
- malformed frame handling does not crash the client
- protocol version mismatch is surfaced clearly

### Engine validation

- serializable run summary after extinction
- tribe death always triggers cleanup
- active war count cannot exceed legal participant relationships without explanation
- resource map is non-zero and inspectable

### Render validation

- 500+ tribes render without frame hitching on normal camera movement
- zooming and selection stay responsive while simulation runs
- disputed tiles and borders render deterministically from the same data
- biome-specific assets load and fall back correctly
- polity-tier settlements resolve to the expected visual profile

### Research validation

- seed lineage can be traced for surviving and extinct tribes
- run summary can explain why major societies succeeded or failed
- simulation outputs remain framed as exploratory and data-seeded, not as direct proof of player psychology

## Risks And Mitigations

### Risk: Big-bang rewrite stalls progress

Mitigation:

- keep Rust server and protocol first
- build MonoGame against the existing live stream before deep engine rewrites

### Risk: C# and Rust drift into duplicated or conflicting mechanics

Mitigation:

- maintain one explicit shared schema
- keep semantic ownership and execution ownership documented
- add protocol/version checks for tiers, artifacts, and payload layouts

### Risk: Fractional territory explodes complexity

Mitigation:

- phase it in after hard-ownership territory is stable

### Risk: Browser removal also removes debugging visibility

Mitigation:

- event inspector, tile inspector, tribe dossier, and performance overlay are first-wave MonoGame tools

### Risk: Legacy frontend code lingers and keeps distorting architecture decisions

Mitigation:

- add an explicit decommission phase
- remove unused frontend/runtime code soon after desktop parity
- update scripts and docs so the team stops accidentally depending on old paths

### Risk: `neurosim:` launcher or desktop bootstrap becomes fragile

Mitigation:

- keep launch parameters simple
- support direct executable startup with explicit endpoint flags as a fallback
- log endpoint resolution and launch context in the desktop client

### Risk: Node middle layer becomes a bottleneck or single point of confusion

Mitigation:

- keep Node thin and well-scoped
- keep binary payloads compact end-to-end
- document whether Node is pass-through, proxy, or protocol adapter for each route

### Risk: Asset integration arrives late and forces renderer rewrites

Mitigation:

- define asset-facing metadata in the protocol early
- create asset registries and fallback bindings in the first MonoGame architecture pass
- organize assets by biome and polity tier from the start

## Recommended First 4 Concrete Work Items

1. Write and freeze `FrameV1`, `ControlV1`, and shared tier/artifact schemas.
2. Refactor Rust snapshot structs so packet encoding is isolated from execution logic and aligned to C# domain payloads.
3. Add asset-facing identifiers for biomes, polity tiers, events, and artifact visuals to the shared contract.
4. Scaffold the MonoGame client with `neurosim:` bootstrap, connection, frame decoding, core polity classes, asset registries, and basic hex rendering.
5. Add a desktop-first debug HUD with pause, resume, step, selected tile, selected tribe, Node endpoint status, Rust backend status, recent events, and asset fallback diagnostics.

If these first items are done well, the migration becomes real instead of aspirational.

## Final Position

The right V3 is not "v2 but prettier in C#."

The right V3 is:

- MonoGame as the desktop host and modular domain-model layer
- C# classes for tribes, cities, duchies, kingdoms, artifacts, and merge semantics
- Rust as the neural and execution backend
- Node as the required middleman and bootstrap layer
- explicit binary contracts
- a `neurosim:` application model instead of a browser cockpit
- strong lifecycle cleanup
- inspectable event-driven debugging
- lineage preserved by IDs
- full commitment to the four V3 markdowns
- feature growth paced by engine correctness

That gives us a system that is both more thesis-defensible and much more buildable.
