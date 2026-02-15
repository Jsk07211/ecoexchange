import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.db_models import ProgramDB, SubmissionDB
from backend.models import Submission, SubmissionResponse

router = APIRouter(prefix="/api/submissions", tags=["submissions"])


@router.post("", response_model=SubmissionResponse)
async def create_submission(
    submission: Submission, db: AsyncSession = Depends(get_db)
):
    row = SubmissionDB(
        id=str(uuid.uuid4()),
        submitted_at=datetime.now(timezone.utc).isoformat(),
        **submission.model_dump(),
    )
    db.add(row)
    await db.execute(
        update(ProgramDB)
        .where(ProgramDB.id == submission.selected_program)
        .values(participants=ProgramDB.participants + 1)
    )
    await db.commit()
    return row
