import os
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.db_models import ProgramDB
import uuid

from backend.models import Program, ProgramCreate

_DB_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://eco:eco@localhost:5432/ecoexchange"
)


def _parse_dsn() -> str:
    return _DB_URL.replace("postgresql+asyncpg://", "postgresql://")


def _project_dsn(project: str) -> str:
    base = _parse_dsn()
    return "/".join(base.rsplit("/", 1)[:-1]) + f"/{project}"

router = APIRouter(prefix="/api/programs", tags=["programs"])


async def _get_live_counts(project_name: str) -> tuple[int, int]:
    """Return (total_rows, distinct_upload_days) across all tables in a project database."""
    if not project_name:
        return 0, 0
    try:
        conn = await asyncpg.connect(dsn=_project_dsn(project_name.lower()))
    except Exception:
        return 0, 0
    try:
        tables = await conn.fetch(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
        )
        total_rows = 0
        all_dates: set = set()
        for t in tables:
            tname = t["table_name"]
            count = await conn.fetchval(f'SELECT COUNT(*) FROM "{tname}"')
            total_rows += count or 0
            # Count distinct upload dates from created_at
            try:
                dates = await conn.fetch(
                    f'SELECT DISTINCT created_at::date AS d FROM "{tname}" WHERE created_at IS NOT NULL'
                )
                for row in dates:
                    all_dates.add(row["d"])
            except Exception:
                pass
        return total_rows, len(all_dates)
    except Exception:
        return 0, 0
    finally:
        await conn.close()


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

    # Populate live counts
    for row in rows:
        data_points, participants = await _get_live_counts(row.project_name)
        row.data_points = data_points
        row.participants = participants

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
    data_points, participants = await _get_live_counts(program.project_name)
    program.data_points = data_points
    program.participants = participants
    return program


@router.delete("/{program_id}", status_code=204)
async def delete_program(program_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProgramDB).where(ProgramDB.id == program_id))
    program = result.scalars().first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    # Clean up the project's dynamic database if it exists
    project_name = (program.project_name or "").lower()
    if project_name:
        sys_conn = await asyncpg.connect(dsn=_parse_dsn())
        try:
            exists = await sys_conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1", project_name
            )
            if exists:
                # Terminate active connections before dropping
                await sys_conn.execute(
                    "SELECT pg_terminate_backend(pid) "
                    "FROM pg_stat_activity "
                    "WHERE datname = $1 AND pid <> pg_backend_pid()",
                    project_name,
                )
                await sys_conn.execute(f'DROP DATABASE "{project_name}"')
        except Exception:
            pass  # Best-effort cleanup — don't block program deletion
        finally:
            await sys_conn.close()

    await db.delete(program)
    await db.commit()
