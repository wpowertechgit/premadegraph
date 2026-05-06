# Tribal NeuroSim

- Rust backend for simulation execution, transport, and analytics support
- C# MonoGame desktop client in `client-monogame/`
- Node as the required middleman between the desktop client and Rust


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

```bash
cd backend/genetic-neurosim/backend
cargo check
```

Desktop client:

Use the MonoGame project under `backend/genetic-neurosim/client-monogame/`.
- Launch: `dotnet run --empire-stress` → starts stress demo with 28 tribes
- Launch: `dotnet run` → unchanged default demo (12 tribes)