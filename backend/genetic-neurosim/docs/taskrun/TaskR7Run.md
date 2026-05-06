# Task R7 — FrameV1 Protocol (Beyond Legacy V0 Wrapper)

**Date:** 2026-05-06  
**Status:** Complete

---

## Files Changed

| File | Δ | Summary |
|------|---|---------|
| `backend/src/frame_v1.rs` | +33 (NEW) | FrameV1 binary schema: constants, encoder helpers (`push_u16/u32/u64/f32`), section flags |
| `backend/src/desktop_protocol.rs` | +20 | Added `PAYLOAD_KIND_FRAME_V1 = 2`, `DESKTOP_FRAME_V1_HEADER_BYTES = 40`, `wrap_frame_v1()` function |
| `backend/src/simulation.rs` | +456 | Added `last_frame_v1` field, `build_frame_v1()` method, `current_packet_v1()` accessor, `pack_current_frame()` now also builds V1, added `simulation_tick()`/`simulation_generation()`/`alive_tribe_count()` getters |
| `backend/src/main.rs` | +86 | Added `mod frame_v1`, `frame_v1_tx` broadcast channel, `/ws/desktop/v2/frames` route, `ws_desktop_v2_client` WebSocket handler, simulation loop publishes V1 frames |

---

## FrameV1 Binary Layout

### Desktop Envelope (40-byte header — `wrap_frame_v1()`)

| Offset | Size | Field |
|--------|------|-------|
| 0 | 4 | Magic "TNS3" |
| 4 | 2 | Version (1) |
| 6 | 2 | HeaderBytes (40) |
| 8 | 2 | PayloadKind (2 = FrameV1) |
| 10 | 2 | Flags |
| 12 | 4 | PayloadBytes |
| 16 | 8 | Tick (u64) |
| 24 | 4 | Generation (u32) |
| 28 | 4 | RecordCount (alive tribe count) |
| 32 | .. | V1 Payload follows |

### V1 Payload Sections (self-describing via flags byte)

**Per-tribe record (46 bytes each)**

| Offset | Size | Field |
|--------|------|-------|
| 0 | 4 | tribe_id (u32) |
| 4 | 1 | polity_tier (u8: 0=Tribe…5=Empire) |
| 5 | 1 | specialization_role (u8: 0=Generalist…5=InternalAffairs) |
| 6 | 2 | main_camp_tile (u16) |
| 8 | 4 | population (u32) |
| 12 | 4 | constituent_count (u32) |
| 16 | 4 | food_stores (f32) |
| 20 | 4 | a_combat (f32) |
| 24 | 4 | a_risk (f32) |
| 28 | 4 | a_resource (f32) |
| 32 | 4 | a_map_objective (f32) |
| 36 | 4 | a_team (f32) |
| 40 | 2 | territory_count (u16) |
| 42 | 4 | entity_count (citizens.len()) (u32) |
| 46 | 2 | veterancy_xp (u16) |
| 48 | 1 | behavior_state (u8) |
| 49 | 1 | alive_flag (u8) |

**Flags byte:** bitmask of which optional sections follow the tribe records.

- `0x01` = FLAG_TILE_DATA — tile records present
- `0x02` = FLAG_WAR_DATA — war records present
- `0x04` = FLAG_EVENT_DATA — event delta present

**Per-tile record (9 bytes each)** — only tiles with occupants or dispute flag.

| Size | Field |
|------|-------|
| 2 | tile_id (u16) |
| 1 | biome_id (u8: 0=Plains…5=River) |
| 1 | occupant_count (u8) |
| 4 | food_amount (f32) |
| 1 | controls_byte (bit 0 = dispute_flag) |

**Per-war record (21 bytes each)** — only when active wars exist.

| Size | Field |
|------|-------|
| 4 | war_id (u32) |
| 4 | attacker_id (u32) |
| 4 | defender_id (u32) |
| 8 | start_tick (u64) |
| 1 | war_status (u8) |

**Event delta (5 bytes per event)** — last 20 global events.

| Size | Field |
|------|-------|
| 2 | event_count (u16) header |
| 1 per event | event_type (u8) |
| 4 per event | tribe_id (u32) |

---

## WebSocket Endpoint

- `/ws/desktop/v2/frames` — sends FrameV1-wrapped payloads
- Backward-compatible: `/ws/desktop/v1/frames` still sends V0-wrapped legacy frames
- Client selects decoder path based on negotiated endpoint path

## Compilation

- `cargo build` — **OK** (14 warnings, all pre-existing)
- `npm run build` (frontend) — **OK** (chunk size warnings pre-existing)

## Notes

- FrameV1 contains all fields MonoGame needs for V3 rendering: biome IDs, polity tiers, specialization roles, dispute flags, war state, event deltas, entity population counts, veterancy XP
- Legacy V0 payload still works untouched alongside V1 via separate broadcast channel (`frame_tx` vs `frame_v1_tx`)
- Tile records filtered to only tiles with occupants or dispute flag to keep payload bounded (~9 bytes per interesting tile)
- Byte order: little-endian throughout
