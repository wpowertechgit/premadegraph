Neurosim Fix Summary — 2026-05-10

  Bug #1 — City tier model not updating on levelup

  File: client-monogame/Rendering/SettlementRenderer.cs

  What broke: Settlement model cache only checked max tier across all tribes. If any tribe was already City, a
  second tribe promoting to City didn't invalidate cache → old Tribe model stayed.

  Fix: Cache now checks sum of all tiers (tierSum). Any single tier change invalidates.

  How to test:
  1. Run --connect mode
  2. Wait for a tribe to reach pop 1000 (City threshold)
  3. Observe: settlement model should change from tent/campfire compound → City model immediately at promotion
  4. Let a second tribe reach City → model should also update

  ---
  Bug #2 — Artifact stats all at 0.95–0.97 (maxed out)

  File: backend/src/tribes.rs line 115

  What broke: Raw premadegraph scores (~2–4) fed into tanh(v) directly → tanh(2.5)=0.987, everything near max.

  Fix: Now tanh(v / 3.0) → spreads values: score 1.0→0.32, 2.0→0.58, 3.0→0.76, 4.5→0.91.

  How to test:
  1. Restart Rust backend (must recompile)
  2. Open selection panel on any tribe
  3. Artifact bars should now show varied values, not all near 1.0
  4. Combat-focused tribes should show higher Combat bar, resource tribes higher Resource bar

  ---
  Bug #2b — Stat decay added

  File: backend/src/simulation.rs

  What added: Every 50 ticks, if a tribe's food_ratio < 0.2, all 5 artifact stats decay by 0.008 × (0.2 -
  food_ratio) per check, floored at 0.05.

  How to test:
  1. Find a small starving tribe (food=0, pop>0)
  2. Watch its artifact stats over time — should slowly decline
  3. Tribe with plenty of food: stats should stay stable

  ---
  Bug #3 — Duchies capped at 6000 pop, can never reach Kingdom

  File: backend/src/simulation.rs (polity promotion block)

  What broke: max_population initialized from cluster_size * 600, minimum 6000. Kingdom requires pop 7000 —
  impossible to reach with 6000 cap.

  Fix: On tier promotion, max_population gets raised:
  - → City: at least 12,000
  - → Duchy: at least 30,000
  - → Kingdom: at least 80,000
  - → Empire: at least 200,000

  How to test:
  1. Wait for a Duchy-tier tribe (pop ~3000+)
  2. Tribe should now continue growing past 6000
  3. At pop 7000 it should promote to Kingdom
  4. Selection panel should show Kingdom badge

  ---
  Bug #4 — Population frozen, tribes with food=0 don't die

  File: backend/src/simulation.rs (population dynamics)

  What broke:
  - Delta ((food_per_pop - 0.8) * 0.05 * pop) as i32 truncated small values to 0 → no change ever
  - Tribe with pop=24, food=0: delta = -0.96 → truncated to 0 → immortal

  Fix:
  - Use .round() as i32 instead of truncation
  - When food_per_pop <= 0.01: force death of max(1, pop/30) per tick

  How to test:
  1. Find tribe with food=0 (e.g., tribe 361 pop=24 food=0) — should die within ~30 ticks now
  2. Find tribe 571 (duchy, pop=24, food=0, territory=27) — should also collapse
  3. Find tribe 106 (pop=467, food=389) — population should now actually fluctuate tick to tick

  ---
  Bug #4b — War events not visible in terminal

  File: backend/src/simulation.rs

  What added: Console output on Rust backend:
  [WAR tick=5583] tribe_546 declares war on tribe_520 (aggression=0.72)
  [WAR tick=5590] tribe_546 defeated tribe_520 (absorbed 12 pop)

  How to test:
  1. Keep Rust backend terminal visible
  2. War events should now print as they happen
  3. Should confirm wars ARE firing even if C# client display is unclear

  ---
  Bug #5 — Riverland biome shows sand, no water

  File: client-monogame/Rendering/WorldRenderer.cs

  What added: After terrain render pass, DrawWaterOverlay() draws semi-transparent blue rectangle (RGBA
  30,90,180,90) over every Riverland tile. Only active at camera distance ≤ 900.

  How to test:
  1. Find a River/Riverland biome tile (sandy-looking tiles near water)
  2. Zoom in (camera < 900)
  3. Should now have a visible transparent blue water layer on top of sand texture
  4. Zoom out past 900 → overlay disappears (correct, matches terrain render cutoff)

  ---
  Bug #6 — Insignia circle shows green instead of emblem

  File: client-monogame/Rendering/BannerRenderer.cs

  What broke: Green-screen detection was pixel-perfect R==0, G==255, B==0. Any anti-aliasing or slight color
  variation → green not detected → not replaced with transparent → green blob visible.

  Fix:
  - Detection now: G > 180 && R < 80 && B < 80 (threshold-based)
  - Emblem size: 1.55 × radius (was 1.27) and max cap 0.58 × frameWidth (was 0.48)

  How to test:
  1. Zoom to banner range (camera 0–6000)
  2. Look at any tribe banner circle
  3. Green circle should be gone — emblem/icon should fill it
  4. Emblem should be noticeably larger than before

  ---
  Bug #7 — Disputed territories always = 0

  File: backend/src/simulation.rs (apply_territory_expansion)

  What broke: Territory expansion always called set_tile_owner() which replaces the owner — no disputes ever
  created. tile_is_disputed stayed false forever.

  Fix: When expanding into an already-owned tile: calls add_tile_occupant(tile, tribe_id, 0.4) → marks tile
  disputed, splits food yield. Neutral tiles still use set_tile_owner (exclusive claim).

  How to test:
  1. Watch run UI — Disputed Territories count should now be > 0 after ~100 ticks
  2. Zoom into a border zone between two tribes
  3. Disputed tiles should show territory renderer overlay from two different tribe colors
  4. Selection panel on a disputed tile should show Dispute: [tribe name] instead of none

  ---
  Rebuild steps before testing

  # Rust backend
  cd backend\genetic-neurosim\backend
  cargo build --release

  # C# client
  cd ..\client-monogame
  dotnet build .\TribalNeuroSim.Client.csproj

  # Run
  dotnet run -- --connect