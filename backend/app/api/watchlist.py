"""Watchlist API endpoints — add, remove, list tickers."""

import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.db import get_db_connection

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

USER_ID = "default"


class AddTickerRequest(BaseModel):
    ticker: str


@router.get("")
async def get_watchlist(request: Request):
    """Current watchlist tickers with latest prices."""
    price_cache = request.app.state.price_cache
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY added_at",
            (USER_ID,),
        ).fetchall()

        result = []
        for r in rows:
            ticker = r["ticker"]
            update = price_cache.get(ticker)
            if update:
                result.append({
                    "ticker": ticker,
                    "price": update.price,
                    "previous_price": update.previous_price,
                    "change_pct": update.change_percent,
                })
            else:
                result.append({
                    "ticker": ticker,
                    "price": None,
                    "previous_price": None,
                    "change_pct": None,
                })
        return result
    finally:
        conn.close()


@router.post("")
async def add_ticker(body: AddTickerRequest, request: Request):
    """Add a ticker to the watchlist."""
    ticker = body.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")

    market_source = request.app.state.market_source
    conn = get_db_connection()
    try:
        # Check if already in watchlist
        existing = conn.execute(
            "SELECT id FROM watchlist WHERE user_id = ? AND ticker = ?",
            (USER_ID, ticker),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail=f"{ticker} is already in watchlist")

        # Add to DB
        conn.execute(
            "INSERT INTO watchlist (id, user_id, ticker) VALUES (?, ?, ?)",
            (str(uuid.uuid4()), USER_ID, ticker),
        )
        conn.commit()

        # Start tracking price
        await market_source.add_ticker(ticker)

        # Return updated watchlist
        return await get_watchlist(request)
    except HTTPException:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.delete("/{ticker}")
async def remove_ticker(ticker: str, request: Request):
    """Remove a ticker from the watchlist."""
    ticker = ticker.upper().strip()
    market_source = request.app.state.market_source
    conn = get_db_connection()
    try:
        result = conn.execute(
            "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
            (USER_ID, ticker),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"{ticker} not in watchlist")
        conn.commit()

        # Stop tracking price
        await market_source.remove_ticker(ticker)

        return {"success": True, "removed": ticker}
    except HTTPException:
        conn.rollback()
        raise
    finally:
        conn.close()
