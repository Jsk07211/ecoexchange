from fastapi import APIRouter, UploadFile, File

from backend.models.upload import UploadFilterResult, UploadResponse

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "application/pdf": "pdf",
    "image/jpeg": "image",
    "image/png": "image",
    "image/webp": "image",
    "text/csv": "csv",
    "application/vnd.ms-excel": "csv",
}


def _detect_file_type(content_type: str, filename: str) -> str:
    if content_type in ALLOWED_CONTENT_TYPES:
        return ALLOWED_CONTENT_TYPES[content_type]
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        return "pdf"
    if ext in ("jpg", "jpeg", "png", "webp"):
        return "image"
    if ext == "csv":
        return "csv"
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
async def upload_files(files: list[UploadFile] = File(...)):
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
        results=results,
    )
