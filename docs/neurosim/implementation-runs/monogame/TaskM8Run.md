# Task M8 — Faction Insignia & Banner System (Run)

**Date:** 2026-05-07
**Status:** Done

## What Was Done

Implemented faction insignia profiles and banner rendering for mid-to-far zoom levels:

1. **FactionInsigniaProfile.cs** — faction color/icon/frame data model
   - `ColorFromArtifacts(ArtifactVector)` maps dominant artifact to color palette (Combat→crimson/bronze, Team→azure/gold, Risk→forest/slate, Resource→amber/copper, MapObjective→purple/silver)
   - `PickIcon(tribeId, availableIcons)` deterministically assigns emblem from 44 icons
   - `PolityFrameKeyForTier(tier)` maps PolityTier to frame asset key

2. **BannerRenderer.cs** — sprite-batch banner compositor
   - Green-screen coordinate parsing: scans polity frame PNGs for #00FF00 pixels, computes center+radius of the emblem zone, replaces green with transparent
   - Three-layer banner draw: tinted emblem → cleaned polity frame → ribbon with name text
   - Emblem tinting caches per (iconKey, color) combination
   - Only renders at camera distance > 200 (mid-to-far zoom)
   - Near-zoom banners hidden (settlement 3D models take over)

3. **RuntimeAssetCatalog.cs** — added 44 icon asset definitions, 10 polity frame/banner definitions, 1 ribbon definition
   - Keys: `icons/*`, `insignia/*_polity`, `insignia/*_banner`, `insignia/ribbon`
   - All added to AssetsByKey dictionary

4. **AssetRegistry.cs** — added `ResolveInsignia(tribeId, tier, artifacts)` for faction profile caching
   - `AvailableIconKeys` populated from InsigniaIcons catalog entries

5. **GameRoot.cs** — integrated BannerRenderer
   - Initialized in LoadContent (after SettlementRenderer)
   - Drawn between settlement rendering and symbol overlays (step 3.5)
   - Disposed in cleanup chain

## Files Changed

| File | Action |
|------|--------|
| `client-monogame/Assets/FactionInsigniaProfile.cs` | Created |
| `client-monogame/Rendering/BannerRenderer.cs` | Created |
| `client-monogame/Assets/RuntimeAssetCatalog.cs` | Modified — added icon/frame/ribbon asset definitions |
| `client-monogame/Assets/AssetRegistry.cs` | Modified — added insignia resolution + icon key list |
| `client-monogame/GameRoot.cs` | Modified — integrated BannerRenderer lifecycle |

## Validation

- `dotnet build` — 0 errors, 53 warnings (all pre-existing FontRenderer CA1416 warnings)
- Visual acceptance requires runtime test with `dotnet run` — banners appear at mid/far zoom above tribe capitals
- Green-screen parsing correctness depends on polity PNGs having real #00FF00 marker circles

## Risks / Follow-ups

- Green-screen detection only matches exact `R=0, G=255, B=0` — near-green pixels (e.g., anti-aliased edges) won't be matched. A tolerance threshold may be needed if the emblem edges show green fringing.
- Banner text rendering is deferred — the current implementation draws the ribbon but tribe names aren't rendered yet (FontRenderer integration TBD in M10).
- Emblem tinting replaces luminescence mapping but doesn't alpha-blend with the frame's inner ring shadow — may need soft-edge compositing pass later.
- Icon asset keys use `icons/` prefix convention but these aren't registered in IconRegistry's existing icon bindings — separate path (deliberate), but if IconRegistry is used elsewhere for insignia, coordinate.
