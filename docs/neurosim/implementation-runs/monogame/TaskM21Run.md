# Task M21 Run — Settlement Lighting Coherence Fix

**Date:** 2026-05-07
**Status:** Done

## What was done

Created `SceneLighting.cs` — single source of truth for directional light vectors and colors shared by all renderers. Updated `SettlementRenderer` and `WorldRenderer` to both reference `SceneLighting` instead of hardcoding lights separately.

### Files changed

| File | Change |
|------|--------|
| `client-monogame/Rendering/SceneLighting.cs` | New — static class with `AmbientColor`, `DiffuseColor`, `KeyDirection`/`KeyDiffuse`, `FillDirection`/`FillDiffuse`, and `ApplyTo(BasicEffect)` helper |
| `client-monogame/Rendering/SettlementRenderer.cs` | `EnsureEffect()`: replaced `EnableDefaultLighting()` + hardcoded ambient/diffuse with `SceneLighting.ApplyTo(_effect)` and `PreferPerPixelLighting = true` |
| `client-monogame/Rendering/WorldRenderer.cs` | `EnsureEffects()`: replaced hardcoded light setup with `SceneLighting.ApplyTo(_hexEffect)` |

### Shared light constants

Canonical values (from WorldRenderer's proven terrain lighting):
- **Ambient:** (0.45, 0.45, 0.42) — scene base fill
- **Diffuse:** (1.0, 1.0, 0.98) — base multiplier
- **Key light (sun):** direction normalize(0.5, -1, -0.3), diffuse (0.85, 0.82, 0.70) — warm
- **Fill light:** direction normalize(-0.3, -0.6, 0.5), diffuse (0.25, 0.28, 0.35) — cool

### Validation

- `dotnet build` — 0 warnings, 0 errors
- No automated tests in test project (manual harness only)
- Directional light values are bit-identical to pre-change WorldRenderer values — terrain shading unchanged
- Settlement models now receive same sun angle and light colors as terrain

### Risks / Follow-ups

- Visual verification needs runtime screenshot — ambient tint may need slight adjustment for settlements vs terrain since settlements don't have per-biome ambient override
- `WorldRenderer.DrawHexTerrain()` still overrides `AmbientLightColor` per biome via `_ambientTintCache` — this is intentional and doesn't break the shared directional lights
