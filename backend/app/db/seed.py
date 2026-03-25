"""Seed the database with default data."""

import sqlite3
import uuid


DEFAULT_TICKERS = [
    "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA",
    "NVDA", "META", "JPM", "V", "NFLX",
]


def seed_default_data(conn: sqlite3.Connection) -> None:
    """Insert default user profile and watchlist tickers if not present."""
    cursor = conn.cursor()

    # Seed default user
    cursor.execute(
        "INSERT OR IGNORE INTO users_profile (id, cash_balance) VALUES (?, ?)",
        ("default", 10000.0),
    )

    # Seed default watchlist
    for ticker in DEFAULT_TICKERS:
        cursor.execute(
            "INSERT OR IGNORE INTO watchlist (id, user_id, ticker) VALUES (?, ?, ?)",
            (str(uuid.uuid4()), "default", ticker),
        )

    conn.commit()
