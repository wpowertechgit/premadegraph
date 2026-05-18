# Tribal NeuroSim v3 Desktop Contract V1

## Purpose

This is the first practical transport contract for the MonoGame desktop migration. It keeps Node thin, preserves Rust as the binary state producer, and gives C# a stable desktop connection target.

## Message Flow

```text
MonoGame -> Node -> Rust
  HTTP GET  /api/neurosim/desktop/v1/handshake
  HTTP GET  /api/neurosim/desktop/v1/status
  HTTP POST /api/neurosim/desktop/v1/control/pause
  HTTP POST /api/neurosim/desktop/v1/control/resume
  HTTP POST /api/neurosim/desktop/v1/control/step-tick

Rust -> Node -> MonoGame
  WS /api/neurosim/desktop/v1/frames
```

Node proxies the desktop paths to Rust:

```text
/api/neurosim/desktop/v1/frames              -> /ws/desktop/v1/frames
/api/neurosim/desktop/v1/status              -> /api/desktop/v1/status
/api/neurosim/desktop/v1/control/pause       -> /api/desktop/v1/control/pause
/api/neurosim/desktop/v1/control/resume      -> /api/desktop/v1/control/resume
/api/neurosim/desktop/v1/control/step-tick   -> /api/desktop/v1/control/step-tick
```

## Binary Frame Envelope

The desktop WebSocket stream wraps the current Rust tribal binary frame with a small V1 header.

All numeric fields are little-endian.

```text
DesktopFrameV1 header, 32 bytes
  u8[4] magic        "TNS3"
  u16   version      1
  u16   headerBytes  32
  u16   payloadKind  1 = tribal legacy V0 payload
  u16   flags        reserved, currently 0
  u32   payloadBytes byte count after the header
  u64   tick         copied from the legacy tribal payload
  u32   generation   copied from the legacy tribal payload
  u32   recordCount  active tribe record count

Payload
  Existing Rust tribal binary frame.
```

The V1 envelope is intentionally not the final world schema. It creates the version marker and handshake path needed for MonoGame while the full `FrameV1` payload is still being designed.

## Future Metadata Slots

The handshake advertises planned metadata families, but the payload does not implement them yet:

- biome ids
- polity tiers
- settlement visual ids
- faction insignia ids
- event icon types
- artifact ids

These must become explicit payload fields before C# render systems depend on them.
