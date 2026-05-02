# AGENTS.md

## Purpose

This file defines the calibrated future-work scope for the next research-oriented upgrades of this repository.

It is intentionally planning-only.

Do not start implementation directly from enthusiasm alone. Follow the sequencing, scope limits, and validation rules below.

The project should now focus on a smaller, more defensible thesis scope:

1. Dataset expansion for stronger experimental evidence
2. Flexset as an associative core-periphery player graph
3. Flex vs SoloQ dataset comparison
4. Assortativity analysis of player performance metrics on the graph
5. Parallel Betweenness Centrality using the Brandes algorithm in Rust + Rayon
6. Genetic NeuroSim v2

Contraction Hierarchies are explicitly out of scope.

Temporal Consistency / Player Stability Analysis and Community Cohesion vs Performance are permanently removed from the roadmap.

Signed Balance / Structural Balance Theory is also retired from the thesis-facing product narrative. Keep existing backend/Rust code if useful, but do not present Signed Balance as a main empirical result or visible frontend workflow. Its authoritative scope note is `docs/signed-balance-methodological-retirement.md`.

---

## Retired Features

The following ideas must not be implemented unless the project owner explicitly reopens the scope later.

### Temporal Consistency / Player Stability Analysis

Status: removed.

Reason:

- The available match histories are not methodologically strong enough for temporal claims.
- If a player only has around 10 matches from half a year ago, the time dimension is not meaningful.
- Longitudinal stability or volatility claims would be difficult to defend in the thesis.

Do not add:

- rolling trends
- streak analysis
- time-based volatility rankings
- player stability tables
- temporal consistency UI

### Community Cohesion Vs Performance

Status: removed.

Reason:

- This feature would try to answer too much while producing weaker conclusions.
- Assortativity and centrality answer the useful parts of this family of questions in a cleaner, more mathematically defensible way.
- The project should avoid broad cluster-performance claims when sharper graph-statistics experiments are available.

Do not add:

- cohesion-vs-performance reports
- cluster density vs `opscore` comparisons
- cohesion ranking dashboards
- causal claims about community strength and player performance

---

## Current Strategy

The project already has enough implementation breadth. The next phase should maximize:

- thesis value
- interpretable results
- reproducible experiments
- clear demo value
- technically defensible Rust-side graph analytics
- stronger evidence through larger and better-separated datasets

The active work order should be:

1. Expand datasets so the experiments have enough evidence.
2. Interpret `flexset` as an associative core-periphery graph.
3. Compare Flex Queue and SoloQ datasets without overstating social meaning.
4. Run Assortativity analysis on `opscore` and `feedscore`.
5. Implement and benchmark Parallel Brandes Centrality in Rust with Rayon.
6. Build Genetic NeuroSim v2 after the graph-derived profiles are stable enough to seed the simulation.

Do not reverse this order unless there is a strong blocking reason.

Reason:

- Dataset expansion is the proof layer. Without enough Flex Queue match data, Assortativity, core-periphery interpretation, and centrality are underpowered.
- Signed Balance is no longer the strongest graph-theory contribution; it is a methodological boundary case because `enemy` edges are not reliable negative social ties.
- Assortativity is a low-effort, high-value graph-statistics extension that cleanly tests whether similar performance profiles are connected.
- Parallel Brandes is the strongest systems/analytics extension because the graph size makes centrality expensive and technically interesting.
- Genetic NeuroSim v2 is the high-concept simulation layer, but it should be seeded from validated cluster/player profiles rather than invented parameters.

---

## Active Dataset Plan

### flexset: Apex Flex Queue Dataset

Goal:

- Collect roughly 3000-5000 Flex Queue matches.
- Use this as the main evidence dataset for associative graph interpretation, dataset comparison, Assortativity, and centrality.

Why:

- Flex Queue naturally supports repeated teammate and opponent relationships.
- It is the correct dataset for testing recurring ally groups, core-periphery structure, and relationship-level graph statistics.

Expected role:

- primary associative graph dataset
- primary graph-analysis dataset
- evidence base for Flex/SoloQ comparison and core-periphery interpretation
- evidence base for performance-metric Assortativity

Validation requirements:

- document collection filters
- document match count
- document player count
- document edge count
- document ally/enemy edge construction rules
- keep collection reproducible enough for thesis discussion

### soloq_dataset: Master SoloQ Control Dataset

Goal:

- Build a Master SoloQ control dataset.
- Use it as a comparison group where there is no stable premade team network structure, only cleaner individual performance.

Why:

- SoloQ is useful as a control group for individual performance distributions.
- It should not be treated as equivalent to the Flex Queue relationship graph.
- It can help seed or calibrate Genetic NeuroSim v2 with high-skill individual profiles.

Expected role:

- control dataset
- individual performance reference
- possible source for apex-tier high-performing player seeds
- not the primary signed-network dataset

Validation requirements:

- keep SoloQ conclusions separate from Flex Queue graph conclusions
- avoid claiming social structure where the dataset does not support it
- document rank/tier filters
- document match count and player count

---

## Retired Feature: Signed Graph / Structural Balance Theory

Status: downgraded from thesis pillar to methodological boundary case.

Reason:

- The formal signed graph projection works.
- `allyWeight` as positive tie is partly defensible in Flex Queue.
- `enemyWeight` as negative social tie is not defensible enough because it can reflect MMR, queue timing, small player pool, matchmaking, or data-collection effects.

Do not expose this as a main frontend workflow or thesis-facing empirical result. Keep existing backend/Rust code only as an experimental diagnostic unless the project owner explicitly reopens the scope.

Historical notes below are retained only to explain the earlier implementation design.

### Goal

Treat the Flex Queue player graph as a formally signed graph and analyze whether local triads are balanced or unbalanced according to Structural Balance Theory.

This remains an experimental/analytical module, not a thesis pillar.

### Core Research Question

Does the observed League of Legends player relationship graph exhibit structurally balanced signed triads more often than unbalanced ones?

### Minimal Theory To Respect

A signed triad is considered balanced when:

- friend of my friend is my friend: `(+,+,+)`
- enemy of my enemy is my friend: `(-,-,+)`

Unbalanced examples include:

- friend of my friend is my enemy: `(+,+,-)`

Before implementation, future work must explicitly define:

- whether edge sign is derived from dominant relation only
- whether multi-edge history is collapsed into one signed edge
- how ties with equal ally/enemy evidence are resolved
- whether low-confidence edges should be excluded from balance analysis

### Required Design Decisions Before Coding

Future implementation must answer these first:

1. What is the canonical sign of an edge?
   - likely `ally = +1`, `enemy = -1`

2. What graph is analyzed?
   - Flex Queue graph
   - filtered graph only
   - weighted graph collapsed into signed simple graph

3. What is a valid triad?
   - only fully connected triples
   - only triples above a minimum edge-strength threshold

4. How is confidence handled?
   - raw sign only
   - sign plus confidence score from match history counts

### Expected Outputs

The final feature should produce at least:

- total number of signed triads analyzed
- balanced triad count
- unbalanced triad count
- balanced ratio
- triad type distribution
- top nodes participating in the most unbalanced triads

Optional outputs:

- balance ratio by cluster
- balance ratio around high-betweenness bridge nodes
- comparison of signed balance in dense vs sparse subgraphs
- player-level instability score based on participation in unbalanced triads

### Data Model Expectations

This feature should not invent a second incompatible graph representation.

Prefer:

- reuse the Rust graph state if possible
- add a signed adjacency projection on top of existing pair relations
- keep the edge-sign derivation explicit and testable

### Implementation Principles

- do not start from UI
- build a backend- or Rust-level analysis result first
- make the analysis deterministic
- make thresholds configurable
- keep the first version read-only and observational

### Validation Requirements

Before calling the feature "done", future work must verify:

- sign derivation is correct on small hand-checked examples
- triad classification matches expected cases
- results remain stable under rerun
- thresholding behavior is documented
- real-dataset output includes match count, player count, edge count, and triad count

### Thesis/Demo Framing

This feature should be presented as:

- a signed-network experiment
- an analysis of whether player interaction patterns exhibit social consistency or instability
- a genuinely research-like extension, not just another graph stat

---

## Feature 2: Assortativity Of Player Performance Metrics

### Goal

Measure whether connected players tend to have similar or dissimilar performance characteristics across the graph.

This should be treated as a mathematically grounded graph-analysis feature, not as a speculative social claim generator.

### Core Practical Question

Do players with similar `opscore` or `feedscore` values tend to be connected to each other more often than expected?

### Why This Matters

Assortativity is one of the cleanest next-step analyses for this dataset because:

- the graph already exists
- node-level performance metrics already exist
- the result is easy to explain
- implementation effort is low relative to thesis value
- it answers the useful part of the removed cohesion-vs-performance idea more cleanly

This can help answer questions like:

- do high-performing players connect to similar high-performing players?
- do low-performing players connect to similar low-performing players?
- are ally-only relationships more assortative than mixed battle-path relationships?

### Required Design Decisions Before Coding

Future implementation must decide:

1. Which graph is analyzed?
   - ally-only
   - battle-path
   - possibly both for comparison

2. Which node attribute is tested?
   - `opscore`
   - `feedscore`
   - maybe both independently

3. Which assortativity definition is used?
   - numeric assortativity / Pearson correlation across edges

4. Which nodes are eligible?
   - all nodes with valid metric values
   - only nodes above a minimum match-count threshold if needed

### Expected Outputs

Minimum required outputs:

- numeric assortativity coefficient for `opscore`
- numeric assortativity coefficient for `feedscore`
- graph mode used
- sample size used
- node count and edge count used

Useful secondary outputs:

- compare assortativity for ally-only vs battle-path graphs
- compare strong ties vs weak ties
- compare Flex Queue graph behavior against SoloQ individual performance distributions where appropriate

### Interpretation Rules

Future work must be careful with interpretation.

Do not jump directly to claims like:

- "toxic players attract toxic players"

Preferred phrasing:

- players with similar measured performance profiles appear more assortatively connected
- the graph shows positive or negative correlation across connected players under the chosen metric

Interpret social causality cautiously.

### Validation Requirements

Before calling the feature "done", future work must verify:

- the metric extraction is correct
- missing values are handled explicitly
- the assortativity formula is documented
- the same result is reproducible under rerun
- dataset source and graph mode are written into the output

### Thesis/Demo Framing

This feature should be presented as:

- a lightweight but strong graph-statistics extension
- evidence about whether similar-performance players tend to connect
- a mathematically grounded complement to core-periphery interpretation and Centrality analysis

---

## Feature 3: Parallel Brandes Betweenness Centrality

### Goal

Compute betweenness centrality efficiently on the real graph using a Rust implementation of the Brandes algorithm, parallelized across CPU cores with Rayon.

### Core Practical Question

Which nodes act as the strongest bridges or brokers in the player network?

### Why This Matters

The target graph may contain roughly 26,000 players and more than 100,000 edges. Betweenness centrality is computationally expensive at this scale, so this feature has both thesis and systems value.

Betweenness centrality can reveal:

- bridge players between clusters
- broker players connecting otherwise separated regions
- major routing intermediaries in pathfinding
- important connectors beyond simple degree

### Scope

The first version should focus on:

- node betweenness centrality
- Rust implementation
- `rayon` parallelism over source nodes
- weighted shortest paths using `1 / strength` as the edge cost
- reproducible whole-graph computation

Do not start with:

- edge betweenness
- dynamic updates
- approximate methods
- distributed computation

unless the exact weighted node centrality version is already working and benchmarked.

### Required Design Decisions Before Coding

Future implementation must decide:

1. Which graph variant is used?
   - likely battle-path / relationship graph first
   - ally-only may be a separate run

2. How are weights represented?
   - edge strength from relationship evidence
   - shortest-path cost should use `1 / strength`
   - zero or invalid strengths must be rejected or filtered

3. How will normalization be handled?
   - raw scores
   - normalized scores
   - both are preferred if practical

4. How will parallelism be applied?
   - parallelize over source nodes using `rayon`
   - preserve deterministic final output ordering

### Technical Expectations

The implementation should:

- live in Rust
- reuse the runtime graph representation or a compatible projection
- use `rayon`
- produce structured output that can be consumed later by backend/frontend code
- record graph size and runtime metrics

### Expected Outputs

Minimum required outputs:

- top N players by betweenness
- raw centrality scores
- optional normalized scores
- runtime metrics
- graph mode used for computation
- node count and edge count
- weight rule used, especially `1 / strength`

Useful secondary outputs:

- compare top betweenness vs top degree
- compare top betweenness vs pathfinder frequently visited nodes
- compare top betweenness vs cluster bridge behavior

### Validation Requirements

Before calling the feature "done", future work must verify:

- the result is correct on small toy graphs with known bridge structure
- weighted shortest-path behavior is correct on hand-checked examples
- parallel and serial versions match
- reruns are deterministic
- runtime improvement is measured, not assumed

### Performance Expectations

The point is not optimization theater.

Future work must report:

- graph size
- runtime on actual dataset
- serial baseline if available
- parallel speedup if measured
- CPU/thread configuration when benchmarking

### Thesis/Demo Framing

This feature should be presented as:

- a graph-analytics upgrade
- a high-performance Rust implementation of a meaningful centrality measure
- a way to identify important broker and bridge players in the network

---

## Feature 4: Genetic NeuroSim v2

### Goal

Use graph-derived League of Legends player profiles as inputs to an evolutionary simulation.

The simulation should connect the graph-analysis side of the thesis to a visually and technically impressive agent-based system.

### Core Practical Question

Can player or cluster performance profiles extracted from LoL data be transferred into an evolutionary simulation as meaningful starting traits?

### Why This Matters

Genetic NeuroSim v2 can raise the project to a stronger scientific and demo level if it is grounded in real extracted profiles rather than arbitrary parameters.

Possible seeds include:

- cluster profiles extracted from Flex Queue graph communities
- apex-tier high-performing individual players from SoloQ
- predator-like high-performing individual agents based on `opscore` and variance parameters

### Technical Direction

The intended direction is:

- NEAT-based mutation/evolution
- binary WebSocket protocol
- simultaneous rendering of roughly 50,000 agents
- performance-aware simulation architecture
- reproducible parameter export from graph/player profiles

### Required Design Decisions Before Coding

Future implementation must decide:

1. What is transferred from LoL data into the simulation?
   - cluster-level profile
   - player-level profile
   - apex-tier individual seed
   - a combination of these

2. Which metrics become simulation parameters?
   - `opscore`
   - variance or spread parameters
   - role/profile tendencies if available
   - graph-derived bridge or centrality indicators if justified

3. What is the simulation target?
   - survival
   - territory control
   - resource capture
   - predator/prey dynamics
   - another explicitly defined behavior

4. How is scientific defensibility preserved?
   - document parameter mapping
   - avoid pretending the simulation directly proves LoL behavior
   - treat the simulation as an exploratory transfer experiment

### Expected Outputs

Minimum required outputs:

- documented mapping from LoL-derived profiles to simulation parameters
- NEAT mutation/evolution design
- binary WebSocket message schema
- render target and performance measurements
- deterministic or seeded experiment mode

Useful secondary outputs:

- comparison between cluster-seeded and individual-seeded agents
- apex-tier seed behavior compared against baseline random seeds
- exported experiment summaries
- replayable simulation runs

### Validation Requirements

Before calling the feature "done", future work must verify:

- the parameter mapping is documented and reproducible
- simulation output can be reproduced with a fixed seed
- WebSocket protocol is documented
- rendering performance is measured with the target agent count
- claims are framed as simulation behavior, not direct proof of real-player psychology

### Thesis/Demo Framing

This feature should be presented as:

- an evolutionary simulation seeded by real graph/player profiles
- a bridge between graph analytics and agent-based modeling
- an exploratory NeuroSim experiment, not a black-box truth engine

---

## Deferred Scope: Data-Driven Revision Of `opscore`

The data-driven `opscore` revision is not part of the immediate implementation plan.

It may be reconsidered only after:

- dataset expansion is complete
- Assortativity and centrality outputs are validated
- Brandes centrality outputs are stable
- enough feature extraction exists to justify calibration

If reopened, it must be framed as interpretable coefficient calibration, not vague "AI magic."

Do not let this distract from the current active scope.

---

## Shared Architecture Rules

Future features should follow these rules:

- Prefer Rust for core algorithmic implementation.
- Keep API responses explicit and versionable.
- Avoid fragile UI-first development.
- Do not duplicate graph logic in multiple languages unless there is a strong reason.
- Keep result formats easy to persist or export.
- Prefer parallel execution for independent analytics jobs and algorithm comparisons.
- Prefer coarse-grained parallelism before fine-grained internal parallelism.
- Use internal algorithm parallelism only when the workload justifies it.
- Preserve deterministic outputs even when work is parallelized.
- Measure speedup before claiming performance benefit.
- Keep Flex Queue graph conclusions separate from SoloQ individual-performance conclusions.

If a result needs to be shown in the frontend later, first stabilize:

- the core algorithm
- the result schema
- the validation story

Only then add visualization.

### Parallelism Guidance

Future work should distinguish between two useful forms of parallelism:

1. Independent job parallelism
   - multiple graph analytics jobs over the same read-only graph
   - multiple dataset-processing jobs
   - feature extraction from many match JSON files
   - simulation batches with different seeds

2. Internal algorithm parallelism
   - Brandes centrality over multiple source nodes
   - large simulation update/render pipelines
   - only when synchronization cost does not dominate the benefit

The system should strongly prefer the first category wherever practical.

Good candidates for parallel execution include:

- Brandes centrality over source nodes
- feature extraction from many match JSON files
- dataset collection/processing batches
- Genetic NeuroSim experiment batches

Future work should avoid overengineering parallelism into tasks that are already fast enough serially.

---

## Suggested Work Sequence

When resuming this effort, use this order:

1. Expand and document `flexset`.
2. Expand and document `soloq_dataset`.
3. Document `flexset` as an associative core-periphery player graph.
4. Compare Flex Queue and SoloQ datasets with separate interpretation boundaries.
5. Implement numeric Assortativity for `opscore` and `feedscore`.
6. Compare Assortativity across selected graph modes.
7. Plan weighted Brandes around `1 / strength` edge costs.
8. Implement a correct serial weighted Brandes baseline.
9. Parallelize Brandes with `rayon`.
10. Benchmark and compare serial vs parallel outputs.
11. Extract stable cluster/player profiles for simulation seeding.
12. Design Genetic NeuroSim v2 parameter mapping.
13. Implement NEAT mutation, binary WebSocket protocol, and large-agent rendering.
14. Expose selected validated results through backend/frontend only after validation.

---

## Non-Goals

The following are not goals for this phase:

- Contraction Hierarchies
- Temporal Consistency / Player Stability Analysis
- Community Cohesion vs Performance
- random algorithm collecting for its own sake
- UI polish before algorithmic correctness
- data-driven `opscore` revision before the current evidence pipeline is mature
- adding features that are hard to justify in the thesis
- performance claims without measurements
- social or psychological claims that the data cannot support

---

## Definition Of Done

No active feature is done until all of the following are true:

- algorithmically correct on small controlled examples
- meaningful on the real dataset
- results are interpretable
- thesis relevance is explicit
- output format is documented
- dataset source is documented
- at least one benchmark or experiment summary exists where relevant
- conclusions avoid unsupported causal claims

---

## Final Reminder

This phase should strengthen the project as a research-and-systems thesis, not just make it more complicated.

If a future implementation path feels clever but not clearly useful, stop and reassess before building.
