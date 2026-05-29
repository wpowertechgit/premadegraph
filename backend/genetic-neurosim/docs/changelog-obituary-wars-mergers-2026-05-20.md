# Obituary Panel, Wars & Mergers — Changes 2026-05-20

## Root Cause of POLITY TIER / max_population / founder_names being null

`cargo build --release` was silently failing (only `cargo check` was run — which does NOT compile test modules). Two `ClusterProfile` struct literals in test functions (`normalized_cluster` at line ~4903 and `sim_last_empire_deterministic` at line ~5459 in `simulation.rs`) were missing the `founder_names: vec![]` field added in the previous session. Because tests are compiled separately, `cargo check` reported zero errors while the full build would fail. Fixed by adding `founder_names: vec![]` to both literals. Release binary now fully rebuilt.

## Files Changed

### `backend/src/simulation.rs`

**1. Fixed two missing `ClusterProfile.founder_names` fields in test helpers**
- `normalized_cluster(...)` → added `founder_names: vec![]`
- `sim_last_empire_deterministic` closure → added `founder_names: vec![]`

**2. Lowered `MERGE_TICK_THRESHOLD` from 80 → 20**
- Rationale: with 599 tribes in active war, allied tribes were dying before reaching the 80-tick threshold. 20 ticks is enough to confirm an alliance before it breaks from third-party attacks.

**3. Added AtWar tile invasion in `apply_territory_expansion`**
- Every 3 ticks, AtWar tribes with a target push onto up to 3 adjacent enemy border tiles via `add_tile_occupant(tile_idx, atk_id, 0.4)`. This sets `tile_is_disputed = true` on those tiles.
- The defender simultaneously gets 2 of the attacker's front-line tiles co-occupied via `add_tile_occupant(atk_tile, def_id, ...)`.
- Result: border between warring tribes shows as disputed (visually "carved up") during the war. When the war resolves (extinction or conquest), `set_tile_owner` clears the dispute.
- Collected into `war_contests: Vec<(u32, usize)>` then applied after the main claims loop to avoid borrow conflicts.

### `client-monogame/UI/TombstoneObituaryPanel.cs`

**4. Panel background fully opaque**
- `PanelColor` alpha 220 → 255. Terrain no longer bleeds through.

**5. Population display for absorbed tribes**
- Conquered/absorbed tribes now show `"transferred (max: N)"` instead of `"0 / 0"`. Pop was 0 at death because it transferred to the conqueror before `record_death` was called — this is correct behavior, now labelled clearly.

**6. Founder name fallback**
- When `founder_names[i]` is null, empty, or equals the PUUID (no DB entry found), shows `"—"` instead of the first 16 chars of the PUUID.

**7. Scrollable founders list**
- Added `_founderScrollOffset` and `MaxVisibleFounders = 5`.
- `HandleScroll(int scrollDelta, int mx, int my)`: adjusts offset if mouse is inside panel bounds. One scroll notch = 120 scroll wheel units.
- `ResetScroll()`: called when panel closes.
- Founder section header shows range `(1–5 of 13)` when truncated.
- Scroll hint `"▲ scroll ▼"` / `"scroll ▼"` / `"▲ scroll"` shown in the section header row.

### `client-monogame/GameRoot.cs`

**8. Scroll wheel forwarded to obituary panel**
- In `Update()`, when `_obituaryVisible`, computes `mouse.ScrollWheelValue - _previousMouse.ScrollWheelValue` and forwards to `_obituaryPanel.HandleScroll(...)`.
- `ResetScroll()` called when obituary closes.

## Rebuild Instructions

```
# Rust backend (required for polity tier, max_pop, founder_names to populate)
cd backend/genetic-neurosim/backend
cargo build --release

# C# client
dotnet build client-monogame/TribalNeuroSim.Client.csproj -c Release
```

After rebuild, restart Node.js WITHOUT `NEUROSIM_HOST` set so it picks up the new local Rust binary.
The new binary populates `polity_tier_reached`, `max_population`, and `founder_names` in tombstone JSON.
