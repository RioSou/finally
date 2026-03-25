"""Database module — SQLite schema, initialization, and connection management."""

from .init import get_db_connection, init_db

__all__ = ["get_db_connection", "init_db"]
