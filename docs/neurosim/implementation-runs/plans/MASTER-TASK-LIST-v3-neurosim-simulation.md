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
| MonoGame client | GameRoot shell, hex world renderer (pointy-hex), isometric camera, vegetation renderer, debug HUD, frame receiver, domain classes (Tribe/City/Duchy/Kingdom/Empire), asset registry, biome profiles, playable local simulation, keyboard controls, deterministic demo world generation, six-way hex neighbors, subtle visual elevation field |
| MonoGame rendering | Terrain texture baking, terrain-stage/symbol-stage split, territory border renderer, initial vegetation/capital renderer, AssimpNet FBX import path, 32-bit index buffers for high-poly settlement meshes, asset-load diagnostics log |
| Assets | ~30+ packs of 3D models/textures/animations downloaded across terrain, vegetation, structures, population, biomes; Meshy settlement FBX families for Tribe/City/Duchy/Kingdom/Empire; known high-poly settlement models need LOD/runtime tuning |

---

## SECTOR 1: Rust V3 Mechanics — Core Simulation Upgrade

### Task R1 — Lineage Registry (DAG ID System) (Done)

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

### Task R2 — Tombstone Ledger (Ghost War Fix) (Done)

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

### Task R3 — V3 State Machine & Behavior Upgrade (Done)

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

### Task R4 — Fractional Tile Control & Disputed Zones (Done)

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

### Task R5 — Binary Diplomacy & Alliance/Merger Pipeline (Done)

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

### Task R6 — Reproduction & Entity-Level Population (Done)

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

### Task R7 — FrameV1 Protocol (Beyond Legacy V0 Wrapper) (Done)

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

### Task R8 — Expansion Pace, Claim Cost, And Defendability (Done)

**Critical for:** Preventing tribes from mindlessly claiming huge territory before they can afford or defend it.

**Files to modify:**
- `backend/src/simulation.rs`
- `backend/src/tribes.rs`
- `client-monogame/Models/PlayableSimulation.cs`
- `client-monogame/Models/PlayableWorldGenerator.cs`
- `client-monogame/UI/DebugHud.cs`

**Problem to solve:**
- Expansion is currently too sudden in the local demo. Example failure: by tick 50, some tribes can expand by roughly 11 tiles.
- Normal early expansion should feel costly and gradual. Around tick 50, a healthy tribe should usually have about 0-2 extra tiles, not a sprawling undefended blob.
- Claiming territory should compete with food, population, and defense instead of being a free automatic flood-fill.

**Rules:**
- Add a per-tribe expansion cooldown or expansion point budget.
- Claiming a new tile costs food and/or population/administrative capacity.
- Claims must stay adjacent to owned/controlled territory.
- Expansion should prefer viable nearby tiles and avoid long thin territory shapes.
- Overextended tribes should face maintenance pressure, lower effective yield, slower future expansion, or easier dispute/retreat.
- The empire stress preset may tune these values separately, but default behavior must remain slow and defensible.

**Initial claim cost model:**
- A tribe may attempt at most one claim every `25` ticks in the default demo.
- Claiming a tile costs food immediately:
  - `base_cost = 40`
  - `territory_cost = 12 * current_owned_tile_count`
  - `distance_cost = 8 * max(0, hex_distance_from_capital - 1)`
  - `terrain_cost`:
    - plains/fertile/grass: `0`
    - forest: `10`
    - desert/snow: `15`
    - hills/highlands/marsh: `20`
    - river crossing or water-adjacent difficult claim: `25`
  - `pressure_cost = 25` if the candidate tile borders another tribe or disputed tile
  - `total_claim_cost = base_cost + territory_cost + distance_cost + terrain_cost + pressure_cost`
- A tribe cannot claim if paying the cost would drop food below `50`.
- A tribe also needs enough people to defend the new border:
  - `required_population = 80 + 25 * current_owned_tile_count`
  - if population is below this value, the claim is blocked
- Newly claimed tiles have an integration period of `75` ticks:
  - integrated yield starts at `25%`
  - rises linearly to `100%`
  - disputed or overextended tiles integrate at half speed
- Overextension begins when `owned_tile_count > 1 + population / 120`.
  - overextended tribes get `+10` extra food cost per over-limit tile on future claims
  - overextended border tiles are easier to dispute or abandon

**Default tuning target:**
- Starting tribes should usually claim their first extra tile around ticks `20-35`.
- A strong early tribe may claim a second tile around ticks `45-60`.
- A normal tribe should not gain 5+ tiles in the first 50 ticks without an explicit stress/debug preset.

**Acceptance:**
- Under the default local demo preset, a fixed seed at tick 50 shows no normal tribe gaining more than 2 extra tiles unless explicitly configured as a stress scenario.
- Expansion rate scales with population, food surplus, and polity tier.
- A tribe with low food or population cannot keep claiming new tiles for free.
- Debug HUD or diagnostics exposes at least one expansion metric: cooldown, claim budget, expansion cost, or overextension.
- A taskrun note records seed, tick count, initial territory count, final territory count, and max tile gain.

**WAIT-FOR:** Task R4 (territory control model) and Task R5 (diplomacy/merger pressure) are already done.

---

## SECTOR 2: MonoGame Client — V3 Visual Upgrade

### Task M1 — FrameV1 Decoder (C# Side) (Done)

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

### Task M2 — Polity Tier Visual Progression (Done)

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
- [x] Each polity tier has distinct settlement model asset registered
- [x] Tribal variants exist for Green, Desert, and Winter
- [x] Runtime catalog and settlement profiles resolve tier/biome visual keys
- [x] Runtime FBX import path started with AssimpNet and 32-bit index buffers
- [ ] Each polity tier actually renders in the MonoGame scene at the correct tile
- [ ] Settlement scale, orientation, material, and culling are validated visually
- [ ] Missing tier model falls back to previous tier visual
- [ ] Faction color/banner integration is implemented after base model visibility is stable
- [ ] LOD or simplified settlement meshes exist for repeated use on the map

**Current caveat:**
- The Meshy settlement FBX files are valid and open in external viewers, but some are very high-poly. Example: `tribal_green.fbx` is roughly 726k vertices and 931k faces.
- MonoGame can support 32-bit index buffers, but the project must not draw many full-resolution settlement meshes at once. Full meshes are acceptable for selected/near capitals; far and mid zoom need LOD, billboards, or simplified exports.
- Runtime asset loading must keep `asset-load.log` useful enough to answer: file found, importer used, vertex/index counts, bounds, texture found, first instance transform, draw count.

---

### Task M3 — Territory Border & Disputed Zone Overlay (Done)

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
- Borders between different owners get thick bright lines (of the tribe's color) and spacing between the two borders are 2px wide, so 2 hex-tiles are easily distinguishable
- Disputed tiles get crosshatch overlay with the color of the two/three disputed tribes contesting it
- Disputed penalty indicator (small "-40%" text or icon) on affected tiles
- The territory itself does not need to be colored entirely, unless it is disputed then we use the crosshatch. since we are going to apply the textures of the biome on it, the main distinguishable part should be the border.

**Acceptance:**
- [x] Biome textures remain visible; territory is not represented by opaque fills
- [x] Borders are rendered as ownership boundaries
- [x] Disputed tiles can be represented through colored overlay patterns
- [x] Territory updates as tribes expand/contract in the local demo
- [ ] Borders follow the exact six-edge pointy-hex geometry in all camera angles
- [ ] Border segments are not overlong, diagonal across unrelated tiles, or detached from actual hex edges
- [ ] Disputed overlays do not visually dominate the map at normal zoom
- [ ] Far zoom simplifies territory into clean colored outlines; close zoom keeps hex-edge fidelity
- [ ] Border rendering uses the same six-way neighbor model as simulation expansion

**Current caveat:**
- The first M3 implementation proved the rendering layer exists, but the early midpoint/neighbor approach produced visually incorrect long border lines.
- Future work must treat borders as edge ownership on six explicit hex edges, not as screen-space approximations between tile centers.
- The task remains accepted only as a first pass; visual correctness belongs to post-M3 refinement.

---

### Task M4 — Semantic Zoom and camera bounds and controls (Civ6-Style Camera) (Done)

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
The zoom mechanics in Crusader Kings 3 act as a dynamic bridge between a high-level strategic overview and detailed micro-management. As you scroll, the game engine seamlessly alters what is rendered to provide the most relevant information for that scale. 

Here is the exact behavior of the map as you move through the zoom levels:

**1. Fully Zoomed Out (The "Tabletop" Paper Map)**
*   **Visual Style:** At the maximum zoom out, the 3D world is hidden and replaced by a stylized 2D "paper map". 
*   **The Table:** In newer updates, the game renders this paper map as if it were physically rolled out on a wooden table, complete with desk dressing and atmospheric decorations around the edges.
*   **Functionality:** This level is purely for grand strategy. It gives you a clear, unobstructed view of massive empires, broad political borders, and the overall state of the world without taxing your system by rendering 3D geography.

**Mid-Zoom (The Transition & Political Map)**
*   **The Blend:** As you scroll in, the game executes a smooth transition, dissolving the 2D paper map to reveal the 3D map underneath. 
*   **Map Overlays:** At this mid-level, the political map overlay is dominant. You see the 3D topography of the earth (mountains, rivers, plains), but the land is heavily shaded with the colors of the various realms, duchies, and counties. 

**3. Fully Zoomed In (The Detailed Terrain Map)**
*   **High-Fidelity Rendering:** Reaching the closest zoom levels requires the most GPU power, as the engine stops hiding the environment and fully renders the 3D terrain, including individual trees and baronies. 
*   **Overlay Fading:** By default, the heavy political map overlay shading becomes "hollow" or fades away to let the actual terrain textures shine through. 
*   **Dynamic Elements:** At this micro-level, the world comes alive. You can see 3D character models for armies moving across the map, and dynamic weather effects become visible, such as falling snow particles over regions experiencing cold winter months.

Update the camera controller: Implement a pitch-shifting zoom where scrolling out makes the camera look straight down, and scrolling in drops the height while tilting to a 45-degree angle. The camera must zoom towards the mouse cursor's position on the terrain. Finally, implement strict X/Z bounds clamping on the camera's focal point so the player cannot pan past the edges of the map grid, and add a visual border (fog/ocean/table) so the empty void outside the map is never rendered on screen.
**Acceptance:**
- Camera smoothly zooms from empire overview to tactical detail
- Visibility changes at each zoom threshold
- No rendering of invisible entities at zoom level
- Performance maintained at 500+ entities
- Near camera never exposes an empty black ceiling/void as the intended world presentation
- Far camera frames the map as an authored object, not an infinite black plane

---

### Task M5 — Debug HUD v2 (V3 Fields Display) (Done)

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

### Task M6 — Live Rust Frame Rendering / Network Mode (Done)

**Critical for:** MonoGame renders real data from Rust backend without destroying the local demo.

**Files to modify:**
- `client-monogame/Program.cs` — parse command line arguments
- `client-monogame/GameRoot.cs` — switch render source based on mode
- `client-monogame/Rendering/PlayableRenderAdapter.cs` — bridge adapter
- `client-monogame/Models/PlayableSimulation.cs` — keep as standalone demo

**Implementation:**
```csharp
// GameRoot must preserve _playableSimulation for the normal local demo.
// If the app is launched normally (e.g., `dotnet run`), it should run the demo.
// If invoked with a network flag/dataset argument, it connects to the Node/Rust backend and uses _viewModel.

// Strategy: 
// - Check command line args in Program.cs and pass a mode flag to GameRoot.
// - If Mode == LocalDemo, only run and render PlayableSimulation.
// - If Mode == Network/Live, start _frameReceiver and render from _viewModel.
// - Tile source: use decoded FrameV1 tile data
// - Tribe source: use decoded FrameV1 tribe records  
// - War/event overlay: from frame event delta
```

**Acceptance:**
- `dotnet run` normally still starts the rich local demo without waiting for a server.
- Launching with a network/dataset argument connects to Rust and renders real frame data.
- The local demo is not "kicked out" or broken; it remains a valid standalone mode.
- Frame decoder V1 path used when available in network mode.

**WAIT-FOR:** Task M1 (FrameV1 decoder), Task R7 (FrameV1 protocol)

---

### Task M7 — Biome-Specific Visual Rendering (Done)

**Files to modify:**
- `client-monogame/Rendering/WorldRenderer.cs` — biome tile drawing
- `client-monogame/Assets/BiomeVisualProfile.cs` — add biome props
- `client-monogame/Rendering/VegetationRenderer.cs` — biome-instanced

**Dependency note:**
- M7 should use the rule-driven prop system from M15 once that exists. Do not keep adding one-off prop placement directly inside `VegetationRenderer`.
- Terrain variation should stay texture/elevation driven. Large chunk models are visual props only, not the terrain surface.

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
- Rocky Hills/Highlands: rockier texture, low visual elevation, cliff shrubs, stone markers, sparse trees only where biome rules allow
- Swamp/Marsh: mud texture, dead trees, reeds, stilt props
- River: water material, banks, no vegetation on river tiles
- Fertile Valley: green grass, dense settlement props, grain fields

**Asset Status:** Most biome textures exist in Content/Materials/Terrain/. Biome-specific tree density rules are now driven by `BiomePropRule` in `AssetManifest.cs` (completed in M15).

**Acceptance:**
- Each biome has distinct visual terrain color/texture
- Trees/props auto-instanced based on M15 biome prop rules
- Missing biome texture falls back to Plains
- Performance: instanced trees don't tank frame rate

---

### Task M8 — Faction Insignia & Banner System (Done)

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
    public string IconKey; // randomly assigned emblem
    public string PolityFrameKey; // e.g., "tribe_polity", "city_polity"
}
```

1. **Green-Screen Coordinate Parsing (Texture Loading):**
   - The polity insignias (`1024x1024 .png`) contain a pure `#00FF00` (green) circle indicating exactly where the emblem should be placed.
   - Upon loading a polity texture, use `GetData<Color>()` to scan for `Color(0, 255, 0)`.
   - Calculate the center `(X,Y)` and radius/diameter of this green zone. Cache these coordinates for the renderer.
   - Replace all `#00FF00` pixels with `Color.Transparent` using `SetData<Color>()` so the frame becomes a hollow window for the emblem.

2. **The Emblem & Frame Layering (`BannerRenderer.cs`):**
   - The emblems (`Content/Image/icons/`) are 512x512 with a black background and white symbol.
   - **Base Layer:** Draw the emblem texture scaled down and offset to match the cached center and radius found in Step 1. Apply a `SpriteBatch` color tint (derived from faction colors) to the emblem. This tints the white symbol while keeping the black background, creating a solid dark backing inside the ring.
   - **Middle Layer:** Draw the cleaned `_polity` frame (`Content/Image/polity/`) exactly on top of the emblem. Its inner ring perfectly covers the hard edges of the square emblem.

3. **The Ribbon & Text:**
   - **Top Layer:** Right below the polity frame, draw `location-ribbon-banner.png`. Using a `SpriteFont` and `MeasureString`, calculate the exact center of the text (e.g., "Tribe 1") and draw it perfectly centered on top of the ribbon.
   - The entire banner group appears at mid-to-far zoom levels.

4. **Faction Colors & Assignment:**
   - Icons: Randomly assign one of the 44 available icons to each tribe based on their `Tribe.Id`.
   - Colors: Auto-generate `PrimaryColor` from `PlayableTribe.Artifacts`:
     - High `Combat` -> Aggressive martial colors (Crimson, Bronze, Deep Orange)
     - High `Team` -> Unity colors (Azure, Gold, Royal Blue)
     - High `Risk` -> Endurance colors (Forest Green, Slate Grey)

**(Done) !!!ASSET-NEEDED:** Assets successfully provided in `Content/Image/icons` and `Content/Image/polity`.

**Acceptance:**
- Emblems perfectly masked inside polity frames using the draw order technique.
- Banners visible at mid-to-far zoom levels.
- Colors derived from artifact profile (not random).
- Icons randomly distributed across tribes.
- Polity name displayed centered on the ribbon below the insignia.

---

### Task M9 — Lineage & Tombstone Inspection UI (Done)

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

### Task M10 — Font & UI Art Direction Pass (Done)

**Files to modify:**
- `client-monogame/Content/UI/Fonts/` — add font files
- `client-monogame/UI/DebugHud.cs` — apply fonts
- `client-monogame/UI/*.cs` — style pass

**Font choices from asset plan:**
- Display: Cinzel (Google Fonts) — for polity names, titles
- Body: Noto Serif (Google Fonts) — for dossiers, text panels
- Debug: Trykker — for debug HUD

**!!!ASSET-NEEDED: (Done)** Download and place font files in `Content/UI/Fonts/`. Test with:
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

### Task M11 — Map Presentation: Parchment On Table, No Black Skybox (Done)

**Critical for:** Making the desktop client feel like an intentional strategy game instead of a debug renderer.

**Files to create:**
- `client-monogame/Rendering/TabletopRenderer.cs`
- `client-monogame/Rendering/ParchmentMapRenderer.cs`

**Files to modify:**
- `client-monogame/GameRoot.cs`
- `client-monogame/Rendering/WorldRenderer.cs`
- `client-monogame/Rendering/IsometricCamera.cs`

**Visual target:**
- The hex world is presented as a parchment map laid on a table.
- Outside the map bounds, the player sees parchment margins and table surface, not black void.
- There is no visible "ceiling" or black skybox. The camera should never make the simulation look like a floating grid in empty space.
- The table/parchment frame is a world-space presentation layer, not a HUD panel.

**Scope guardrail:**
- Start with one flat textured table quad and one flat textured parchment quad under the map.
- Do not start with curled parchment, thick paper geometry, bevels, shadow-catcher tricks, or ornate table dressing.
- Only refine parchment edges after camera clipping, world bounds, depth sorting, and lighting consistency are stable.

**Implementation:**
```csharp
public sealed class TabletopRenderer {
    public void DrawTable(GraphicsDevice device, IsometricCamera camera, RectangleF worldBounds);
    public void DrawParchment(GraphicsDevice device, IsometricCamera camera, RectangleF mapBounds);
}
```

**Design rules:**
- The table should be a large low plane beneath and around the map.
- Parchment should extend beyond the outer hexes by a comfortable margin.
- Map edge should read as a parchment cut/deckled edge, not a hard black alpha edge.
- The clear color can stay dark only behind the authored tabletop scene; normal camera angles should not reveal it.
- Do not add decorative gradient/orb backgrounds. This is a physical tabletop scene.
- Use the Content/Image/parchment-bg.jpg as the parchment texture
**Acceptance:**
- Screenshots at close, mid, and far zoom never show a large black void around normal map framing.
- Map edge clearly sits on parchment.
- Parchment sits on table.
- The solution works even when map size changes with tribe count.
- HUD remains readable over the tabletop scene.
	- [x] TabletopRenderer created: table quad (10000x10000) + parchment quad with texture
	- [x] WorldRenderer.cs and IsometricCamera.cs required no changes
	- [x] Map bounds computed from tiles each frame — adapts to map size changes
	- [x] Build succeeds with 0 errors
	- [ ] Visual acceptance needs runtime screenshot verification (see TaskM11Run.md)

---

### Task M12 — FBX Runtime Asset Pipeline Hardening Mini-Phase (Done)

**Critical for:** Settlement models and imported props actually appearing in MonoGame.

**Files to modify:**
- `client-monogame/Rendering/VegetationRenderer.cs`
- `client-monogame/Assets/AssetLoadDiagnostics.cs`
- `client-monogame/TribalNeuroSim.Client.csproj`
- `client-monogame-tests/Program.cs`

**Problem to solve:**
- External viewers load the Meshy FBX files correctly.
- Runtime rendering still needs explicit validation for scene transforms, handedness, units, winding, material texture lookup, bounds, scale, and draw visibility.
- Some settlement models exceed 700k vertices and require 32-bit index buffers.
- This is a known trap zone, not a simple loader task. Expected failure modes include wrong scale, inverted axes, flipped winding, missing textures, origin offset, and broken normals.

**Mini-phase breakdown:**
- M12A: file resolution and diagnostics. Confirm paths, importer type, mesh counts, material names, and texture references.
- M12B: geometry construction. Confirm 32-bit index buffers, vertex declarations, bounds, winding, culling, and normals.
- M12C: transform normalization. Apply node transforms, unit conversion, axis conversion, origin recentering, and known scale policy.
- M12D: material fallback. Load diffuse/normal/metallic/roughness when available; render readable fallback material when not.
- M12E: isolated viewer mode. Render one imported model at origin with a fixed camera and lighting before placing it on the world map.
- M12F: map placement. Only after M12E succeeds, place settlement instances on capital tiles.

**Implementation requirements:**
- Import FBX with scene/node transforms applied.
- Use 32-bit index buffers for any mesh that can exceed 65,535 vertices or indices.
- Log every model load to `client-monogame/asset-load.log`.
- Log: asset key, resolved path, importer type, vertex count, index count, primitive count, bounds, horizontal extent, texture path, first instance position, scale, and draw-call count.
- Keep culling disabled for imported FBX until winding is verified.
- Add a debug mode that can render one settlement model alone at origin with a known camera.

**Acceptance:**
- `tribal_green.fbx` loads and appears visibly in isolated viewer mode first.
- `tribal_green.fbx` then appears visibly on the map at the correct capital tile.
- `asset-load.log` explains any missing model without needing a debugger.
- The test suite verifies the model exceeds `ushort.MaxValue` so the 32-bit path cannot be removed accidentally.
- At least one high-poly settlement and one GLB prop are proven visible in-game.
- Missing satellite textures do not prevent geometry from loading; geometry should render with fallback material if needed.
- A taskrun note records scale policy, axis conversion, winding/culling decision, texture lookup behavior, and model bounds.

---

### Task M13 — Settlement Renderer And LOD Strategy (Done)

**Critical for:** Turning M2 asset registration into actual map visuals.

**Files to create:**
- `client-monogame/Rendering/SettlementRenderer.cs`
- `client-monogame/Assets/SettlementLodProfile.cs`

**Files to modify:**
- `client-monogame/GameRoot.cs`
- `client-monogame/Assets/AssetRegistry.cs`
- `client-monogame/Assets/AssetManifest.cs`
- `client-monogame/Rendering/VegetationRenderer.cs`

**Implementation:**
- Move capital/settlement placement out of generic vegetation rendering.
- Resolve settlement model by `PolityTier` and biome.
- Place settlement on the tribe main camp/capital tile.
- Use actual model bounds to scale to a hex footprint.
- Add LOD tiers:
  - Close: full model for selected/near capital only.
  - Mid: simplified model, generated proxy, or lower-detail mesh.
  - Far: billboard/banner/insignia marker.

**Acceptance:**
- Tribe capitals render as settlement models, not circles or generic markers.
- City/Duchy/Kingdom/Empire can render different models once simulation creates those tiers.
- More than 10 tribes do not draw 10 full 700k-vertex meshes at once.
- Selected settlement can use highest detail; unselected/far settlements use cheaper visuals.
- Settlement draw order does not hide selection or territory borders.

---

### Task M14 — Heightmap And Terrain Relief Without Chunk Mountains (Done)

**Critical for:** Making the map feel like terrain while preserving the satellite/parchment-map view.

**Files to modify:**
- `client-monogame/Models/PlayableWorldGenerator.cs`
- `client-monogame/Rendering/HexTerrainMesh.cs`
- `client-monogame/Rendering/PlayableRenderAdapter.cs`
- `client-monogame/Rendering/WorldRenderer.cs`

**Rules:**
- Do not spawn giant mountain/cliff chunk models as terrain.
- Hills, valleys, cold regions, and highlands should be readable through subtle elevation, texture, tint, and prop density.
- Terrain should remain mostly flat and map-like.
- Rocks are visual dressing props, not terrain replacement.

**Implementation:**
- Use deterministic visual elevation from seeded noise.
- Keep elevation amplitude low enough that the map still reads as a board/parchment map.
- Slightly lift hills/highlands and lower river/marsh regions.
- Place prop objects at the tile's visual elevation.
- Optional later: generate a continuous terrain mesh instead of per-hex y offsets if seams become too visible.

**Acceptance:**
- At low camera angle, the terrain has visible relief.
- At normal strategy angle, the terrain still reads as a coherent map.
- No large terrain chunks appear as mountains.
- Rocks/grass/trees are spawned as small prop elements with their own textures.

---

### Task M15 — Prop, Grass, Tree, And Rock Dressing Pass (Done)

**Critical for:** Replacing the empty texture-board look with believable terrain dressing.

**Files to create:**
- `client-monogame/Assets/PropVisualProfile.cs`
- `client-monogame/Assets/BiomePropRule.cs`
- `client-monogame/Rendering/PropPlacementPlanner.cs`
- `client-monogame/Rendering/PropInstanceBatch.cs`

**Files to modify:**
- `client-monogame/Rendering/VegetationRenderer.cs`
- `client-monogame/Assets/BiomeVisualProfile.cs`
- `client-monogame/Assets/AssetManifest.cs`

**Goal:**
- Vegetation, trees, rocks, reeds, logs, and grass must have a real generation structure.
- They should not be hardcoded ad hoc in `VegetationRenderer`.
- The renderer should consume planned prop instances; biome/profile rules should decide what appears and where.

**Scope guardrail for V0:**
- Start with at most 2-3 prop families per biome.
- Use deterministic placement first; add visual variation only after the stable baseline renders well.
- Do not build a complex constraint solver in the first pass.
- Cap prop count per tile and per visible frame before adding more asset variety.
- Prefer sparse, readable dressing over noisy realism.

**Data model:**
```csharp
public enum PropFamily {
    GrassPatch,
    Tree,
    Bush,
    Rock,
    Reed,
    DeadWood,
    Log,
    Flower,
    SettlementClutter,
}

public sealed record PropVisualProfile(
    string Key,
    PropFamily Family,
    string ModelKey,
    string? DiffuseTextureKey,
    float BaseScale,
    float ScaleVariance,
    bool WindAffected,
    bool BlocksSettlementFootprint,
    float MinCameraDistance,
    float MaxCameraDistance);

public sealed record BiomePropRule(
    BiomeId Biome,
    PropFamily Family,
    float Density,
    int MinPerTile,
    int MaxPerTile,
    float MinDistanceFromTileCenter,
    float MaxDistanceFromTileCenter,
    float AvoidCapitalRadius,
    float ElevationBias,
    string[] CandidatePropKeys);
```

**Implementation:**
- Use biome profiles for prop density and prop families.
- Plains/fertile: grass patches, low shrubs, occasional rocks.
- Forest/woodland: tree clusters, bushes, fallen logs.
- Hills/highlands: small rock clusters, sparse shrubs, dry grass.
- Cold: snow vegetation, conifers, snow rocks.
- Marsh/riverland: reeds, dead trees, plants; no random dry boulders.
- Add simple wind sway only to grass, plants, bushes, and flexible vegetation.
- Add deterministic per-tile prop seeds so reruns are stable.
- V0 prop sets:
  - Plains/fertile: grass patch, small bush, small rock.
  - Forest/woodland: tree, bush, fallen log.
  - Hills/highlands: small rock, dry grass, sparse bush.
  - Marsh/riverland: reed, dead wood, marsh plant.
  - Cold: conifer or snow shrub, snow rock, low grass.
- Use placement constraints:
  - no trees inside capital footprint
  - no large rocks directly on settlement center
  - no dry rocks/reeds in invalid biomes
  - no dense tree clusters on river/water-like tiles
  - grass patches may overlap visually but should stay low and not hide tile borders
- Use LOD/distance rules:
  - close: individual grass/tree/rock props
  - mid: reduced prop count
  - far: no individual grass; optionally use biome texture only
- Use batching by model/material key where possible.
- Log missing prop models and textures through the asset diagnostics log.

**Acceptance:**
- Grass tiles contain actual grass/vegetation props.
- Forest and woodland tiles contain trees from a rule-driven placement system.
- Hills/highlands use small rocks as visual elements, not terrain chunks.
- Marsh/riverland prop rules prefer reeds/dead wood/plants and reject dry-biome clutter.
- Props never dominate the tile or hide settlement/capital models.
- Wind dynamics are subtle and readable.
- Props use their respective texture or a clear fallback material.
- Performance remains acceptable with the default demo tribe count.
- All biome prop rules are inspectable in `AssetManifest` or a dedicated manifest file.
- A failed prop asset load produces a useful `asset-load.log` line.

---

### Task M16 — Selection, Inspection, And Interaction Cleanup (Done)

**Critical for:** Making the game playable rather than merely visible.

**Files to create:**
- `client-monogame/Input/SelectionSystem.cs`
- `client-monogame/UI/SelectionPanel.cs`

**Files to modify:**
- `client-monogame/GameRoot.cs`
- `client-monogame/Rendering/WorldRenderer.cs`
- `client-monogame/UI/DebugHud.cs`

**Rules:**
- Selection should not be represented by huge abstract circles.
- Selected tile and selected tribe need readable but restrained highlights.
- A selected capital should be highlighted around its hex footprint or with a small banner, not a giant floating disk.

**Acceptance:**
- Click selects a tile or tribe reliably.
- Selected hex outline follows the exact hex border.
- Selected tribe panel shows: tier, population, food, territory count, artifact profile, current behavior, disputes.
- Debug HUD and gameplay inspection are visually separate.
- No large unexplained circles remain in normal rendering.

---

### Task M17 — Render Performance And Draw Budget (Done)

**Critical for:** Preventing visual upgrades from killing the simulation demo.

**Files to modify:**
- `client-monogame/GameRoot.cs`
- `client-monogame/Rendering/*.cs`
- `client-monogame/UI/DebugHud.cs`

**Metrics to expose:**
- FPS
- terrain tiles drawn
- settlement instances drawn by LOD
- vegetation/prop instances drawn
- total primitives submitted
- asset load failures
- frame decode latency

**Acceptance:**
- Default local demo runs smoothly with 10-20 tribes.
- Far zoom avoids drawing high-poly settlement meshes.
- Selected high-detail settlement model does not freeze the client.
- Debug HUD or diagnostics can show why performance drops.
- Asset load and render budgets are documented in a short taskrun note.

---

### Task M18 — Local Demo World Quality Pass

**Critical for:** A demo that communicates the intended game even without Rust backend connection.

**Files to modify:**
- `client-monogame/Models/PlayableSimulation.cs`
- `client-monogame/Models/PlayableWorldGenerator.cs`
- `client-monogame/Rendering/PlayableRenderAdapter.cs`

**Implementation:**
- Keep deterministic world generation.
- Map size scales from tribe count.
- Tribe spawn points are scattered by noise/viability, not a center ring.
- Biome regions are coherent and not random speckles.
- Main camps start on viable terrain.
- Local simulation remains useful as a renderer testbed when Rust/Node is disconnected.

**Acceptance:**
- Running the client offline shows an intentional generated world.
- Tribe capitals are placed around the map in plausible positions.
- Biome distribution supports visual testing of grass, trees, rocks, snow, desert/dry, and water/marsh regions.
- The demo does not depend on remote connection to be visually meaningful.

---

### Task M18B — Local Demo Merger And Empire Stress Scenario

**Critical for:** Testing merger mechanics all the way to the top polity tier without depending on a perfect live backend run.

**Files to modify:**
- `client-monogame/Models/PlayableSimulation.cs`
- `client-monogame/Models/PlayableWorldGenerator.cs`
- `client-monogame/Models/Tribe.cs`
- `client-monogame/UI/DebugHud.cs`

**Problem to solve:**
- The demo needs enough initial clusters/tribes that some can die out while others still have enough neighbors, alliances, and territory pressure to merge upward.
- The local testbed should be able to exercise Tribe -> City -> County/Duchy -> Kingdom -> Empire visuals and state transitions.
- This is especially important for validating settlement tier models, banners, territory ownership, selection UI, and merge/tier rules before live data is perfect.

**Implementation direction:**
- Add a deterministic "empire stress" demo preset separate from the default lightweight demo.
- Spawn enough viable tribe clusters to make top-tier formation likely even after extinctions.
- Ensure clusters are distributed across the map by viability/noise, not a center ring.
- Bias some neighboring tribes toward compatible alliance/merge behavior so the top tier can be reached in a reasonable demo time.
- Keep hostile/low-resource regions present so extinction and failed alliances still occur.
- Scale map size from initial tribe/cluster count so the map is dense enough for interaction but not visually cramped.
- Add a debug HUD line for highest polity tier reached and active merge count.

**Acceptance:**
- The stress preset can reach at least Kingdom tier reliably under a fixed seed.
- At least one fixed seed can reach Empire tier within a documented tick budget.
- Some tribes may die out without preventing later high-tier formation.
- Settlement renderer sees multiple tiers during one run.
- The run remains deterministic for the same seed and preset.
- A taskrun note records the seed, initial tribe count, map size, tick budget, highest tier reached, and extinction count.

---

### Task M18C — Local Demo Dispute Behavior Harness (Done)

**Critical for:** Validating disputed-zone visuals in the acceptance checklist.

**Problem to solve:**
- The renderer has disputed tile overlays, but the current local demo often reaches visual-review checkpoints with zero disputed tiles.
- This blocks acceptance for:
  - disputed zones visible
  - disputed overlay subtle
- The fix should be behavioral/test-harness oriented, not a fake always-on overlay.

**Implementation direction:**
- Add a deterministic local debug preset or hotkey that creates several contested tiles within a short tick budget.
- Keep the default demo believable; use a separate dispute stress path if needed.
- Ensure contested tiles have at least two real controlling tribes with normalized control shares.
- Ensure the selection panel and HUD expose dispute count and selected tribe dispute state.
- Capture close/mid/far screenshots from the dispute preset for the visual checklist.

**Acceptance:**
- [x] A fixed seed/preset produces non-zero disputed tiles within the documented tick budget.
- [x] Disputed tiles render colored crosshatch/overlay using actual contesting tribe IDs.
- [x] Overlay remains subtle enough that terrain texture is still readable.
- [x] The run is deterministic for the same seed and preset.
- [x] A taskrun note records seed, tick, disputed tile count, and screenshot paths.

**Done:** Food economy rebalanced (regrowth 0.012→0.030, upkeep 0.028→0.016, relaxed expansion costs). Added `DemoMode.DisputeStress` with `--dispute-stress` CLI flag, dense 42 tiles/tribe map, high Combat/Risk artifact bias. Added `ForceDispute()` method and 'F' hotkey (changed from 'D' to avoid WASD camera conflict) for on-demand dispute creation. Selection panel and HUD already exposed dispute counts. See `docs/taskrun/TaskM18CRun.md`.

---

### Task M19 — Visual Screenshot Acceptance Harness (Done)

**Critical for:** Stopping "it builds but looks wrong" regressions.

**Files to create:**
- `client-monogame/Diagnostics/ScreenshotCapture.cs`
- `docs/taskrun/visual-acceptance-checklist.md`

**Files to modify:**
- `client-monogame/GameRoot.cs`

**Implementation:**
- Add a deterministic screenshot/debug camera mode.
- Capture close, mid, and far view screenshots.
- Document visual acceptance criteria:
  - no black void/ceiling in normal framing
  - parchment/table visible outside map
  - settlement model visible on capital
  - borders follow hex edges
  - vegetation props visible on grass/forest tiles
  - no giant unexplained circles
  - no terrain chunk mountains

**Acceptance:**
- A developer can run one command or press one debug key to capture comparison screenshots.
- The taskrun folder contains a current visual acceptance checklist.
- Future visual changes include screenshots before being called done.

---

### Task M21 — Settlement Lighting Coherence Fix

**Critical for:** Settlements looking grounded instead of pasted on with a different sun.

**Problem:** `SettlementRenderer.EnsureEffect()` calls `EnableDefaultLighting()` — MonoGame's built-in default directional setup. Terrain uses two custom directional lights (warm main `(0.5, -1, -0.3)` / cool fill `(-0.3, -0.6, 0.5)`). Settlements are shaded by a different sun than everything else, making them look disconnected.

**Files to modify:**
- `client-monogame/Rendering/SettlementRenderer.cs` — `EnsureEffect()` and `Render()`

**Implementation:**
Replace `_effect.EnableDefaultLighting()` with the same light setup as `WorldRenderer`:
```csharp
_effect = new BasicEffect(graphicsDevice)
{
    TextureEnabled = false,
    VertexColorEnabled = false,
    LightingEnabled = true,
    PreferPerPixelLighting = true,
    AmbientLightColor = new Vector3(0.30f, 0.30f, 0.28f),
    DiffuseColor = new Vector3(0.75f, 0.68f, 0.55f),
};
_effect.DirectionalLight0.Enabled = true;
_effect.DirectionalLight0.Direction = Vector3.Normalize(new Vector3(0.5f, -1f, -0.3f));
_effect.DirectionalLight0.DiffuseColor = new Vector3(0.85f, 0.82f, 0.70f);
_effect.DirectionalLight1.Enabled = true;
_effect.DirectionalLight1.Direction = Vector3.Normalize(new Vector3(-0.3f, -0.6f, 0.5f));
_effect.DirectionalLight1.DiffuseColor = new Vector3(0.20f, 0.22f, 0.30f);
_effect.DirectionalLight2.Enabled = false;
```

Extract the shared light constants to a static class `SceneLighting` in `client-monogame/Rendering/SceneLighting.cs` so both renderers reference the same values rather than duplicating them.

**Acceptance:**
- Settlement models cast and receive the same directional shading as terrain tiles — same apparent sun angle
- Shadows/highlights on a settlement match the shading direction on adjacent terrain hexes
- `SceneLighting.cs` is the single source of truth for directional light vectors and colors
- No new runtime cost — same BasicEffect, same draw calls

---

### Task M22 — Post-Process Render Target Pass (Vignette + Color Grade) (Done)

**Critical for:** Making every screenshot look authored instead of raw debug output.

**Problem:** Scene renders straight to back buffer. No color grade, no vignette, no post-processing of any kind. Even a minimal post-process pass makes the scene read as intentional and raises perceived quality significantly.

**Files to create:**
- `client-monogame/Rendering/PostProcessRenderer.cs`

**Files to modify:**
- `client-monogame/GameRoot.cs` — render scene to RT, apply post-process before Present

**Implementation:**

```csharp
public sealed class PostProcessRenderer : IDisposable
{
    private RenderTarget2D? _sceneTarget;
    private Texture2D? _vignetteOverlay;
    private SpriteBatch? _spriteBatch;

    // Called once at startup / on resize
    public void EnsureTargets(GraphicsDevice gd, int width, int height);

    // Returns the RenderTarget2D to draw the scene into
    public RenderTarget2D SceneTarget => _sceneTarget!;

    // Final composite: draw scene RT with color grade, then vignette overlay
    public void Apply(GraphicsDevice gd);
}
```

**Pipeline in `GameRoot.Update/Draw`:**
1. `graphicsDevice.SetRenderTarget(postProcess.SceneTarget)` — begin scene
2. Draw everything (tabletop, terrain, settlements, props, territory, banners, HUD)
3. `graphicsDevice.SetRenderTarget(null)` — back to back buffer
4. `postProcess.Apply(graphicsDevice)`:
   - Draw scene RT with `SpriteBatch` using a warm multiply tint: `Color(255, 248, 235)` at ~90% alpha — gives the whole scene a warm parchment-adjacent grade
   - Draw vignette overlay: a pre-baked `Texture2D` (or CPU-generated gradient) with `Color.Black` at edges, `Color.Transparent` center, `BlendState.AlphaBlend`

**Vignette texture generation (no shader needed):**
```csharp
private static Texture2D GenerateVignette(GraphicsDevice gd, int width, int height)
{
    var pixels = new Color[width * height];
    var cx = width * 0.5f;
    var cy = height * 0.5f;
    var maxDist = MathF.Sqrt(cx * cx + cy * cy);
    for (var y = 0; y < height; y++)
    for (var x = 0; x < width; x++)
    {
        var dx = (x - cx) / maxDist;
        var dy = (y - cy) / maxDist;
        var dist = MathF.Sqrt(dx * dx + dy * dy);
        var alpha = MathF.Pow(MathHelper.Clamp(dist - 0.45f, 0f, 1f) / 0.55f, 2.2f);
        pixels[y * width + x] = Color.Black * alpha;
    }
    // ... SetData
}
```

**Scope guardrail:**
- No HLSL custom shaders in V0. CPU-generated vignette texture + SpriteBatch tint only.
- Only add a bloom pass if V0 compiles clean and the vignette alone looks good.
- Resize the render target when the window resizes (hook `Window.ClientSizeChanged`).

**Acceptance:**
- All screenshots have soft darkened edges (vignette)
- Scene has a subtle warm parchment color grade (not harsh orange, just enough to unify the palette)
- No performance regression — one extra SpriteBatch pass at end of frame
- HUD still renders on top (draw HUD after `postProcess.Apply`, not into the scene RT, or draw HUD into the RT after scene)
- Toggle with `P` key for before/after comparison

---

### Task M23 — Settlement Ground Shadows (Blob AO)

**Critical for:** 3D settlement models looking grounded on terrain instead of floating pasted-on.

**Problem:** Settlement models sit on terrain tiles with no shadow connection. No ground contact shadow = models look like they're floating or added in Photoshop. A soft dark ellipse beneath each model gives instant depth perception at near-zero cost.

**Files to create:**
- `client-monogame/Rendering/BlobShadowRenderer.cs`

**Files to modify:**
- `client-monogame/GameRoot.cs` — draw blob shadows between terrain and settlement models
- `client-monogame/Rendering/SettlementRenderer.cs` — expose draw list for shadow pass

**Implementation:**
```csharp
public sealed class BlobShadowRenderer : IDisposable
{
    private Texture2D? _shadowTexture; // pre-baked radial gradient: white center → transparent edges
    private SpriteBatch? _spriteBatch;

    // Pre-bake shadow texture (64x64 soft radial gradient, greyscale)
    public void Initialize(GraphicsDevice gd);

    // Draw one blob shadow per settlement, projected to terrain surface
    // Must be called AFTER terrain, BEFORE settlement models
    public void DrawShadows(
        GraphicsDevice gd,
        IReadOnlyList<SettlementDraw> draws,
        IsometricCamera camera,
        int selectedTribeId);
}
```

**Shadow placement:**
- Project each settlement's 3D world position to screen space via camera view/projection matrices
- Draw `_shadowTexture` at screen position, sized proportional to settlement model horizontal extent
- Use `BlendState` with: `ColorSourceBlend = AlphaBlend, AlphaSourceBlend = Zero` (darkening blend)
- Shadow color: `Color.Black * 0.35f` — subtle, not harsh
- Shadow ellipse: horizontal radius = `modelHorizontalExtent * 1.2f`, vertical radius = `horizontal * 0.4f` (isometric foreshortening)
- Offset shadow slightly in light direction: `+8px right, +4px down` (matches `DirectionalLight0` direction from M21/`SceneLighting`)
- Selected tribe: shadow slightly larger and slightly darker (`0.50f` alpha) to reinforce selection

**Acceptance:**
- Each settlement capital has a soft dark ellipse on the terrain beneath it
- Shadow size scales correctly from close to mid zoom (disappears at far zoom, same LOD cutoff as settlement model)
- Shadow does not appear at far zoom where settlement is replaced by a marker
- No z-fighting with terrain — shadow drawn with `DepthStencilState.None` in screen space pass
- Scene does not look worse with shadows off (toggle available for comparison)

---

### Task M20 — Tribe Stakes And Gameplay Readability Pass

**Critical for:** Making the player care about tribes after the rendering pipeline becomes believable.

**Status:** Deferred until the core visual pipeline is stable.

**Problem to solve:**
- The rendering plan is now ambitious, but the demo still needs a readable reason to care about each tribe.
- Visual polish should support simulation/gameplay meaning, not replace it.

**Implementation direction:**
- Give each tribe a compact identity summary: tier, behavior tendency, current pressure, food/population trend, and current dispute or expansion goal.
- Make capitals, territory, and inspection UI answer: "what is this tribe doing and why does it matter?"
- Prefer small readable state indicators over more abstract circles.

**Acceptance:**
- Selecting a tribe gives a clear narrative snapshot in under five seconds.
- The player can tell which tribes are growing, starving, disputing, collapsing, or dominating.
- Visual elements reinforce tribe state instead of existing as decoration only.

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

### Current Position After 2026-05-06 MonoGame Pass

Rust R1-R7 are recorded as done in this task list. R8 is the next behavioral tuning task for slower, costed, defensible expansion.

MonoGame has advanced beyond the earlier first-pass state:

- M1 is done: FrameV1 decoder exists.
- M2 is done: settlement assets are registered, tier/biome profiles resolve, and runtime placement is wired.
- M3 is done: territory borders use exact six-edge hex geometry with zoom-aware disputed overlays.
- M4 is done: semantic zoom, pitch shifting, cursor-directed zoom, damping, and map bounds clamping are implemented.
- M11 is done: flat parchment and tabletop presentation removes the normal black-void framing.
- M12 is done: FBX runtime diagnostics, 32-bit indices, transform policy, material fallback, and isolated viewer are implemented.
- M13 is done: settlements are separated from vegetation and rendered with LOD/caps.
- M14 is done: subtle heightmap relief replaces terrain chunk mountains.
- M15 is done: rule-driven biome prop placement exists.
- M16 is done: selection/inspection cleanup replaced large circles with exact hex selection and a separate panel.
- M7 is done: per-biome ambient tint, Plains texture fallback, BiomeId on RenderableTile for biome-specific terrain rendering.

Remaining work should now prioritize behavior tuning, validation, performance, and game readability rather than basic rendering infrastructure.

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
| M6 — Live Rust Rendering | M1 | DONE — network mode renders from FrameV1 data; local demo preserved |
| M9 — Lineage/Tombstone UI | R1, R2 |
| N3 — End Analytics Export | R1, R2 |

### Phase D — MonoGame Visual Completion (Ordered Unless Explicitly Split)
| Task | Notes |
|------|-------|
| R8 — Expansion Pace/Claim Cost | DONE — per-tribe cooldown, food cost, pop gate, integration period, overextension |
| M12 — FBX Runtime Asset Pipeline Mini-Phase | DONE — diagnostics, transforms, 32-bit indices, fallback material, isolated viewer |
| M13 — Settlement Renderer And LOD Strategy | DONE — dedicated renderer, LOD thresholds, max draw cap |
| M15 — Prop/Grass/Tree/Rock Dressing Structure | DONE — rule-driven deterministic prop placement |
| M14 — Heightmap/Terrain Relief | DONE — subtle map-like relief, no terrain chunk mountains |
| M11 — Parchment On Table Presentation | DONE — flat table quad + flat parchment quad under map |
| M3 follow-up — Exact Hex Borders | DONE — exact six-edge borders and zoom-aware disputed overlays |
| M4 — Semantic Zoom | DONE — pitch-shifting, cursor-directed, bounds clamping, zoom damping |
| M7 — Biome Visuals | DONE — per-biome ambient tint, Plains texture fallback, BiomeId on RenderableTile |
| M8 — Faction Insignia | DONE — faction colors, icon assignment, green-screen banner compositing, mid-to-far zoom rendering |
| M10 — Font & UI | DONE — Cinzel (display), Noto Serif (body), Trykker (debug) via PrivateFontCollection |
| M16 — Selection/Inspection Cleanup | DONE — exact hex picking, selection panel, no large circles |
| M17 — Render Performance Budget | DONE — FPS, draw counters, primitives estimate, budget bar in Debug HUD |
| M18 — Local Demo World Quality | Keeps offline demo useful |
| M18B — Local Demo Merger/Empire Stress Scenario | **Done** — `CreateEmpireStress()` preset, polity tier progression in merges, HUD tracking, `--empire-stress` flag |
| M18C — Local Demo Dispute Behavior Harness | **Done** — food economy rebalance, `CreateDisputeStress()` preset, `ForceDispute()` + 'F' hotkey, `--dispute-stress` flag |
| M19 — Visual Screenshot Acceptance Harness | DONE — F6 captures close/mid/far PNGs, checklist in docs/taskrun/visual-acceptance-checklist.md |
| M21 — Settlement Lighting Coherence | Fix settlement BasicEffect lights to match terrain light directions. **Done** — `SceneLighting.cs` shared constants, both renderers use same directional lights |
| M22 — Post-Process Render Target Pass | **Done** — warm parchment tint + radial vignette via CPU-generated texture; scene rendered to RT, composited before UI; P key toggles; no custom shaders |
| M23 — Settlement Ground Shadows | **Done** — BlobShadowRenderer draws soft radial shadow ellipses under settlement capitals between terrain/vegetation and model passes; LOD-aware, screen-space, no z-fighting |
| M20 — Tribe Stakes/Gameplay Readability | Deferred; answers why tribes matter after visuals stabilize |
| N2 — Dataset Bootstrap | Needs dataset integration |

### Phase D Recommended Order For MonoGame Completion

1. R8 — DONE — slow default expansion with claim cost, cooldown/budget, and defendability.
2. M17/M19 — DONE — performance diagnostics and screenshot acceptance now that the render stack exists.
3. M18 — polish the default local demo world against the current renderer.
4. M18B — add deterministic merger/Empire stress preset for top-tier visual and mechanic testing.
5. M7 — biome visual polish on top of M15 prop rules. (Done)
6. M8 — faction insignia/banner pass for far-zoom readability.
7. M10 — final font and UI art direction pass, building on M16's FontRenderer.
8. M21 — settlement lighting coherence (trivial fix, high visual impact).
9. M23 — blob shadow pass under settlements (drawn between terrain and model passes).
10. M22 — post-process render target pass (vignette + color grade, no custom shaders).
11. M20 — tribe stakes and gameplay-state readability.
12. M6/M9/N2/N3 — live backend rendering, lineage UI, dataset bootstrap, and export integration when backend-facing work resumes.

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
| `client-monogame/Assets/AssetRegistry.cs` | By M2/M8/M13/M15 | Asset registry tasks must be sequential |
| `client-monogame/Assets/AssetManifest.cs` | By M2/M7/M13/M15 | Asset manifest/profile tasks must be sequential |
| `client-monogame/Rendering/VegetationRenderer.cs` | By M12/M15 | Do not edit at same time as settlement/prop pipeline work |
| `client-monogame/Rendering/WorldRenderer.cs` | By M3/M11/M14/M16 | Main render-stage tasks must be sequential |
| `client-monogame/Rendering/HexTerrainMesh.cs` | By M14 | Do not edit with M3 border geometry work |
| `backend/server.js` | By N-task | N1, N2, N3 cannot run same time |

**Rule:** If two tasks modify the same file, run them sequentially. Use git branches per task if running in parallel.

---

## Current Assets Status (From taskrun records)

Everything in `Content/` is already downloaded or generated enough for a real runtime pass. No new asset downloads are needed except:
- !!! Font files (Cinzel, Noto Serif from Google Fonts)
- !!! Banner/symbol icon variants
- !!! Lower-poly or LOD exports for high-poly settlement models, unless generated procedurally from existing assets
- !!! Optional parchment/table texture if procedural parchment/table material is not good enough

Existing packs already usable:
- Terrain: grass, mud, sand, forest floor, rock, snow (8 texture families)
- Vegetation: 3 tree types, 6 grass types, bushes, ferns, dead trees, reeds
- Structures: tents, fences, walls, towers, gates, bridges, ladders, storage, campfire, well, cart, shrine/totem bits
- Population: medieval people FBX, base humanoid
- Biomes: terrain chunks, cliff, beach, cave, waterfall assets exist, but giant chunk models should not be used as primary terrain in the satellite/parchment map view
- Settlements: Meshy FBX families exist for Tribe/City/Duchy/Kingdom/Empire; they require runtime FBX handling, 32-bit index buffers, material/transform validation, and LOD before broad use

Current visual asset direction:
- Terrain is texture/elevation-first.
- Rocks, grass, trees, reeds, logs, and bushes are prop dressing generated from biome rules.
- Mountains/hills/valleys are expressed by heightmap, texture, tint, and small props, not by spawning huge mountain chunks.
- Capitals are settlement models on camp/capital tiles, not big circles.
- Outside the playable map is parchment on a table, not black skybox/void.
