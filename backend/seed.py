from datetime import date

import asyncpg
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.data.datasets import datasets
from backend.data.programs import programs
from backend.db_models import DatasetDB, ProgramDB
from backend.routes.dynamic_tables import _parse_conn_params, _project_dsn

# Sample bird sightings to seed into the urban_bird_census dynamic table
_SIGHTINGS = [
    ("American Robin", 40.7128, -74.0060, date(2026, 2, 10), 3),
    ("Red-tailed Hawk", 40.7580, -73.9855, date(2026, 2, 11), 1),
    ("House Sparrow", 40.7282, -73.7949, date(2026, 2, 12), 12),
    ("Northern Cardinal", 40.6892, -74.0445, date(2026, 2, 13), 5),
    ("Blue Jay", 40.7489, -73.9680, date(2026, 2, 14), 2),
]


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

    # Seed the dynamic sightings table for urban_bird_census
    await _seed_sightings()


async def _seed_sightings() -> None:
    db_name = "urban_bird_census"
    conn_params = _parse_conn_params()

    # Create the project database if it doesn't exist
    sys_conn = await asyncpg.connect(**conn_params)
    try:
        exists = await sys_conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", db_name
        )
        if not exists:
            await sys_conn.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        await sys_conn.close()

    # Connect to project DB and create + populate the sightings table
    project_conn = await asyncpg.connect(dsn=_project_dsn(db_name))
    try:
        await project_conn.execute("""
            CREATE TABLE IF NOT EXISTS sightings (
                id SERIAL PRIMARY KEY,
                species VARCHAR(255) NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                observed_on DATE NOT NULL,
                count INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Only insert if the table is empty
        row_count = await project_conn.fetchval("SELECT COUNT(*) FROM sightings")
        if row_count == 0:
            await project_conn.executemany(
                """
                INSERT INTO sightings (species, latitude, longitude, observed_on, count)
                VALUES ($1, $2, $3, $4, $5)
                """,
                _SIGHTINGS,
            )
    finally:
        await project_conn.close()
