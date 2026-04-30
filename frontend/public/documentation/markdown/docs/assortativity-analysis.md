# Assortativity Analysis Of Player Performance Metrics

## Document Role

This document is the implementation and experiment note for the assortativity feature.

## Related Documents

- [Signed Balance Theory And Implementation](signed-balance-theory.md)
- [Mock Datasets And Chaos Design](mock-datasets-and-chaos-design.md)
- [New GUI Overview](new-gui-overview.md)

## Purpose

The assortativity feature measures whether connected players tend to have similar or dissimilar performance values on the graph.

The current implementation evaluates:

- `opscore`
- `feedscore`
- `social-path`
- `battle-path`

The result is meant to be a mathematically grounded graph statistic, not a speculative social claim generator.

## In Plain Language

This document explains a simple question: do players who are connected in the graph tend to have similar performance scores?

Here, "assortativity" is just the graph-analysis term for that similarity pattern. A positive result means connected players tend to look more alike on the chosen metric, while a negative result means connected players tend to look more different.

## Relevant Implementation Surfaces

- `backend/pathfinder-rust/src/engine/assortativity.rs`
- `backend/pathfinder-rust/src/engine/graph.rs`
- `backend/server.js`
- `frontend/src/AssortativityPage.tsx`
- `frontend/src/assortativityTypes.ts`
- `frontend/src/assortativityMock.ts`
- `frontend/scripts/assortativity_mock_probe.mts`

## What The Backend Computes

The Rust backend computes numeric assortativity as:

- Pearson correlation across both endpoint orientations of each eligible undirected edge

That detail matters because the graph is undirected, and duplicating endpoint orientation avoids arbitrary ordering bias.

Each run reports:

- coefficient
- sample size
- candidate edges
- analyzed edges
- skipped edges due to low support
- skipped edges due to missing metric values
- skipped edges due to low player match counts
- global result
- within-cluster result
- cross-cluster result
- strong-tie result
- weak-tie result

## Eligibility And Projection Rules

The current feature uses these explicit rules:

- `social-path` uses ally-supported edges only
- `battle-path` uses all co-play edges from the runtime signed graph
- both endpoints must have the selected metric value present
- both endpoints must satisfy the minimum player match-count threshold
- edge support thresholding is configurable
- strong versus weak tie split is configurable

These are part of the experiment, not just implementation details.

## Mock Mode

The assortativity page also supports its own mock mode.

This mock mode is intentionally separate from the full Rust-backed dataset and uses:

- the Pathfinder Lab mock graph
- deterministic synthetic `opscore` values
- deterministic synthetic `feedscore` values
- the same assortativity reporting shape as the real feature

This makes the page demo-friendly and reproducible on fresh clones, but mock-mode output should not be treated as thesis evidence about real players.

## Validation Commands

The following validation steps were run on March 20, 2026:

1. `cargo test` in `backend/pathfinder-rust`
2. `npm run build` in `frontend`
3. `Write-Output '{}' | cargo run -- assortativity` in `backend/pathfinder-rust`
4. a local Node-based mock probe using the same mock-analysis logic exposed by `frontend/src/assortativityMock.ts`

## Measured Full-Dataset Results

Default request:

- `minEdgeSupport = 1`
- `minPlayerMatchCount = 1`
- `strongTieThreshold = 3`

Measured full-dataset results:

| Graph Mode | Metric | Global Coefficient | Sample Size |
| --- | --- | ---: | ---: |
| social-path | opscore | 0.587 | 61,297 |
| social-path | feedscore | 0.350 | 61,297 |
| battle-path | opscore | 0.545 | 146,780 |
| battle-path | feedscore | 0.016 | 146,780 |

Secondary breakdown highlights:

| Graph Mode | Metric | Within Cluster | Cross Cluster | Strong Ties | Weak Ties |
| --- | --- | ---: | ---: | ---: | ---: |
| social-path | opscore | 0.520 | 0.590 | 0.501 | 0.588 |
| social-path | feedscore | 0.240 | 0.352 | 0.243 | 0.351 |
| battle-path | opscore | 0.491 | 0.546 | 0.501 | 0.545 |
| battle-path | feedscore | 0.151 | 0.014 | 0.222 | 0.015 |

## Measured Mock-Mode Results

Default request:

- `minEdgeSupport = 1`
- `minPlayerMatchCount = 1`
- `strongTieThreshold = 3`

Measured mock-mode results:

| Graph Mode | Metric | Global Coefficient | Sample Size |
| --- | --- | ---: | ---: |
| social-path | opscore | 0.732 | 377 |
| social-path | feedscore | 0.356 | 377 |
| battle-path | opscore | 0.515 | 803 |
| battle-path | feedscore | 0.266 | 803 |

Secondary breakdown highlights:

| Graph Mode | Metric | Within Cluster | Cross Cluster | Strong Ties | Weak Ties |
| --- | --- | ---: | ---: | ---: | ---: |
| social-path | opscore | 0.939 | 0.201 | 0.936 | 0.725 |
| social-path | feedscore | 0.439 | 0.157 | 0.241 | 0.359 |
| battle-path | opscore | 0.940 | 0.284 | 0.443 | 0.516 |
| battle-path | feedscore | 0.441 | 0.171 | 0.018 | 0.272 |

## Conclusions

### 1. `opscore` is clearly assortative on the real graph

Both graph modes show strong positive `opscore` assortativity:

- `0.587` on `social-path`
- `0.545` on `battle-path`

This supports the claim that connected players tend to have more similar `opscore` values than random pairing would suggest under the chosen graph projections.

### 2. `feedscore` behaves differently depending on graph mode

`feedscore` is moderately assortative on `social-path` (`0.350`), but becomes almost neutral on `battle-path` (`0.016`).

The most defensible reading is:

- ally-only relationships preserve some similarity in `feedscore`
- once enemy-linked battle connectivity is included, that similarity is largely washed out

This is a useful thesis result because it shows that the answer depends strongly on graph semantics, not only on the metric itself.

### 3. The graph-mode comparison is substantively meaningful

The drop from:

- `0.587` to `0.545` for `opscore`
- `0.350` to `0.016` for `feedscore`

shows that `battle-path` is not just a larger graph. It changes the kind of relationship being measured.

That makes the ally-only versus battle-path comparison worth keeping in the final thesis framing.

### 4. Mock mode is useful for explanation, not for real-world inference

Mock mode produces strongly positive coefficients, especially for within-cluster `opscore`, because the synthetic metrics were intentionally designed to create interpretable demo structure.

That is desirable for:

- UI demos
- explanation
- reproducibility on fresh clones

But it should be described as:

- a deterministic demonstration environment

not as evidence about the real dataset.

## Careful Interpretation

The feature supports cautious phrasing such as:

- connected players appear positively assortative under `opscore`
- ally-only relationships preserve more `feedscore` similarity than the broader battle-path graph
- the graph projection materially changes the observed correlation structure

The feature does not justify claims such as:

- players cause each other to perform similarly
- toxic players attract toxic players
- graph connection alone explains behavior

## Recommended Thesis Framing

The cleanest thesis framing is:

- a lightweight but strong graph-statistics extension
- evidence that similarity structure depends on both the chosen metric and the chosen graph mode
- a mathematically grounded complement to signed-balance and centrality analysis

## Bottom Line

The current implementation already produces a useful thesis-level result:

- `opscore` is meaningfully assortative on the real graph
- `feedscore` is much more sensitive to graph definition
- mock mode is suitable for demos and explanation
- the feature is reproducible, testable, and interpretable
