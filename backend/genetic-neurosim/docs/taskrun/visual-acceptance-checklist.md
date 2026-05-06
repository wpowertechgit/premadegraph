# Visual Acceptance Checklist — Tribal NeuroSim v3

**Last updated:** 2026-05-06 (Task M19)
**How to use:** Press F6 in-game to capture close/mid/far screenshots to `screenshots/YYYY-MM-DD_HHmmss/`. Check each item below against the three zoom levels.

## Close Zoom (distance ~150)

- [ ] **No black void** — the area outside the map shows parchment and table, not black/empty space
- [ ] **Settlement model visible** — at least one Tribe/City/etc. 3D settlement model appears on a capital tile
- [ ] **Hex terrain textured** — hex tiles have biome-appropriate textures (grass, forest floor, sand, etc.)
- [ ] **Vegetation props visible** — grass patches, bushes, trees, or rocks appear on appropriate biome tiles
- [ ] **No giant unexplained circles** — no large abstract circles floating on the map
- [ ] **No terrain chunk mountains** — no giant mountain models; elevation is subtle heightmap relief
- [ ] **Territory borders** — borders follow exact hex edges between different-owner tiles
- [ ] **Selection highlight** — selected tile/tribe highlighted with restrained hex outline, not a giant disk

## Mid Zoom (distance ~350)

- [ ] **Parchment/table visible** — map sits on parchment, parchment sits on table surface
- [ ] **Borders readable** — territory borders still visible and follow hex geometry
- [ ] **Disputed zones subtle** — crosshatch/overlay on disputed tiles visible but doesn't dominate the map
- [ ] **Settlement models at LOD** — some settlements may render at reduced detail; selected stays full
- [ ] **Biome regions coherent** — biomes appear as regions, not random speckles
- [ ] **Vegetation reduced** — fewer individual props visible; biome textures carry visual weight

## Far Zoom (distance ~650)

- [ ] **Tabletop framing** — map framed as physical object on table, not floating in void
- [ ] **No high-poly settlements** — no 3D settlement models rendered (all sprite markers)
- [ ] **Territory colors distinct** — different factions' territory borders distinguishable
- [ ] **Camp/settlement markers** — sprite markers for capitals visible and readable
- [ ] **Map edges defined** — clear boundary between map, parchment margin, and table
- [ ] **Performance HUD visible** — FPS counter and draw budget panel shown (top-right)

## Regression Checks (all zoom levels)

- [ ] **Debug HUD readable** — text not clipped, colors distinguishable
- [ ] **Performance HUD readable** — FPS, draw counts, primitives estimate visible
- [ ] **No rendering artifacts** — no flickering, z-fighting, missing textures, or geometry holes
- [ ] **HUD does not cover critical map area** — panels in corners, not center

## Notes

- Screenshots saved with timestamp in `screenshots/` folder relative to the executable
- Filenames: `m19_close.png`, `m19_mid.png`, `m19_far.png`
- Compare against previous run screenshots for regression detection
- Checklist items checked during a real MonoGame runtime session — not in a build-only context
