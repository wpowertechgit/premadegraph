# Thesis Framework: Signed Balance And Assortativity As Complementary Network Analysis

> **Superseded note (2026-04-30):** This framing has been downgraded. Read
> [`signed-balance-methodological-retirement.md`](signed-balance-methodological-retirement.md)
> first. Signed Balance remains an implemented experimental option, but it is no
> longer a central thesis result because enemy edges are not reliable negative
> social ties in League of Legends matchmaking.

## Data Context

This thesis analyzes a **premade player network** built from League of Legends match data:

- Start with a random player node
- Crawl ~50 matches for that player
- Identify co-players appearing >2-3 times (strong co-play signal)
- Expand the network by recursively crawling those players
- Result: A graph of players with intentional relationship structures (duos, premades, clans)

**Why this matters:** Allies in this network represent repeated, intentional team formation, not matchmaking artifacts. Enemies represent opponents these premades faced together in competitive matches.

## Motivation

The signed-balance and assortativity features address two independent but complementary structural questions about this premade network:

1. **Signed Balance Theory** answers: *Do repeated ally/enemy relationships form locally stable patterns?*
2. **Assortativity Analysis** answers: *Do performance-similar players choose to play together?*

Together, they provide evidence that the premade network exhibits both **intentional relationship coherence** (via balance theory) and **skill-based social organization** (via assortativity).

## The Two Questions Are Different

### Signed Balance: Local Coherence

Signed balance asks whether the graph's **relationship patterns** form locally stable triads.

- High balance ratio: ally/enemy patterns are predictable and consistent
- Low balance ratio: friend-enemy contradictions are common

What it measures: *Does the network structure feel contradictory to local observers?*

Example: If Alice allies Bob, and Bob allies Carol, is Alice also more likely to ally Carol? Or are contradictory patterns (Alice allies Bob but enemies Carol, even though Bob allies Carol) common?

### Assortativity: Performance Clustering

Assortativity asks whether **similar-performing players** are connected in the network.

- High assortativity: connected players tend to have similar performance scores
- Low assortativity: connected players tend to have dissimilar performance scores

What it measures: *Does the network structure reflect skill similarity?*

Example: Do high-performers mostly ally other high-performers? Do mid-tier players cluster with their peers? Or is performance uncorrelated with connection?

## Why Both Matter For A Thesis

### Network Intentionality

Because allies in this graph represent >2-3 co-play signals (intentional team choices), both analyses address real player behavior:

- Signed balance answers: *Do players who choose each other form stable local alliances, or do contradictory team compositions emerge?*
- Assortativity answers: *Do similar-skilled players actively choose each other, or is skill orthogonal to team formation?*

This is not measuring matchmaking artifacts—it's measuring intentional social structures in competitive gaming.

### Structural Validity

A strong thesis result needs multiple angles to be credible:

- Signed balance alone could show that premades form coherent teams, but not explain *why* (performance similarity, role fit, friendship circles?)
- Assortativity alone could show that similar players cluster, but not explain whether that clustering forms *stable relationships* or temporary pairings

Together: If both analyses return strong results, you have evidence that premade teams exhibit **performance-based selection** (assortativity) *and* **locally coherent relationship patterns** (balance). This suggests intentional, skill-aware team formation.

### Methodological Robustness

The two features use different algorithms and different data projections:

- Signed balance: Triangle enumeration on signed edges, sensitivity to tie-breaking
- Assortativity: Pearson correlation on endpoint metrics, sensitivity to graph mode

If both independently return defensible results, you're less vulnerable to a single methodological critique.

### Relationship Semantics Validation

For premade networks, the two features jointly validate that relationship definitions matter:

- Do ally relationships behave differently from enemy relationships? **Yes, if** signed balance shows structural coherence in ally triads vs. enemy triads
- Do allied players cluster by skill? **Yes, if** assortativity is high on the ally-only graph mode

This supports a thesis narrative around "premade teams form intentional structures that reflect both player skill and relationship stability."

## Interpreting The Results Together

### Example 1: Strong Balance + Strong Assortativity

If signed balance shows ~70% balanced triads and assortativity shows ~0.6 opscore correlation:

- The network is locally coherent *and* performance-clustered
- Interpretation: Players form intentional ally/enemy groups, and those groups tend to cluster by skill

This is a strong thesis result because it shows the network isn't random—it exhibits multiple layers of structure.

### Example 2: Strong Balance + Weak Assortativity

If signed balance shows ~80% balanced triads but assortativity shows ~0.1 feedscore correlation:

- The relationship patterns are coherent, but performance metrics don't drive connection
- Interpretation: Players organize around social coherence (not contradiction), but their connection isn't driven by feedscore similarity

This is valuable because it falsifies a naive hypothesis while preserving the balance finding.

### Example 3: Weak Balance + Strong Assortativity

If signed balance shows ~50% balanced triads but assortativity shows ~0.6 opscore correlation:

- Performance clustering is strong, but relationship patterns are contradictory
- Interpretation: Players cluster by skill, but ally/enemy relationships within those clusters are unstable

This is interesting because it suggests skill homophily works despite relationship instability—perhaps skill is a stronger driver than coherence.

## Measured Results (Current Full Dataset)

### Signed Balance

- Balanced ratio: ~65% (project-to-date default parameters)
- Suggests moderate local coherence in ally/enemy patterns
- Some nodes disproportionately participate in unbalanced triads

### Assortativity

| Graph Mode | Metric | Coefficient | Interpretation |
| --- | --- | ---: | --- |
| social-path | opscore | 0.587 | Strong clustering by operational score |
| social-path | feedscore | 0.350 | Moderate clustering by feed score |
| battle-path | opscore | 0.545 | Strong clustering (maintained on broader graph) |
| battle-path | feedscore | 0.016 | Negligible clustering on non-ally edges |

### Joint Reading

The measured results support:

1. **Ally relationships preserve performance similarity** (high opscore assortativity on social-path)
2. **Broader battle connectivity dilutes performance clustering** (opscore drops 0.587→0.545, feedscore drops 0.350→0.016)
3. **Ally patterns are locally more coherent than enemy patterns** (social-path shows stronger assortativity than battle-path)
4. **Operational score is a stronger clustering driver than feed score** (opscore maintained across graph modes, feedscore drops sharply)

This suggests ally relationships are both performance-sorted *and* locally coherent, which supports a thesis narrative around intentional relationship formation based on player similarity.

## Recommended Thesis Structure

### 1. Motivation & Research Questions

Frame two research questions grounded in premade team formation:

- **RQ1**: When players choose to play together repeatedly (>2-3 matches), do they cluster by performance skill?
- **RQ2**: Do repeated ally/enemy relationships in premade networks form locally stable patterns, or are they contradictory?

This positions the analysis as studying **intentional team formation**, not matchmaking artifacts.

### 2. Data & Methods

- Explain the network construction: random node crawl, >2-3 co-play thresholds, recursive expansion
- Clarify what "ally" means in this context: >2-3 matches on the same team (intentional signal)
- Explain what "enemy" means: opponents faced together in competitive matches
- Describe signed-balance and assortativity methodology separately (reference existing docs)
- Justify why both metrics matter for premade teams

### 3. Results

- Present assortativity findings: Do premades cluster by performance across graph modes?
- Present signed-balance findings: Do premade ally/enemy triads exhibit balance properties?
- Highlight joint patterns: Does balancing correlate with performance clustering?
- Show sensitivity: How do projection choices (edge thresholds, tie policies) affect results?

### 4. Interpretation

- Contextualize within premade team formation: "Players who team repeatedly tend to be similar-skilled"
- Connect to relationship stability: "Ally/enemy patterns are locally coherent, suggesting intentional team composition"
- Discuss implications: Does this suggest skill-aware team formation? Strategic team building?
- Frame as descriptive: These are observable network properties, not proof of causation or strategy sophistication

### 5. Limitations & Robustness

- Explain edge thresholds (>2-3 matches) and how they affect bias
- Vary parameters to show robustness of findings
- Acknowledge correlation vs. causation boundary
- Discuss geographic/temporal limitations of match crawling
- Note that mock-mode results are demonstration only

## Connection To Thesis Narrative

Position the overall argument:

1. **Observation**: Players form premade teams through repeated play
2. **Question**: What structure do these teams exhibit?
3. **Analysis**: Two independent angles (performance clustering + relationship balance)
4. **Finding**: Premades cluster by skill AND maintain locally coherent ally/enemy relationships
5. **Implication**: This suggests skill-aware, intentional team formation in competitive gaming

This is defensible because you're grounded in observable network properties of *intentional* social structures, not speculating about behavior.

## Avoiding Over-Interpretation

Do not claim:
- Balance or assortativity *determine* player performance or behavior
- The results prove toxicity, strategy depth, or specific social dynamics
- Causation in either direction (do skillful players choose each other, or does team play improve skill?)

Do claim:
- Premade teams show measurable performance-based clustering under the chosen metrics (assortativity)
- Repeated ally/enemy relationships in premades form locally coherent patterns (signed balance)
- Ally relationships preserve more performance similarity than the broader co-play graph
- Ally/enemy patterns exhibit balance properties consistent with intentional team formation
- These structural properties are measurable, reproducible, and sensitive to projection choices
- Premade teams appear to organize around both player skill and relationship coherence

## See Also

- [Signed Balance Theory And Implementation](signed-balance-theory.md)
- [Assortativity Analysis Of Player Performance Metrics](assortativity-analysis.md)
