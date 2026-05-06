# AGENTS.md

## Purpose

This subtree now serves Tribal NeuroSim v3.

The active direction is:

- Rust backend for simulation execution and protocol support
- C# MonoGame desktop client for the main application
- Node as the required middleman between the desktop client and Rust
- asset and concept-art collection under `client-monogame/Content/`

## Current Scope

Work in this subtree should support:

1. Tribal NeuroSim v3 desktop migration
2. C# domain modeling for polity tiers and artifacts
3. Rust-side simulation, event, and transport work
4. Node-mediated desktop integration
5. biome-aware and polity-tier-aware asset preparation

## Architecture Rules
- Keep Rust focused on simulation execution, compact data handling, protocol output, and analytics support.
- Keep C# focused on the desktop client, domain structure, rendering preparation, and asset-facing registries.
- Keep Node thin as the required middleman and bootstrap layer.

## Domain Direction

The C# side should be prepared to model:

- `Tribe`
- `City`
- `Duchy`
- `Kingdom`
- `Empire`

It should also be prepared to define:

- artifact metadata
- biome visual mappings
- settlement visual mappings
- icon and insignia registries

## Assets

Asset collection belongs under:

- `backend/genetic-neurosim/client-monogame/Content/`

Code belongs under:

- `backend/genetic-neurosim/client-monogame/Assets/`
- `backend/genetic-neurosim/client-monogame/Domain/`
- `backend/genetic-neurosim/client-monogame/Net/`
- `backend/genetic-neurosim/client-monogame/Protocol/`

Do not mix raw downloaded assets into code folders.

## Source Of Truth

When making decisions here, follow these docs first:

- `docs/tribal-neurosim-v3-monogame-migration-plan.md`
- `docs/tribal-neurosim-v3-asset-plan.md`
- `docs/Tribal Neurosim v3_ Architecture & Mechanics Redesign.md`
- `docs/Tribal NeuroSim V3_ Territory & Expansion Mechanics.md`
- `docs/Tribal NeuroSim v3_ Offspring Mechanics & Evolutionary Lineage.md`
- `docs/Tribal NeuroSim v3 _ Information Theory Lineage Compression.md`

These V3 docs are not optional flavor notes. They define the direction.

## What Not To Do

- Do not add random AI-life mechanics unrelated to the V3 documents.
- Do not collect giant asset packs blindly without curating them into the `Content/` tree.

## Practical Priority

When in doubt, favor:

1. protocol clarity
2. asset organization
3. simulation observability
4. visual fidelity later
