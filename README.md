# EcoExchange

Citizen-science data exchange platform. Next.js frontend + FastAPI backend.

## Quick Start

```bash
docker compose up --build
```

This starts three services:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000 (docs at `/docs`)
- **PostgreSQL:** localhost:5432

Tables are created and seeded with 6 programs + 6 datasets automatically on first startup. Data persists across restarts via a Docker volume (`pgdata`).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/programs` | List programs (query: `category`, `status`, `search`) |
| GET | `/api/programs/{id}` | Get single program |
| GET | `/api/datasets` | List datasets (query: `category`, `search`, `sort_by`, `sort_dir`) |
| GET | `/api/datasets/{id}` | Get single dataset |
| POST | `/api/submissions` | Submit an observation |
| POST | `/api/uploads` | Upload files for AI filtering |
| GET | `/api/categories` | List categories |
| GET | `/api/statuses` | List statuses |

## AI Upload Filter

The upload endpoint at `POST /api/uploads` accepts multipart file uploads (PDFs, images, CSVs) and runs each file through an AI filter. Currently the filter is a stub that accepts everything. Below is how to implement real filtering.

### Current behavior

Every uploaded file passes through `_ai_filter()` in `backend/routes/uploads.py`. The stub accepts all files and returns:

```json
{
  "filename": "data.csv",
  "file_type": "csv",
  "size": 1024,
  "accepted": true,
  "reason": "Passed (AI filter not yet active)",
  "ai_tags": [],
  "ai_confidence": null
}
```

### How to add real AI filtering

Edit the single function `_ai_filter()` in `backend/routes/uploads.py`. It receives three arguments:

- `file` -- the FastAPI `UploadFile` object (has `.filename`, `.content_type`)
- `file_type` -- detected type string: `"pdf"`, `"image"`, `"csv"`, or `"unknown"`
- `contents` -- the raw file bytes, already read

Replace the stub body with your AI logic. Example using the Anthropic SDK:

```python
import anthropic
import base64

client = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY env var

async def _ai_filter(file: UploadFile, file_type: str, contents: bytes) -> UploadFilterResult:
    if file_type == "image":
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=256,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": file.content_type, "data": base64.b64encode(contents).decode()}},
                    {"type": "text", "text": "Classify this image for a citizen-science dataset. Return JSON with keys: accepted (bool), reason (str), tags (list of str), confidence (float 0-1)."}
                ]
            }]
        )
        result = json.loads(response.content[0].text)
    elif file_type == "csv":
        preview = contents[:2000].decode(errors="replace")
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=256,
            messages=[{"role": "user", "content": f"Validate this CSV for ecological data quality. First 2000 chars:\n{preview}\nReturn JSON: accepted, reason, tags, confidence."}]
        )
        result = json.loads(response.content[0].text)
    elif file_type == "pdf":
        # Use base64 PDF input or extract text first
        result = {"accepted": True, "reason": "PDF received", "tags": [], "confidence": 0.5}
    else:
        result = {"accepted": False, "reason": "Unsupported file type", "tags": [], "confidence": 1.0}

    return UploadFilterResult(
        filename=file.filename or "unnamed",
        file_type=file_type,
        size=len(contents),
        accepted=result["accepted"],
        reason=result["reason"],
        ai_tags=result.get("tags", []),
        ai_confidence=result.get("confidence"),
    )
```

When adding real AI, update `backend/requirements.txt`:

```
anthropic>=0.40.0
```

And pass the API key via `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

### Pydantic models

The response schema is defined in `backend/models/upload.py`:

- `UploadFilterResult` -- per-file result with `accepted`, `reason`, `ai_tags`, `ai_confidence`
- `UploadResponse` -- summary with `total_files`, `accepted`, `rejected`, and list of results

### Frontend usage

```typescript
import { uploadFiles } from "@/lib/api/uploads"

const response = await uploadFiles(selectedFiles)
// response.results[0].accepted, .reason, .aiTags, .aiConfidence
```

## Database

PostgreSQL 16 is used for persistence via SQLAlchemy async + asyncpg.

### Architecture

```
FastAPI routes  →  SQLAlchemy async (db_models.py)  →  PostgreSQL
                   Pydantic (models/)               →  API response schemas
```

- **ORM models** (`backend/db_models.py`): `ProgramDB`, `DatasetDB`, `SubmissionDB`
- **Pydantic schemas** (`backend/models/`): used for API request/response validation (unchanged)
- **Seed data** (`backend/data/`): inserted on first startup if tables are empty
- **No Alembic** -- tables are created via `create_all` on startup

### Tables

| Table | Purpose | Rows |
|-------|---------|------|
| `programs` | Citizen-science programs | 6 (seeded) |
| `datasets` | Published datasets | 6 (seeded) |
| `submissions` | User-submitted observations | grows over time |

### Connection

Default: `postgresql+asyncpg://eco:eco@db:5432/ecoexchange` (set via `DATABASE_URL` env var).

To connect locally (e.g. with psql while Docker is running):

```bash
psql postgresql://eco:eco@localhost:5432/ecoexchange
```

### Reset the database

```bash
docker compose down -v   # deletes pgdata volume
docker compose up --build  # recreates and re-seeds
```

## Project Structure

```
backend/
  main.py              # FastAPI app, lifespan (create tables + seed), CORS
  database.py          # Async engine, session factory, get_db dependency
  db_models.py         # SQLAlchemy ORM models (ProgramDB, DatasetDB, SubmissionDB)
  seed.py              # Seeds programs + datasets on first startup
  requirements.txt     # Python dependencies
  models/              # Pydantic API schemas
  data/                # Seed data (Python dicts)
  routes/              # API route handlers
    programs.py        # GET /api/programs, GET /api/programs/{id}
    datasets.py        # GET /api/datasets, GET /api/datasets/{id}
    submissions.py     # POST /api/submissions
    uploads.py         # POST /api/uploads (AI filter)
lib/
  types.ts             # Shared TypeScript interfaces
  api/                 # Typed fetch wrappers
components/            # React components (fetch from API)
```

## Local Development

### Option A: Full Docker (everything in containers)

```bash
docker compose up --build
```

### Option B: Local Python + Dockerized Postgres (recommended for dev)

```bash
# Terminal 1 -- start Postgres
docker compose up db

# Terminal 2 -- run the backend with hot reload
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
DATABASE_URL=postgresql+asyncpg://eco:eco@localhost:5432/ecoexchange \
  uvicorn backend.main:app --reload

# Terminal 3 -- run the frontend
pnpm install
pnpm dev
```
