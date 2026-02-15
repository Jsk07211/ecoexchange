import os
from contextlib import asynccontextmanager

import sqlalchemy
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database import Base, async_session, engine
from backend.db_models import DatasetDB, FormConfigDB, ProgramDB, SubmissionDB  # noqa: F401
from backend.routes import datasets, dynamic_tables, form_configs, programs, submissions, uploads
from backend.seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add contribution_spec column if missing (no Alembic migrations)
        await conn.execute(
            sqlalchemy.text(
                "ALTER TABLE programs ADD COLUMN IF NOT EXISTS contribution_spec JSONB"
            )
        )
        await conn.execute(
            sqlalchemy.text(
                "ALTER TABLE programs ADD COLUMN IF NOT EXISTS project_name VARCHAR"
            )
        )
        await conn.execute(
            sqlalchemy.text(
                "ALTER TABLE programs ADD COLUMN IF NOT EXISTS table_name VARCHAR"
            )
        )
        await conn.execute(
            sqlalchemy.text(
                "ALTER TABLE programs ADD COLUMN IF NOT EXISTS cnn_filter VARCHAR"
            )
        )
    async with async_session() as session:
        await seed(session)
    yield
    await engine.dispose()


app = FastAPI(title="EcoExchange API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(programs.router)
app.include_router(datasets.router)
app.include_router(submissions.router)
app.include_router(uploads.router)
app.include_router(dynamic_tables.router)
app.include_router(form_configs.router)


os.makedirs("/app/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")


@app.get("/api/categories")
def list_categories() -> list[str]:
    return ["All", "Biodiversity", "Water Quality", "Air Quality", "Climate"]


@app.get("/api/statuses")
def list_statuses() -> list[str]:
    return ["All", "Active", "Upcoming", "Completed"]
