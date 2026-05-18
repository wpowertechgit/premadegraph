---
status: working
mainraw_included: false
mainraw_chapters: []
document_role: demo-copy
---

# Landing Page Design

## Purpose

This document defines the visual and structural direction for the project landing page.

The goal is not to make the site feel like a startup product page or a game fan page. It should feel like a friendly, engaging research showcase that quickly explains what the project is, what it does, and why it matters.

The page should impress academic viewers through clarity, atmosphere, visual discipline, and methodological seriousness, while still being accessible to any first-time visitor.

---

## Core Intent

The landing page should communicate three things immediately:

1. this is a research-oriented League of Legends graph analytics project
2. it has real datasets, real system architecture, and real analytical outputs
3. it is presented with enough visual ambition to feel memorable without becoming noisy or gimmicky

The page should feel:

- scholarly
- cinematic
- calm
- precise
- readable
- slightly magical, but never unserious

---

## Design System Alignment

The landing page should inherit the direction established in `DESIGN.md`, especially:

- dark-mode-native presentation
- near-black background surfaces
- strong typographic hierarchy
- restrained indigo-violet accent usage
- thin semi-transparent borders
- precise spacing
- large compositional breathing room

However, the landing page should not feel like a direct clone of a SaaS marketing site.

Adjustments for this page:

- soften the startup feel
- reduce UI density
- replace product-dashboard energy with research-atmosphere energy
- allow more environmental storytelling through landscape art
- use fewer hard component boundaries in the hero and early scroll sections

This means the landing page should preserve the rigor of the existing visual language while gaining a more editorial, thesis-showcase tone.

---

## Visual Direction

### Overall Mood

The page should feel like a research instrument framed inside a fictional scientific world.

The key inspiration is a Piltover-like environment: a city of invention, measurement, archives, bridges, and elevated infrastructure. The visual should clearly evoke that mood without directly copying any Riot or Arcane environment art.

It should feel original and stylized.

### Artistic Style

The background art should be:

- flat vector landscape art
- layered for parallax
- clean and geometric
- low-noise
- readable at large scale
- suitable for later lightweight video animation

Avoid:

- painterly rendering
- high-frequency texture
- photorealism
- cluttered fantasy detail
- direct imitation of copyrighted environment compositions

### Atmosphere

The exact time-of-day can be decided later, but the image system should support:

- atmospheric haze
- strong silhouette separation
- controlled accent lighting
- depth through layer contrast rather than texture

The environment should suggest:

- research
- engineering
- connectivity
- observation
- structure

---

## Hero Artwork Concept

### Scene Summary

The hero should feature a wide, original, flat-vector landscape panorama inspired by Piltover.

Composition:

- distant skyline in the back
- elevated bridges and hextech-like towers in the middle ground
- terraced foreground with research-oriented architectural forms

The city should feel like a place where graph theory, infrastructure, and scientific discovery belong naturally.

### Symbolic Environmental Cues

The artwork should embed subtle thesis-relevant symbolism:

- bridges suggest connectivity
- elevated districts suggest graph layers and hierarchy
- a dominant central tower can imply a core node
- smaller distributed structures can imply peripheral nodes
- observatories or survey towers can suggest measurement and analytics
- rail lines, cable lines, or light paths can hint at edges and traversal

These references should remain environmental and elegant, not literal chart illustrations.

### Hero Motion Strategy

The hero background should be designed as a lightweight animated video derived from generative work based on the vector composition.

Desired motion:

- subtle atmospheric drift
- slight parallax separation
- slow movement in haze, light, or small environmental accents
- no dramatic camera movement

The motion should support readability of the title and not compete with the content.

### Current Asset Mapping

The current public assets for this landing page are:

- `public/hero-video.mp4`
- `public/hero.png`
- `public/between.png`
- `public/library.png`

These should be treated as the canonical visual inputs for the first implementation pass.

Important note for `hero-video.mp4`:

- the video currently has a black border
- implementation should account for this visually
- the border should not become a visible framing mistake in the final hero presentation
- cropping, scaling, masking, or controlled overflow may be needed so the hero still feels seamless

The still fallback for the animated hero is `hero.png`.

---

## Background Continuity Below The Hero

After the hero, the landing page should continue using one large continuous background image system in the same visual language.

This should not feel like unrelated section backgrounds stacked on top of each other.

Instead, the page should behave like a single journey downward through one stylized world.

### Continuity Rules

- the hero and lower sections should share the same world, palette, and shape language
- the scenery should evolve gradually while scrolling
- transitions between sections should feel continuous
- section content should appear as overlays placed over calmer parts of the image
- the background should remain supportive, not dominant

Possible progression:

- hero: distant skyline and opening atmosphere
- upper sections: city overview and elevated research districts
- middle sections: bridges, systems, archives, structures
- lower sections: grounded platforms, documented outputs, quieter architectural zones

### Three-Image Background Architecture

The landing page should use a staged three-image environmental progression rather than one repeated background treatment.

This is the intended structure:

1. hero image: exterior city reveal
2. transition image: threshold / semi-interior passage
3. main section image: interior research library / archive

This creates a spatial narrative:

- first the visitor sees the larger world
- then the visitor moves inward through that world
- then the visitor arrives at the academic interior where the actual research content is presented

#### Image 1: Hero Exterior

Role:

- grand opening composition
- strongest visual identity
- most cinematic frame

Content characteristics:

- monumental exterior cliffside city
- strong negative space for headline placement
- iconic skyline silhouette
- minimal interference with text readability

Usage:

- occupies the full hero section
- supports the title, subtitle, and short introductory copy
- no navbar visible during this stage
- implemented with `hero-video.mp4` as the animated layer and `hero.png` as the still fallback / transition source image

#### Image 2: Transition Threshold

Role:

- visual bridge between exterior city and interior research environment
- sense of entering the world behind the skyline

Content characteristics:

- arched passages, balconies, observatory halls, windows, platforms, and elevated walkways
- partial views back out toward the city
- architectural threshold feeling rather than a complete destination

Usage:

- shorter than the hero and shorter than the main content background
- used as a transitional scroll band
- should not carry too many content-heavy sections
- implemented with `between.png`

#### Image 3: Main Content Interior

Role:

- primary content environment for the landing page sections
- calmest and most academically legible backdrop

Content characteristics:

- research library / archive interior
- tall windows, shelves, vaulted architecture, tables, instruments, and structured open floor areas
- wide text-safe regions for readable section overlays

Usage:

- used for the majority of the landing page sections
- acts as the stable visual home for the page body
- implemented with `library.png`

Recommended content mapping:

- image 1: Hero
- image 2: What This Project Does transition zone
- image 3: Current Thesis Scope, System Pipeline, Key Research Outputs, Selected Interface / Screenshots, Methodological Boundaries, Footer / Resources

The three images should feel clearly related in palette, silhouette language, and atmosphere, but distinct in function.

They should not look like three disconnected illustrations.

They should feel like three spatial chapters of the same world.

### Transition Rule Between Hero And Between

The key transition trick is:

- the animated hero experience uses `hero-video.mp4`
- but the scroll transition into the next visual stage should happen between `hero.png` and `between.png`

This means the transition should not attempt to morph directly from the moving video into `between.png`.

Instead, the implementation should conceptually work like this:

1. the visitor sees `hero-video.mp4` while the hero section is active
2. near the end of the hero scroll range, the system resolves visually onto `hero.png`
3. the scroll-driven transition then happens between `hero.png` and `between.png`
4. after the threshold section, the experience transitions into `library.png`

This should make the visual handoff cleaner and easier to control.

---

## Navbar Behavior

The navbar should be fully absent during the hero section.

This is important.

The hero should feel uninterrupted, like a cinematic opening frame rather than a conventional product page.

### Navbar Rules

- no visible navbar at initial page load while the hero is active
- the hero owns the full top of the screen
- after the hero section is crossed, the navbar should appear
- the navbar reveal should be smooth and calm, not abrupt
- once shown, it can remain sticky for lower sections

Recommended behavior:

- fade + slight upward slide on reveal
- translucent dark background
- minimal links
- no oversized CTA styling

The navbar should feel like a research index that appears once the visitor enters the document body.

---

## Scrolling Behavior

Scrolling should be smooth and continuous across the entire page.

### Desired Feel

- no jarring jumps between sections
- no hard full-screen snapping unless later proven useful
- gentle parallax movement across background layers
- section-to-section rhythm should feel guided but natural

### Interaction Rules

- anchor navigation should scroll smoothly
- parallax speed differences should be subtle
- animation should never impair text legibility
- motion should degrade gracefully on weaker devices

The page should feel refined, not flashy.

### Scroll Choreography

The three-image system should be revealed through a controlled scroll sequence.

Recommended sequence:

1. page opens on the exterior hero image
2. the hero remains visually dominant during the opening reading moment
3. as the user scrolls past the hero, the navbar fades in
4. near the end of the hero phase, the presentation visually settles from `hero-video.mp4` onto `hero.png`
5. the transition from `hero.png` to `between.png` is driven by scroll progress
6. the second image appears as a transition band that suggests entering the city’s academic interior
7. the third image, `library.png`, takes over as the stable background for the main thesis sections

Behavior notes:

- image transitions should be smooth fades or layered cross-dissolves
- parallax movement should remain subtle
- image 2 should feel like a passage, not a second hero
- image 3 should feel quiet and steady so that content readability stays high
- the transition movement itself should respond to scrolling rather than play like a fixed autoplay sequence
- the `hero.png -> between.png` handoff should be the primary scroll-driven visual blend
- the `between.png -> library.png` transition should also respond to scroll, but can be calmer and slower

The overall effect should feel like descending from spectacle into understanding.

---

## Typography Direction

Typography should remain close to `DESIGN.md`:

- Inter Variable as the primary typeface
- strong display sizes with tight letter spacing
- clean body text
- Berkeley Mono for technical labels, dataset tags, and micro-metadata where useful

Tone adjustments for the landing page:

- headline copy should be more human and explanatory
- avoid overly corporate product phrasing
- avoid ironic or overly dramatic fantasy language
- keep section titles academically legible

The typography should bridge:

- research seriousness
- modern interface precision
- public readability

---

## Color Direction

The landing page should remain dark, but the environment art introduces a broader mood system around the existing palette.

### Foundation

- near-black and deep slate surfaces from `DESIGN.md`
- luminous off-white text
- restrained indigo accent

### Environmental Expansion

The background landscape can introduce:

- muted stone neutrals
- cool dusk or dawn blues
- brass or warm architectural highlights
- occasional teal-cyan or hex-gold signal lights

These additions should remain subdued and cinematic.

The UI layer should still read as part of the established dark design system.

---

## Page Structure

The landing page should include the following sections in order.

### 1. Hero

Purpose:

- establish atmosphere
- state the project clearly
- make a strong first impression

Content:

- project title
- concise thesis-grade subtitle
- short supporting sentence
- optional single downward prompt like “Explore the project”

Behavior:

- full-screen or near-full-screen
- animated vector landscape video in the background
- no navbar visible
- high contrast text overlay

Suggested content direction:

- explain that the project studies repeated player interaction networks in League of Legends
- mention graph construction, datasets, and analytics in plain language

### 2. What This Project Does

Purpose:

- make the project understandable in under a minute

Recommended format:

- three concise blocks or cards

Suggested subtopics:

- dataset collection
- graph construction
- graph analytics

This section should answer the question:

“What is actually happening here?”

### 3. Current Thesis Scope

Purpose:

- show that the project has a clear and defensible focus

Suggested items:

- Flex Queue dataset expansion
- SoloQ control dataset
- associative core-periphery interpretation
- Flex vs SoloQ comparison
- assortativity on `opscore` and `feedscore`
- weighted Brandes betweenness centrality in Rust
- Genetic NeuroSim v2 as future-facing but secondary

Important:

- clearly separate active work from future work
- do not foreground retired scope

### 4. System Pipeline

Purpose:

- explain the architecture in a simple, academic-friendly way

Recommended format:

- horizontal or gently stacked pipeline illustration

Suggested flow:

Riot match data -> dataset processing -> player graph -> Rust analytics -> frontend evidence view

This section should make the system understandable without reading technical documentation.

### 5. Key Research Outputs

Purpose:

- make the work feel concrete and evidence-backed

Suggested content:

- dataset counts
- player counts
- edge counts
- available analytics outputs
- benchmark notes where appropriate

Recommended format:

- stat blocks or concise evidence tiles

The tone should be “measured outputs,” not marketing KPIs.

### 6. Selected Interface / Screenshots

Purpose:

- prove that the system exists as a usable artifact

Suggested screenshot set:

- graph view
- assortativity readout
- Brandes centrality result

Rules:

- keep captions short
- avoid carousels
- use a restrained editorial gallery

### 7. Methodological Boundaries

Purpose:

- build trust with academic viewers

Content direction:

- the project avoids unsupported causal claims
- Flex Queue and SoloQ conclusions are interpreted separately
- retired or weaker thesis directions are not overstated
- analytics are framed as evidence, not as social truth claims

This section is small but important.

It signals discipline.

### 8. Footer / Resources

Purpose:

- give access to the project’s evidence trail and codebase

Suggested links:

- repository
- documentation
- chapter evidence map
- thesis PDF or thesis notes if available
- backend / frontend / Rust stack note

The footer should feel tidy and archival, not commercial.

---

## Layout Strategy

The page should be structured as centered content islands placed over a continuous panoramic world.

### Layout Principles

- large vertical spacing
- narrow to medium reading widths
- carefully separated sections
- no crowded dashboard composition
- text should sit in visually calm regions of the background

Recommended pattern:

- hero uses free composition
- lower sections use centered containers with consistent max width
- some sections may alternate between text-first and media-first balance

The art should create the emotional continuity.
The content blocks should create the intellectual clarity.

---

## Motion Principles

Motion should serve atmosphere and continuity.

Use:

- soft parallax
- slow background drift
- smooth anchor scrolling
- modest reveal animations for text blocks

Avoid:

- exaggerated motion
- constant looping UI gimmicks
- excessive blur transitions
- anything that makes the page feel like a game trailer site

This is a research page with cinematic restraint.

---

## Content Tone

Copy should be:

- plain-language
- academically credible
- concise
- grounded
- welcoming to non-specialists

Avoid:

- startup hype language
- vague “AI insight” phrasing
- overly fandom-oriented references
- unsupported social or psychological claims

The page should explain the project as a serious computational and analytical artifact with an inviting surface.

---

## Non-Goals

The landing page should not become:

- a generic SaaS product homepage
- a heavy lore tribute page
- an animation showcase with weak substance
- a dense dashboard embedded directly into the first-scroll experience
- a place that foregrounds retired research scope

The art exists to create identity and atmosphere.
The content exists to create understanding and trust.

---

## Summary

The landing page should combine:

- the dark precision of `DESIGN.md`
- a Piltover-inspired original flat-vector research landscape
- a cinematic hero with no navbar
- a continuous illustrated background through the full page
- gentle parallax and smooth scrolling
- academically structured sections
- a calm, engaging explanation of the project

The final experience should feel like entering a research world and then being guided through its evidence, methods, and outputs with clarity.
