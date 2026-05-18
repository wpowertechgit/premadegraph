# Playability Fix Pass — 2026-05-10

User report (image: 977 ticks, 425 tribes, 2.9 FPS, all tribes piled in
bottom-right, no hex conquering, sim already at tick 600 on first view).

This pass addresses four interlocking issues. Build verified:

- `cargo check` → clean (preexisting `dead_code` warnings only).
- `dotnet build -t:Compile` → 0 warnings, 0 errors.

> **Confidence: best effort, ~70-80% per fix.** Numbers are tuned from static
> analysis of the math, not measured. Re-run, watch population/food curves,
> and tweak the constants below if tribes still stall or balloon.

---

## 1. Tick already at 600 on first connect

**Root**: `simulation_loop` in `backend/src/main.rs` ticks unconditionally at
boot, regardless of subscribers. By the time the desktop client opens its
WebSocket, the Rust sim has been running for tens of seconds.

**Fix**: gate stepping on `frame_tx.receiver_count() + frame_v1_tx.receiver_count() > 0`.
When no clients are subscribed, the loop sleeps 200ms and skips `step()`.
First viewer now sees tick=0.

File: `backend/src/main.rs` (around `async fn simulation_loop`).

Caveat: if multiple clients connect serially, the second client still picks
up the running tick. That is intentional — only the cold-start case is gated.

---

## 2. Hex conquering never happens

**Root**: Two compounding issues.

a) **Tile food was tiny.** `world.rs` set `max_food = stats.food_density`
   (Plains = 0.7) and `food_regen = density * 0.1` (= 0.07/tick). A 1-tile
   tribe gathers `tile.food * 0.1` (≈ 0.07/tick at equilibrium) but pays
   upkeep `pop * 0.003` (≈ 0.15/tick at pop=50). Net: starvation.

b) **Claim cost was unreachable.** `CLAIM_BASE_COST=40` plus
   `CLAIM_TERRITORY_COST_PER_TILE=12` plus `CLAIM_FOOD_FLOOR=15` meant the
   first claim required ≥ 67 food in stores — never reached.

**Fix (Rust)**:

- `world.rs` tile init: `max_food = stats.food_density * 100`,
  `food_regen = stats.food_density * 0.6`. Plains is now 70 max with regen
  0.42 — surplus over upkeep on a 1-tile tribe.
- `simulation.rs` claim constants: base 40 → 16, per-tile 12 → 5,
  distance 8 → 4, pressure 25 → 12, floor 15 → 6, pop-base 30 → 25.

**Fix (C# `PlayableSimulation`, used in offline demo modes)**:

- `GrowFood` regen 3% → 6% of `MaxFood` per tick.
- `ApplyPopulationPressure` upkeep 0.016 → 0.009 per pop.
- Claim constants: base 12 → 10, per-tile 5 → 4, pressure 12 → 10,
  floor 6 → 5, pop-base 55 → 35, pop-per-tile 14 → 10.

Files: `backend/src/world.rs`, `backend/src/simulation.rs`,
`client-monogame/Models/PlayableSimulation.cs`.

Risk: tribes may now expand *too* fast. If you see runaway empires inside
~200 ticks, raise `CLAIM_BASE_COST` 16→22 and `ClaimPopBase` 35→45.

---

## 3. Tribes piled in bottom-right (camera framing, not spawn)

**Root**: in `--connect` network mode, `GameRoot` initializes the camera at
`FocalPoint=(220,0,160)` with `Distance=1200` and `MaxDistance=4000`. With
a 122×123 grid (15006 tiles → world ~5900×5160 units) the framed view only
covers the top-left ¼ of the world. Tribes rendered in the upper-left of
the world land in the bottom-right of the visible playfield, then banner
labels stack along the edge of the camera viewport.

**Fix**: in `GameRoot.cs / DrainReceivedFrames`, once `_mapWidth` and
`_mapHeight` are first known, compute world AABB via `_renderAdapter.TileCenter`
for the 4 corners and set the camera focal point to the world center,
distance to `max(worldW, worldH) * 0.85`, MaxDistance to at least
`max * 1.4`. Guarded by `_didFitNetworkCamera` so it only happens once.

Result: on first frame, the camera frames the entire 122×123 grid. Tribes
visibly spread across the whole map.

File: `client-monogame/GameRoot.cs`.

---

## 4. 3 FPS — render-throughput collapse with 425 tribes + 15k tiles

**Root**: `WorldRenderer.DrawHexTerrain` issues one `_hexMesh.Draw` per
visible tile (no instancing). At zoom-out the AABB cull leaves several
thousand sub-pixel tiles each frame, plus `BannerRenderer` draws a
6-spritebatch banner per tribe with no upper count.

**Fixes**:

- **WorldRenderer** (`Rendering/WorldRenderer.cs`):
  - Stride sampling at far zoom: `Distance > 1200` → every 2nd tile,
    `> 2000` → every 3rd, `> 3000` → every 4th. Visually a denser checker
    pattern instead of full coverage; far zoom reads fine.
  - Hard cap of 6000 tile draws per frame when `Distance > 1500`.
- **BannerRenderer** (`Rendering/BannerRenderer.cs`):
  - `MaxDistanceForBanners = 1500f` — skip banners entirely beyond that.
  - `MaxBannersPerFrame = 80` — cap per-frame banner count even when
    zoomed in with hundreds of tribes on screen.

Settlement renderer was already LOD-capped via
`SettlementLodCatalog.MaxSettlementDraws` so left alone.

Risk: stride sampling at far zoom leaves visible holes in the terrain.
If the resulting look is unacceptable, replace with one large textured
quad per biome cluster (real instanced batching) — bigger refactor.

---

## What was *not* changed

- Cluster-loaded tribe count (425) is sourced from PREMADEGRAPH HTTP
  feed. If you want fewer tribes, lower `clusters` upstream — not a sim
  bug.
- `find_spawn_tiles` zone-spread already scatters correctly across the
  full grid — confirmed by inspection. The "bottom-right pile" was
  framing, not spawn distribution.
- Frame protocol food encoding — `max_food` field on the wire grew from
  ≤1.0 to ≤100.0. If the desktop tile food bar reads weird, normalize on
  the client by `food / max_food` (probably already does).
- Genetic NeuroSim NEAT loop, war balance, merger logic — out of scope.

---

## Suggested verification path

1. Stop running client + Rust backend. Rebuild both.
2. Start `cd backend && cargo run`. Verify `tick = 0` until the desktop
   client connects (look for `Loaded N clusters`, then no further log
   spam).
3. Start `dotnet run -- --connect` in `client-monogame`. Confirm:
   - Initial frame → tick 0 (or near 0) on the HUD.
   - Camera frames the entire grid; tribes scattered across all of it.
   - FPS panel ≥ 30 at the default zoom; ≥ 15 at fully zoomed out.
   - Within ~100-300 ticks: territory counts > 1 for many tribes; map
     shows visible owned-tile patches growing.
4. If tribes still extinct en masse early, drop upkeep further
   (`PlayableSimulation.cs:0.009f`, Rust `simulation.rs` near
   `tribe.food_stores -= tribe.population as f32 * 0.003`).
