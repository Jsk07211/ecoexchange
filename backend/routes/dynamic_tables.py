import os
import re
import uuid
from datetime import date, timezone, datetime

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.db_models import DatasetDB, ProgramDB
from backend.models.dynamic_table import DynamicTableRequest

router = APIRouter(prefix="/api", tags=["dynamic-tables"])

_IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

# Base connection params derived from DATABASE_URL env var
_DB_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://eco:eco@localhost:5432/ecoexchange"
)


def _parse_conn_params() -> dict:
    """Extract host, port, user, password from the SQLAlchemy DATABASE_URL."""
    # Strip the sqlalchemy driver prefix to get a plain postgres URL
    raw = _DB_URL.replace("postgresql+asyncpg://", "postgresql://")
    # asyncpg can parse standard postgres:// URIs
    return {"dsn": raw}


def _validate_identifier(name: str, label: str) -> None:
    if not _IDENTIFIER_RE.match(name):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {label}: '{name}'. Use only letters, digits, and underscores.",
        )


@router.post("/tables")
async def create_dynamic_table(req: DynamicTableRequest):
    db_name = req.project_name.lower()
    table_name = req.table_name.lower()

    _validate_identifier(db_name, "project_name")
    _validate_identifier(table_name, "table_name")
    for field in req.fields:
        _validate_identifier(field.name, "field name")

    conn_params = _parse_conn_params()

    # --- 1. Create the project database if it doesn't exist -----------------
    sys_conn = await asyncpg.connect(**conn_params)
    try:
        exists = await sys_conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", db_name
        )
        if not exists:
            # CREATE DATABASE cannot run inside a transaction
            await sys_conn.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        await sys_conn.close()

    # --- 2. Connect to the new database and create the table ----------------
    # Build a DSN pointing at the newly created database
    base_dsn = conn_params["dsn"]
    # Replace the database portion in the DSN
    project_dsn = "/".join(base_dsn.rsplit("/", 1)[:-1]) + f"/{db_name}"

    project_conn = await asyncpg.connect(dsn=project_dsn)
    try:
        column_defs = ["id SERIAL PRIMARY KEY"]
        for field in req.fields:
            column_defs.append(f'"{field.name}" {field.type.sql_type}')
        column_defs.append("created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

        create_sql = (
            f'CREATE TABLE IF NOT EXISTS "{table_name}" ({", ".join(column_defs)})'
        )
        await project_conn.execute(create_sql)
    finally:
        await project_conn.close()

    columns = (
        ["id (SERIAL PRIMARY KEY)"]
        + [f"{f.name} ({f.type.sql_type})" for f in req.fields]
        + ["created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"]
    )

    return {
        "status": "ok",
        "database": db_name,
        "table": table_name,
        "columns": columns,
    }


@router.post("/tables/{project_name}/{table_name}/rows")
async def insert_row(
    project_name: str,
    table_name: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    db_name = project_name.lower()
    tbl = table_name.lower()

    _validate_identifier(db_name, "project_name")
    _validate_identifier(tbl, "table_name")
    for key in data:
        _validate_identifier(key, "field name")

    conn_params = _parse_conn_params()
    base_dsn = conn_params["dsn"]
    project_dsn = "/".join(base_dsn.rsplit("/", 1)[:-1]) + f"/{db_name}"

    # Insert the row into the dynamic table
    project_conn = await asyncpg.connect(dsn=project_dsn)
    try:
        # Query column types so we can cast string values from the form
        col_types = {}
        rows = await project_conn.fetch(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_name = $1",
            tbl,
        )
        for r in rows:
            col_types[r["column_name"]] = r["data_type"]

        # Cast values to match column types
        cast_values = []
        for k, v in data.items():
            dt = col_types.get(k, "character varying")
            if v == "" or v is None:
                cast_values.append(None)
            elif dt == "integer":
                cast_values.append(int(v))
            elif dt == "double precision":
                cast_values.append(float(v))
            elif dt == "boolean":
                cast_values.append(str(v).lower() in ("true", "1", "yes"))
            elif dt == "date":
                cast_values.append(date.fromisoformat(str(v)))
            else:
                cast_values.append(str(v))

        columns = ", ".join(f'"{k}"' for k in data)
        placeholders = ", ".join(f"${i+1}" for i in range(len(data)))
        sql = f'INSERT INTO "{tbl}" ({columns}) VALUES ({placeholders}) RETURNING id'
        row_id = await project_conn.fetchval(sql, *cast_values)
    finally:
        await project_conn.close()

    # Count total rows in the dynamic table
    project_conn = await asyncpg.connect(dsn=project_dsn)
    try:
        total = await project_conn.fetchval(f'SELECT COUNT(*) FROM "{tbl}"')
    finally:
        await project_conn.close()

    # Find the program that owns this table
    result = await db.execute(
        select(ProgramDB).where(
            ProgramDB.project_name == project_name,
            ProgramDB.table_name == table_name,
        )
    )
    program = result.scalars().first()

    # Upsert a DatasetDB row so the dataset page shows this data
    if program:
        result = await db.execute(
            select(DatasetDB).where(DatasetDB.id == f"ds-{program.id}")
        )
        existing = result.scalars().first()
        today = date.today().isoformat()

        # Quality score: percentage of non-empty fields in this submission
        filled = sum(1 for v in data.values() if str(v).strip())
        score = round(filled / max(len(data), 1) * 100)

        if existing:
            existing.records = total
            existing.last_updated = today
            # Running average of quality scores
            existing.quality_score = round(
                (existing.quality_score * (total - 1) + score) / total
            )
        else:
            ds = DatasetDB(
                id=f"ds-{program.id}",
                title=f"{program.title} Dataset",
                program=program.title,
                organization=program.organization,
                category=program.category,
                records=total,
                format="Dynamic Table",
                license="CC BY 4.0",
                last_updated=today,
                quality_score=score,
                downloads=0,
                description=program.description or f"Data collected for {program.title}",
                tags=program.tags or [],
            )
            db.add(ds)

        # Also update the program's data_points count
        program.data_points = total
        await db.commit()

    return {"status": "ok", "id": row_id, "total_records": total}
