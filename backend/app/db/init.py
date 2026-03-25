"""Lazy database initialization."""

import os
import sqlite3
from pathlib import Path

from .seed import seed_default_data

DB_PATH = os.environ.get("DB_PATH", "/app/db/finally.db")

_SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def _tables_exist(conn: sqlite3.Connection) -> bool:
    """Check whether the schema tables already exist."""
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users_profile'"
    )
    return cursor.fetchone() is not None


def init_db() -> None:
    """Create schema and seed data if the database is empty."""
    # Ensure the directory for the DB file exists
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    try:
        if not _tables_exist(conn):
            schema_sql = _SCHEMA_PATH.read_text()
            conn.executescript(schema_sql)
            seed_default_data(conn)
    finally:
        conn.close()


def get_db_connection() -> sqlite3.Connection:
    """Return a new SQLite connection with row factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn
