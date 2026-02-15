import os
import re
import uuid

from fastapi import APIRouter, UploadFile, File, Form

from backend.models.upload import QualityScanResult, UploadFilterResult, UploadResponse

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
    """Stub quality scanner — always returns 100 / Good.

    Replace this with real checks per-program criteria, e.g.:
      - Minimum resolution (width × height)
      - Blur / sharpness detection
      - EXIF metadata presence
      - File size limits
      - NSFW / content-policy filtering
    """
    return QualityScanResult(score=100.0, passed=True, reason="Good")


async def _ai_filter(file: UploadFile, file_type: str, contents: bytes) -> UploadFilterResult:
    """Stub — accepts every file. Replace with real AI filtering later."""
    quality = await _run_quality_scan(file, file_type, contents)
    detected_label = (
        _label_from_filename(file.filename or "unnamed")
        if file_type == "image"
        else None
    )
    return UploadFilterResult(
        filename=file.filename or "unnamed",
        file_type=file_type,  # type: ignore[arg-type]
        size=len(contents),
        accepted=quality.passed,
        reason="Passed quality scan" if quality.passed else quality.reason,
        detected_label=detected_label,
        quality=quality,
        ai_tags=[],
        ai_confidence=None,
    )


@router.post("", response_model=UploadResponse)
async def upload_files(
    files: list[UploadFile] = File(...),
    program_id: str = Form(...),
):
    results: list[UploadFilterResult] = []

    for f in files:
        contents = await f.read()
        file_type = _detect_file_type(f.content_type or "", f.filename or "")
        result = await _ai_filter(f, file_type, contents)

        if result.accepted and file_type == "image":
            ext = (f.filename or "").rsplit(".", 1)[-1].lower() if "." in (f.filename or "") else "bin"
            save_name = f"{uuid.uuid4().hex}.{ext}"
            program_dir = os.path.join(UPLOAD_DIR, program_id)
            os.makedirs(program_dir, exist_ok=True)
            with open(os.path.join(program_dir, save_name), "wb") as fp:
                fp.write(contents)
            result.url = f"/uploads/{program_id}/{save_name}"

        results.append(result)

    accepted = sum(1 for r in results if r.accepted)
    return UploadResponse(
        total_files=len(results),
        accepted=accepted,
        rejected=len(results) - accepted,
        program_id=program_id,
        results=results,
    )
