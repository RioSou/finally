"""FastAPI application entry point for FinAlly."""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from app.api.chat import router as chat_router
from app.api.portfolio import record_snapshot
from app.api.portfolio import router as portfolio_router
from app.api.watchlist import router as watchlist_router
from app.db import get_db_connection, init_db
from app.db.seed import seed_default_data
from app.market import PriceCache, create_market_data_source, create_stream_router

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]

# Module-level price cache so the stream router can reference it at import time
price_cache = PriceCache()


async def _snapshot_loop(price_cache: PriceCache, interval: float = 30.0):
    """Background task: record portfolio value snapshot every `interval` seconds."""
    while True:
        await asyncio.sleep(interval)
        try:
            conn = get_db_connection()
            record_snapshot(conn, price_cache)
            conn.commit()
            conn.close()
        except Exception:
            logger.exception("Failed to record portfolio snapshot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB, start market data. Shutdown: stop market data."""
    logger.info("Initializing database...")
    init_db()

    market_source = create_market_data_source(price_cache)

    # Load watchlist tickers from DB (fall back to defaults)
    tickers = DEFAULT_TICKERS
    try:
        conn = get_db_connection()
        rows = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id = ?", ("default",)
        ).fetchall()
        conn.close()
        if rows:
            tickers = [row["ticker"] for row in rows]
    except Exception:
        logger.warning("Could not load watchlist from DB, using defaults")

    await market_source.start(tickers)
    logger.info("Market data source started with %d tickers", len(tickers))

    app.state.price_cache = price_cache
    app.state.market_source = market_source

    # Start background snapshot task
    snapshot_task = asyncio.create_task(_snapshot_loop(price_cache))

    yield

    # Shutdown
    snapshot_task.cancel()
    try:
        await snapshot_task
    except asyncio.CancelledError:
        pass
    logger.info("Shutting down market data source...")
    await market_source.stop()


app = FastAPI(title="FinAlly", version="0.1.0", lifespan=lifespan)

# Routers
app.include_router(create_stream_router(price_cache))
app.include_router(portfolio_router)
app.include_router(watchlist_router)
app.include_router(chat_router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/api/test/reset")
async def test_reset():
    """Reset DB to seed state. Only available in LLM_MOCK=true mode."""
    if os.environ.get("LLM_MOCK", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="Only available in test mode")
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM trades")
        conn.execute("DELETE FROM positions")
        conn.execute("DELETE FROM portfolio_snapshots")
        conn.execute("DELETE FROM chat_messages")
        conn.execute("DELETE FROM watchlist")
        conn.execute("DELETE FROM users_profile")
        seed_default_data(conn)
        conn.commit()
    finally:
        conn.close()
    return {"status": "reset"}


# Mount static files last (catch-all for Next.js export)
_static_dir = Path("/app/static")
if _static_dir.exists():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
