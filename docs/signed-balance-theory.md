# Signed Balance Theory And Implementation

## Document Role

This document is the signed-network theory and implementation note for the project.

## Related Documents

- [New GUI Overview](new-gui-overview.md)
- [Bird's-Eye 3D Sphere](birdseye-3d-sphere.md)
- [Mock Datasets And Chaos Design](mock-datasets-and-chaos-design.md)
- [Unified Cluster Persistence And Exact A*](unified-cluster-persistence-and-astar.md)

## Purpose

The signed-balance feature turns the player graph into a signed-network experiment inspired by Structural Balance Theory.

Relevant implementation surfaces include:

- `backend/pathfinder-rust/src/engine/signed_balance.rs`
- `frontend/src/SignedBalancePage.tsx`
- `frontend/src/signedBalanceTypes.ts`
- `frontend/src/signedBalanceMock.ts`

## Core Research Question

The feature asks whether the observed player relationship graph exhibits balanced signed triads more often than unbalanced ones.

In practical terms:

- do repeated ally/enemy relationships form socially consistent local patterns?
- or does the graph contain substantial local contradiction and instability?

## Minimal Theory

A signed triad is a triple of nodes where each pair has a sign.

Typical interpretations used here:

- `+++`: friend of my friend is my friend
- `+--`: enemy of my enemy is my friend
- `++-`: friend of my friend is my enemy
- `---`: enemy of my enemy is still my enemy

In this project, the first two are treated as balanced, while `++-` and `---` are treated as unbalanced according to the chosen interpretation rules in the implementation.

## Why This Fits The Dataset

This repository is unusually well-suited for signed-balance work because the graph already contains both:

- ally evidence
- enemy evidence

That makes the project more academically interesting than a plain unsigned co-play graph, since many game-network visualizations never reach the point of an explicit signed projection.

## Projection Choices

The analysis does not use raw match rows directly. It first projects repeated pair history into a signed graph.

Important design choices include:

- edge sign is derived from dominant relation
- support thresholding can remove weak edges
- ties can be excluded or forced toward ally/enemy
- valid triads require all three edges to exist after projection

These decisions are not implementation noise. They directly affect the experiment and therefore must be explicit.

## What The Rust Backend Produces

The Rust signed-balance analysis returns more than a single ratio. It provides:

- total triads analyzed
- balanced and unbalanced counts
- balanced ratio
- triad-type distribution
- graph-summary counts for the projection pipeline
- top nodes participating in unbalanced triads
- optional cluster summaries
- warnings when the chosen projection removes too much structure

This is important because a thesis result should be inspectable, not just decorative.

## Frontend Presentation

The signed-balance page is designed as an explanatory analytics surface rather than a thin endpoint wrapper.

It includes:

- dataset-mode switching
- explicit parameter controls
- help text and effect text for each control
- balanced-versus-unbalanced charts
- triad distribution bars
- graph pipeline summary
- instability ranking
- optional cluster summary tables
- interpretation notes

The page tries to answer not only "what is the ratio?" but also "why did the ratio come out this way?"

## Development Process Reasoning

The signed-balance feature was shaped by several constraints from the research side of the project.

### 1. The analysis needed to stay interpretable

The project avoids vague black-box behavior here. Thresholds, tie policy, and projection rules are exposed because they materially affect the meaning of the result.

### 2. Theory had to survive implementation details

It is easy to say "signed triads" in a report, but much harder to define what counts as a sign in real repeated-match data. The implementation therefore treats projection rules as first-class decisions, not hidden assumptions.

### 3. The frontend had to teach the result

A raw JSON response would not have been enough. The page was designed to show:

- outcome
- pipeline
- sensitivity
- local concentration of imbalance

That makes the feature more defensible in a thesis and more useful in a live demo.

### 4. Validation mattered more than novelty theater

The signed-balance work is valuable because it is grounded, not because it is flashy. The implementation direction favors deterministic, thresholded, testable analysis over speculative storytelling.

## Tradeoffs

The current feature still makes some simplifying assumptions:

- sign is collapsed from repeated history into one dominant relation
- low-support edges may be excluded entirely
- tie resolution can materially change the graph
- cluster summaries are optional and not the main claim

These are acceptable tradeoffs as long as they are documented and visible to the user.

## How To Read Results Carefully

A high balanced ratio does not automatically prove deep social harmony. A low balanced ratio does not automatically prove toxicity or chaos.

More careful phrasing is:

- the projected signed graph shows more or fewer structurally balanced triads under the chosen projection rules
- some nodes or communities participate disproportionately in unbalanced local structures
- the result should be interpreted together with threshold choice and tie policy

## Recommended Future Direction

The next sensible extension is not to make the analysis more mysterious. It is to make it more robust:

- compare multiple projection settings
- document threshold sensitivity more explicitly
- test cluster-level summaries more carefully
- connect imbalance results to other validated graph metrics rather than to speculative social labels

## Conclusions

The main conclusion is that projection choices and interpretation rules are part of the experiment itself, so documenting them explicitly is essential.
