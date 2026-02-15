# EcoExchange

Citizen-science data exchange platform. Next.js frontend + FastAPI backend with CNN image classification.

## Quick Start

```bash
docker compose up --build
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000 (docs at `/docs`)
- **PostgreSQL:** localhost:5432

Data persists via Docker volumes (`pgdata`, `uploads`).

## Features

- **Program Management** — Create, browse, and filter citizen-science programs
- **Dynamic Tables** — Define custom data schemas per program with multiple tables
- **CNN Image Classification** — MobileNetV2-based validation of uploaded images (e.g. bird detection). Configurable per-table.
- **Image Quality Scanning** — Checks blur, contrast, and resolution before accepting uploads
- **Batch Upload** — CSV + images, images only, or CSV only with smart file matching
- **Single Entry Forms** — Auto-generated from table schema with image preview and live verification

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI |
| Backend | FastAPI, SQLAlchemy async, asyncpg |
| Database | PostgreSQL 16 |
| ML | PyTorch, TorchVision (MobileNetV2) |
| Infra | Docker, Docker Compose |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/programs` | List programs (`category`, `status`, `search`) |
| GET | `/api/programs/{id}` | Get single program |
| POST | `/api/programs` | Create program with tables, fields, CNN filters |
| DELETE | `/api/programs/{id}` | Delete program |
| POST | `/api/uploads` | Upload files with quality + CNN verification |
| POST | `/api/tables/{project}/{table}` | Create dynamic table |
| GET | `/api/tables/{project}` | List project tables |
| GET | `/api/tables/{project}/{table}/schema` | Get table schema |
| POST | `/api/tables/{project}/{table}/rows` | Insert row |
| POST | `/api/tables/{project}/{table}/rows/batch` | Batch insert rows |
| GET | `/api/tables/{project}/{table}/rows` | Query rows |
| GET | `/api/datasets` | List datasets |
| POST | `/api/submissions` | Submit observation |

## Project Structure

```
backend/
  main.py              # FastAPI app, CORS, lifespan, migrations
  database.py          # Async engine + session
  db_models.py         # SQLAlchemy ORM models
  classify_image.py    # MobileNetV2 CNN classifier
  qualify_image.py     # Image quality checks
  seed.py              # Seed data on first startup
  models/              # Pydantic schemas
  routes/              # API route handlers
    programs.py        # Program CRUD
    uploads.py         # File upload + AI filter
    dynamic_tables.py  # Dynamic table management
    datasets.py        # Dataset endpoints
    submissions.py     # Submission endpoint
    form_configs.py    # Form config management
app/                   # Next.js pages
  programs/[id]/contribute/  # Data contribution UI
  create/              # Program creation wizard
  projects/[project]/[table]/  # Table data viewer
lib/
  types.ts             # Shared TypeScript types
  api/                 # Typed API clients
components/            # React UI components
```

## Database

Default connection: `postgresql+asyncpg://eco:eco@db:5432/ecoexchange`

Connect locally while Docker is running:

```bash
psql postgresql://eco:eco@localhost:5432/ecoexchange
```

Reset everything:

```bash
docker compose down -v && docker compose up --build
```
