from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.auth import CurrentUserId
from app.spec_import.extract_text import EmptyDocument, UnsupportedFileType, extract_text

MAX_BYTES = 10 * 1024 * 1024

router = APIRouter(prefix="/spec-import", tags=["spec-import"])


@router.post("")
async def upload_file(user_id: CurrentUserId, file: Annotated[UploadFile, File()]) -> dict:
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="The file is too large. The limit is 10 MB.",
        )

    try:
        text = extract_text(file.filename or "", data)
    except UnsupportedFileType:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a PDF, DOCX, Markdown, or text file.",
        ) from None
    except EmptyDocument:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="No text could be found in this file.",
        ) from None
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="This file couldn't be read.",
        ) from exc

    return {"filename": file.filename, "characters": len(text), "text": text}
