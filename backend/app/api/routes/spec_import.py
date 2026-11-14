from fastapi import APIRouter, File, UploadFile
from app.auth import CurrentUserId

router = APIRouter(prefix="/spec-import", tags=["spec-import"])


@router.post("")
async def upload_file(user_id: CurrentUserId, file: UploadFile = File(...)) -> dict:
    data = await file.read()
    size = len(data)
    return {"filename": file.filename, "size": size}
