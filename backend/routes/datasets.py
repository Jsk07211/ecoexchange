from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.db_models import DatasetDB
from backend.models import Dataset

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("", response_model=list[Dataset])
async def list_datasets(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: Optional[str] = "desc",
    db: AsyncSession = Depends(get_db),
):
    stmt = select(DatasetDB)
    if category:
        stmt = stmt.where(DatasetDB.category == category)

    if sort_by and sort_by in ("last_updated", "quality_score", "downloads", "records"):
        col = getattr(DatasetDB, sort_by)
        stmt = stmt.order_by(col.asc() if sort_dir == "asc" else col.desc())

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


@router.get("/{dataset_id}", response_model=Dataset)
async def get_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DatasetDB).where(DatasetDB.id == dataset_id))
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset
