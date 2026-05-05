# DESIGN.md

## Design Direction

This subtree no longer follows the old SpaceX-inspired browser design language.

The active visual direction is Tribal NeuroSim v3:

- tribal
- prehistoric to antiquity
- pre-Christian ancient-world atmosphere
- vibrant stylized low-poly asset language
- serious strategy-game readability
- biome-aware environment identity
- clear polity-tier silhouette progression

## Application Context

The primary visual target is now a C# MonoGame desktop application, not a web landing page.

That changes the design priorities:

1. readable world state from zoomed-out view
2. strong silhouette differences between polity tiers
3. biome-specific identity
4. clean asset separation and reusable content structure
5. diagnostics and operator readability

## Settlement Progression

The world should visually communicate progression across:

- `Tribe`
- `City`
- `Duchy`
- `Kingdom`
- `Empire`

The progression should move from tribal encampment into early civilization and antiquity-scale power centers.

Avoid:

- feudal castles as the default visual language
- gothic or cathedral-centric identity
- late-medieval European atmosphere

## Asset Style

Preferred look:

- stylized low-poly
- vibrant but grounded colors
- clean forms
- readable from isometric or high-angle perspective
- suitable for strategy-game map rendering

Avoid:

- over-detailed realism that hurts readability
- toy-like exaggeration unless used carefully
- dark muddiness that hides terrain state

## Biome Identity

Biomes should not feel interchangeable.

The system should support distinct visual families for:

- plains
- dense forest
- sparse woodland
- marsh
- mountain
- riverland
- fertile valley
- dry steppe
- cold biome if enabled

Each biome should eventually have:

- terrain material identity
- vegetation identity
- prop identity
- settlement adaptation cues

## UI Direction

The desktop UI should support the world rather than overpower it.

Preferred UI tone:

- restrained ancient-world influence
- carved, woven, stone, bronze, leather, clay accents in moderation
- readable labels and overlays
- clear event and state icons

Avoid:

- sci-fi HUD aesthetics
- full-screen web-hero aesthetics
- decorative overload

## Typography

Preferred direction:

- ancient or inscriptional display feel
- readable body font
- practical debug text

Potential font exploration:

- `Cinzel`
- `Marcellus`
- `Cormorant`
- `Noto Serif`

Typography should feel historical without becoming unreadable.

## Content Structure

Code and content should stay separated.

Code:

- `client-monogame/Assets/`
- `client-monogame/Domain/`
- `client-monogame/Net/`
- `client-monogame/Protocol/`

Content:

- `client-monogame/Content/Materials/`
- `client-monogame/Content/Models/`
- `client-monogame/Content/ConceptArts/`
- later `client-monogame/Content/UI/`

## Supporting Docs

For the deeper visual and sourcing plan, use:

- `docs/tribal-neurosim-v3-asset-plan.md`

For the architecture and migration plan, use:

- `docs/tribal-neurosim-v3-monogame-migration-plan.md`
