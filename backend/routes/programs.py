from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.db_models import ProgramDB
from backend.models import Program

router = APIRouter(prefix="/api/programs", tags=["programs"])


@router.get("", response_model=list[Program])
async def list_programs(
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ProgramDB)
    if category:
        stmt = stmt.where(ProgramDB.category == category)
    if status:
        stmt = stmt.where(ProgramDB.status == status.lower())
    result = await db.execute(stmt)
    rows = result.scalars().all()
    if search:
        q = search.lower()
        rows = [
            r
            for r in rows
            if q in r.title.lower()
            or q in r.organization.lower()
            or q in r.description.lower()
        ]
    return rows


@router.get("/{program_id}", response_model=Program)
async def get_program(program_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProgramDB).where(ProgramDB.id == program_id))
    program = result.scalars().first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return program
