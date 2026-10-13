from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model that emits camelCase JSON while using snake_case in Python.

    `populate_by_name=True` lets inbound requests accept either casing, which keeps
    FastAPI's automatically-generated docs usable from either side.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
