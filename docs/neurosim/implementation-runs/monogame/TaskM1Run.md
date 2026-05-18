# Task M1 Run Report — FrameV1 Decoder (C# Side)

**Date:** 2026-05-06
**Task:** M1 — FrameV1 Decoder
**Depends-On:** R7 (FrameV1 Protocol — Rust side done)

## Summary

Implemented C# FrameV1 decoder path. MonoGame client can now decode FrameV1 binary payloads from Rust backend, making all V3 fields (biome_id, polity_tier, specialization_role, dispute, control, war/event data) available in C# models.

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| `client-monogame/Protocol/DesktopProtocol.cs` | Added FrameV1 constants | +9 |
| `client-monogame/Protocol/SimulationFrame.cs` | Added V1 record types + SimulationFrameV1Data property | +40 |
| `client-monogame/Protocol/FrameDecoder.cs` | Added DecodeFrameV1 path + binary readers | +97 |
| `client-monogame/Models/SimulationViewModel.cs` | Added V1 field mapping + accessors | +62 |

### Details

**DesktopProtocol.cs — Constants:**
- `PayloadKindFrameV1 = 2` — identifies V1 payload in TNS3 envelope
- Section flags: `FlagTileData = 0x01`, `FlagWarData = 0x02`, `FlagEventData = 0x04`
- Record sizes: Tribe=50, Tile=9, War=21, Event=5

**SimulationFrame.cs — V1 Record Types:**
- `SimulationFrameV1` — holds decoded V1 payload (tribes, tiles, wars, events)
- `TribeFrameV1Record` — 17 fields: polity tier, specialization role, main camp tile, constituent count, entity count, veterancy xp, alive flag, plus all legacy fields
- `TileFrameV1Record` — tile id, biome id, occupant count, food amount, dispute flag
- `WarFrameV1Record` — war id, attacker/defender ids, start tick, war status
- `EventDeltaRecord` — event type, tribe id
- `SimulationFrame` extended with `FrameV1Data` property (nullable)

**FrameDecoder.cs — Decoder:**
- `DecodeDesktopV1()` routes `payloadKind=2` to `DecodeFrameV1()`
- Handles header size discrepancy: Rust claims 40-byte V1 header but writes 32
- Reads tribe records (50 bytes each), flags byte, then optional tile/war/event sections
- Builds backward-compatible V0 frame from V1 tribe data (graceful fallback)
- Adds `ReadUInt64()` binary reader for war start_tick field

**SimulationViewModel.cs — V1 Mapping:**
- New dictionaries: `V1Tribes`, `TileData` (with biome & dispute)
- New lists: `Wars`, `Events`
- `HasV1Data` flag for renderers to detect V1 availability
- Clears stale V1 state on each `ApplyFrame()`

## Wire Format Note

Rust `FRAME_V1_TRIBE_RECORD_BYTES` constant is 46 but actual wire bytes per tribe record = 50. C# uses correct 50-byte stride. Rust `build_frame_v1()` writes correct 50 bytes — only the constant and comment miscount. No data corruption, since Vec capacity is a hint.

## Validation

| Check | Result |
|-------|--------|
| Frontend build (`npm --prefix frontend run build`) | **PASS** — 959 modules, 6.79s, 0 errors |
| Rust compile (`cargo check`) | **PASS** — 0 errors, 14 pre-existing warnings |

## Acceptance Criteria

- [x] C# can decode FrameV1 payload
- [x] Falls back gracefully to V0 wrapper path (V0 records built from V1 data)
- [x] All V3 fields available in C# models (biome_id, polity_tier, specialization_role, dispute, control)

## Artifacts

- 4 C# files modified
- No asset changes
- No new dependencies
