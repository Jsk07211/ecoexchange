import os

import re
from datetime import date, datetime

import asyncpg
from fastapi import APIRouter, HTTPException

from pydantic import BaseModel

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


def _project_dsn(project: str) -> str:
    base_dsn = _parse_conn_params()["dsn"]
    return "/".join(base_dsn.rsplit("/", 1)[:-1]) + f"/{project}"


def _validate_identifier(name: str, label: str) -> None:
    if not _IDENTIFIER_RE.match(name):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {label}: '{name}'. Use only letters, digits, and underscores.",
        )


def _serialize_row(record: asyncpg.Record) -> dict:
    """Convert an asyncpg Record to a JSON-safe dict."""
    row: dict = {}
    for key, value in record.items():
        if isinstance(value, (datetime, date)):
            row[key] = value.isoformat()
        else:
            row[key] = value
    return row


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
    project_conn = await asyncpg.connect(dsn=_project_dsn(db_name))
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


@router.get("/tables/{project}/{table}/schema")
async def get_table_schema(project: str, table: str):
    """Return column names and Postgres types for a dynamic table."""
    project = project.lower()
    table = table.lower()
    _validate_identifier(project, "project_name")
    _validate_identifier(table, "table_name")

    try:
        conn = await asyncpg.connect(dsn=_project_dsn(project))
    except asyncpg.InvalidCatalogNameError:
        raise HTTPException(404, f"Project database '{project}' not found")

    try:
        rows = await conn.fetch(
            """
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
            """,
            table,
        )
        if not rows:
            raise HTTPException(404, f"Table '{table}' not found in '{project}'")

        columns = [
            {
                "name": r["column_name"],
                "type": r["data_type"],
                "nullable": r["is_nullable"] == "YES",
            }
            for r in rows
        ]
    finally:
        await conn.close()

    return {"project": project, "table": table, "columns": columns}


@router.get("/tables/{project}/{table}/rows")
async def get_table_rows(project: str, table: str, limit: int = 100, offset: int = 0):
    """Return rows from a dynamic table."""
    project = project.lower()
    table = table.lower()
    _validate_identifier(project, "project_name")
    _validate_identifier(table, "table_name")

    try:
        conn = await asyncpg.connect(dsn=_project_dsn(project))
    except asyncpg.InvalidCatalogNameError:
        raise HTTPException(404, f"Project database '{project}' not found")

    try:
        # Verify table exists
        exists = await conn.fetchval(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_name = $1 AND table_schema = 'public'
            """,
            table,
        )
        if not exists:
            raise HTTPException(404, f"Table '{table}' not found in '{project}'")

        total = await conn.fetchval(f'SELECT COUNT(*) FROM "{table}"')
        records = await conn.fetch(
            f'SELECT * FROM "{table}" ORDER BY id LIMIT $1 OFFSET $2',
            limit,
            offset,
        )
        rows = [_serialize_row(r) for r in records]
    finally:
        await conn.close()

    return {
        "project": project,
        "table": table,
        "total": total,
        "limit": limit,
        "offset": offset,
        "rows": rows,
    }


@router.get("/tables/{project}")
async def list_project_tables(project: str):
    """List all tables in a project database."""
    project = project.lower()
    _validate_identifier(project, "project_name")

    try:
        conn = await asyncpg.connect(dsn=_project_dsn(project))
    except asyncpg.InvalidCatalogNameError:
        raise HTTPException(404, f"Project database '{project}' not found")

    try:
        rows = await conn.fetch(
            """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
        )
    finally:
        await conn.close()

    return {"project": project, "tables": [r["table_name"] for r in rows]}


class _SingleRowBody(BaseModel):
    data: dict


class _BatchRowsBody(BaseModel):
    rows: list[dict]


async def _get_table_columns(conn: asyncpg.Connection, table: str) -> set[str]:
    """Return the set of user-defined column names (excludes id and created_at)."""
    records = await conn.fetch(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        """,
        table,
    )
    return {r["column_name"] for r in records} - {"id", "created_at"}


def _coerce_row(data: dict, valid_columns: set[str], table: str) -> dict:
    """Validate column names and coerce date strings to date objects."""
    bad = set(data.keys()) - valid_columns
    if bad:
        raise HTTPException(
            400,
            f"Unknown columns for table '{table}': {', '.join(sorted(bad))}. "
            f"Valid columns: {', '.join(sorted(valid_columns))}",
        )
    row: dict = {}
    for k, v in data.items():
        if isinstance(v, str):
            # Try to coerce date-like strings
            try:
                row[k] = date.fromisoformat(v)
                continue
            except ValueError:
                pass
        row[k] = v
    return row


@router.post("/tables/{project}/{table}/rows")
async def insert_row(project: str, table: str, body: _SingleRowBody):
    """Insert a single row into a dynamic table."""
    project = project.lower()
    table = table.lower()
    _validate_identifier(project, "project_name")
    _validate_identifier(table, "table_name")

    try:
        conn = await asyncpg.connect(dsn=_project_dsn(project))
    except asyncpg.InvalidCatalogNameError:
        raise HTTPException(404, f"Project database '{project}' not found")

    try:
        valid_columns = await _get_table_columns(conn, table)
        if not valid_columns:
            raise HTTPException(404, f"Table '{table}' not found in '{project}'")

        row = _coerce_row(body.data, valid_columns, table)
        cols = list(row.keys())
        placeholders = ", ".join(f"${i+1}" for i in range(len(cols)))
        col_names = ", ".join(f'"{c}"' for c in cols)

        record = await conn.fetchrow(
            f'INSERT INTO "{table}" ({col_names}) VALUES ({placeholders}) RETURNING *',
            *row.values(),
        )
    finally:
        await conn.close()

    return {"status": "ok", "row": _serialize_row(record)}


@router.post("/tables/{project}/{table}/rows/batch")
async def insert_rows_batch(project: str, table: str, body: _BatchRowsBody):
    """Bulk insert rows into a dynamic table."""
    project = project.lower()
    table = table.lower()
    _validate_identifier(project, "project_name")
    _validate_identifier(table, "table_name")

    if not body.rows:
        raise HTTPException(400, "No rows provided")

    try:
        conn = await asyncpg.connect(dsn=_project_dsn(project))
    except asyncpg.InvalidCatalogNameError:
        raise HTTPException(404, f"Project database '{project}' not found")

    try:
        valid_columns = await _get_table_columns(conn, table)
        if not valid_columns:
            raise HTTPException(404, f"Table '{table}' not found in '{project}'")

        coerced = [_coerce_row(r, valid_columns, table) for r in body.rows]
        # Use columns from first row (all rows should have same keys)
        cols = list(coerced[0].keys())
        col_names = ", ".join(f'"{c}"' for c in cols)
        placeholders = ", ".join(f"${i+1}" for i in range(len(cols)))

        await conn.executemany(
            f'INSERT INTO "{table}" ({col_names}) VALUES ({placeholders})',
            [tuple(r[c] for c in cols) for r in coerced],
        )
    finally:
        await conn.close()

    return {"status": "ok", "count": len(coerced)}
