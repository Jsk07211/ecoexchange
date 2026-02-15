from typing import Literal, Optional
from pydantic import BaseModel, Field


class FileInfo(BaseModel):
    filename: str
    content_type: str
    size: int
    file_type: Literal["image", "text", "video", "unknown"]


class QualityWarning(BaseModel):
    check: str = Field(description="Check name, e.g. blur, exposure, noise")
    message: str = Field(description="Human-readable explanation, e.g. 'Blurry because ...'")


class QualityScanResult(BaseModel):
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
        description="Human-readable summary of the quality verdict.",
    )
    warnings: list[QualityWarning] = Field(
        default_factory=list,
        description="Individual quality issues found.",
    )


class CnnResult(BaseModel):
    label: str = Field(description="Detected class label from CNN")
    confidence: float = Field(description="Confidence score 0.0-1.0")
    matches: bool = Field(description="Whether the detection matches the expected category")
    expected_category: str = Field(description="The category the program expects")
    message: str = Field(description="Human-readable CNN result message")


class UploadFilterResult(BaseModel):
    """Result of AI filtering for a single file."""

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
    cnn: Optional[CnnResult] = None


class UploadResponse(BaseModel):
    total_files: int
    accepted: int
    rejected: int
    program_id: str
    results: list[UploadFilterResult]


class ScanUrlRequest(BaseModel):
    urls: list[str]
    program_id: str
    table_name: Optional[str] = None


class ScanUrlResult(BaseModel):
    url: str
    quality: QualityScanResult = Field(default_factory=QualityScanResult)
    cnn: Optional[CnnResult] = None
    error: Optional[str] = None


class ScanUrlResponse(BaseModel):
    results: dict[str, ScanUrlResult]
