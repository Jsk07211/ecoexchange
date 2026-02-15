from typing import Literal, Optional
from pydantic import BaseModel, Field


class FileInfo(BaseModel):
    filename: str
    content_type: str
    size: int
    file_type: Literal["image", "text", "video", "unknown"]


class QualityScanResult(BaseModel):
    """Result of a quality scan on an uploaded file.

    Replace the stub ``run_quality_scan`` function with real logic
    (e.g. resolution check, blur detection, EXIF validation) to
    populate these fields with meaningful values.
    """

    score: float = Field(
        default=100.0,
        ge=0.0,
        le=100.0,
        description="Quality score from 0-100. 100 = perfect.",
    )
    passed: bool = Field(
        default=True,
        description="Whether the file meets the program's quality criteria.",
    )
    reason: str = Field(
        default="Good",
        description="Human-readable explanation of the quality verdict.",
    )


class UploadFilterResult(BaseModel):
    """Result of AI filtering for a single file.
    For now passes everything through — swap in real AI logic later."""

    filename: str
    file_type: Literal["image", "text", "video", "unknown"]
    size: int
    accepted: bool
    reason: Optional[str] = None
    url: Optional[str] = None
    detected_label: Optional[str] = None
    quality: QualityScanResult = Field(default_factory=QualityScanResult)
    ai_tags: list[str] = []
    ai_confidence: Optional[float] = None


class UploadResponse(BaseModel):
    total_files: int
    accepted: int
    rejected: int
    program_id: str
    results: list[UploadFilterResult]
