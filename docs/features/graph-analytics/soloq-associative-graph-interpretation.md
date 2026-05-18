---
title: SoloQ Associative Graph Interpretation
tags:
  - thesis
  - graph-v2
  - soloq
  - associative-graph
  - visualization
  - methodology
created: 2026-04-30
---

# SoloQ Associative Graph Interpretation

## Core Interpretation

The `soloq` Graph V2 visualization should be interpreted as an **apex Solo/Duo Queue encounter-association graph**.

It is not a premade social graph in the same sense as `flexset`. Its structure is mostly shaped by:

- Solo/Duo Queue premade limits
- high-rank matchmaking recurrence
- repeated MMR-neighborhood encounters
- occasional duos
- a small active Master+ player pool
- the graph builder's minimum support and ally-group projection rules

The strongest defensible reading is:

> The `soloq` graph forms a thin, hub-like encounter ecosystem: a small central core of highly recurring high-rank players and many tiny singleton/duo clusters around it. Unlike `flexset`, the graph does not primarily show premade group structure; it mostly shows repeated exposure inside a constrained apex matchmaking pool.

This makes `soloq` valuable as a **control/baseline dataset**, not as the main social-structure dataset.

## What The Graph Shows

The current `soloq` Graph V2 artifact contains:

- `2000` matches
- `1538` visible nodes
- `4111` visible edges
- `870` bounded ally groups / visual clusters
- `2682` ally edges (`65.24%`)
- `1429` enemy edges (`34.76%`)
- `2.364` average edge support
- `20` as the largest visual cluster size, by design
- `1.768` average cluster size
- `605` bridge-candidate clusters
- `265` outer-orbit clusters without cross-cluster ally bridges

The key visual fact is that `soloq` has many more clusters relative to its node count than `flexset`.

Approximate comparison:

| Dataset | Visible nodes | Clusters | Average cluster size | Edges | Average edge support |
| --- | ---: | ---: | ---: | ---: | ---: |
| `flexset` | `5741` | `1531` | `3.750` | `18548` | `3.405` |
| `soloq` | `1538` | `870` | `1.768` | `4111` | `2.364` |

This supports the main distinction:

> `flexset` creates larger and denser repeated ally groups; `soloq` creates many tiny association fragments.

## Cluster Size Distribution

The `soloq` cluster distribution is dominated by singleton and duo groups:

- `549` clusters have `1` member
- `247` clusters have `2` members
- `34` clusters have `3` members
- only `10` clusters reach the visual cap of `20` members

This is exactly what should be expected from Solo/Duo Queue.

The dataset can contain repeated contacts, but it does not naturally support stable 3-5 person premade structures in the same way as Flex Queue. Most visible groups are therefore not teams; they are small repeated-contact artifacts, single players, duos, or small local recurrence pockets.

Good thesis wording:

> The SoloQ graph is intentionally not treated as a premade-network dataset. Its average cluster size of `1.768` and its dominance of singleton/duo groups show that it functions better as an individual-performance and matchmaking-recurrence baseline.

## What The Central Core Means

The screenshots show a dense center with many bridge links. This central region is not evidence of a large SoloQ premade community.

It is better interpreted as:

> a high-recurrence apex matchmaking core.

The innermost SoloQ bridge-orbit clusters are large bounded groups with many cross-cluster contacts. For example, the strongest bridge-orbit clusters include:

| Cluster | Members | Cross ally support | Connected ally clusters | Internal ally edges | Enemy/cross exposure | Orbit radius |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `graph-v2:ally-group:3` | `20` | `505` | `120` | `44` | `620` | `360.00` |
| `graph-v2:ally-group:10` | `20` | `484` | `122` | `40` | `598` | `375.97` |
| `graph-v2:ally-group:7` | `20` | `292` | `91` | `29` | `416` | `712.17` |
| `graph-v2:ally-group:4` | `20` | `221` | `81` | `31` | `295` | `886.64` |
| `graph-v2:ally-group:9` | `20` | `219` | `79` | `24` | `276` | `898.72` |

These numbers show that the core is made from players/clusters that repeatedly appear across many other clusters.

Possible causes:

- small Master+ population
- repeated queue-time overlap
- narrow MMR band
- high-activity players appearing in many sampled matches
- duo pairs rotating across broader matchmaking exposure
- graph-builder splitting of larger connected recurrence regions into bounded groups

This is a valid graph observation, but it should not be called stable social structure.

## What The Outer Ring Means

The `soloq` outer ring consists of weaker, smaller, lower-bridge clusters.

In the current artifact:

- `265` clusters have no cross-cluster ally bridges
- these clusters average `1.61` members
- they average only `0.63` internal ally edges
- they average `0` cross ally support
- they average `0` connected ally clusters

This is much more fragile than the `flexset` outer ring. In `flexset`, unbridged outer groups often look like small premade-like islands. In `soloq`, many outer groups are simply singleton/duo fragments.

Good thesis wording:

> The SoloQ periphery is not a field of stable premade groups. It is mostly a field of weakly connected or isolated player fragments, consistent with Solo/Duo Queue's individual-centered matchmaking rules.

## Why The Ring Is Not As Extreme As Flexset

In the `flexset` artifact, unbridged clusters were pushed to very large orbit radii around `9850`.

In the `soloq` artifact, the overall layout radius distribution is different:

- average radius across all clusters: about `5671`
- no clusters in the computed metadata had `orbitRadius >= 9000`
- unbridged clusters average about `7542`
- bridge-connected clusters average about `4851`
- inner high-bridge clusters average below `1500`

This means the `soloq` layout still separates core and periphery, but the visual scale is less extreme than the `flexset` outer shell.

Important caution:

> Orbit radius is a visualization heuristic. It should be used to describe the layout and propose hypotheses, not as a standalone scientific metric unless validated against independent centrality or bridge measures.

## What The Two Screenshots Mean

### With Bridge Links Enabled

With bridge links enabled, the graph looks like a dense fan from the center.

This view emphasizes:

- repeated cross-cluster exposure in the apex SoloQ population
- a small number of clusters acting as high-recurrence hubs
- many long-range contacts between the core and surrounding clusters
- a matchmaking ecosystem rather than premade community structure

The visual message:

> SoloQ still has a recurring core, but the core is better understood as high-rank matchmaking recurrence than as social grouping.

### With Bridge Links Disabled

With bridge links hidden, the graph becomes much sparser and more fragmented.

This view emphasizes:

- singleton and duo dominance
- weak local ally-group structure
- lack of large organic premade-like clusters
- a central set of larger bounded recurrence groups surrounded by many tiny fragments

The visual message:

> The bridge layer is what makes SoloQ look connected. Without it, the underlying ally-group structure is thin and individual-centered.

This is a strong visual contrast against `flexset`.

## Comparison Against Flexset

The `soloq` graph is valuable because it makes the `flexset` interpretation stronger by contrast.

| Dimension | `flexset` | `soloq` |
| --- | --- | --- |
| Queue meaning | Flex Queue, premade-compatible | Solo/Duo Queue, individual-centered |
| Visible nodes | `5741` | `1538` |
| Edges | `18548` | `4111` |
| Average edge support | `3.405` | `2.364` |
| Average cluster size | `3.750` | `1.768` |
| Ally edge share | `73.17%` | `65.24%` |
| Enemy edge share | `26.83%` | `34.76%` |
| Main graph shape | core + many local ally islands | thin apex recurrence core + singleton/duo periphery |
| Best interpretation | player association / premade-compatible Flex structure | control baseline / matchmaking recurrence |

The important point is:

> Both datasets produce a core-periphery pattern, but the meaning of the core differs.

For `flexset`, the core is more naturally linked to repeated ally groups and premade-compatible association.

For `soloq`, the core is more naturally linked to repeated exposure inside a small high-rank matchmaking pool.

## What This Is Good For

The `soloq` visualization supports several defensible uses:

1. It serves as a control dataset against `flexset`.
2. It shows that repeated graph structure can appear even without large premades.
3. It separates "premade-like ally structure" from "apex matchmaking recurrence."
4. It helps explain why signed balance should not be overinterpreted.
5. It gives a baseline for assortativity under a more individual-centered queue.
6. It helps test whether `opscore` similarity comes from teammate choice, queue/MMR matching, or broad high-rank homogeneity.

This is especially important for assortativity.

If `soloq` still shows positive `opscore` assortativity, the likely explanation is not "premade players choose similarly skilled teammates." A better explanation is:

> high-rank matchmaking repeatedly places similarly skilled players into the same local encounter ecosystem.

That is a useful and defensible control interpretation.

## Strong Thesis Claim

The strongest defensible thesis claim from the `soloq` visualization is:

> The `soloq` dataset produces a much thinner and more fragmented association graph than `flexset`. Its structure is dominated by singleton and duo clusters, with a small central high-recurrence core caused by repeated apex matchmaking exposure. This supports the use of `soloq` as a control dataset: it captures individual-centered high-rank recurrence rather than premade-oriented group structure.

This claim is:

- supported by the metadata
- visible in the screenshots
- consistent with Solo/Duo Queue rules
- useful for explaining Flex vs SoloQ differences
- safer than social or psychological interpretation

## What Not To Claim

Do not claim:

- SoloQ has stable team communities
- the central SoloQ core is a premade social group
- outer SoloQ clusters are meaningful communities
- enemy edges indicate rivalry or hostility
- left/right/top/bottom layout position has meaning
- bridge-orbit radius is a validated centrality score
- singleton clusters are "lonely players" in a social sense

The correct language is structural and cautious:

- repeated exposure
- encounter ecosystem
- high-rank matchmaking recurrence
- association fragments
- singleton/duo dominated periphery
- control dataset

## Relationship To Assortativity

The `soloq` graph makes assortativity more interesting, not less.

In `flexset`, positive teammate assortativity can plausibly come from repeated premade-compatible grouping.

In `soloq`, positive assortativity is more likely to come from:

- MMR similarity
- high-rank population constraints
- repeated queue timing
- matchmaking selecting similarly skilled players

Therefore, the Flex vs SoloQ assortativity comparison can answer:

> Is performance similarity stronger in premade-compatible teammate associations than in individual-centered matchmaking recurrence?

This is a better thesis question than signed balance.

## Suggested Chapter Framing

Suggested Hungarian section title:

> A `soloq` mint apex matchmaking-recurrence kontrollgráf

Suggested English section title:

> SoloQ As An Apex Matchmaking-Recurrence Control Graph

Suggested Hungarian paragraph:

> A `soloq` Graph V2 nézete nem premade-közösségi hálóként értelmezendő, hanem apex matchmaking-recurrence kontrollgráfként. A gráf 1538 látható csúcsra 870 klasztert tartalmaz, az átlagos klaszterméret mindössze 1.768, és a klasztereloszlást döntően egytagú és kéttagú csoportok adják. Ez élesen eltér a `flexset` sűrűbb, nagyobb ally-csoportokat tartalmazó szerkezetétől. A `soloq` központi régiója nem stabil premade-struktúrát, hanem a Master+ Solo/Duo Queue szűk matchmaking-populációjából fakadó ismétlődő találkozási magot jelöl. Ezért a `soloq` a dolgozatban kontrollként használható: megmutatja, milyen gráfszerkezet keletkezik akkor, amikor a queue-szabályok nem támogatnak nagyobb premade-csoportokat.

