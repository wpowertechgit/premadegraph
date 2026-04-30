# Experiment Runners For Signed-Balance Sensitivity And Assortativity Significance

## Purpose

This document describes the Rust-first experiment layer for two thesis-facing questions:

1. how robust signed-balance results are under projection changes
2. whether observed assortativity exceeds simple randomized baselines

The goal is reproducible, machine-readable analysis output rather than UI-first presentation.

## Signed-Balance Sensitivity Sweep

The signed-balance sweep runs the existing structural-balance analysis across a parameter grid.

Current sweep dimensions:

- `minEdgeSupports`
- `tiePolicies`
- `includeClusterSummaries`

Each run records:

- the exact parameter combination
- graph projection summary
- triad totals
- balanced and unbalanced counts
- balanced ratio
- triad-type distribution
- warnings

Recommended interpretation:

- if the balanced ratio stays similar across thresholds and tie handling, the result is more robust
- if the ratio moves sharply with small projection changes, the result is more sensitive to projection assumptions

Avoid stronger claims than the experiment supports. This is a robustness check on the projected signed graph, not proof of any latent social mechanism.

## Assortativity Significance Runner

The assortativity significance runner keeps graph topology fixed and permutes the chosen node metric across eligible nodes.

Current null model:

- fixed topology
- fixed eligibility filtering
- shuffled `opscore` or `feedscore` values across eligible nodes only

This means the test asks:

- is the observed assortativity larger or smaller than what we would expect if the same graph had the same set of eligible metric values, but those values were randomly reassigned?

Each run records:

- graph mode
- metric
- observed coefficient
- permutation count
- null-distribution summary
- empirical percentile
- empirical upper-tail and two-sided p-style summaries
- z-score when null variance is non-zero

Recommended interpretation:

- preferred phrasing: the observed assortativity exceeds or does not exceed the randomized baseline under the chosen null model
- avoid causal phrasing about why players connect

## Determinism And Output Design

Both runners are designed to stay thesis-defensible:

- Rust owns the core experiment logic
- JSON output is explicit and versioned
- a seed is part of permutation-based significance requests
- run ordering is deterministic
- outputs are observational and read-only

Top-level metadata includes:

- `analysisType`
- `schemaVersion`
- `generatedAtUnixMs`
- dataset and graph scope
- seed when applicable
- dataset summary
- run count

## CLI Usage

Run from `backend/pathfinder-rust/`.

Signed-balance sweep:

```bash
echo '{"minEdgeSupports":[1,2,3,4],"tiePolicies":["exclude","ally","enemy"],"includeClusterSummaries":false}' | cargo run -- balance-sweep
```

Assortativity significance:

```bash
echo '{"graphModes":["social-path","battle-path"],"metrics":["opscore","feedscore"],"permutationCount":100,"seed":42}' | cargo run -- assortativity-significance
```

## Backend Endpoints

- `POST /api/pathfinder-rust/balance-sweep`
- `POST /api/pathfinder-rust/assortativity-significance`

These endpoints are thin wrappers over the Rust runner and return the same JSON result shape.

## Limitations

- the significance test uses a simple metric-permutation null model, not a full graph rewiring baseline
- significance is only as meaningful as the chosen eligibility and support thresholds
- undefined coefficients can still occur when eligible values have no measurable variance
- p-style summaries should be treated as descriptive randomization results under this null model, not universal causal evidence
