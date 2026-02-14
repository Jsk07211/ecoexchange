import uuid
from datetime import datetime, timezone

from fastapi import APIRouter

from backend.models import Submission, SubmissionResponse

router = APIRouter(prefix="/api/submissions", tags=["submissions"])


@router.post("", response_model=SubmissionResponse)
def create_submission(submission: Submission):
    return SubmissionResponse(
        **submission.model_dump(),
        id=str(uuid.uuid4()),
        submitted_at=datetime.now(timezone.utc).isoformat(),
    )
