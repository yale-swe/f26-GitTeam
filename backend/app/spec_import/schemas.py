from app.schemas.base import CamelModel


class ExtractedMilestone(CamelModel):
    title: str
    date: str | None
    deliverables: list[str]


class ExtractedPlan(CamelModel):
    name: str
    summary: str
    features: list[str]
    milestones: list[ExtractedMilestone]
