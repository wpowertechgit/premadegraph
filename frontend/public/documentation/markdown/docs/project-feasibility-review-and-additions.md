# Project Feasibility Review And Useful Additions

> **Superseded note (2026-04-30):** The optimistic signed-balance framing in this
> note has been superseded by
> [`signed-balance-methodological-retirement.md`](signed-balance-methodological-retirement.md).
> Signed Balance is implemented, but should be treated as a methodological
> boundary case rather than a strong thesis pillar.

## Purpose

This note reviews whether the current `premadegraph` thesis direction is feasible as a research-and-systems project and identifies additions that would strengthen the thesis without derailing scope.

It is based on:

- the existing repository documentation
- current local validation performed on April 22, 2026
- supporting network-science literature

## Short Answer

Yes, the project is feasible.

More specifically:

- the core architecture already supports thesis-grade graph analytics
- signed balance and assortativity are not speculative ideas anymore in this repo; they already exist in Rust, are documented, and produce real outputs
- parallel Brandes betweenness is a realistic next step because the codebase already has a Rust graph runtime, deterministic tests, and `rayon` in `Cargo.toml`
- temporal consistency and community cohesion are also feasible because the data pipeline already stores repeated match history and player-level metrics

The project is strongest when framed as:

- a signed social-network analysis of repeated co-play
- a reproducible Rust graph-analytics system
- a thesis that combines interpretable network science with defensible systems implementation

## What Already Makes The Project Feasible

### 1. The architecture is already in the right shape

From the repo docs, the project already has a defensible split:

- Python for collection and graph-building support
- SQLite for persistence
- Node/Express as API shell
- Rust for exact graph analytics and pathfinding
- React/Vite for presentation

That is already enough infrastructure for a serious thesis. The next work does not need a platform rewrite; it only needs disciplined analytics additions.

### 2. Two research features are already beyond the planning stage

The docs and runtime show that:

- signed balance is implemented and documented
- assortativity is implemented and documented

Local validation on April 22, 2026:

- `cargo test` passed with 23/23 tests
- `npm run build` succeeded
- `cargo run -- assortativity` returned full real-dataset results
- `cargo run -- signed-balance` returned full real-dataset results

That matters because feasibility is no longer hypothetical. The repo already demonstrates that research-style metrics can be computed on the real graph.

### 3. The next planned features fit the current data model

From `AGENTS.md`, the next roadmap items are:

1. signed graph / structural balance
2. parallel Brandes betweenness
3. assortativity
4. temporal consistency
5. community cohesion vs performance
6. data-driven `opscore` revision

This sequence is sound. It moves from:

- graph-native and already-supported structure
- to high-value centrality
- to lightweight statistical analysis
- to longitudinal and calibration work

That order is thesis-friendly because it prioritizes interpretability over novelty theater.

## Research Fit By Topic

### Signed Balance

Superseded: this is no longer treated as a strong thesis pillar. Signed triads and structural balance are established topics in signed-network research, but the current League of Legends enemy-edge semantics are not strong enough for a central social-network interpretation.

Important caution:

the current default output is extremely balanced under the present projection settings:

- `totalAnalyzed = 3734`
- `balancedCount = 3732`
- `unbalancedCount = 2`
- `balancedRatio = 0.99946`

This does not make the feature bad, but it does mean the thesis will need to show that the result is not just an artifact of:

- `minEdgeSupport = 2`
- tie exclusion
- strong projection collapse

So the feature is feasible, but it now needs robustness work more than raw implementation work.

### Assortativity

This is already one of the best-supported parts of the project.

Local runtime output on April 22, 2026 reproduced the documented pattern:

- `social-path` + `opscore`: `0.587`
- `battle-path` + `opscore`: `0.545`
- `social-path` + `feedscore`: `0.350`
- `battle-path` + `feedscore`: `0.016`

This is a strong thesis result because it is:

- interpretable
- easy to explain
- sensitive to graph semantics
- already reproducible in the repo

### Parallel Brandes Betweenness

This is feasible and technically well-matched to the repo.

Why:

- the project already has a Rust graph runtime
- `rayon` is already a dependency
- the graph is read-mostly during analytics
- the source-node decomposition used in Brandes is a standard coarse-grained parallelization strategy

This is exactly the kind of systems extension that can be justified with:

- correctness on toy graphs
- serial vs parallel equivalence
- measured runtime improvement

### Temporal Consistency

This is also feasible, assuming match timestamps and ordering are available in the collected history.

It is a good thesis direction because it:

- uses already-owned data
- avoids weak social speculation
- adds a longitudinal component
- can be stored as a derived player-level analysis table

### Community Cohesion Vs Performance

This is feasible, but it should come after centrality and temporal work, just as `AGENTS.md` says.

Its value is not that it is flashy; its value is that it can validate whether the detected communities actually align with meaningful performance patterns.

### Data-Driven `opscore` Revision

This is feasible later, but only if kept narrow and interpretable.

It is the riskiest item for thesis framing because it can easily slide into:

- vague pseudo-ML
- weak supervision
- unjustified coefficient storytelling

It should remain a calibration problem, not an "AI discovered the truth" section.

## Best Useful Additions

### 1. Highest-value addition: null-model significance testing

This is the single most useful addition to the project.

Why it matters:

- signed balance and assortativity currently return descriptive values
- a thesis will be stronger if it can also ask whether those values are unusually large relative to a reasonable baseline
- the current signed-balance result is so high that a reviewer may immediately ask whether the projection rules made balance inevitable

Recommended addition:

- add permutation or null-model testing for balance and assortativity
- compare observed results against randomized edge-sign or metric-preserving baselines
- report z-scores, percentile ranks, or empirical `p`-style summaries

For example:

- keep graph topology fixed, randomize edge signs under controlled constraints
- keep graph topology fixed, shuffle `opscore` or `feedscore` across eligible nodes
- optionally preserve degree sequence or sign counts in stronger later baselines

Why this is better than adding another flashy metric:

- it strengthens the interpretation of the metrics you already have
- it helps separate real structure from projection artifact
- it creates a better thesis defense story

### 2. Sensitivity sweep and experiment harness

Also highly recommended:

- run signed balance across a grid of `minEdgeSupport` and tie-policy settings
- run assortativity across minimum match-count thresholds
- export all runs into a structured report table

This would let the thesis say not only "here is the result" but also:

- how stable the result is
- when the result changes
- which assumptions matter most

This is especially important because the signed-balance result looks very sensitive to projection choices.

### 3. Dataset snapshot / manifest versioning

A practical addition with strong thesis value:

- create a manifest for every analysis run
- record dataset size, date, thresholds, graph mode, match count, and commit hash if available

This would improve:

- reproducibility
- comparison between runs
- future thesis figure generation

### 4. Simple benchmark harness for Rust analytics

Before parallel Brandes lands, the repo would benefit from a small analytics benchmark format:

- graph size
- node count
- edge count
- runtime
- memory notes if available
- command parameters

This addition is useful because it supports both:

- the upcoming Brandes chapter
- the broader systems story of the thesis

## Recommended Thesis-Safe Next Move

If the goal is maximum thesis value with minimum scope risk, the best immediate addition is:

1. null-model significance testing for signed balance and assortativity
2. parameter-sensitivity sweep export
3. then serial Brandes
4. then parallel Brandes with measured speedup

That sequence is stronger than jumping directly into more UI or into the `opscore` revision.

## Evidence From This Repo

The current repo already supports the claim that the project is viable:

- signed balance has explicit Rust implementation, tests, docs, and API surface
- assortativity has explicit Rust implementation, tests, docs, and API surface
- the frontend already contains dedicated analysis pages for both
- the backend/frontend build path currently succeeds locally
- the runtime already computes on the real dataset, not only on a toy mock

That means the project has crossed the hardest threshold already:

- it is not just a promising idea
- it is an operating research prototype

## Final Assessment

The project is feasible and already strong enough to become a coherent thesis if the next steps stay disciplined.

The biggest opportunity is not to add more unrelated features. It is to make the current analytics more scientifically defensible.

If only one new addition is chosen, it should be:

- null-model significance testing plus sensitivity analysis

That addition would make the existing signed-balance and assortativity work much harder for the thesis than another purely decorative or exploratory feature would.

## References

Local project references:

- [AGENTS.md](../AGENTS.md)
- [Signed Balance Theory And Implementation](signed-balance-theory.md)
- [Assortativity Analysis Of Player Performance Metrics](assortativity-analysis.md)
- [Thesis Framework: Signed Balance And Assortativity](thesis-framework-signed-balance-and-assortativity.md)
- [Unified Cluster Persistence And Exact A*](unified-cluster-persistence-and-astar.md)

External references:

- Newman, M. E. J. "Mixing patterns in networks." *Physical Review E* 67, 026126 (2003). https://doi.org/10.1103/PhysRevE.67.026126
- Brandes, U. "A Faster Algorithm for Betweenness Centrality." *Journal of Mathematical Sociology* 25(2):163-177 (2001). Listed at https://www.inf.uni-konstanz.de/exalgo/members/brandes/publications/
- Prountzos, D. "Betweenness centrality: algorithms and implementations." ACM PPoPP (2013). https://www.microsoft.com/en-us/research/publication/betweenness-centrality-algorithms-and-implementations/
- Facchetti, G., Iacono, G., and Altafini, C. "Rethinking structural balance in signed social networks." *Discrete Applied Mathematics* 268:70-90 (2019). https://doi.org/10.1016/j.dam.2019.04.019
- Lerner, J. et al. "Structural balance in signed networks: Separating the probability to interact from the tendency to fight." *Social Networks* 45:66-77 (2016). https://doi.org/10.1016/j.socnet.2015.12.002
