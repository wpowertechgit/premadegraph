# Visual Acceptance Checklist — Tribal NeuroSim v3

**Last updated:** 2026-05-07 (Tasks M19 + M18B + M8/M10/M5/M13/M16/M4 visual pass)
**How to use:** Press F6 in-game to capture close/mid/far screenshots to `screenshots/YYYY-MM-DD_HHmmss/`. Check each item below against the three zoom levels.

## Close Zoom (distance ~150)

### Terrain & Environment
- [x] **No black void** — area outside map shows parchment and table, not black/empty space
- [x] **Hex terrain textured** — hex tiles have biome-appropriate textures (grass, forest floor, sand, rock, snow, etc.)
- [ ] **Vegetation props visible** — grass patches, bushes, trees, or rocks appear on appropriate biome tiles
- [x] **No terrain chunk mountains** — no giant mountain models; elevation is subtle heightmap relief only
- [ ] **Props don't dominate tiles** — vegetation dressing is sparse and readable, not noisy or hiding settlement models

### Settlement & Polity
- [x] **Settlement model visible** — at least one 3D settlement model appears on a capital tile (not a circle or generic marker)
- [x] **Settlement scale correct** — model fits within a hex footprint, not a towering giant or invisible speck
- [ ] **Settlement tier distinct** — Tribe camp looks different from City; City looks different from Kingdom (where multiple tiers exist)
- [x] **No giant unexplained circles** — no large abstract circles floating on the map (selection replaced by hex outline)

### Territory & Borders
- [x] **Territory borders** — borders follow exact hex edges between different-owner tiles, not diagonal screen-space approximations
- [ ] **Border segments correct** — no overlong lines crossing unrelated tiles; each segment belongs to its shared hex edge
- [ ] **Disputed zones visible** — crosshatch or overlay on contested tiles shows which tribes are contesting (colored by both tribes)
- [ ] **Disputed overlay subtle** — crosshatch pattern does not fully obscure the terrain texture beneath it

### Selection & Interaction
- [x] **Selection highlight** — selected tile/tribe highlighted with a restrained hex outline, not a giant disk
- [ ] **Selection panel readable** — selected tribe panel shows: tier, population, food, territory count, artifact profile, behavior, disputes

---

## Mid Zoom (distance ~350)

### Terrain & Environment
- [ ] **Parchment/table visible** — map sits on parchment, parchment sits on table surface; no black void framing
- [ ] **Biome regions coherent** — biomes appear as regions, not random speckles
- [ ] **Vegetation reduced** — fewer individual props visible at this distance; biome textures carry visual weight

### Settlement & Polity
- [ ] **Settlement models at LOD** — some settlements may render at reduced detail; selected/near capital stays full quality
- [ ] **Faction banners visible** — insignia frame + emblem icon + polity ribbon appears above each capital (M8)
- [ ] **Banner text readable** — polity name (e.g. "Tribe 1") is centered on ribbon below insignia frame
- [ ] **Emblem inside frame** — emblem icon is masked inside the polity frame circle, not a floating square
- [ ] **Banner color derived from artifacts** — high-combat tribes use martial colors; high-team tribes use unity colors
- [ ] **Cinzel font for polity names** — capital/polity names render in Cinzel display font, not the debug font

### Territory & Borders
- [ ] **Borders readable** — territory borders still visible and follow hex geometry at this zoom
- [ ] **Disputed zones subtle** — crosshatch/overlay on disputed tiles visible but doesn't dominate the map
- [ ] **Border thickness appropriate** — borders between two tribes have distinct color segments, not a single blended line

---

## Far Zoom (distance ~650)

### Environment & Framing
- [ ] **Tabletop framing** — map framed as physical object on table; no floating-grid-in-void look
- [ ] **Map edges defined** — clear boundary between map, parchment margin, and table
- [ ] **Camera pitch shifted** — at far zoom the camera looks more straight down; at close zoom it tilts to ~45 degrees

### Settlement & Polity
- [ ] **No high-poly settlements at far** — no 3D settlement meshes rendered at far zoom (all replaced by markers/billboards)
- [ ] **Camp/settlement markers** — sprite or banner markers for capitals visible and readable
- [ ] **Territory colors distinct** — different factions' territory borders distinguishable at empire overview scale

### Banners & Insignia
- [ ] **Banners readable at far** — polity insignia still legible; not too small to identify faction at empire view
- [ ] **Icons randomly distributed** — different tribes have different emblem icons (not all identical)

### Performance
- [ ] **Performance HUD visible** — FPS counter and draw budget panel shown (top-right corner)
- [ ] **FPS acceptable at far** — far zoom does not draw high-poly meshes; frame rate should be highest at this level

---

## Debug HUD — V3 Fields (M5)

- [ ] **Protocol version shown** — HUD displays which frame protocol version is active (V0 / V1)
- [ ] **Polity tier counts** — HUD shows count of: Tribes / Cities / Counties / Duchies / Kingdoms / Empires
- [ ] **Active war count** — HUD shows number of active wars
- [ ] **Total entity count** — HUD shows total citizen entities across all alive tribes
- [ ] **Disputed tile count** — HUD shows how many tiles are currently disputed (-40% penalty indicator)
- [ ] **Tombstone count** — HUD shows how many tribes have gone extinct this run
- [ ] **Lineage depth** — HUD shows max generation depth reached so far
- [ ] **Asset diagnostic summary** — HUD or log indicates asset load failures if any

---

## Empire Stress Scenario (M18B)

Run with `--empire-stress` flag or press the empire-stress debug key. Check these additional items:

- [ ] **Multiple polity tiers visible** — at least City, Duchy/County, and Kingdom/Empire settlement models appear in the same run
- [ ] **Tier-appropriate settlement models** — higher-tier capitals render with a visually larger/more complex model than basic tribes
- [ ] **Merge HUD line present** — debug HUD shows "highest polity tier reached" and active merge count
- [ ] **Extinctions occur** — tombstone count is non-zero; some tribes die before top tier forms
- [ ] **Empire tier reachable** — under a fixed seed the run reaches at least Kingdom, ideally Empire, within the documented tick budget
- [ ] **Deterministic** — two runs with the same seed and preset produce the same polity tier progression

---

## Regression Checks (all zoom levels)

- [ ] **Debug HUD readable** — text not clipped, colors distinguishable on table/parchment background
- [ ] **Performance HUD readable** — FPS, draw counts (terrain/settlement/prop), primitives estimate visible
- [ ] **No rendering artifacts** — no flickering, z-fighting, missing textures, or geometry holes
- [ ] **HUD does not cover critical map area** — panels in corners, not center
- [ ] **Local demo runs offline** — `dotnet run` starts the demo without needing the Rust/Node backend
- [ ] **Selection does not break on no-selection state** — clicking empty map area does not crash or show corrupt panel
- [ ] **Camera stays in bounds** — panning cannot move the focus point past the outer hex grid edges
- [ ] **Noto Serif body text readable** — inspection panels and dossier text use Noto Serif at a comfortable size
- [ ] **Trykker debug text distinct** — debug HUD text is visually separate from gameplay UI text

---

## Notes

- Screenshots saved with timestamp in `screenshots/` folder relative to the executable
- Suggested filenames: `close.png`, `mid.png`, `far.png` (or prefixed with task/date)
- Compare against previous run screenshots for regression detection
- Checklist items checked during a real MonoGame runtime session — not in a build-only context
- Empire stress scenario requires a separate F6 screenshot set; label those `empire_close.png` etc.
