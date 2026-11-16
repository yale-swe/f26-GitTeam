import random

import pytest

from app.experiments.bandit import ArmStats, choose_variant, click_rate

ARMS = {
    "blue": ArmStats(views=100, clicks=5),  # 5%
    "green": ArmStats(views=100, clicks=20),  # 20%, the best
    "dark": ArmStats(views=100, clicks=10),  # 10%
}


def test_click_rate_starts_untried_arms_optimistically():
    assert click_rate(ArmStats(views=0, clicks=0)) == 1.0
    assert click_rate(ArmStats(views=4, clicks=4)) == 1.0


def test_exploits_the_best_arm_when_never_exploring():
    rng = random.Random(1)
    picks = {choose_variant(ARMS, epsilon=0, rng=rng) for _ in range(100)}
    assert picks == {"green"}


def test_explores_every_arm_when_always_exploring():
    rng = random.Random(1)
    picks = {choose_variant(ARMS, epsilon=1, rng=rng) for _ in range(200)}
    assert picks == {"blue", "green", "dark"}


def test_mostly_exploits_with_the_default_epsilon():
    rng = random.Random(1)
    picks = [choose_variant(ARMS, rng=rng) for _ in range(1000)]
    # 90% exploit green, plus about a third of the 10% random picks.
    assert 900 <= picks.count("green") <= 960


def test_tries_every_untried_arm_first():
    arms = {"blue": ArmStats(views=10, clicks=1), "green": ArmStats(0, 0), "dark": ArmStats(0, 0)}
    picks = {choose_variant(arms, epsilon=0, rng=random.Random(seed)) for seed in range(50)}
    assert picks == {"green", "dark"}


def test_converges_on_the_best_arm_in_simulation():
    """Simulate visitors whose true click rates differ; the best arm should get most views."""
    true_rates = {"blue": 0.05, "green": 0.15, "dark": 0.08}
    stats = {name: ArmStats(0, 0) for name in true_rates}
    rng = random.Random(42)
    for _ in range(5000):
        chosen = choose_variant(stats, rng=rng)
        clicked = rng.random() < true_rates[chosen]
        old = stats[chosen]
        stats[chosen] = ArmStats(old.views + 1, old.clicks + int(clicked))
    views = {name: arm.views for name, arm in stats.items()}
    assert max(views, key=views.get) == "green"
    assert views["green"] > 0.6 * 5000


def test_requires_at_least_one_arm():
    with pytest.raises(ValueError):
        choose_variant({})
