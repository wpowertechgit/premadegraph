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

The client now includes a local playable V3 prototype mode so it can be run before the Rust/Node stream is fully available.

This prototype is not the final visual standard. It is a desktop stepping stone toward the architecture and cockpit experience defined in:

- `docs/neurosim-tribal-simulation-critical-redesign.md`
- `docs/Tribal Neurosim v3_ Architecture & Mechanics Redesign.md`
- `docs/Tribal NeuroSim v3_ Territory & Expansion Mechanics.md`
- `docs/Tribal NeuroSim v3_ Offspring Mechanics & Evolutionary Lineage.md`
- `docs/Tribal NeuroSim v3 _ Information Theory Lineage Compression.md`

Prototype controls:

- `WASD` or arrow keys: pan camera
- mouse wheel: zoom
- right or middle mouse drag: pan camera
- left click: select nearest tribe
- `Tab`: cycle selected tribe
- `Space`: pause or resume local simulation
- `N` or `.`: step one tick
- `R`: reset local demo
- `+` / `-`: adjust local simulation speed
- `Esc`: quit

The window title is currently the minimal HUD. It shows mode, tick, living tribe count, disputed tile count, selected tribe, and whether the Node stream is connected.

There is also an in-window no-font HUD drawn with simple generated block glyphs. It is intentionally utilitarian until a proper cockpit font and UI asset pass lands.

Runtime asset loading:

- selected small PNG/JPG assets are loaded directly from `Content/` through `RuntimeAssetLoader`
- no MonoGame content pipeline step is required for this first pass
- active terrain rendering uses the proper material diffuse textures from `Content/Materials/Terrain/`
- terrain is rendered as pointy hex triangle geometry with world-space material UVs, not square sprite stamps
- the tiny `LowPolyPixelRpgAssets/*.png` files are not used as terrain because they create a pixel-art/debug-board look

Next implementation steps:

1. Add a Civ-like terrain composition pass: clustered biomes, readable rivers/coasts, forests, hills, mountains, and subtle borders.
2. Replace the current no-font debug HUD with a proper cockpit-grade information layer.
3. Wire desktop pause/resume/step controls to Node/Rust when connected.
4. Add selected structure/settlement prop bindings for camps, outposts, cities, and ruins.
5. Freeze `FrameV1`, `ControlV1`, and asset metadata contracts across Rust, Node, and C#.
6. Replace the legacy V0 decoder with full versioned V3 frame decoding.
