from typing import Literal, Optional
from pydantic import BaseModel


class FileInfo(BaseModel):
    filename: str
    content_type: str
    size: int
    file_type: Literal["pdf", "image", "csv", "unknown"]


class UploadFilterResult(BaseModel):
    """Result of AI filtering for a single file.
    For now passes everything through — swap in real AI logic later."""

    filename: str
    file_type: Literal["pdf", "image", "csv", "unknown"]
    size: int
    accepted: bool
    reason: Optional[str] = None
    # placeholder for future AI metadata
    ai_tags: list[str] = []
    ai_confidence: Optional[float] = None


class UploadResponse(BaseModel):
    total_files: int
    accepted: int
    rejected: int
    results: list[UploadFilterResult]
