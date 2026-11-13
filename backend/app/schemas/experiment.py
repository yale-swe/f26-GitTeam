from app.schemas.base import CamelModel


class VariantAssignment(CamelModel):
    experiment: str
    variant: str


class ConversionInput(CamelModel):
    variant: str


class VariantResult(CamelModel):
    variant: str
    views: int
    clicks: int
    click_rate: float


class ExperimentResults(CamelModel):
    experiment: str
    variants: list[VariantResult]
