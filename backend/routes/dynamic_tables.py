import os
import re

import asyncpg
from fastapi import APIRouter, HTTPException

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
