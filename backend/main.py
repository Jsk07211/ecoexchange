from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import Base, async_session, engine
from backend.db_models import DatasetDB, ProgramDB, SubmissionDB  # noqa: F401
from backend.routes import datasets, programs, submissions, uploads
from backend.seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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


@app.get("/api/categories")
def list_categories() -> list[str]:
    return ["All", "Biodiversity", "Water Quality", "Air Quality", "Climate"]


@app.get("/api/statuses")
def list_statuses() -> list[str]:
    return ["All", "Active", "Upcoming", "Completed"]
