# Tribal NeuroSim

This subtree is now centered on the Tribal NeuroSim v3 desktop migration.

Current direction:

- Rust backend for simulation execution, transport, and analytics support
- C# MonoGame desktop client in `client-monogame/`
- Node as the required middleman between the desktop client and Rust

The old browser runtime frontend has been removed from this subtree.

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
