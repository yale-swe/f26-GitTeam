from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.experiments.registry import EXPERIMENTS, LANDING_SIGNIN_COLOR
from app.models.experiment_variant import ExperimentVariant

URL = f"/api/experiments/{LANDING_SIGNIN_COLOR}"


def _counts(db: Session) -> dict[str, tuple[int, int]]:
    rows = db.scalars(
        select(ExperimentVariant).where(ExperimentVariant.experiment == LANDING_SIGNIN_COLOR)
    )
    return {row.variant: (row.views, row.clicks) for row in rows}


def test_assign_is_public_and_counts_one_view(anon_client: TestClient, db_session: Session):
    response = anon_client.post(f"{URL}/assign")

    assert response.status_code == 200
    variant = response.json()["variant"]
    assert variant in EXPERIMENTS[LANDING_SIGNIN_COLOR]
    counts = _counts(db_session)
    assert set(counts) == set(EXPERIMENTS[LANDING_SIGNIN_COLOR])
    assert counts[variant] == (1, 0)
    assert sum(views for views, _ in counts.values()) == 1


def test_convert_counts_one_click(anon_client: TestClient, db_session: Session):
    response = anon_client.post(f"{URL}/convert", json={"variant": "green"})

    assert response.status_code == 204
    assert _counts(db_session)["green"] == (0, 1)


def test_convert_rejects_an_unknown_variant(anon_client: TestClient):
    response = anon_client.post(f"{URL}/convert", json={"variant": "purple"})

    assert response.status_code == 422


def test_unknown_experiment_is_not_found(anon_client: TestClient):
    assert anon_client.post("/api/experiments/nope/assign").status_code == 404
    assert anon_client.get("/api/experiments/nope").status_code == 404


def test_results_report_views_clicks_and_rate(anon_client: TestClient, db_session: Session):
    db_session.add(
        ExperimentVariant(experiment=LANDING_SIGNIN_COLOR, variant="blue", views=4, clicks=1)
    )
    db_session.commit()

    response = anon_client.get(URL)

    assert response.status_code == 200
    by_variant = {row["variant"]: row for row in response.json()["variants"]}
    assert by_variant["blue"] == {"variant": "blue", "views": 4, "clicks": 1, "clickRate": 0.25}
    assert by_variant["green"]["views"] == 0
    assert by_variant["green"]["clickRate"] == 0.0


def test_assign_prefers_the_best_performing_variant(anon_client: TestClient, db_session: Session):
    for variant, clicks in [("blue", 2), ("green", 30), ("dark", 5)]:
        db_session.add(
            ExperimentVariant(
                experiment=LANDING_SIGNIN_COLOR, variant=variant, views=100, clicks=clicks
            )
        )
    db_session.commit()

    picks = [anon_client.post(f"{URL}/assign").json()["variant"] for _ in range(100)]

    # 90% exploit green, plus about a third of the 10% random picks.
    assert picks.count("green") > 80
