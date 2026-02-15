import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.db_models import ProgramDB, VisualizationDB
from backend.models.visualization import Visualization, VisualizationCreate

router = APIRouter(prefix="/api/programs/{program_id}/visualizations", tags=["visualizations"])


@router.get("", response_model=list[Visualization])
async def list_visualizations(program_id: str, db: AsyncSession = Depends(get_db)):
    program = await db.execute(select(ProgramDB).where(ProgramDB.id == program_id))
    if program.scalars().first() is None:
        raise HTTPException(status_code=404, detail="Program not found")

    result = await db.execute(
        select(VisualizationDB)
        .where(VisualizationDB.program_id == program_id)
        .order_by(VisualizationDB.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=Visualization, status_code=201)
async def create_visualization(
    program_id: str, payload: VisualizationCreate, db: AsyncSession = Depends(get_db)
):
    program = await db.execute(select(ProgramDB).where(ProgramDB.id == program_id))
    if program.scalars().first() is None:
        raise HTTPException(status_code=404, detail="Program not found")

    row = VisualizationDB(
        id=str(uuid.uuid4()),
        program_id=program_id,
        name=payload.name,
        description=payload.description,
        config=payload.config,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(row)
    await db.commit()
    return row


@router.get("/{visualization_id}", response_model=Visualization)
async def get_visualization(
    program_id: str, visualization_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(VisualizationDB)
        .where(VisualizationDB.program_id == program_id)
        .where(VisualizationDB.id == visualization_id)
    )
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Visualization not found")
    return row
