"""Public endpoints for the landing-page button experiment.

These run before anyone signs in, so they are not behind `get_current_user`.
They only accept experiments and versions listed in the registry.
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db import DbSession
from app.experiments.bandit import ArmStats, choose_variant
from app.experiments.registry import EXPERIMENTS
from app.models.experiment_variant import ExperimentVariant
from app.schemas.experiment import (
    ConversionInput,
    ExperimentResults,
    VariantAssignment,
    VariantResult,
)

router = APIRouter(prefix="/experiments", tags=["experiments"])


def _variants_or_404(experiment: str) -> tuple[str, ...]:
    variants = EXPERIMENTS.get(experiment)
    if variants is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "not_found", "message": "Experiment not found"},
        )
    return variants


def _load_arms(db: Session, experiment: str, variants: tuple[str, ...]) -> list[ExperimentVariant]:
    """Return one row per version, creating missing rows with zero counts."""
    rows = [{"experiment": experiment, "variant": v, "views": 0, "clicks": 0} for v in variants]
    db.execute(insert(ExperimentVariant).values(rows).on_conflict_do_nothing())
    rows = db.scalars(
        select(ExperimentVariant).where(
            ExperimentVariant.experiment == experiment,
            ExperimentVariant.variant.in_(variants),
        )
    ).all()
    return sorted(rows, key=lambda row: variants.index(row.variant))


@router.post("/{experiment}/assign", response_model=VariantAssignment)
def assign_variant(experiment: str, db: DbSession) -> VariantAssignment:
    """Pick a version for a new visitor with epsilon-greedy and count one view."""
    variants = _variants_or_404(experiment)
    arms = _load_arms(db, experiment, variants)
    chosen = choose_variant({row.variant: ArmStats(row.views, row.clicks) for row in arms})
    db.execute(
        update(ExperimentVariant)
        .where(ExperimentVariant.experiment == experiment, ExperimentVariant.variant == chosen)
        .values(views=ExperimentVariant.views + 1)
    )
    db.commit()
    return VariantAssignment(experiment=experiment, variant=chosen)


@router.post("/{experiment}/convert", status_code=status.HTTP_204_NO_CONTENT)
def record_conversion(experiment: str, payload: ConversionInput, db: DbSession) -> None:
    """Count one click on the button for the given version."""
    variants = _variants_or_404(experiment)
    if payload.variant not in variants:
        raise HTTPException(
            status_code=422,
            detail={"code": "unknown_variant", "message": "Unknown variant"},
        )
    _load_arms(db, experiment, variants)
    db.execute(
        update(ExperimentVariant)
        .where(
            ExperimentVariant.experiment == experiment,
            ExperimentVariant.variant == payload.variant,
        )
        .values(clicks=ExperimentVariant.clicks + 1)
    )
    db.commit()


@router.get("/{experiment}", response_model=ExperimentResults)
def get_results(experiment: str, db: DbSession) -> ExperimentResults:
    """Current views, clicks and click rate for every version."""
    variants = _variants_or_404(experiment)
    arms = _load_arms(db, experiment, variants)
    db.commit()
    return ExperimentResults(
        experiment=experiment,
        variants=[
            VariantResult(
                variant=row.variant,
                views=row.views,
                clicks=row.clicks,
                click_rate=round(row.clicks / row.views, 4) if row.views else 0.0,
            )
            for row in arms
        ],
    )
