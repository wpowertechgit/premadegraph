# Task Run: Track E — Protocol Snapshots And Typed Frontend State

**Date:** 2026-05-03  
**Agent constraint:** Frontend only. Backend not touched.

---

## Tasks Implemented

### E1 — Protocol Version Header (frontend portion)

Added TS constants at top of `TribalSimulationPage.tsx`:

```ts
export const PROTOCOL_VERSION = 1;
export const MESSAGE_TRIBE_FRAME_V0 = 0x0000; // legacy frame, no header
export const MESSAGE_WORLD_SNAPSHOT_V1 = 0x0001;
export const MESSAGE_TILE_DELTA_V1 = 0x0002;
export const MESSAGE_TRIBE_DELTA_V1 = 0x0003;
```

Current binary frame documented as V0 (legacy, no envelope). Rust constants not added — backend not touched per instructions. Follow-up: add matching Rust constants in `simulation.rs` when backend work resumes.

### E3 — Frontend Fetches And Draws World Snapshot

Added `WorldTile` and `WorldSnapshot` TypeScript types.  
Added `fetchWorldSnapshot()` function that:
- GETs `/api/neurosim/api/world-snapshot`
- Populates `biomeRef` with real biome data from backend
- Updates `gridWRef` / `gridHRef` with actual map dimensions
- Returns silently on 404 / network error — keeps all-plains fallback

`draw()` now uses `gridWRef.current` / `gridHRef.current` instead of hardcoded `GRID_W`/`GRID_H` constants, so it works with both 40×40 fallback and any dynamic dimensions returned by the future backend endpoint.

Fetch called once on mount inside `useEffect`.

### E5 — Frontend Draws Territory Ownership

Added `TileOwner` and `TileOwnershipSnapshot` TypeScript types.  
Added `fetchTileOwnership()` function that:
- GETs `/api/neurosim/api/tile-ownership`
- Populates `tribeTerritory.current` map (tileIdx → tribeId)
- Assigns stable `hsla` colors per tribe id using golden-angle hue spread
- Returns silently on 404 / network error — territory map stays empty

Polling: called once on mount and then every 2 seconds inside `useEffect`.

Also added fallback color assignment in `ws.onmessage`: when the ownership endpoint is not yet available, tribe colors are still assigned per-tribe from the live frame so the territory layer is future-ready.

### E2 and E4 — Backend Endpoints

Skipped — backend not touched per task instructions.  
When implemented, the frontend fetch calls will start returning data and the territory/biome layers will populate automatically.

---

## Files Changed

- `frontend/src/pages/TribalSimulationPage.tsx`

---

## Validation

```
npm --prefix frontend run build -> ✓ built in 5.26s (0 errors, 0 warnings)
```

No behavior regression — existing WebSocket frame parser unchanged, all fallbacks maintain current all-plains / empty-territory behavior when backend endpoints are absent.

---

## Notes / Deferred

- Rust constants (`PROTOCOL_VERSION`, `MESSAGE_TRIBE_FRAME_V0`) not added — backend constraint.
- E2 (`GET /api/world-snapshot`) and E4 (`GET /api/tile-ownership`) are backend tasks, not implemented here.
- Once E2/E4 land in backend, no further frontend changes needed — fetch logic is already wired.
- Canvas size remains 800×800; `tilePx` computed dynamically from `CANVAS_SIZE / max(gw, gh)` so non-square or larger maps render within the fixed canvas bounds.
