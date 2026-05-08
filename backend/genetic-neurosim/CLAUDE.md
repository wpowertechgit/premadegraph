# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Identity

Tribal NeuroSim v3 is an AI-driven tribal civilization simulator. Tribes evolve via neural networks and genetic algorithms, expand territory, wage wars, and progress through polity tiers (Tribe → City → Duchy → Kingdom → Empire). Three runtimes cooperate:

- **Rust backend** (`backend/`): simulation loop, world state, event system, WebSocket/REST API on port 8000
- **C# MonoGame client** (`client-monogame/`): isometric desktop renderer and UI
- **Node middleware**: required bridge between the desktop client and the Rust backend; not in this subtree but expected at `ws://127.0.0.1:3001/api/neurosim/desktop/v1/frames`

Read `AGENTS.md` before adding features. The V3 architecture docs in `docs/` are authoritative for scope and design decisions.

## Build Commands

**Prerequisites (install once):**
```powershell
winget install Microsoft.DotNet.SDK.8
winget install Rustlang.Rust.MSVC
```

**C# client:**
```powershell
dotnet restore .\client-monogame\TribalNeuroSim.Client.csproj
dotnet build .\client-monogame\TribalNeuroSim.Client.csproj
```

**Rust backend:**
```powershell
cd backend
cargo check
cargo build --release
```

**Run tests:**
```powershell
dotnet test .\client-monogame-tests\TribalNeuroSim.Client.Tests.csproj
```

## Running

**Desktop client launch modes:**
```powershell
cd client-monogame
dotnet run                          # local demo (no network)
dotnet run -- --empire-stress       # 28-tribe stress demo
dotnet run -- --dispute-stress      # dispute-heavy local scenario
dotnet run -- --connect             # connect to Node WebSocket endpoint
```

**Rust backend:**
```powershell
cd backend
cargo run                           # starts Axum on port 8000
```

Postgres is optional. The backend starts in HTTP-only mode if the database is unavailable; set `PREMADEGRAPH_URL` for HTTP cluster profile fallback.

## Architecture

### Rust Backend (`backend/src/`)

| File | Responsibility |
|---|---|
| `main.rs` | Axum router: WebSocket frames, REST endpoints, `AppState` |
| `simulation.rs` | Core tribe neural-network logic, genetic algorithms, control config (~3k LOC) |
| `world.rs` | Map generation, tile ownership, resource distribution |
| `tribes.rs` | Tribe state, behavior states, polity tier progression |
| `war.rs` | Combat mechanics and war status |
| `events.rs` | 70+ event types: lifecycle, resources, territory, diplomacy, polity |
| `lineage_registry.rs` | Tribe lineage and inheritance tracking |
| `tombstone.rs` | Records for extinct tribes |
| `desktop_protocol.rs` | Legacy frame encoding (`wrap_tribal_legacy_frame`) |
| `frame_v1.rs` | Versioned binary frame protocol (`wrap_frame_v1`) |
| `db.rs` | PostgreSQL + PREMADEGRAPH HTTP integration |

**Key types:** `TribeSimulation`, `SharedSimulation` (Arc-wrapped), `ControlConfig`, `AppState`. The simulation runs under a shared lock accessed by both the tick loop and HTTP handlers.

Two broadcast channels carry encoded frames to WebSocket subscribers: `frame_tx` (legacy v0) and `frame_v1_tx` (v1 schema).

### C# Desktop Client (`client-monogame/`)

**Entry points:** `Program.cs` → `Launcher/` → `GameRoot.cs` (MonoGame `Game` subclass)

**Folder responsibilities:**
- `Assets/` — `AssetRegistry`, runtime loaders, OBJ/material parsers, biome mappings. PNG/JPG loaded directly (not through the MonoGame content pipeline).
- `Content/` — Raw asset files: terrain textures, vegetation packs, concept art. Never put code here.
- `Domain/` — Polity tier classes (`Tribe`, `City`, `Duchy`, `Kingdom`, `Empire`), artifact definitions.
- `Net/` — `SimulationConnection` (WebSocket wrapper), `SimulationFrameReceiver`, `ControlClient`.
- `Protocol/` — `FrameDecoder` supporting v0 (legacy binary) and v1 (schema-tagged binary), `DesktopProtocol` constants.
- `Models/` — `PlayableSimulation`, `SimulationViewModel`, `PlayableRenderAdapter`, diagnostics.
- `Rendering/` — Isometric camera, terrain/vegetation/settlement/banner/shadow/post-process renderers.
- `UI/` — `DebugHud`, `LineageInspectorPanel`, `TombstonePanel`, `SelectionPanel`.
- `Input/` — `KeyboardCommandController`, `SelectionSystem`.

**Rendering pipeline in `GameRoot.cs`:** tick accumulator at 12 TPS → `PlayableSimulation.Tick()` → renderer `Draw()` calls → optional post-process pass.

### Protocol

Two frame versions exist. Legacy v0 wraps tribe state in a compact binary blob. v1 adds a schema tag, supports tribe records, tile ownership delta, war state, and recent events. `FrameDecoder.cs` handles both. Keep `desktop_protocol.rs` and `frame_v1.rs` in sync with `Protocol/` on the C# side when changing the wire format.

## Architecture Rules (from AGENTS.md)

- **Rust**: simulation execution, compact data, protocol output, analytics. Not rendering.
- **C#**: desktop client, domain modeling, rendering, asset registries. Not simulation logic.
- **Node**: thin middleman only; do not add game logic there.
- Raw assets go in `Content/`; code goes in `Assets/`, `Domain/`, `Net/`, `Protocol/`.

## Key Docs

When making design decisions, consult these first:

- `docs/tribal-neurosim-v3-monogame-migration-plan.md`
- `docs/tribal-neurosim-v3-asset-plan.md`
- `docs/Tribal Neurosim v3_ Architecture & Mechanics Redesign.md`
- `docs/Tribal NeuroSim V3_ Territory & Expansion Mechanics.md`
- `docs/Tribal NeuroSim v3_ Offspring Mechanics & Evolutionary Lineage.md`
- `docs/taskrun/MASTER-TASK-LIST-v3-neurosim-simulation.md`
- `docs/taskrun/AGENT-MODEL-ROUTING-v3-neurosim.md`
