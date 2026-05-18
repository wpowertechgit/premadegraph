# Tribal NeuroSim v3 Master Task List — Civ6-Style Simulation

**Created:** 2026-05-06
**Target:** Working simulation game with Rust motor fetching datasets from backend, playable through MonoGame desktop client.

## How To Use This Document

Each section = independent parallelizable work package. Sub-agents can pick any section without merge conflicts because:

- task files live in `backend/genetic-neurosim/` with clear separation
- Rust (`backend/src/`) and C# (`client-monogame/`) are separate projects
- No two tasks edit the same file unless stated as dependency
- Dependencies are explicit: `WAIT-FOR: TASK-ID` means do not start until dependency done
- `!!!ASSET-NEEDED` markers flag places needing human-created assets

## Existing State (Already Done)

| Area | What Works |
|------|------------|
| Rust backend | Axum server, WS frame streaming, basic tribes/war/events/world, NEAT genome, territory expansion, combat resolution, alliance system, generation boundaries, river crossing, 5 artifact stats, active war records |
| Rust desktop protocol | TNS3 V1 envelope wraps legacy payload |
| MonoGame client | GameRoot shell, hex world renderer (pointy-hex), isometric camera, vegetation renderer, debug HUD, frame receiver, domain classes (Tribe/City/Duchy/Kingdom/Empire), asset registry, biome profiles, playable local simulation, keyboard controls |
| Assets | ~30+ packs of 3D models/textures/animations downloaded across terrain, vegetation, structures, population, biomes |

---

## SECTOR 1: Rust V3 Mechanics — Core Simulation Upgrade

### Task R1 — Lineage Registry (DAG ID System)

**Critical for:** Every other V3 mechanic. Solves exponential string bloat.

**Files to create:**
- `backend/src/lineage_registry.rs` — new module

**Files to modify:**
- `backend/src/simulation.rs` — integrate LineageRegistry
- `backend/src/main.rs` — expose lineage query endpoints

**Implementation:**
```rust
// lineage_registry.rs
pub struct LineageRegistry {
    registry: HashMap<u32, (u32, u32)>, // entity_id -> (parent_a_id, parent_b_id)
    next_id: u32,
    seed_to_entity_ids: HashMap<String, Vec<u32>>, // cluster_id -> seed entity ids
}

impl LineageRegistry {
    pub fn register(&mut self, parent_a: u32, parent_b: u32) -> u32; // returns new entity_id
    pub fn resolve_lineage(&self, entity_id: u32) -> Vec<(u32, u32)>; // walk DAG
    pub fn seed_from_entity(&self, entity_id: u32) -> Option<String>; // trace to original seed cluster
}
```

**Acceptance:**
- No string concatenation in hot path for lineage
- Every entity has two parent pointers in registry
- `resolve_lineage(5432)` traces back to original seed IDs via O(1) lookups
- Thread-safe under RwLock

**!!!ASSET-NEEDED:** None — pure data structure.

---

### Task R2 — Tombstone Ledger (Ghost War Fix)

**Critical for:** Memory discipline. Dead tribes must disappear from active state.

**Files to create:**
- `backend/src/tombstone.rs` — new module

**Files to modify:**
- `backend/src/simulation.rs` — call `cleanup_tribe()` on extinction
- `backend/src/war.rs` — WarStatus needs `WarCancelled` variant

**Implementation:**
```rust
// tombstone.rs
pub struct TombstoneRecord {
    pub tribe_id: u32,
    pub cluster_id: String,
    pub tick_died: u64,
    pub generation_died: u32,
    pub population_at_death: u32,
    pub territory_at_death: usize,
    pub cause: String, // "extinction" | "absorbed" | "rebelled"
    pub lineage_summary: Vec<String>, // compact seed references only
    pub final_artifacts: ArtifactSnapshot,
}

pub struct TombstoneLedger {
    records: Vec<TombstoneRecord>,
}

impl TombstoneLedger {
    pub fn record_death(&mut self, tribe: &TribeState, tick: u64, cause: &str);
    pub fn is_dead(&self, tribe_id: u32) -> bool;
    pub fn all_records(&self) -> &[TombstoneRecord];
}
```

**Modify `simulation.rs`:**
- When `tribe.alive = false` → call `tombstone.record_death()` immediately
- All active wars involving dead tribe → `WarStatus::WarCancelled`
- Remove tribe territory from tile ownership map
- `cleanup_tribe(tribe_id)` must be atomic (no partial cleanup)

**Acceptance:**
- No ghost wars (war terminates when participant dies)
- Dead tribe never appears in `alive_count`
- TombstoneRecords queryable via REST endpoint `/api/tombstones`
- Memory: dead tribes consume only tombstone entry (~100 bytes), not active state

**WAIT-FOR:** Task R1 (lineage registry needed for lineage_summary field)

---

### Task R3 — V3 State Machine & Behavior Upgrade

**Critical for:** Civ6-like societal hierarchy. Implements "The 5 Core Artifacts" trait system.

**Files to modify:**
- `backend/src/tribes.rs` — expand `TribeState`
- `backend/src/simulation.rs` — state machine transitions
- `backend/src/main.rs` — new endpoints

**New tribe state fields:**
```rust
pub struct TribeState {
    // Existing fields preserved...
    
    // V3: Polity tier (Tribe -> City -> County -> Duchy -> Kingdom -> Empire)
    pub polity_tier: PolityTier,
    pub parent_polity_id: Option<u32>, // if part of larger polity
    pub constituent_tribe_ids: Vec<u32>, // tribes that merged into this polity
    
    // V3: Specialization role (based on dominant artifact)
    pub specialization_role: SpecializationRole,
    pub veterancy_xp: u32, // accumulates while fulfilling role
    
    // V3: Main camp tile (distinct from claimed wilderness)
    pub main_camp_tile: u16,
    
    // V3: Entity-level population tracking (citizens with lineage)
    pub citizens: Vec<CitizenRecord>, // entity_ids for lineage tracking
}

pub enum PolityTier {
    Tribe = 0,
    City = 1,
    County = 2,    // note: County not Duchy is the correct V3 term
    Duchy = 3,     // keep both; migration doc says County, redesign doc says Duchy
    Kingdom = 4,
    Empire = 5,
}

pub enum SpecializationRole {
    Generalist,
    Military,       // high A_combat
    Economy,        // high A_resource
    Governance,     // high A_map_objective
    Logistics,      // high A_risk
    InternalAffairs,// high A_team
}
```

**State machine additions:**
- Existing behaviors keep working (Settling, Foraging, AtWar, etc.)
- New behavior: `Consolidating` — tribes merging into higher polity
- New behavior: `Rebellious` — constituent tribe seeking independence
- New behavior: `Administering` — ruling council role in merged society

**Acceptance:**
- Tribes can progress through polity tiers via merger
- Specialization role assigned based on dominant artifact at merge time
- Veterancy XP increments each tick when tribe fulfills its role
- Main camp tile distinct from general territory

**WAIT-FOR:** Nothing — can run in parallel with R1/R2 (just don't activate V3 mechanics until registry exists)

---

### Task R4 — Fractional Tile Control & Disputed Zones

**Critical for:** V3 Territory mechanics. Implements "Float Mechanic."

**Files to modify:**
- `backend/src/world.rs` — tile ownership structure
- `backend/src/tribes.rs` — territory management
- `backend/src/simulation.rs` — dispute penalty calculations

**New world tile structure:**
```rust
// In world.rs
pub struct TileControl {
    pub tribe_id: u32,
    pub control_percentage: f32, // 0.0 to 1.0, sum across occupants = 1.0
}

// Replace simple tile_owner with Vec of controllers
pub struct WorldTile {
    // Existing fields preserved...
    pub occupants: ArrayVec<TileControl, 4>, // max 4 factions per tile
    pub is_disputed: bool,
}

// WorldGrid additions:
// tile_occupants: Vec<ArrayVec<TileControl, 4>>
// tile_is_disputed: Vec<bool>
```

**Dispute mechanics in simulation.rs:**
```rust
// DISPUTE_PENALTY constant: 0.40 (flat -40%)
pub const DISPUTE_PENALTY: f32 = 0.40;

// When two tribes occupy same tile:
// - Set is_disputed = true
// - Each tribe's effective yield = control_percentage * (1.0 - DISPUTE_PENALTY)
// - e.g., 70% controller gets: 0.70 * 0.60 = 0.42 net yield

// Resolution paths from V3 docs:
// 1. Passive acceptance: A_risk > threshold, yield still sufficient
// 2. Military threat: A_combat advantage forces retreat
// 3. Total war: Combat resolution
// 4. Diplomatic merger: Alliance unifies control
```

**Acceptance:**
- Tiles can have multiple occupants with fractional control
- Disputed flag auto-calculated when 2+ occupants
- -40% penalty applied to all operations on disputed tiles
- Resolution paths trigger based on A_risk/A_combat thresholds
- Backward-compatible: single-occupant tiles behave identically to before

**WAIT-FOR:** Nothing — independent world data structure change

---

### Task R5 — Binary Diplomacy & Alliance/Merger Pipeline

**Critical for:** V3 "No Middle Ground" diplomacy rule.

**Files to modify:**
- `backend/src/simulation.rs` — alliance/merger logic
- `backend/src/tribes.rs` — alliance/merge state
- `backend/src/events.rs` — new event types
- `backend/src/main.rs` — new endpoints

**Rules from V3 docs:**
- No economic cooperation without structural binding
- Option A: Total War (existing combat system)
- Option B: Full Alliance -> Merger -> Higher polity tier

**Implementation:**
```rust
// New event types
AllianceProposed = 42,
AllianceAccepted = 43,
MergeInitiated = 44,
MergeCompleted = 45,
PolityUpgraded = 46,
RebellionStarted = 47,
RebellionCompleted = 48,

// Merger flow:
impl TribeSimulation {
    // 1. Two Allied tribes can initiate merge
    fn try_merge_allies(&mut self, a: usize, b: usize) -> bool;
    
    // 2. Merge produces higher-tier polity
    fn create_higher_polity(&mut self, constituents: Vec<usize>) -> Option<usize>;
    //   - 3 tribes -> City
    //   - 10 tribes -> County  
    //   - 50 tribes -> Kingdom
    //   - 100+ tribes -> Empire
    
    // 3. Specialization delegation
    fn assign_roles(&mut self, polity_id: usize);
    //   - Highest A_combat -> Military
    //   - Highest A_resource -> Economy
    //   - Highest A_map_objective -> Governance
    //   - Highest A_risk -> Logistics
    //   - Highest A_team -> Internal Affairs
    
    // 4. Rebellion trigger
    fn check_rebellion(&mut self, tribe_idx: usize) -> bool;
    //   - A_team < critical threshold
    //   - Specialized unit calculates higher survival chance independently
}
```

**Acceptance:**
- Allies can merge after sustained alliance period
- Merger creates higher polity tier with correct threshold
- Specialization roles assigned based on artifact scores
- Rebellion triggers when A_team drops below threshold
- Merged entity gets constituent_tribe_ids for lineage tracking

**WAIT-FOR:** Task R3 (polity tier fields needed)

---

### Task R6 — Reproduction & Entity-Level Population

**Critical for:** V3 Offspring Mechanics & Lineage docs.

**Files to modify:**
- `backend/src/simulation.rs` — reproduction logic
- `backend/src/lineage_registry.rs` — parent pointer registration

**Rules:**
- Minimum 2 living entities in tribe for reproduction
- Unisex breeding model
- Same-gene breeding permitted (both parents same seed)
- Offspring inherits blended 5 artifacts from parents
- Configurable mutation rate on every birth
- Cross-tribe breeding after merger

**Implementation:**
```rust
pub struct CitizenRecord {
    pub entity_id: u32,
    pub parent_a: u32,
    pub parent_b: u32,
    pub generation: u32,
}

impl TribeSimulation {
    // Each tick: check reproduction eligibility
    fn try_reproduction(&mut self, tribe_idx: usize) {
        let tribe = &self.tribes[tribe_idx];
        if tribe.citizens.len() < 2 { return; }
        // Configurable reproduction interval (every 50 ticks)
        if self.tick % 50 != 0 { return; }
        
        // Pick two random citizens
        // Blend artifacts: average of parents + mutation
        // Register new entity_id in LineageRegistry
        // New citizen gets mutated artifact blend
    }
    
    fn blend_artifacts(a: &ArtifactSet, b: &ArtifactSet, mutation_rate: f32) -> ArtifactSet;
}
```

**Canonical entity ID format (never stored as string in hot path):**
- Rust stores: `entity_id: u32`, `parent_a: u32`, `parent_b: u32`
- Decoded on query: `tribe_id:entity_id:generation:seed_id`

**Seed population weighting (from V3 doc):**
- Players with more matches get more seed entities
- Every cluster player gets at least 1 entity ("No One Left Behind" rule)

**Acceptance:**
- Reproduction fires every N ticks for eligible tribes
- Offspring has blended + mutated artifacts
- LineageRegistry populated with parent pointers
- Entity-level population visible via tribe snapshot API

**WAIT-FOR:** Task R1 (LineageRegistry must exist), Task R3 (citizens field on TribeState)

---

### Task R7 — FrameV1 Protocol (Beyond Legacy V0 Wrapper)

**Critical for:** MonoGame to receive V3 metadata (biome IDs, polity tiers, control data).

**Files to create:**
- `backend/src/frame_v1.rs` — new binary frame schema

**Files to modify:**
- `backend/src/desktop_protocol.rs` — add FrameV1 encoder
- `backend/src/simulation.rs` — build_frame_v1() method
- `docs/tribal-neurosim-v3-desktop-contract-v1.md` — update schema doc

**FrameV1 payload areas:**
```
DesktopFrameV1 (40 bytes fixed header)
  u8[4]  magic "TNS3"
  u16    version 1
  u16    headerBytes 40
  u16    payloadKind 2  // new: FrameV1
  u16    flags
  u32    payloadBytes
  u64    tick
  u32    generation
  u32    recordCount

Per-tile payload:
  u16    tile_id or axial coord
  u8     biome_id
  u8     occupant_count
  f32    food_amount (or per-occupant?)
  u8     dispute_flag + reserved bits

Per-tribe payload:
  u32    tribe_id
  u8     polity_tier
  u8     specialization_role
  u16    main_camp_tile
  u32    population
  u32    constituent_count
  f32    food_stores
  f32    a_combat, a_risk, a_resource, a_map_objective, a_team
  u16    territory_count
  u32    entity_count (citizens)
  u16    veterancy_xp
  u8     behavior_state
  u8     alive_flag

Per-war payload (optional, signaled by flag):
  u32    war_id
  u32    attacker_id, defender_id
  u64    start_tick
  u8     war_status

Event delta payload:
  u16    event_count
  per event: u8 event_type, u32 tribe_id
```

**Acceptance:**
- FrameV1 contains all fields MonoGame needs for V3 rendering
- Backward-compatible: legacy V0 payload still works alongside V1
- Protocol version field lets client choose decoder path
- Schema doc in `docs/` is the source of truth

**WAIT-FOR:** Tasks R1-R6 (FrameV1 should include all V3 fields)

---

## SECTOR 2: MonoGame Client — V3 Visual Upgrade

### Task M1 — FrameV1 Decoder (C# Side)

**Critical for:** Receiving V3 data from Rust.

**Files to modify:**
- `client-monogame/Protocol/FrameDecoder.cs` — add V1 path
- `client-monogame/Protocol/DesktopProtocol.cs` — V1 structs
- `client-monogame/Protocol/SimulationFrame.cs` — new fields
- `client-monogame/Models/SimulationViewModel.cs` — V1 field mapping

**Acceptance:**
- C# can decode FrameV1 payload
- Falls back gracefully to V0 wrapper path if client detects version mismatch
- All V3 fields (biome_id, polity_tier, specialization, dispute, control) available in C# models

**WAIT-FOR:** Task R7 (FrameV1 schema must be frozen first)

---

### Task M2 — Polity Tier Visual Progression

**Critical for:** Civ6-like empire visibility on map.

**Files to modify:**
- `client-monogame/Rendering/WorldRenderer.cs` — settlement rendering
- `client-monogame/Assets/SettlementVisualProfile.cs` — tier->model mapping
- `client-monogame/Assets/AssetRegistry.cs` — register settlement models

**Visual rules:**
- Each polity tier gets distinct 3D model or billboard
- Tribe: small camp cluster (hide tents, fire pit, stakes)
- City: dense proto-urban cluster (mud-brick, timber)
- County: fortified hub (walls, chieftain hall)
- Kingdom: large citadel (monumental hall, layered walls)
- Empire: monumental capital (multi-ring fortification, palace)

**!!!ASSET-NEEDED:** 5 settlement model families (Tribe camp, City center, County hub, Kingdom capital, Empire capital). Use existing kits (Kenney, Medieval Village Pack) as placeholders first, then replace with Meshy/Firefly generated models.

**Implementation:**
```csharp
// In WorldRenderer or new SettlementRenderer:
public void DrawSettlement(
    SpriteBatch spriteBatch,
    PolityTier tier,
    Vector3 worldPosition,
    Color factionColor,
    float zoomLevel)
{
    // Resolve visual profile from AssetRegistry
    // Draw 3D model or billboard based on zoom
    // Apply faction color tint
    // Add territory border glow at kingdom+ tier
}

// LOD strategy from asset plan:
// Far zoom: 2D billboard/icon
// Mid zoom: simplified 3D model
// Close zoom: full 3D model with props
```

**Acceptance:**
- Each polity tier renders different visual on map
- Tier visual clearly distinguishable at zoom levels
- Missing tier model falls back to previous tier visual
- Faction color applied to settlement models

---

### Task M3 — Territory Border & Disputed Zone Overlay

**Critical for:** Territory/expansion visibility.

**Files to modify:**
- `client-monogame/Rendering/WorldRenderer.cs`
- `client-monogame/Rendering/TerritoryRenderer.cs` — new file

**Implementation:**
```csharp
public class TerritoryRenderer {
    // Draw colored hex fills for each tribe's territory
    // Draw border lines between different owners
    // Draw disputed zone pattern (crosshatch or flashing)
    // Smooth borders at territory edges (not per-tile sharp)
    
    public void DrawTerritory(Viewport viewport, SimulationViewModel viewModel, CameraController camera);
    public void DrawDisputedZones(Viewport viewport, SimulationViewModel viewModel);
}
```

**Visual rules:**
- Each faction gets distinct territory fill color (semi-transparent)
- Borders between different owners get thick lines
- Disputed tiles get red/crosshatch overlay
- Disputed penalty indicator (small "-40%" text or icon) on affected tiles

**!!!ASSET-NEEDED:** Territory border texture, dispute overlay pattern. Procedural generation acceptable for first pass.

**Acceptance:**
- Territory fills visible on map
- Borders between different factions clearly visible
- Disputed tiles visually distinct
- Territory updates as tribes expand/contract

---

### Task M4 — Semantic Zoom (Civ6-Style Camera)

**Critical for:** Playable map navigation at all scales.

**Files to modify:**
- `client-monogame/Rendering/CameraController.cs`
- `client-monogame/Rendering/IsometricCamera.cs`
- `client-monogame/GameRoot.cs`

**Zoom tiers:**
```csharp
public enum ZoomLevel {
    Far,    // Empire view: colored territory, banners, polity names only
    Mid,    // Regional view: settlements, borders, resource nodes
    Close,  // Tactical view: individual citizens, camp details, frontlines
}

public class IsometricCamera {
    public ZoomLevel CurrentZoom { get; private set; }
    public float Distance { get; set; } // 50 (close) to 800 (far)
    
    // Auto-threshold: switch zoom level at defined distances
    // Far: Distance > 500
    // Mid: Distance 200-500  
    // Close: Distance < 200
    
    // Smooth interpolation between zoom levels
    // Mouse wheel zoom with acceleration/deceleration
}
```

**Visibility filters per zoom level:**
- Far: territory fills, polity banners, large text labels, no individuals
- Mid: settlements, resource icons, border lines, event markers
- Close: 3D settlement models, citizen markers, camp props, frontline details

**Acceptance:**
- Camera smoothly zooms from empire overview to tactical detail
- Visibility changes at each zoom threshold
- No rendering of invisible entities at zoom level
- Performance maintained at 500+ entities

---

### Task M5 — Debug HUD v2 (V3 Fields Display)

**Files to modify:**
- `client-monogame/UI/DebugHud.cs`
- `client-monogame/UI/DebugHudState.cs`

**Add to debug HUD:**
- Protocol version currently active
- Polity tier counts (tribes, cities, counties, kingdoms, empires)
- Active war count
- Total entity count (citizens across all tribes)
- Disputed tile count / -40% penalty indicator
- Tombstone count (extinct tribes)
- Lineage depth (max generations)
- Asset diagnostic summary

**Acceptance:**
- HUD shows all V3 state fields
- Update interval throttled to avoid frame drops
- Toggleable with config key

---

### Task M6 — Live Rust Frame Rendering (Replace Local Demo)

**Critical for:** MonoGame renders real data from Rust backend.

**Files to modify:**
- `client-monogame/GameRoot.cs` — switch render source
- `client-monogame/Rendering/PlayableRenderAdapter.cs` — bridge adapter
- `client-monogame/Models/PlayableSimulation.cs` — keep as fallback

**Implementation:**
```csharp
// GameRoot currently renders from _playableSimulation (local demo)
// Must switch to rendering from _viewModel (received Rust frames)

// Strategy: RenderAdapter checks source
// - If _frameReceiver has data in last 5 seconds -> use _viewModel
// - If no frames received -> fall back to _playableSimulation
// - Never show blank screen

// Tile source: use decoded FrameV1 tile data
// Tribe source: use decoded FrameV1 tribe records  
// War/event overlay: from frame event delta
```

**Acceptance:**
- Client renders live Rust backend state when connected
- Seamless fallback to local demo when disconnected
- No visual glitch on source switch
- Frame decoder V1 path used when available

**WAIT-FOR:** Task M1 (FrameV1 decoder), Task R7 (FrameV1 protocol)

---

### Task M7 — Biome-Specific Visual Rendering

**Files to modify:**
- `client-monogame/Rendering/WorldRenderer.cs` — biome tile drawing
- `client-monogame/Assets/BiomeVisualProfile.cs` — add biome props
- `client-monogame/Rendering/VegetationRenderer.cs` — biome-instanced

**Implementation:**
```csharp
// Per biome visual profile now includes:
public class BiomeVisualProfile {
    public string DisplayName;
    public Color MapColor;
    public string TerrainTextureKey;
    public string[] PropAssetKeys; // trees, rocks, bushes per biome
    public float TreeDensity; // 0-1, controls instancing count
    public float GrassDensity;
    public Color AmbientTint;
}
```

**Biome families from asset plan:**
- Plains: grass texture, sparse bushes, wind-swept feel
- Forest: dark floor texture, dense tree instancing, fallen logs
- Desert: sand texture, cactus/palm, sparse dry bushes
- Mountain: rock texture, cliff shrubs, stone markers, no trees
- Swamp/Marsh: mud texture, dead trees, reeds, stilt props
- River: water material, banks, no vegetation on river tiles
- Fertile Valley: green grass, dense settlement props, grain fields

**!!!ASSET-NEEDED:** Biome-specific prop variants. Most biome textures already exist in Content/Materials/Terrain/. Need biome-specific tree density rules.

**Acceptance:**
- Each biome has distinct visual terrain color/texture
- Trees/props auto-instanced based on biome density rules
- Missing biome texture falls back to Plains
- Performance: instanced trees don't tank frame rate

---

### Task M8 — Faction Insignia & Banner System

**Files to create:**
- `client-monogame/Assets/FactionInsigniaProfile.cs`
- `client-monogame/Rendering/BannerRenderer.cs`

**Files to modify:**
- `client-monogame/Assets/AssetRegistry.cs`
- `client-monogame/Rendering/WorldRenderer.cs`

**Implementation:**
```csharp
public class FactionInsigniaProfile {
    public Color PrimaryColor;
    public Color SecondaryColor;
    public string IconKey; // symbol/pattern key
    public string BannerModelKey; // 3D banner model
}

// Auto-generate faction identity from artifact profile:
// - A_combat high -> martial colors (reds, bronzes)
// - A_team high -> unity colors (blues, golds)  
// - A_risk high -> endurance colors (greys, greens)
```

**!!!ASSET-NEEDED:** 5-10 banner/symbol icon variants, faction color scheme generation rules.

**Acceptance:**
- Each polity shows colored banner/border matching faction identity
- Banners visible at Far zoom level
- Colors derived from artifact profile (not random)
- Polity name displayed near banner at Far zoom

---

### Task M9 — Lineage & Tombstone Inspection UI

**Files to create:**
- `client-monogame/UI/LineageInspectorPanel.cs`
- `client-monogame/UI/TombstonePanel.cs`

**Files to modify:**
- `client-monogame/Models/LineageViewState.cs`
- `client-monogame/Models/TombstoneViewState.cs`

**Implementation:**
```csharp
// Panel triggered when player selects a tribe and presses 'L'
public class LineageInspectorPanel {
    // Shows family tree (DAG) for selected entity
    // Entity ID -> Parent A -> Parent B -> Grandparent chain
    // Traces back to original seed player
    // Root nodes = original cluster profile IDs
    // Color-coded by seed source
    
    // On-demand query to Node backend (not live frame data)
    // Node forwards to Rust lineage query endpoint
}

public class TombstonePanel {
    // Lists all extinct tribes
    // Sortable by: death tick, population_at_death, territory_at_death
    // Shows cause of death
    // Click expands lineage detail
    // Empty state message if no extinctions yet
}
```

**Acceptance:**
- Lineage inspector shows parent chain from entity to seed
- Tombstone panel lists all extinct tribes
- Both panels are query-driven (not in hot path)
- Empty states handled gracefully

**WAIT-FOR:** Task R1 (lineage registry), Task R2 (tombstone ledger)

---

### Task M10 — Font & UI Art Direction Pass

**Files to modify:**
- `client-monogame/Content/UI/Fonts/` — add font files
- `client-monogame/UI/DebugHud.cs` — apply fonts
- `client-monogame/UI/*.cs` — style pass

**Font choices from asset plan:**
- Display: Cinzel (Google Fonts) — for polity names, titles
- Body: Noto Serif (Google Fonts) — for dossiers, text panels
- Debug: system monospace — for debug HUD

**!!!ASSET-NEEDED:** Download and place font files in `Content/UI/Fonts/`. Test with:
- Tribe/city/kingdom names
- Region labels
- Dossier text panels

**Acceptance:**
- Display font renders polity names with tribal/antiquity feel
- Body font readable at UI panel sizes
- Debug font doesn't depend on external font (system fallback)
- Missing font falls back to SpriteFont default gracefully

**!!!ASSET-NEEDED:** Font files download from Google Fonts (Cinzel, Noto Serif).

---

## SECTOR 3: Node Bridge & Data Pipeline

### Task N1 — Node Middleman: Desktop Control Forwarding

**Already partially done** per TNS3-MG-04. Finish remaining.

**Files to modify:**
- `backend/server.js` — desktop V1 control routes
- `client-monogame/Net/SimulationControlClient.cs` — HTTP command sending

**Routes to wire:**
```
POST /api/neurosim/desktop/v1/control/pause     -> Rust POST /api/desktop/v1/control/pause
POST /api/neurosim/desktop/v1/control/resume    -> Rust POST /api/desktop/v1/control/resume
POST /api/neurosim/desktop/v1/control/step-tick -> Rust POST /api/desktop/v1/control/step-tick
GET  /api/neurosim/desktop/v1/status            -> Rust GET  /api/desktop/v1/status
```

**Acceptance:**
- MonoGame pause/resume/step commands reach Rust backend
- Command failures reported in client diagnostics
- Node passes through responses unchanged

---

### Task N2 — Dataset Bootstrap for NeuroSim

**Files to modify:**
- `backend/server.js` — cluster export endpoint
- `backend/pathfinder-rust/src/engine/graph.rs` — existing graph export

**Implementation:**
- Node fetches latest cluster data from dataset when NeuroSim backend starts
- Node formats clusters into `ClusterProfile` JSON
- Node pushes profiles to Rust via config endpoint or startup env
- MonoGame's `neurosim:` URI includes dataset selection parameter

**Acceptance:**
- Starting NeuroSim loads current dataset clusters
- Dataset switch from frontend also updates NeuroSim clusters
- MonoGame shows which dataset is active

---

### Task N3 — End Analytics & Run Summary Export

**Files to create:**
- `Node endpoint: GET /api/neurosim/export/summary`
- `Node endpoint: GET /api/neurosim/export/lineage`

**Files to modify:**
- `backend/server.js`

**Implementation:**
- Node queries Rust run_summary endpoint
- Node queries Rust lineage for entities
- Node formats into exportable JSON/CSV
- Export includes: tick count, extinct/alive tribes, polity progression timeline, lineage depth, artifact evolution over generations

**Acceptance:**
- Run summary exportable after simulation ends
- Lineage traceable back to original seed players
- Export format readable for thesis documentation

**WAIT-FOR:** Task R1 (lineage), Task R2 (tombstone)

---

## SECTOR 4: Integration & Validation

### Task I1 — 500+ Entity Scale Test

**Files to modify:**
- None (test configuration)

**Test scenario:**
1. Configure Rust with 50+ clusters (populating ~500+ entities)
2. Run simulation for 2000+ ticks
3. Verify MonoGame renders without frame hitching
4. Verify Rust stays under 6 GB RAM
5. Check for ghost wars/dead tribes

**Acceptance:**
- 500+ tribes render at 30+ FPS minimum
- No memory leak over 2000 ticks
- All ghost wars eliminated (zero active wars with dead participants)

---

### Task I2 — Deterministic Replay Test

**Files to modify:**
- Test harness or existing test framework

**Test scenario:**
1. Run simulation with seed 42 for 1000 ticks → record summary A
2. Reset with same seed 42 → run 1000 ticks → record summary B
3. Compare A and B — should be identical within deterministic rules

**Acceptance:**
- Same seed produces same outcome within documented deterministic rules
- Non-deterministic elements (mutation RNG) documented as such
- Replay recording/playback works for debug

---

### Task I3 — V3 Mechanics Compliance Audit

**For each V3 doc, verify implementation:**

1. **Architecture & Mechanics Redesign:**
   - [ ] Rust/C#/Node split (Triumvirate) respected
   - [ ] Societal hierarchy works (Tribe->City->County->Kingdom->Empire)
   - [ ] 5 artifact roles implemented (combat, resource, map_objective, risk, team)
   - [ ] Specialization at merge time works
   - [ ] Rebellion triggers when A_team drops
   - [ ] Tombstone ledger active
   - [ ] Lineage ID-based (no string expansion)

2. **Territory & Expansion:**
   - [ ] Main camp + outpost model works
   - [ ] Fractional tile control implemented (Vec of occupants)
   - [ ] Disputed tiles with -40% penalty
   - [ ] Binary diplomacy: total war OR full alliance/merger
   - [ ] Casus Belli triggers from dispute penalty

3. **Offspring Mechanics:**
   - [ ] Seed population weighted by match count
   - [ ] Every seed player gets at least 1 entity
   - [ ] Unisex breeding with minimum 2 entity threshold
   - [ ] Same-gene breeding permitted
   - [ ] Mutation rate applied per birth
   - [ ] Cross-tribe breeding after merger

4. **Lineage Compression:**
   - [ ] LineageRegistry with HashMap<u32, (u32, u32)> structure
   - [ ] No string concatenation in hot path
   - [ ] Entity IDs sequential u32
   - [ ] Recursive resolution back to seed players
   - [ ] Memory: flat O(1) per birth

---

## Execution Order (Recommended)

### Phase A — Independent Parallel Tasks (No Dependencies)
| Task | Est. Effort | Agent |
|------|-------------|-------|
| R3 — V3 State Machine | Med | Rust agent |
| R4 — Fractional Tile Control | Med | Rust agent |
| R7 — FrameV1 Schema Design | Small | Protocol agent |
| N1 — Node Desktop Forwarding | Small | Node agent |
| M5 — Debug HUD v2 | Small | C# agent |

### Phase B — WAIT-FOR R3, R4, R7
| Task | WAIT-FOR | 
|------|----------|
| R1 — Lineage Registry | R3 (needs entity model) |
| R2 — Tombstone Ledger | R1 (lineage summary) |
| R5 — Diplomacy & Merger | R3 (polity tiers) |
| M1 — FrameV1 Decoder | R7 (schema frozen) |

### Phase C — WAIT-FOR R1, R2, R5
| Task | WAIT-FOR |
|------|----------|
| R6 — Reproduction | R1, R3 |
| M6 — Live Rust Rendering | M1 |
| M9 — Lineage/Tombstone UI | R1, R2 |
| N3 — End Analytics Export | R1, R2 |

### Phase D — Visual Polish (Can Run In Any Order)
| Task | Notes |
|------|-------|
| M2 — Polity Visual Progression | !!! needs settlement models |
| M3 — Territory/Dispute Overlay | Procedural shaders |
| M4 — Semantic Zoom | Needs camera tuning |
| M7 — Biome Visuals | !!! needs biome-specific props |
| M8 — Faction Insignia | !!! needs banner art |
| M10 — Font & UI | !!! needs font downloads |
| N2 — Dataset Bootstrap | Needs dataset integration |

### Phase E — Validation
| Task | WAIT-FOR |
|------|----------|
| I1 — Scale Test | Phase C + monitors |
| I2 — Deterministic Replay | Phase C |
| I3 — V3 Compliance Audit | All phases done |

---

## Files To Never Edit In Same Agent Session (Merge Risk)

| File | If being edited | No other agent edits this |
|------|-----------------|--------------------------|
| `backend/src/simulation.rs` | By any R-task | All other R-tasks |
| `backend/src/main.rs` | By any R-task | All other R-tasks |
| `client-monogame/GameRoot.cs` | By any M-task | All other M-tasks |
| `client-monogame/Protocol/FrameDecoder.cs` | By M1 | M2-M10 |
| `client-monogame/Assets/AssetRegistry.cs` | By M2/M8 | M2 and M8 cannot run same time |
| `backend/server.js` | By N-task | N1, N2, N3 cannot run same time |

**Rule:** If two tasks modify the same file, run them sequentially. Use git branches per task if running in parallel.

---

## Current Assets Status (From taskrun records)

Everything in `Content/` is already downloaded ready. No new asset downloads needed except:
- !!! Font files (Cinzel, Noto Serif from Google Fonts)
- !!! Polity tier settlement models (use existing kits as placeholders)
- !!! Banner/symbol icon variants
- !!! Biome-specific prop adjustment rules

Existing packs already usable:
- Terrain: grass, mud, sand, forest floor, rock, snow (8 texture families)
- Vegetation: 3 tree types, 6 grass types, bushes, ferns, dead trees, reeds
- Structures: tents, fences, walls, towers, gates, bridges, ladders, storage, campfire, well, cart, shrine/totem bits
- Population: medieval people FBX, base humanoid
- Biomes: mountain, terrain chunks, cliff, beach, cave, waterfall
