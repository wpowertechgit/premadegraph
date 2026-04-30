# Player Details: Impact Benchmarking Revision

## Why This Change Was Made

The original player-details card had a presentation problem:

- the artifact circles were normalized against the player's own highest artifact
- this made values like `31%` for KDA look much worse than they really were
- the percentages did **not** mean "better or worse than the dataset"
- the labels below the circles were too raw to explain actual player impact

That created confusion on the page, especially when a clearly decent player looked artificially weak.

The goal of this revision was to make the card **dataset-grounded, interpretable, and impact-focused**.

---

## Design Direction

The local scoring documentation already defines the system as:

- dataset-based
- role-aware
- based on averages across stored matches
- intended to describe player performance relative to the stored player pool

Because of that, the player-details page should not show self-relative artifact percentages.

Instead, the page should answer:

- how this player compares to the dataset
- what the player's average performance looks like
- which areas are strengths or weaknesses
- what each score is actually measuring

---

## What Was Changed

### 1. Replaced Fake Artifact Percentages

Before:

- the ring values were computed as:
  - `artifact / maxArtifactForThisPlayer`
- this only showed internal distribution within one player
- it did **not** show dataset ranking or quality

Now:

- the backend computes dataset-relative percentile benchmarks
- the frontend rings show percentile against the stored player population
- the card explicitly states that the rings are dataset-grounded

Meaning:

- `31%` no longer means "this artifact is 31% of the player's best artifact"
- it now means something much closer to "this player is around the 31st percentile on that impact dimension"

---

### 2. Added Real KDA Benchmarking

The user-facing complaint was correct:

- the KDA area should say what the player's **average KDA** is
- not just show a raw artifact number with no context

Now the backend scans stored match JSON and computes:

- player's average KDA
- dataset-wide average KDA
- sample counts used

The frontend now uses that for the combat card headline so the page can say:

- player's average KDA
- dataset average KDA

This makes the card much easier to read in practical terms.

---

### 3. Regrouped Artifacts Around "Impact"

The original eight-card layout contained too many artifacts and too much overlap.

The page was revised to focus on three impact-oriented groups:

#### Combat Impact

Includes:

- `kda`
- `damage`
- `tanking`

Reason:

- damage dealt and damage absorbed are part of fight impact
- a high KDA alone does not necessarily mean meaningful impact
- combining them produces a more honest combat picture

#### Map Control

Includes:

- `map_awareness`
- `objectives`
- `early_game`

Reason:

- the user requested that map/objective/early pressure should live together
- early pressure is more useful here as a map-tempo signal than as a standalone artifact

#### Resource & Utility

Includes:

- `economy`
- `utility`

Reason:

- economy and utility were too fragmented as separate high-level circles
- combining them better reflects resource conversion plus team contribution

---

## Removed / Folded Areas

### Removed as standalone cards

- `Early`
- `Damage`
- `Tanking`
- `Objectives`
- `Map`
- `Economy`
- `Utility`

These are not lost.

They are now shown:

- inside grouped impact cards
- inside explanation panels with player value vs dataset average

---

## New Interpretation Layer

The player-details page now contains a "What This Means" section.

It explains:

- `Performance Index`
- `Feed Discipline`
- each grouped impact dimension

Each section uses plain language such as:

- above the dataset average
- below the dataset average
- around the dataset average
- percentile position within the dataset

It also includes component-level stat explanations so the page now answers:

- what the stat does
- why it matters
- whether this player is above or below the field

This directly addresses the request for an info box / interpretation box below the performance charts.

---

## Backend Changes

The backend route:

- `GET /api/players/:puuid/scores`

was expanded to return benchmark information in addition to the existing score payload.

### Added backend benchmark payload

- dataset sample size
- opscore average and percentile
- feedscore average and percentile
- average KDA benchmark
- grouped artifact percentile summaries
- per-component player value vs dataset average

### Important implementation note

Average KDA is computed from stored match JSON, not from the artifact score.

That was intentional, because the UI needed a real gameplay-facing KDA benchmark, not the synthetic scoring artifact.

---

## Frontend Changes

The player performance card was rewritten to:

- consume the new benchmark payload
- render grouped impact cards instead of the 8 separate artifact circles
- display average KDA wording directly
- show percentile-based rings
- add explanation text blocks under the visual summary

The card now presents the system more like an analysis panel than a raw score dump.

---

## Files Changed

### Backend

- [backend/server.js](/c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/backend/server.js)

Added:

- percentile helpers
- average KDA extraction from match files
- grouped artifact benchmarking
- richer response shape for player score details

### Frontend

- [frontend/src/components/PlayerPerformanceCard.tsx](/c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/frontend/src/components/PlayerPerformanceCard.tsx)
- [frontend/src/components/PlayerPerformanceCard.css](/c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/frontend/src/components/PlayerPerformanceCard.css)

Added:

- grouped impact cards
- dataset-relative summaries
- "What This Means" explanation section
- supporting styles for benchmark copy and insight cards

---

## Validation Performed

The changes were validated with:

- `node --check backend/server.js`
- `npm run build` in `frontend`

The frontend build succeeded.

There were existing Vite/MUI warnings about ignored `"use client"` directives in bundled dependencies, but they were warnings only and did not block the build.

---

## Current Assumption

The current implementation benchmarks the player against the **whole stored dataset**.

This matches the user request:

- compare the player to the whole dataset
- use grounded averages

Possible later extension:

- show both whole-dataset percentile and same-role percentile

That would be especially useful for fairer comparisons between roles such as `JUNGLE`, `BOTTOM`, and `UTILITY`.

---

## Result

The player-details page now communicates impact more clearly:

- KDA is shown as an average, not a mysterious raw number
- percent rings are grounded in the dataset
- overlapping artifacts are grouped into clearer impact dimensions
- the page explains what each metric means for the player

This makes the page much closer to an actual performance interpretation view instead of a raw metric display.
