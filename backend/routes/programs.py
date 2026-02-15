from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.db_models import ProgramDB
import uuid

from backend.models import Program, ProgramCreate

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


@router.post("", response_model=Program, status_code=201)
async def create_program(data: ProgramCreate, db: AsyncSession = Depends(get_db)):
    # Build contribution_spec from the provided fields and accepted_files
    contribution_spec = None
    if data.fields or data.accepted_files:
        accepted = data.accepted_files if data.accepted_files else ["csv"]
        spec_fields = []
        for f in data.fields:
            spec_fields.append({
                "name": f.get("name", ""),
                "type": f.get("type", "STRING"),
                "required": f.get("required", False),
                "description": f.get("description", f.get("name", "")),
            })
        contribution_spec = {
            "accepted_files": accepted,
            "fields": spec_fields,
        }

    program = ProgramDB(
        id=str(uuid.uuid4()),
        title=data.title,
        organization=data.organization,
        category=data.category,
        description=data.description,
        location=data.location,
        participants=0,
        data_points=0,
        status="active",
        tags=data.tags,
        deadline=None,
        contribution_spec=contribution_spec,
        project_name=data.project_name,
        table_name=data.table_name,
        cnn_filter=data.cnn_filter,
    )
    db.add(program)
    await db.commit()
    return program


@router.get("/{program_id}", response_model=Program)
async def get_program(program_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProgramDB).where(ProgramDB.id == program_id))
    program = result.scalars().first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


@router.delete("/{program_id}", status_code=204)
async def delete_program(program_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProgramDB).where(ProgramDB.id == program_id))
    program = result.scalars().first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    await db.delete(program)
    await db.commit()
