# Tribal NeuroSim

- Rust backend for simulation execution, transport, and analytics support
- C# MonoGame desktop client in `client-monogame/`
- Node as the required middleman between the desktop client and Rust

## Installation

Install the required SDKs first:

```powershell
winget install Microsoft.DotNet.SDK.8
winget install Rustlang.Rust.MSVC
```

Then restore/build the projects from this folder:

```powershell
dotnet restore .\client-monogame\TribalNeuroSim.Client.csproj
dotnet build .\client-monogame\TribalNeuroSim.Client.csproj

cd .\backend
cargo check
cd ..
```

Notes:

- the desktop client targets `.NET 8`
- the Rust backend uses Cargo; no Python `requirements.txt` exists in this subtree
- Postgres is optional for the backend; it can start in HTTP-only mode if the database is unavailable


## Layout

```text
backend/
  Cargo.toml
  src/
    main.rs
    simulation.rs
    world.rs
    tribes.rs
    war.rs
    events.rs
    desktop_protocol.rs
client-monogame/
  TribalNeuroSim.Client.csproj
  Program.cs
  GameRoot.cs
  Assets/
  Content/
  Domain/
  Launcher/
  Models/
  Net/
  Protocol/
```

## Key Docs

- `docs/tribal-neurosim-v3-monogame-migration-plan.md`
- `docs/tribal-neurosim-v3-asset-plan.md`

## Current Notes

- terrain and vegetation assets are now being collected under `client-monogame/Content/`
- concept art references are stored under `client-monogame/Content/ConceptArts/`
- the desktop client is the active UI direction

## Verification

Backend:

```powershell
cd .\backend
cargo check
```

Desktop client:

```powershell
cd .\client-monogame
dotnet run
```

Useful launch variants:

- `dotnet run` -> default local demo
- `dotnet run -- --empire-stress` -> stress demo with 28 tribes
- `dotnet run -- --dispute-stress` -> dispute-heavy local scenario
- `dotnet run -- --connect` -> connect to the default Node endpoint at `ws://127.0.0.1:3001/api/neurosim/desktop/v1/frames`

Backend run command:

```powershell
cd .\backend
cargo run
```
How it works now:
                                                                                                                        
  dotnet run (no flags) will:                               
  1. Start C# PlayableSimulation as fallback (always created)
  2. Simultaneously in the background: try to connect to ws://127.0.0.1:8000/ws/desktop/v1/frames — the Rust backend
  directly, no Node middleware
  3. If Rust is running → connection succeeds within 5 seconds → _isNetworkMode flips to true → C# simulation stops
  ticking, rendering switches to Rust frames
  4. If Rust is not running → 4 attempts × 5s timeout = ~28s of silent retries, then falls back gracefully to the C# sim

  To run with Rust:
  # Terminal 1
  cd backend\genetic-neurosim\backend
  cargo run

  # Terminal 2 (after Rust prints "listening on 0.0.0.0:8000")
  cd backend\genetic-neurosim\client-monogame
  dotnet run
  The C# will auto-detect Rust and switch. No --connect needed, no Node middleware needed.

  --connect flag still works — it just pre-sets _isNetworkMode = true immediately instead of waiting for connection.
  Useful if you want to be explicit.

  --node-ws=ws://... still works for when you do have Node in the loop.