import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.db_models import FormConfigDB
from backend.models.form_config import FormConfigRequest, FormConfigResponse

router = APIRouter(prefix="/api/form-configs", tags=["form-configs"])


@router.post("", response_model=FormConfigResponse)
async def create_form_config(
    config: FormConfigRequest, db: AsyncSession = Depends(get_db)
):
    row = FormConfigDB(
        id=str(uuid.uuid4()),
        project_name=config.project_name,
        table_name=config.table_name,
        fields=[f.model_dump() for f in config.fields],
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(row)
    await db.commit()
    return row


@router.get("/{project_name}/{table_name}", response_model=FormConfigResponse)
async def get_form_config(
    project_name: str, table_name: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(FormConfigDB).where(
            FormConfigDB.project_name == project_name,
            FormConfigDB.table_name == table_name,
        )
    )
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Form config not found")
    return row
