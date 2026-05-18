---
title: Signed Balance Methodological Retirement
tags:
  - thesis
  - signed-balance
  - methodology
  - scope
  - retired-feature
created: 2026-04-30
---

# Signed Balance Methodological Retirement

## Decision

Signed Balance / Structural Balance Theory should no longer be treated as a central thesis result.

The implementation can remain in the project as an experimental graph-analysis option, but it should not be framed as one of the strongest empirical claims of the thesis.

The strongest defensible thesis position is:

> The signed-balance module is useful as an exploratory experiment and as a demonstration of how formal signed-network methods can be projected onto game telemetry. However, its real-world interpretation is limited because League of Legends "enemy" edges are not reliable negative social ties. Therefore, signed balance should be discussed primarily as a methodological limitation case, not as proof of meaningful social balance.

This document supersedes earlier optimistic framing in which signed balance was treated as a major research pillar.

## Why The Original Idea Was Attractive

The project stores two kinds of repeated pair evidence:

- `allyWeight`: how often two players appeared on the same team
- `enemyWeight`: how often two players appeared on opposite teams

This naturally suggested a signed projection:

- dominant ally relation = positive edge
- dominant enemy relation = negative edge
- equal evidence = tie / excluded edge

In abstract graph theory, this looks appealing. Structural Balance Theory gives a clean triad rule:

- `+++` is balanced
- `+--` is balanced
- `++-` is unbalanced
- `---` is unbalanced

The method is mathematically elegant, easy to implement, and easy to summarize numerically.

The problem is not the algorithm. The problem is the semantic meaning of the negative edge.

## Core Problem: Enemy Edges Are Not Social Antagonism

Structural Balance Theory was developed for signed social relations such as friendship, hostility, trust, distrust, approval, and disapproval.

In the current project, an enemy edge usually means something weaker:

> These two players were placed on opposite teams by matchmaking more often than they were placed on the same team.

That does not necessarily mean:

- rivalry
- dislike
- conflict
- social opposition
- strategic avoidance
- group boundary

It may simply mean:

- they play in the same MMR band
- they queue at similar hours
- the high-rank player pool is small
- matchmaking repeatedly places them into the same matches
- Flex Queue groups are internally stable, making non-group players more likely to appear as opponents
- the dataset collection strategy amplifies repeated encounters

Because of this, `enemy = negative social tie` is too strong for the thesis.

## Why The Classic Unbalanced Example Is Rare In This Domain

A textbook unbalanced triad might look like:

> A is allied with B, B is allied with C, but A is mostly an enemy of C.

Formally, this is a `++-` triad.

In a human social network, that could indicate tension: "my friend is friends with someone I dislike."

In League matchmaking, this situation is much harder to interpret. For it to happen repeatedly, the data must show:

- A and B frequently appear together
- B and C frequently appear together
- A and C frequently appear against each other

This pattern is possible, but it is not obviously meaningful. It could come from:

- B playing with different duo/flex partners at different times
- A and C both belonging to the same small rank pool
- partial premade groups rotating members
- queue timing coincidence
- insufficient evidence after collapsing multi-edge history into a single sign

Therefore, when the algorithm labels the triad "unbalanced," the thesis cannot confidently say that the player network contains social instability. It can only say that the chosen ally/enemy projection produced an unbalanced signed triad under the formal rule.

That is much weaker than the original research framing.

## Why A High Balance Ratio Is Not Very Informative

The observed high balance ratio is not automatically impressive.

If Flex Queue naturally creates stable teammate groups, then many dense triads will be ally-heavy. Ally-heavy triangles become `+++`, which are always balanced. This can drive the balance ratio upward without proving any deep social phenomenon.

In other words:

> A 95-98% balance ratio may mostly say that repeated Flex teammates form closed ally triangles.

That is not useless, but it is not as strong as:

> The player network exhibits meaningful signed social balance.

The first claim is a structural observation. The second claim is a social interpretation. The thesis should avoid the second.

## Why This Is Especially Problematic For Master+ Flex

Master+ Flex Queue is not a neutral social environment.

At high rank:

- relatively few players queue regularly
- many players do not play Flex alone
- premade groups are common
- repeated teammate edges are expected
- repeated opponent edges may reflect limited matchmaking supply rather than negative relation

This means the signed graph is likely dominated by queue mechanics and collection strategy.

The method may still detect structure, but the structure is not necessarily "signed social balance." It may be:

- premade repetition
- small-pool recurrence
- queue-time overlap
- matchmaking constraints
- dominant ally-clique formation

That weakens signed balance as a thesis centerpiece.

## What Signed Balance Can Still Be Used For

Signed balance can remain in the repository as an experimental or diagnostic module.

Acceptable uses:

- demonstrating that the graph can be projected into a signed simple graph
- showing how formal signed-network methods behave on game telemetry
- exposing the limits of importing social-network theory into matchmaking data
- comparing projection policies, support thresholds, and tie handling
- providing a cautionary case in the thesis methodology chapter
- serving as a UI/demo option for advanced exploration

Unacceptable or weak uses:

- claiming that players form socially harmonious or unstable groups
- treating enemy edges as genuine hostility
- presenting the balance ratio as a strong standalone result
- using signed balance as the main proof that Flex Queue has social structure
- over-explaining small numbers of unbalanced triads as meaningful social conflict

## Recommended Thesis Framing

The thesis should frame signed balance as a limitation-aware experiment:

> I implemented a signed-balance analysis because the graph records repeated ally and enemy relations. The formal method is valid at the graph-projection level, but its interpretation is limited. In League of Legends telemetry, an enemy edge does not necessarily represent a negative social tie; it often reflects matchmaking, MMR proximity, queue timing, or a small active player pool. For this reason, signed balance is retained as an experimental diagnostic rather than used as a central empirical conclusion.

Another concise version:

> The signed-balance module is valuable mainly because it shows where the boundary of the method is. The computation is correct, but the social interpretation is not strong enough for the thesis to rely on it as a main result.

## Recommended Thesis Structure Change

The current thesis should not dedicate a full "major result" chapter to signed balance.

Better placement:

1. Briefly introduce signed graphs in the background chapter.
2. Mention the implemented signed-balance module in the architecture/Rust analytics chapter.
3. Move the detailed signed-balance result discussion into a limitations or methodological reflection chapter.
4. Present the high balance ratio as an artifact-sensitive diagnostic, not as a major finding.
5. State explicitly that assortativity, graph construction, centrality, dataset comparison, and system architecture are stronger thesis pillars.

Suggested section title:

> Structural Balance As A Methodological Boundary Case

or in Hungarian:

> A strukturális egyensúly mint módszertani határeset

## Relationship To Assortativity

Assortativity is more defensible than signed balance in this project.

Assortativity asks a simpler and more telemetry-native question:

> Do connected players have similar measured performance profiles?

This does not require enemy edges to mean hostility. It only requires:

- a graph relation
- a numeric node attribute
- a clearly defined edge sample
- a cautious interpretation of correlation

Even modest assortativity coefficients can be useful if compared across:

- `social-path` vs `battle-path`
- `opscore` vs `feedscore`
- Flex Queue vs SoloQ
- observed graph vs metric-permuted null model

Therefore, if the thesis needs a graph-statistics result, assortativity should carry more weight than signed balance.

## Final Position

Signed balance is not removed because the implementation is wrong.

It is downgraded because the thesis interpretation is weak.

The correct final stance:

> Signed balance remains as an experimental option and as a methodological caution. It demonstrates that the system can perform signed-graph analysis, but it also demonstrates that not every elegant graph-theory concept transfers cleanly to game telemetry. The project is stronger if it admits this boundary instead of forcing a weak claim.

