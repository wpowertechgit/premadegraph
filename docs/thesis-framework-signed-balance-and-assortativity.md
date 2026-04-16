# Thesis Framework: Signed Balance And Assortativity As Complementary Network Analysis

## Motivation

The signed-balance and assortativity features address two independent but complementary structural questions about the player network:

1. **Signed Balance Theory** answers: *Are ally/enemy relationships locally coherent?*
2. **Assortativity Analysis** answers: *Do performance-similar players cluster in the network?*

Together, they provide evidence that the network exhibits both **structural stability** (via balance theory) and **similarity-based organization** (via assortativity).

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

### Structural Validity

A strong thesis result needs multiple angles to be credible:

- Signed balance alone could show a coherent relationship graph, but not explain *why* it's coherent (performance similarity, role specialization, random chance?)
- Assortativity alone could show performance clustering, but not explain whether the *relationship types* (ally vs. enemy) matter

Together: If both analyses return strong results, the network exhibits both **intentional structure** (performance-based grouping) and **stable relationship patterns** (ally/enemy coherence).

### Methodological Robustness

The two features use different algorithms and different data projections:

- Signed balance: Triangle enumeration on signed edges, sensitivity to tie-breaking
- Assortativity: Pearson correlation on endpoint metrics, sensitivity to graph mode

If both independently return defensible results, you're less vulnerable to a single methodological critique.

### Graph Semantics

The two features answer the graph-semantics question differently:

- Does the ally vs. enemy distinction matter? **Yes, if** signed balance shows structural coherence
- Does the performance metric matter? **Yes, if** assortativity shows non-random clustering

This supports thesis framing around "networks encode both relationship semantics and similarity structure."

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

### 1. Motivation

Present both research questions:
- Do players organize by performance similarity?
- Do ally/enemy relationships form stable local patterns?

### 2. Data & Methods

- Describe the player graph, the two-column signed projection, and the clustering structure
- Explain signed-balance and assortativity methodology separately (reference existing docs)

### 3. Results

- Present signed-balance findings (ratio, distribution, top unbalanced nodes)
- Present assortativity findings (both graph modes, both metrics)
- Highlight the cross-feature patterns (ally = performance-clustered + locally coherent)

### 4. Interpretation

- Do not claim causation (similarity does not imply influence)
- Do claim observable structure (the network exhibits both properties)
- Discuss what the properties mean jointly:
  - Strong ally assortativity + balance suggests intentional clustering
  - Weak battle-path assortativity suggests enemy relationships are less performance-driven
  - This supports selecting ally-only definitions for performance-based analysis

### 5. Limitations

- Both analyses assume projection choices; vary parameters to show robustness
- Both are correlation, not causation
- Mock-mode results are demonstration only; thesis should use full-dataset results

## Avoiding Over-Interpretation

Do not claim:
- Players *cause* each other to cluster by performance
- Balance or assortativity *explains* player behavior
- The results prove toxicity, strategy, or social dynamics

Do claim:
- The network exhibits performance-based clustering under the chosen metrics and graph projections
- Ally relationships preserve more performance similarity than the broader battle graph
- Ally/enemy patterns form locally more balanced triads than random expectations would suggest
- These structural properties are measurable, reproducible, and sensitive to projection choices

## See Also

- [Signed Balance Theory And Implementation](signed-balance-theory.md)
- [Assortativity Analysis Of Player Performance Metrics](assortativity-analysis.md)
