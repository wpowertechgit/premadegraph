# Tribal NeuroSim v3 MonoGame Client

This folder is the first desktop-client skeleton for the Tribal NeuroSim v3 migration.

## Purpose

`client-monogame` is the canonical C# MonoGame application shell for the V3 desktop runtime. The browser cockpit is being retired, so new runtime UI work should target this client after the Rust/Node/C# contracts are stabilized.

## Architecture Role

- C# owns the desktop host, MonoGame lifecycle, view model, asset registries, and semantic domain classes for `Tribe`, `City`, `Duchy`, `Kingdom`, `Empire`, and artifacts.
- Node remains the required middleman. The client is prepared to connect to a Node WebSocket endpoint and should not connect around Node in the default runtime path.
- Rust remains responsible for neural-network work, heavy simulation execution, hot-path state, and binary frame transport.

The default desktop frame stream is:

`ws://127.0.0.1:3001/api/neurosim/desktop/v1/frames`

The current `FrameDecoder` accepts the desktop V1 envelope (`TNS3`) and unwraps the existing tribal Rust payload. The payload remains intentionally narrow until the full V3 frame contract is frozen.

## Folder Map

```text
Assets/      Biome, settlement, and icon registry scaffolding
Domain/      C# polity and artifact model types
Launcher/    Command-line and future neurosim: launch parsing
Models/      Decoded simulation state for render systems
Net/         Node WebSocket connection wrapper
Protocol/    Binary frame records and decoder
```

## Next Steps

1. Freeze `FrameV1`, `ControlV1`, and asset metadata contracts across Rust, Node, and C#.
2. Replace the legacy V0 decoder with versioned frame decoding.
3. Add a background receive loop that applies frames to `SimulationViewModel`.
4. Add placeholder map and polity rendering after protocol shape is stable.
5. Add asset diagnostics for missing biome, settlement, artifact, and icon bindings.
