from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.data.datasets import datasets
from backend.data.programs import programs
from backend.db_models import DatasetDB, ProgramDB


async def seed(session: AsyncSession) -> None:
    # Seed programs
    result = await session.execute(select(ProgramDB).limit(1))
    if result.scalars().first() is None:
        for p in programs:
            session.add(ProgramDB(**p))
    else:
        # Backfill contribution_spec on existing programs
        for p in programs:
            if p.get("contribution_spec"):
                await session.execute(
                    update(ProgramDB)
                    .where(ProgramDB.id == p["id"])
                    .values(contribution_spec=p["contribution_spec"])
                )

    # Seed datasets
    result = await session.execute(select(DatasetDB).limit(1))
    if result.scalars().first() is None:
        for d in datasets:
            session.add(DatasetDB(**d))

    await session.commit()

