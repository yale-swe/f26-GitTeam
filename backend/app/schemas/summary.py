import uuid
from datetime import datetime

from app.schemas.base import CamelModel


class SummaryRead(CamelModel):
    id: uuid.UUID
    project_id: uuid.UUID
    text: str
    generated_at: datetime
