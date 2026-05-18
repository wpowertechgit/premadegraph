# Tribal NeuroSim v3 MonoGame Next Task List

## Status

Active planning task list for the next implementation slice.

Created: 2026-05-05

## Source Documents Read

- `docs/neurosim/architecture/monogame-migration-plan.md`
- `docs/neurosim/architecture/desktop-contract-v1.md`
- `docs/neurosim/visual-assets/v3-asset-plan.md`
- `docs/neurosim/architecture/v3-architecture-and-mechanics-redesign.md`
- `docs/neurosim/mechanics/v3-territory-and-expansion-mechanics.md`
- `docs/neurosim/mechanics/v3-offspring-mechanics-and-evolutionary-lineage.md`
- `docs/neurosim/mechanics/v3-information-theory-lineage-compression.md`

## V3 Mechanics Constraints From The Full Document Set

The MonoGame client must be designed for these V3 mechanics, even while the current desktop V1 frame still wraps the legacy payload:

- Rust remains the simulation hot path and must not pass raw player-name strings through the tick loop.
- C# owns visualization, semantic domain models, dossiers, camera, overlays, and lineage/territory inspection views.
- Node remains the bridge for dataset bootstrap, query routing, local storage, end analytics, and lineage export formatting.
- Territory is not ultimately one tribe per tile; the final model needs main camp, claimed wilderness/outposts, disputed zones, and fractional tile control.
- Disputed tiles carry a documented `-40%` efficiency penalty and need visible client metadata.
- Diplomacy is binary for V3 purposes: total war or full alliance/merger.
- Societal progression must support tribe, city, larger regional polity, kingdom, and empire tiers.
- The current code uses `Duchy`, while one mechanics doc names `County`; this needs an explicit naming decision before schema freeze. Do not silently fork the concept.
- The five artifact roles are canonical: combat, resource tempo, map objective control, risk discipline, and team enablement.
- Reproduction and lineage must use numeric IDs, parent pointers, and a DAG/dictionary style representation instead of expanding strings.
- The Tombstone Ledger is required for dead tribes/entities and must be queryable later for end analytics.
- MonoGame should eventually support semantic zoom: far zoom territory/banners, close zoom settlements/resources/citizens/frontlines.

## Current Working Directory

- `backend/genetic-neurosim/client-monogame/`

## Current State Summary

The MonoGame client already has the right skeleton:

- launch option parsing for direct arguments and `neurosim:` URIs
- a `GameRoot` MonoGame shell
- Node WebSocket and HTTP control client wrappers
- a desktop V1 binary envelope decoder for `TNS3`
- a legacy tribal payload decoder
- a `SimulationViewModel` that can apply decoded frames
- C# domain enums for polity tiers, artifact roles, and biomes
- fallback-oriented asset registry scaffolding
- a large `Content/` tree with newly downloaded terrain, vegetation, structure, population, animation, and concept-art assets

The main missing piece is not more raw content. The next useful work is to make the downloaded assets addressable, diagnosable, and visible through the MonoGame runtime without drifting away from the V1 desktop contract.

## Next Implementation Recommendation

Start with an asset-runtime and live-client vertical slice that stays compatible with the V3 mechanics:

1. register real asset keys for the content that was downloaded today
2. add asset diagnostics so missing bindings are visible immediately
3. wire `GameRoot` to connect, receive, decode, and apply frames
4. add a minimal debug HUD so the desktop client proves the contract is alive
5. draw a simple map/tribe layer using fallback colors first
6. add client-side model placeholders for future fractional tile control, lineage queries, and tombstone-ledger diagnostics before the protocol depends on them
7. only then start loading actual 3D/texture assets into renderers

This keeps the work aligned with the migration plan: contract first, diagnostics early, visuals as a result of stable runtime data.

## Task List

### Task TNS3-MG-01: Asset Manifest And Stable Keys

Status: completed on 2026-05-05.

Goal:
Create a code-facing manifest of the downloaded assets so render systems can refer to stable keys instead of ad hoc file paths.

Files:

- Modify: `backend/genetic-neurosim/client-monogame/Assets/AssetRegistry.cs`
- Optional create: `backend/genetic-neurosim/client-monogame/Assets/AssetKey.cs`
- Optional create: `backend/genetic-neurosim/client-monogame/Assets/AssetManifest.cs`

Steps:

- [x] Define stable key conventions for terrain materials, vegetation props, structures, population markers, concept art, and fallback visuals.
- [x] Register biome visual profiles for all current `BiomeId` values.
- [x] Map at least one terrain material and two to five prop keys per biome where available.
- [x] Register settlement fallback profiles for `Tribe`, `City`, `Duchy`, `Kingdom`, and `Empire`.
- [x] Keep keys content-relative and extension-free where possible.
- [x] Do not load heavy model content yet.

Acceptance:

- Every `BiomeId` resolves to a non-unknown `BiomeVisualProfile`.
- Every `PolityTier` resolves to a settlement profile.
- Missing assets still resolve through documented fallback keys.

### Task TNS3-MG-02: Asset Diagnostics

Status: completed on 2026-05-05.

Goal:
Make missing or fallback asset bindings visible before full rendering work begins.

Files:

- Create: `backend/genetic-neurosim/client-monogame/Assets/AssetDiagnostics.cs`
- Modify: `backend/genetic-neurosim/client-monogame/Assets/AssetRegistry.cs`
- Optional modify: `backend/genetic-neurosim/client-monogame/README.md`

Steps:

- [x] Add diagnostics that count registered biomes, settlement profiles, icon bindings, and fallback usages.
- [x] Add a method that validates expected biome and polity coverage.
- [x] Report missing profiles as structured diagnostic records.
- [x] Keep diagnostics independent from MonoGame draw logic.

Acceptance:

- A caller can ask the registry for a diagnostic summary.
- Missing biome, settlement, or icon bindings are reported without crashing the client.

### Task TNS3-MG-03: Background Frame Receive Loop

Status: completed on 2026-05-05.

Goal:
Turn the client skeleton into a live desktop consumer of the Node frame stream.

Files:

- Modify: `backend/genetic-neurosim/client-monogame/GameRoot.cs`
- Modify: `backend/genetic-neurosim/client-monogame/Net/SimulationConnection.cs`
- Optional create: `backend/genetic-neurosim/client-monogame/Net/SimulationFrameReceiver.cs`
- Optional modify: `backend/genetic-neurosim/client-monogame/Models/ClientDiagnostics.cs`

Steps:

- [x] Connect to `LaunchOptions.NodeWebSocketEndpoint` during initialization or first update.
- [x] Receive binary frames on a background task.
- [x] Decode frames with `FrameDecoder`.
- [x] Apply decoded frames to `SimulationViewModel` safely from the game loop.
- [x] Track connection state, last frame tick, last frame byte count, and last decode error.
- [x] Make disconnects visible but non-fatal.
- [x] Keep the receiver generic enough that future `FrameV1` payload areas can add tile control, lineage, tombstone, and event metadata without rewriting the loop.

Acceptance:

- The client can receive and apply frames without freezing the MonoGame loop.
- Protocol/decode errors are captured in diagnostics instead of crashing during normal operation.

### Task TNS3-MG-04: Desktop Control Wiring

Status: locally completed for playable prototype controls on 2026-05-05. Node/Rust HTTP command forwarding remains next.

Goal:
Expose the V1 desktop controls through keyboard commands first.

Files:

- Modify: `backend/genetic-neurosim/client-monogame/GameRoot.cs`
- Modify: `backend/genetic-neurosim/client-monogame/Net/SimulationControlClient.cs`
- Optional create: `backend/genetic-neurosim/client-monogame/Input/KeyboardCommandController.cs`

Steps:

- [ ] Create a `SimulationControlClient` from `LaunchOptions.NodeHttpEndpoint`.
- [x] Bind `Space` to local pause/resume.
- [x] Bind `N` or `.` to step one local tick.
- [x] Avoid repeat-firing controls while a key is held down.
- [ ] Track last command result or failure for Node/Rust HTTP commands.

Acceptance:

- Pause, resume, and step can be issued from the desktop client.
- Failed HTTP commands are visible in diagnostics.

### Task TNS3-MG-05: Minimal Debug HUD

Status: completed for prototype HUD on 2026-05-05.

Goal:
Draw enough text to prove the desktop client is connected and consuming meaningful state.

Files:

- Modify: `backend/genetic-neurosim/client-monogame/GameRoot.cs`
- Optional create: `backend/genetic-neurosim/client-monogame/UI/DebugHud.cs`
- Optional add: `backend/genetic-neurosim/client-monogame/Content/UI/Fonts/`

Steps:

- [x] Add a fallback HUD path through the window title because no font assets exist yet.
- [x] Add an in-window generated block-glyph HUD because no font assets exist yet.
- [x] Display local mode, connection state, tick, tribe count, disputed tile count, and selected tribe.
- [x] Display last error in-window.
- [ ] Display protocol version, generation, food delta count, and asset diagnostic counts in-window after a richer cockpit HUD pass.
- [x] Keep the HUD small and utilitarian.

Acceptance:

- Launching the client shows live state and diagnostic text.
- The HUD does not depend on the old browser cockpit.

### Task TNS3-MG-06: Pointy-Hex World Renderer

Status: upgraded from fallback prototype to pointy-hex material terrain on 2026-05-05.

Goal:
Render a coherent hex world layer from current decoded payloads before attempting full 3D asset loading.

Files:

- Create: `backend/genetic-neurosim/client-monogame/Rendering/WorldRenderer.cs`
- Optional create: `backend/genetic-neurosim/client-monogame/Rendering/CameraController.cs`
- Modify: `backend/genetic-neurosim/client-monogame/GameRoot.cs`

Steps:

- [x] Add a simple camera with pan and zoom.
- [x] Draw a fixed-grid or inferred-grid pointy-hex tile field using biome materials.
- [x] Retire food/resource dot rendering from the terrain pass.
- [x] Draw tribe markers at main camp tile ids.
- [x] Use stable colors for tribe ids.
- [x] Keep rendering deterministic from local `PlayableSimulation` state.
- [x] Clip proper terrain material textures to actual hex geometry instead of square sprite stamps.
- [x] Render territory and dispute overlays as hex overlays instead of rectangles.

Note:

- The first playable renderer is intentionally local-demo backed. It does not yet render the live `SimulationViewModel` stream because the current legacy payload does not include enough V3 territory, biome, dispute, and camp metadata.
- This is acceptable for the prototype milestone; the receiver still runs separately and applies decoded frames for contract validation.
- The earlier square/pixel-grid treatment is retired. The current renderer uses a `BasicEffect` triangle fan per pointy hex, world-space material UVs, and SpriteBatch only for semantic overlays and agents.

Acceptance:

- The client shows a visible map-like layer and live tribe markers.
- Rendering still works if no backend is connected by using empty-state fallbacks.
- The map reads as hex territory first, not as a checkerboard texture test.

### Task TNS3-MG-07: First Asset Binding Smoke Test

Status: completed for terrain material loading on 2026-05-05.

Goal:
Prove that at least one downloaded texture or concept-art asset can be loaded by the MonoGame content path.

Files:

- Modify: `backend/genetic-neurosim/client-monogame/TribalNeuroSim.Client.csproj`
- Modify: `backend/genetic-neurosim/client-monogame/GameRoot.cs`
- Optional create: `backend/genetic-neurosim/client-monogame/Assets/AssetLoadSmokeTest.cs`

Steps:

- [x] Decide whether the first smoke test uses copied raw files or MonoGame content pipeline assets.
- [x] Replace the initial small pixel-art PNG terrain experiment with proper diffuse material textures from `Content/Materials/Terrain/`.
- [x] Use grass, forest floor, mud, dirt, sand, snow, gray rock, and stone diffuse textures in the terrain renderer where available.
- [x] Record that direct loading from the project `Content/` folder is the first-pass route.

Note:

- `LowPolyPixelRpgAssets` terrain textures are explicitly retired from the terrain renderer because they produced a pixelated debug-board look.
- The renderer now uses pointy-hex geometry, world-space material sampling, and linear/wrapped terrain textures to avoid jagged square or diamond artifacts.

Acceptance:

- One downloaded bitmap asset visibly renders in the client.
- The result documents whether future assets need pipeline conversion, direct file loading, or a hybrid approach.

### Task TNS3-MG-08: Versioned FrameV1 Design Follow-Up

Goal:
Prepare the next protocol step after the legacy V0 payload is stable in MonoGame.

Files:

- Modify: `docs/neurosim/architecture/desktop-contract-v1.md`
- Optional create: `docs/tribal-neurosim-v3-frame-v1-schema.md`

Steps:

- [ ] List payload fields still missing for asset-aware rendering.
- [ ] Define first-class fields for biome ids, polity tiers, settlement visual ids, faction insignia ids, event icon ids, artifact ids, tile-control records, dispute flags, main-camp ids, lineage ids, and tombstone/event references.
- [ ] Keep the existing `TNS3` envelope as the compatibility wrapper.
- [ ] Do not implement the Rust schema until the document is clear.

Acceptance:

- The next Rust/Node/C# schema change is explicit and reviewable.
- The renderer does not need to guess biome or polity semantics from legacy fields.

### Task TNS3-MG-09: V3 Inspection Model Placeholders

Goal:
Add C# model shapes for V3 territory, lineage, and tombstone-ledger inspection without implementing final Rust protocol fields yet.

Files:

- Optional create: `backend/genetic-neurosim/client-monogame/Models/TileControlViewState.cs`
- Optional create: `backend/genetic-neurosim/client-monogame/Models/LineageViewState.cs`
- Optional create: `backend/genetic-neurosim/client-monogame/Models/TombstoneViewState.cs`
- Optional modify: `backend/genetic-neurosim/client-monogame/Models/SimulationViewModel.cs`

Steps:

- [ ] Represent fractional tile control as compact C# records using numeric polity/tribe ids and float control shares.
- [ ] Represent lineage nodes as numeric ids with `parentA` and `parentB` references.
- [ ] Represent tombstone records as numeric ids plus reason/event references, not expanded strings.
- [ ] Keep these as view/query models only until Rust/Node expose the data.
- [ ] Do not add speculative simulation behavior to C#.

Acceptance:

- Future frame/query data has a clear C# landing shape.
- The models preserve the V3 no-string-hot-path rule.
- The current legacy frame decoder remains unchanged.

## Recommended Execution Order

1. TNS3-MG-01: Asset Manifest And Stable Keys
2. TNS3-MG-02: Asset Diagnostics
3. TNS3-MG-03: Background Frame Receive Loop
4. TNS3-MG-05: Minimal Debug HUD
5. TNS3-MG-04: Desktop Control Wiring
6. TNS3-MG-06: Fallback 2D World Renderer
7. TNS3-MG-07: First Asset Binding Smoke Test
8. TNS3-MG-08: Versioned FrameV1 Design Follow-Up
9. TNS3-MG-09: V3 Inspection Model Placeholders

## What Not To Do Next

- Do not download more assets before current assets are registered and diagnosable.
- Do not jump straight into full 3D scene rendering before a fallback world renderer exists.
- Do not revive the browser cockpit as the main runtime path.
- Do not invent C# simulation rules that conflict with Rust execution state.
- Do not depend on biome, polity, event, or artifact metadata that is not in the contract yet.
- Do not make thesis-facing claims from this visual layer; it is runtime infrastructure for the simulation.
- Do not store or display expanded lineage strings as the canonical model.
- Do not implement fractional territory visually before the data model and schema are explicit.

## First Implementation Slice To Start Now

TNS3-MG-01 and TNS3-MG-02 are complete.

Reason:

- They use the assets downloaded today.
- They are low-risk.
- They make future rendering work cleaner.
- They do not require backend availability.
- They satisfy the migration plan's requirement that missing assets degrade through fallback bindings.

Expected validation for the first slice:

- `dotnet run --project backend/genetic-neurosim/client-monogame-tests/TribalNeuroSim.Client.Tests.csproj`
- `dotnet build backend/genetic-neurosim/client-monogame/TribalNeuroSim.Client.csproj`
- a small registry/diagnostics call path compiled into the client
- no heavy model-loading dependency yet

## Latest Validation

2026-05-05:

- `dotnet run --project backend/genetic-neurosim/client-monogame-tests/TribalNeuroSim.Client.Tests.csproj` passed.
- `dotnet build backend/genetic-neurosim/client-monogame/TribalNeuroSim.Client.csproj` passed with 0 warnings and 0 errors.
- After TNS3-MG-03, the same test command passed with five focused checks.
- After TNS3-MG-03, the same client build command passed with 0 warnings and 0 errors.
- After the playable prototype slice, the test command passed with eight focused checks.
- After the five-agent continuation slice, the test command passed with eleven focused checks.
- After the five-agent continuation slice, the client build passed with 0 warnings and 0 errors.
- After the terrain material correction, the test command passed with twelve focused checks.
- After the terrain material correction, the client build passed with 0 warnings and 0 errors.
- After the pointy-hex renderer correction, the test command passed with fourteen focused checks.
- After the pointy-hex renderer correction, the client build passed with 0 warnings and 0 errors.

## Next Task To Implement

Proceed to a Civ-like terrain composition pass aligned with `docs/neurosim/architecture/critical-redesign.md`: biome clustering, river/coast readability, mountains/forests as actual map features, smoother territory borders, and less debug overlay noise. Then finish Node/Rust desktop control forwarding.

After the full V3 mechanics docs were added to the source set, the receiver boundary was implemented with diagnostics and a generic queue so later tile-control, lineage, tombstone, and event payloads can attach cleanly.
