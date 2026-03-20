# Route Transition Overlay

## Document Role

This document covers route-to-route motion, timing, and transition orchestration inside the application shell.

## Related Documents

- [New GUI Overview](new-gui-overview.md)
- [Bird's-Eye 3D Sphere](birdseye-3d-sphere.md)
- [Mock Datasets And Chaos Design](mock-datasets-and-chaos-design.md)

## Purpose

The route-transition system gives the application a deliberate page-to-page motion language instead of abrupt route swaps.

The implementation primarily lives in:

- `frontend/src/App.tsx`
- `frontend/src/RouteTransitionOverlay.tsx`
- `frontend/src/index.css`

## In Plain Language

This document explains the animated page transitions between screens in the app.

The simple purpose is to make navigation feel intentional instead of jarring. When the user changes pages, the old page fades out, the new page fades in, and the app feels more polished and easier to follow.

## Core Mechanism

The app uses a two-stage navigation model:

1. detect that the target route changed
2. keep rendering the old page while the transition enters its outro phase
3. swap the displayed route halfway through the timing window
4. finish with an intro phase into the new page

This is managed in `App.tsx` through:

- `displayedLocation`
- `transitionPhase`
- `TRANSITION_TOTAL_MS`
- `TRANSITION_SWAP_MS`

The overlay itself is rendered above the route content and removed once the transition finishes.

## Transition Types

`RouteTransitionOverlay.tsx` currently supports several named transition families:

- `ethereal-morph`
- `neural-dissolve`
- `scarlet-breach`
- `monolith-descent`
- `minimal`

The first four are expressive visual styles. The `minimal` variant exists as the reduced-motion fallback.

## Accessibility

Reduced-motion support is built directly into the component with `window.matchMedia("(prefers-reduced-motion: reduce)")`.

If reduced motion is requested:

- the transition kind becomes `minimal`
- the active timing window is shortened
- the heavier visual choreography is skipped

This is important because route transitions should improve feel, not force motion on users who explicitly do not want it.

## Why The Overlay Is Implemented Centrally

The transition system is attached at the app-shell level rather than embedded in each page.

That decision has several benefits:

- page components stay focused on their own content
- transitions remain visually consistent across routes
- route changes can be orchestrated with one timing model
- new pages automatically inherit the transition system

If each page owned its own entrance and exit animation, the application would quickly become harder to reason about and much easier to break.

## CSS Strategy

The actual motion language is mostly CSS-driven. The React layer chooses the current transition kind and phase, while the stylesheet handles:

- backdrop behavior
- blob motion
- singularity particles
- monolith slabs
- scarlet breach halves and sparks
- reduced-motion overrides

This division keeps the JavaScript logic compact and makes visual tuning easier without constantly rewriting component code.

## Development Process Reasoning

The transition system was introduced for more than just decoration.

### 1. The app had grown into multiple heavy views

Once the project gained the pathfinder lab, the signed-balance page, and the full 3D sphere, route changes began to feel more like hard jumps than deliberate movement through one application. The transition layer helps make the product feel coherent.

### 2. The new visual language needed identity

The project moved beyond a utility-style interface. A custom transition system helps signal that the application has its own visual identity, which matters in demos and presentations.

### 3. Motion needed guardrails

The implementation deliberately avoids handing timing control to many separate components. Central orchestration reduces accidental overlap and keeps animation bugs localized.

### 4. Reduced motion was treated as a design requirement

The fallback was not added as an afterthought. It is part of the core design because a thesis-facing application should be polished, but not hostile.

## Tradeoffs

The transition overlay introduces some complexity:

- route state becomes slightly more indirect because `displayedLocation` can lag behind the real location
- timing constants must stay in sync with visual expectations
- large transition effects can feel excessive if overused

Those tradeoffs are acceptable because the transitions are centralized and still optional through reduced-motion handling.

## Future Improvements

Potential next steps:

- make the transition family route-aware instead of purely weighted-random
- expose a lightweight developer toggle for transition debugging
- add performance telemetry for low-end devices
- keep animation vocabulary curated rather than adding endless variants

## Conclusions

The main conclusion is that centralized transition control is the right tradeoff for consistency, accessibility, and maintainability.
