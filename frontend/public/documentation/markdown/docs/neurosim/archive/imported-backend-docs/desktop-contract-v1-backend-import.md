# Tribal NeuroSim v3 Desktop Contract V1

## Purpose

Transport contract for MonoGame desktop client. Node stays thin — Rust is binary state producer, C# decodes and renders.

## Message Flow

```
MonoGame -> Node -> Rust
  HTTP GET  /api/neurosim/desktop/v1/handshake
  HTTP GET  /api/neurosim/desktop/v1/status
  HTTP POST /api/neurosim/desktop/v1/control/pause
  HTTP POST /api/neurosim/desktop/v1/control/resume
  HTTP POST /api/neurosim/desktop/v1/control/step-tick

Rust -> Node -> MonoGame (legacy)
  WS /api/neurosim/desktop/v1/frames        -> /ws/desktop/v1/frames

Rust -> Node -> MonoGame (FrameV1)
  WS /api/neurosim/desktop/v2/frames       -> /ws/desktop/v2/frames
```

Node proxies desktop paths to Rust. Client picks decoder path based on endpoint.

## Binary Frame Envelope (Desktop Level)

All numeric fields are little-endian. Every WebSocket message starts with this 40-byte header:

```
DesktopFrameV1 header, 40 bytes
  u8[4] magic        "TNS3"
  u16   version      1
  u16   headerBytes  40
  u16   payloadKind  1 = legacy V0 tribal frame
                    2 = FrameV1 (full V3 fields)
  u16   flags        reserved, currently 0
  u32   payloadBytes byte count after header
  u64   tick         simulation tick
  u32   generation   simulation generation
  u32   recordCount  alive tribe count (V0) or total record count (V1)

Payload
  V0 path: existing Rust tribal binary frame (backward-compatible)
  V1 path: FrameV1 sections described below
```

### Payload Kind 1 — Legacy V0 (backward-compatible)

Same binary format as original NeuroSim tribal frames. Available at `/ws/desktop/v1/frames`. Preserved for clients that haven't updated to FrameV1 decoder.

### Payload Kind 2 — FrameV1 (current)

#### Per-tribe record (50 bytes each)

| Offset | Size | Field |
|--------|------|-------|
| 0 | 4 | tribe_id (u32) |
| 4 | 1 | polity_tier (u8: 0=Tribe / 1=City / 2=County / 3=Duchy / 4=Kingdom / 5=Empire) |
| 5 | 1 | specialization_role (u8: 0=Generalist / 1=Military / 2=Economy / 3=Governance / 4=Logistics / 5=InternalAffairs) |
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
| 42 | 4 | entity_count (citizen count, u32) |
| 46 | 2 | veterancy_xp (u16) |
| 48 | 1 | behavior_state (u8) |
| 49 | 1 | alive_flag (u8) |

#### Flags byte

After tribe records, a single flags byte signals optional sections:

- `0x01` = FLAG_TILE_DATA — tile records present
- `0x02` = FLAG_WAR_DATA — war records present
- `0x04` = FLAG_EVENT_DATA — event delta present

#### Per-tile record (9 bytes each)

Only tiles with occupants or dispute flag. Variable count.

| Size | Field |
|------|-------|
| 2 | tile_id (u16) |
| 1 | biome_id (u8: 0=Plains / 1=FertileValley / 2=DenseForest / 3=SparseWoodland / 4=Hills / 5=Mountains / 6=Marsh / 7=Riverland / 8=DrySteppe / 9=Cold / 10=Unknown) |
| 1 | occupant_count (u8) |
| 4 | food_amount (f32) |
| 1 | controls_byte (bit 0 = dispute_flag) |

#### Per-war record (21 bytes each)

Only when active wars exist. Variable count.

| Size | Field |
|------|-------|
| 4 | war_id (u32) |
| 4 | attacker_id (u32) |
| 4 | defender_id (u32) |
| 8 | start_tick (u64) |
| 1 | war_status (u8) |

#### Event delta (5 bytes per event)

Last 20 global events. Variable count.

| Size | Field |
|------|-------|
| 2 | event_count (u16) header |
| 1 per event | event_type (u8) |
| 4 per event | tribe_id (u32) |

## FrameV1 Source

Implementation location:
- Rust: `backend/src/frame_v1.rs` — binary schema constants, encoder helpers
- Rust: `backend/src/simulation.rs` — `build_frame_v1()` method
- C#: `client-monogame/Protocol/FrameDecoder.cs` — `DecodeFrameV1()` decoder path

## Fields Now Available (FrameV1)

All fields MonoGame needs for V3 rendering are in the payload:

- biome IDs per tile
- polity tiers (Tribe through Empire)
- specialization roles
- dispute flags + fractional control
- war state + event deltas
- entity population + veterancy XP
- constituent counts for merged polities
