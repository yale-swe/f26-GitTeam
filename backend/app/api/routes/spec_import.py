from fastapi import APIRouter

router = APIRouter(prefix="/spec_import", tags=["spec_import"])


@router.post("")
def spec_import() -> dict:
    return {"ok": True}
