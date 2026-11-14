from datetime import date
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.auth import CurrentUserId
from app.integrations.openrouter import OpenRouterConfigError, OpenRouterError
from app.spec_import.extract_text import EmptyDocument, UnsupportedFileType, extract_text
from app.spec_import.llm_extract import extract_plan
from app.spec_import.quality import check_plan

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

    try:
        plan = extract_plan(text)
    except OpenRouterConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spec import is not configured.",
        ) from exc
    except OpenRouterError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The plan couldn't be extracted from this file. Please try again.",
        ) from exc

    warnings = check_plan(plan, text, date.today())

    return {
        "filename": file.filename,
        "plan": plan.model_dump(by_alias=True),
        "warnings": warnings,
    }
