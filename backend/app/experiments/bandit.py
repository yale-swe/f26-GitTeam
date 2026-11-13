"""Epsilon-greedy multi-armed bandit.

Each version of a page is an "arm". Most of the time we show the arm with the
best click rate so far (exploit); a small fraction of the time we show a random
arm (explore), so an arm that started unlucky can still win later.
"""

import random
from collections.abc import Mapping
from dataclasses import dataclass

EPSILON = 0.1  # share of visitors who see a random version


@dataclass(frozen=True)
class ArmStats:
    views: int
    clicks: int


def click_rate(stats: ArmStats) -> float:
    """Clicks per view, starting every arm at 1 click out of 1 view.

    The +1s make untried arms look perfect, so each arm gets shown early on,
    and they avoid dividing by zero.
    """
    return (stats.clicks + 1) / (stats.views + 1)


def choose_variant(
    arms: Mapping[str, ArmStats],
    epsilon: float = EPSILON,
    rng: random.Random | None = None,
) -> str:
    """Pick which version to show the next visitor."""
    if not arms:
        raise ValueError("choose_variant needs at least one arm")
    rng = rng or random.Random()
    names = sorted(arms)
    if rng.random() < epsilon:
        return rng.choice(names)
    best_rate = max(click_rate(arms[name]) for name in names)
    best = [name for name in names if click_rate(arms[name]) == best_rate]
    return rng.choice(best)
