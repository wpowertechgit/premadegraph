---
title: Flexset Associative Graph Interpretation
tags:
  - thesis
  - graph-v2
  - flexset
  - associative-graph
  - visualization
  - methodology
created: 2026-04-30
---

# Flexset Associative Graph Interpretation

## Core Interpretation

The `flexset` Graph V2 visualization should be interpreted as an **associative player graph**, not as a literal friendship graph and not as direct evidence of social psychology.

The strongest defensible reading is:

> Flex Queue match history can be transformed into a weighted player association graph. In this graph, repeated ally evidence creates bounded player groups, and repeated cross-group ally evidence creates bridge structure between those groups. The resulting `flexset` visualization shows a core-periphery pattern: a dense bridge-rich core surrounded by many small weakly connected or isolated premade-like islands.

This is a stronger and cleaner thesis claim than treating the same graph as a signed social-balance network.

## What The Graph Shows

The current `flexset` Graph V2 artifact contains:

- `4980` matches
- `5741` visible nodes
- `18548` visible edges
- `1531` bounded ally groups / visual clusters
- `13572` ally edges (`73.17%`)
- `4976` enemy edges (`26.83%`)
- `3.405` average edge support
- `20` as the largest visual cluster size, by design
- `815` bridge-candidate clusters
- `716` outer-orbit clusters without cross-cluster ally bridges

These numbers support the interpretation that the graph is not one uniform mass. It is split between:

1. A bridge-rich recurrent Flex core.
2. Many small outer groups that have internal ally evidence but little or no repeated ally evidence to other groups.

## What The Outer Ring Means

The outer ring is not decorative.

In the `bridge-orbit-layout-v1` layout, clusters are placed farther from the center when they have weak bridge evidence. In practice, the outer ring mostly represents clusters with:

- `crossAllySupport = 0`
- `connectedAllyClusterCount = 0`
- small member count, often duos or trios
- low internal edge counts compared with the core groups

In the current `flexset` artifact:

- `716` clusters have no cross-cluster ally bridges
- these clusters average about `3.11` members
- these clusters average about `3.93` internal ally edges
- their average orbit radius is about `9851.77`

This makes them interpretable as small local islands:

> They are visible because the dataset has enough repeated ally evidence inside the group, but they are pushed outward because they do not repeatedly ally with other groups strongly enough to become part of the bridgeable Flex core.

Good thesis wording:

> The outer ring represents weakly attached or unattached local ally groups. Their presence shows that Flex Queue contains many small recurrent association islands in addition to the central high-activity core.

## What The Dense Core Means

The dense core contains clusters with strong cross-cluster ally evidence.

Clusters near the center tend to have:

- high `crossAllySupport`
- high `connectedAllyClusterCount`
- high internal ally evidence
- often the maximum visual group size of `20`
- many cross-cluster bridge links

In the current artifact, the innermost high-bridge clusters are all `20`-member bounded groups. The strongest bridge-orbit cluster has:

- `20` members
- `592` cross ally support
- `109` connected ally clusters
- `74` internal ally edges
- `669` enemy/cross exposure
- `9.9666` orbit score
- `360.00` orbit radius

This supports the reading:

> The core is not a single premade team. It is an active recurring association region where many bounded ally groups repeatedly connect to other groups.

Possible reasons include:

- high-activity Flex players
- rotating teammate pools
- small Master+ Flex population
- recurring queue-time overlap
- players who appear across multiple group contexts
- bounded visual splitting of larger ally-connected components

This should be described as graph structure, not as friendship or intentional social organization.

## Why The Graph Looks Empty On One Side

The empty-looking left side of the visualization should not be overinterpreted.

The angular position of a cluster is not a thesis-relevant property. A cluster being on the left, right, top, or bottom of the orbit is mostly a layout artifact.

The meaningful layout signal is:

- **radius**: closer to center means stronger bridge evidence
- **outer ring**: weakly connected or unbridged ally groups
- **dense interior**: bridge-rich recurring association structure

The angle around the ring is mainly used for deterministic visual placement. If the layout were regenerated with a different angular seed or rotated in the viewer, the empty-looking side could move elsewhere.

Good thesis wording:

> In the bridge-orbit layout, radial distance is interpretable, while angular position is primarily a deterministic visualization choice. Therefore, the empty-looking left side should not be read as a missing social region; it reflects how the current layout distributes clusters around the orbit.

If more clusters were added, especially more weakly bridged clusters, the outer ring would likely become more visually filled around the circle. That would not mean a new "left-side community" was discovered; it would simply mean the layout has more peripheral groups to place.

## What The Two Screenshots Mean

### With Bridge Links Enabled

When bridge links are visible, the graph emphasizes cross-cluster ally structure.

This view shows:

- the Flex core is highly interconnected
- a small number of bridge-rich regions create many visible long edges
- cross-cluster ally links dominate visual complexity
- the graph contains a strong recurrent association core

The visual message:

> Flex Queue produces many repeated ally relationships that do not stay inside tiny groups; some groups repeatedly connect outward and form a dense bridge structure.

### With Bridge Links Disabled

When bridge links are hidden, the graph reveals the bounded ally-group layer underneath.

This view shows:

- many distinct clusters remain
- the graph is not naturally one giant uniform component
- small outer groups are numerous
- the dense core is made from many bounded groups, not one visual blob

The visual message:

> Under the bridge edges, the dataset consists of many local ally groups. The bridge layer is what turns these groups into a broader Flex association network.

Both views are useful. The first shows inter-group recurrence. The second shows local group structure.

## What This Is Good For

This graph is useful because it supports several defensible research questions:

1. Does Flex Queue produce a denser association graph than SoloQ?
2. Are there many small isolated ally groups, or does the graph mostly form one core?
3. Which clusters act as bridge candidates between otherwise separate local groups?
4. Are bridge-rich clusters different from peripheral clusters in performance spread?
5. Does performance assortativity behave differently inside the core versus on the periphery?
6. Does hiding cross-cluster bridges reveal a meaningful local group layer?

These are better questions than:

> Is the signed graph socially balanced?

The associative graph does not need enemy edges to mean hostility. It only needs repeated co-occurrence and clearly defined edge semantics.

## Strong Thesis Claim

The strongest defensible thesis claim from the `flexset` visualization is:

> The `flexset` dataset forms a core-periphery player association graph. The central core consists of bounded ally groups with high cross-cluster ally support, while the outer ring consists mostly of small local groups with no repeated ally bridges to other clusters. This shows that Flex Queue match history contains both local premade-like islands and a broader recurring association core.

This claim is:

- visible in the graph
- supported by the artifact metadata
- understandable to non-specialists
- not dependent on weak enemy-edge semantics
- directly connected to queue mechanics
- useful for later centrality and assortativity analysis

## What Not To Claim

Do not claim:

- the graph shows friendship
- the graph shows social harmony
- the graph shows toxicity or rivalry
- outer clusters are worse players
- central clusters are better players
- left/right/top/bottom position has independent meaning
- every 20-player cluster is a real 20-person premade
- bridge-rich clusters are important until validated with centrality

Especially important:

> The largest cluster size is capped at `20` by the visualization/clustering algorithm. A 20-player group is not necessarily a natural 20-player team. It may be a bounded slice of a larger ally-connected region.

## Relationship To Assortativity

This interpretation pairs naturally with assortativity.

Once the graph is understood as an association graph, assortativity asks:

> Do connected players have similar performance profiles?

Useful follow-up comparisons:

- core clusters vs peripheral clusters
- internal ally edges vs bridge ally edges
- `social-path` vs `battle-path`
- `opscore` vs `feedscore`
- `flexset` vs `soloq`

This makes assortativity more meaningful because the graph structure has an interpretable local/core/peripheral layer.

Possible thesis wording:

> The core-periphery structure of the `flexset` graph gives context to the assortativity results. A positive `opscore` correlation on teammate-based edges suggests that repeated ally associations are not performance-random, while differences between internal and bridge edges can test whether this similarity is concentrated inside local groups or extends across the Flex core.

## Relationship To Betweenness Centrality

The bridge-orbit layout uses heuristic bridge features:

- `crossAllySupport`
- `connectedAllyClusterCount`
- `memberCount`
- `orbitScore`
- `orbitRadius`

These are useful for visualization, but they are not the same as true graph centrality.

The next strong validation step is:

> Compare bridge-orbit clusters against Brandes betweenness centrality.

If the central bridge-orbit clusters also have high betweenness, then the visualization heuristic is validated by an independent graph algorithm.

If they do not match, that is still useful: it means the layout captures local bridge exposure, while Brandes captures shortest-path brokerage.

Either outcome is thesis-defensible.

## Suggested Chapter Framing

Suggested Hungarian chapter/section title:

> A `flexset` mint asszociatív core-periphery játékosgráf

Suggested English chapter/section title:

> Flexset As A Core-Periphery Player Association Graph

Suggested paragraph:

> A Graph V2 vizualizáció nem közvetlen barátsági vagy ellenségességi hálóként értelmezendő, hanem asszociatív játékosgráfként. A csúcsok játékosokat, az élek pedig ismétlődő meccsbeli együtt- vagy szembekerülési bizonyítékot jelölnek. A `flexset` esetében a legfontosabb mintázat nem az előjeles egyensúly, hanem a core-periphery szerkezet: a központi régióban sok kereszt-klaszter szövetségesi kapcsolatot hordozó csoportok jelennek meg, míg a külső gyűrűben sok kis, gyengén kapcsolt vagy teljesen híd nélküli lokális ally-csoport található. Ez a Flex Queue premade-kompatibilis mechanikájával összhangban áll, ugyanakkor nem igényel túlzó szociológiai értelmezést.

