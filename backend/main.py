from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes import programs, datasets, submissions, uploads

app = FastAPI(title="EcoExchange API")

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
