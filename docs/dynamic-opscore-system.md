# Player Scoring

This document explains what the player scores mean in the current product.

## Opscore

`opscore` is the main performance score.

It is meant to show how strong a player looks across the matches stored in this dataset, while taking their played role into account.

A higher `opscore` means the player looks more effective overall.

The score is shown on a `0-10` scale so players are easy to compare.

## Feedscore

`feedscore` reflects how costly a player's deaths look relative to their overall contribution.

A lower `feedscore` is better.

## What The Scores Take Into Account

The scoring looks at match performance with role-awareness built in.

In plain terms, it values things like:

- kills and assists
- gold generation
- vision contribution
- the role the player was actually playing in that match

This is important because supports, carries, junglers, and solo laners should not be judged as if they all do the same job.

## What The Scores Represent

These scores describe the player's overall profile in the stored dataset.

They are meant to answer:

**Based on the matches we have, how good does this player look overall?**

## What The Scores Do Not Try To Do

These scores do not try to show:

- momentum
- recent hot streaks
- long-term improvement
- age-based recency weighting

All stored matches are treated equally in the final score.

## Related Fields

- `opscore`: main performance score
- `feedscore`: lower-is-better penalty score
- `matches_processed`: how many matches were included
- `dynamic_score_updated`: when the scores were last recomputed

## Summary

`opscore` is the main role-aware performance score.

`feedscore` is the lower-is-better penalty score.

Together, they give a simple picture of how a player looks in the dataset we currently have.
