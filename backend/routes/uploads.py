import os
import re
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.db_models import ProgramDB
from backend.models.upload import CnnResult, QualityScanResult, QualityWarning, UploadFilterResult, UploadResponse
from backend.qualify_image import check_quality

UPLOAD_DIR = "/app/uploads"

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "application/pdf": "text",
    "image/jpeg": "image",
    "image/png": "image",
    "image/webp": "image",
    "text/csv": "text",
    "text/plain": "text",
    "application/vnd.ms-excel": "text",
    "video/mp4": "video",
    "video/quicktime": "video",
    "video/webm": "video",
}


def _detect_file_type(content_type: str, filename: str) -> str:
    if content_type in ALLOWED_CONTENT_TYPES:
        return ALLOWED_CONTENT_TYPES[content_type]
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        return "text"
    if ext in ("jpg", "jpeg", "png", "webp"):
        return "image"
    if ext in ("csv", "txt"):
        return "text"
    if ext in ("mp4", "mov", "webm"):
        return "video"
    return "unknown"


def _label_from_filename(filename: str) -> str:
    """Derive a human-readable label from a filename.

    ``"blue_jay_park.jpg"`` → ``"Blue Jay Park"``
    """
    stem = filename.rsplit(".", 1)[0] if "." in filename else filename
    # Replace underscores, hyphens, and camelCase boundaries with spaces
    stem = re.sub(r"[-_]+", " ", stem)
    stem = re.sub(r"([a-z])([A-Z])", r"\1 \2", stem)
    return stem.strip().title()


async def _run_quality_scan(
    file: UploadFile, file_type: str, contents: bytes
) -> QualityScanResult:
    if file_type != "image":
        return QualityScanResult(score=100.0, passed=True, reason="Good")

    result = check_quality(contents)
    warnings = [QualityWarning(**w) for w in result["warnings"]]
    score = result["score"]

    if warnings:
        reason = "; ".join(w.message for w in warnings)
    else:
        reason = "Good"

    return QualityScanResult(
        score=score,
        passed=result["passed"],
        reason=reason,
        warnings=warnings,
    )


async def _ai_filter(
    file: UploadFile, file_type: str, contents: bytes, cnn_filter: str | None = None
) -> UploadFilterResult:
    quality = await _run_quality_scan(file, file_type, contents)
    detected_label = (
        _label_from_filename(file.filename or "unnamed")
        if file_type == "image"
        else None
    )

    # Run CNN classification if enabled and this is an image
    cnn_result = None
    if cnn_filter and file_type == "image":
        try:
            from backend.classify_image import check_category
            cnn_data = check_category(contents, cnn_filter)
            cnn_result = CnnResult(
                label=cnn_data["label"],
                confidence=cnn_data["confidence"],
                matches=cnn_data["matches"],
                expected_category=cnn_data["expected_category"],
                message=cnn_data["message"],
            )
            detected_label = cnn_data["label"]
        except Exception:
            pass  # CNN failure shouldn't block upload

    return UploadFilterResult(
        filename=file.filename or "unnamed",
        file_type=file_type,  # type: ignore[arg-type]
        size=len(contents),
        accepted=quality.passed,
        reason="Passed quality scan" if quality.passed else quality.reason,
        detected_label=detected_label,
        quality=quality,
        ai_tags=[],
        ai_confidence=cnn_result.confidence if cnn_result else None,
        cnn=cnn_result,
    )


@router.post("", response_model=UploadResponse)
async def upload_files(
    files: list[UploadFile] = File(...),
    program_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    # Look up the program's CNN filter setting
    cnn_filter: str | None = None
    result = await db.execute(select(ProgramDB).where(ProgramDB.id == program_id))
    program = result.scalars().first()
    if not program:
        # Also try matching by project_name
        result = await db.execute(
            select(ProgramDB).where(ProgramDB.project_name == program_id)
        )
        program = result.scalars().first()
    if program:
        cnn_filter = program.cnn_filter

    results: list[UploadFilterResult] = []

    for f in files:
        contents = await f.read()
        file_type = _detect_file_type(f.content_type or "", f.filename or "")
        filter_result = await _ai_filter(f, file_type, contents, cnn_filter)

        if filter_result.accepted and file_type == "image":
            ext = (f.filename or "").rsplit(".", 1)[-1].lower() if "." in (f.filename or "") else "bin"
            save_name = f"{uuid.uuid4().hex}.{ext}"
            program_dir = os.path.join(UPLOAD_DIR, program_id)
            os.makedirs(program_dir, exist_ok=True)
            with open(os.path.join(program_dir, save_name), "wb") as fp:
                fp.write(contents)
            filter_result.url = f"/uploads/{program_id}/{save_name}"

        results.append(filter_result)

    accepted = sum(1 for r in results if r.accepted)
    return UploadResponse(
        total_files=len(results),
        accepted=accepted,
        rejected=len(results) - accepted,
        program_id=program_id,
        results=results,
    )
