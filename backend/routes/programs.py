import os
import re
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.db_models import ProgramDB, SubmissionDB
import uuid

from backend.models import Program, ProgramCreate

router = APIRouter(prefix="/api/programs", tags=["programs"])

_IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
_DB_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://eco:eco@localhost:5432/ecoexchange"
)


def _project_dsn(project: str) -> str:
    raw = _DB_URL.replace("postgresql+asyncpg://", "postgresql://")
    return "/".join(raw.rsplit("/", 1)[:-1]) + f"/{project}"


async def _dynamic_table_row_count(project_name: str, table_name: str) -> int | None:
    project = project_name.lower()
    table = table_name.lower()
    if not _IDENTIFIER_RE.match(project) or not _IDENTIFIER_RE.match(table):
        return None

    try:
        conn = await asyncpg.connect(dsn=_project_dsn(project))
    except asyncpg.InvalidCatalogNameError:
        return 0

    try:
        exists = await conn.fetchval(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_name = $1 AND table_schema = 'public'
            """,
            table,
        )
        if not exists:
            return 0
        total = await conn.fetchval(f'SELECT COUNT(*) FROM "{table}"')
        return int(total or 0)
    finally:
        await conn.close()


async def _submission_count(program_id: str, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(SubmissionDB)
        .where(SubmissionDB.selected_program == program_id)
    )
    return int(result.scalar() or 0)


async def _program_with_live_metrics(program: ProgramDB, db: AsyncSession) -> Program:
    participants = program.participants
    data_points = program.data_points

    if program.project_name and program.table_name:
        table_count = await _dynamic_table_row_count(program.project_name, program.table_name)
        if table_count is not None:
            data_points = table_count
            if table_count > 0 and participants == 0:
                # Backfill for programs that were populated before write-counter logic existed.
                participants = 1
    else:
        submission_count = await _submission_count(program.id, db)
        if submission_count > data_points:
            data_points = submission_count

    return Program(
        id=program.id,
        title=program.title,
        organization=program.organization,
        category=program.category,
        description=program.description,
        location=program.location,
        participants=participants,
        data_points=data_points,
        status=program.status,
        tags=program.tags,
        deadline=program.deadline,
        contribution_spec=program.contribution_spec,
        project_name=program.project_name,
        table_name=program.table_name,
        cnn_filter=program.cnn_filter,
        table_cnn=program.table_cnn,
    )


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
    return [await _program_with_live_metrics(r, db) for r in rows]


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
        table_cnn=data.table_cnn,
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
    return await _program_with_live_metrics(program, db)


@router.delete("/{program_id}", status_code=204)
async def delete_program(program_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProgramDB).where(ProgramDB.id == program_id))
    program = result.scalars().first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    await db.delete(program)
    await db.commit()
