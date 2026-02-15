from fastapi import APIRouter, UploadFile, File, Form

from backend.models.upload import UploadFilterResult, UploadResponse

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


async def _ai_filter(file: UploadFile, file_type: str, contents: bytes) -> UploadFilterResult:
    """Stub — accepts every file. Replace with real AI filtering later."""
    return UploadFilterResult(
        filename=file.filename or "unnamed",
        file_type=file_type,  # type: ignore[arg-type]
        size=len(contents),
        accepted=True,
        reason="Passed (AI filter not yet active)",
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
        results.append(result)

    accepted = sum(1 for r in results if r.accepted)
    return UploadResponse(
        total_files=len(results),
        accepted=accepted,
        rejected=len(results) - accepted,
        program_id=program_id,
        results=results,
    )
