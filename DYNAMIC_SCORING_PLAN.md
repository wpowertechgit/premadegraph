# Player Scoring Reference

This is the short reference version of the scoring model used in the project.

## Final Result

The product exposes two player scores:

- `opscore`: the main role-aware performance score on a `0-10` scale
- `feedscore`: a lower-is-better penalty score tied to deaths versus contribution

## Intended Meaning

The goal is to describe how a player looks across the matches stored in the dataset.

The score is role-aware, so it judges a player's matches in the context of the position they actually played.

## Included Ideas

The score reflects:

- match performance
- role context
- dataset-wide averaging across the stored sample

## Excluded Ideas

The score does not include:

- 30-day decay
- recency weighting
- streaks
- stability bonuses
- role-confidence estimation

## Source Of Truth

For the user-facing explanation, use [docs/dynamic-opscore-system.md](/C:/Users/admin/Downloads/premgraph/premadegraph/docs/dynamic-opscore-system.md).
