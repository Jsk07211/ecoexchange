from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.data.datasets import datasets
from backend.data.programs import programs
from backend.db_models import DatasetDB, ProgramDB


async def seed(session: AsyncSession) -> None:
    result = await session.execute(select(ProgramDB).limit(1))
    if result.scalars().first() is None:
        for p in programs:
            session.add(ProgramDB(**p))

    result = await session.execute(select(DatasetDB).limit(1))
    if result.scalars().first() is None:
        for d in datasets:
            session.add(DatasetDB(**d))

    await session.commit()
