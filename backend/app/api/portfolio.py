"""Portfolio API endpoints — positions, trades, portfolio history."""

import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.db import get_db_connection

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

USER_ID = "default"


class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: str  # "buy" or "sell"


@router.get("")
async def get_portfolio(request: Request):
    """Current positions, cash balance, total value, unrealized P&L."""
    price_cache = request.app.state.price_cache
    conn = get_db_connection()
    try:
        # Cash balance
        row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id = ?", (USER_ID,)
        ).fetchone()
        cash_balance = row["cash_balance"] if row else 10000.0

        # Positions with live prices
        rows = conn.execute(
            "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = ? AND quantity > 0",
            (USER_ID,),
        ).fetchall()

        positions = []
        total_position_value = 0.0
        total_unrealized_pnl = 0.0

        for r in rows:
            current_price = price_cache.get_price(r["ticker"]) or r["avg_cost"]
            market_value = r["quantity"] * current_price
            cost_basis = r["quantity"] * r["avg_cost"]
            unrealized_pnl = market_value - cost_basis
            pnl_pct = (unrealized_pnl / cost_basis * 100) if cost_basis != 0 else 0.0

            positions.append({
                "ticker": r["ticker"],
                "quantity": r["quantity"],
                "avg_cost": round(r["avg_cost"], 2),
                "current_price": round(current_price, 2),
                "unrealized_pnl": round(unrealized_pnl, 2),
                "pnl_pct": round(pnl_pct, 2),
            })
            total_position_value += market_value
            total_unrealized_pnl += unrealized_pnl

        total_value = cash_balance + total_position_value

        return {
            "cash_balance": round(cash_balance, 2),
            "positions": positions,
            "total_value": round(total_value, 2),
            "unrealized_pnl": round(total_unrealized_pnl, 2),
        }
    finally:
        conn.close()


@router.post("/trade")
async def execute_trade(trade: TradeRequest, request: Request):
    """Execute a market order at current price."""
    price_cache = request.app.state.price_cache

    if trade.side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="side must be 'buy' or 'sell'")
    if trade.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")

    current_price = price_cache.get_price(trade.ticker)
    if current_price is None:
        raise HTTPException(status_code=400, detail=f"No price available for {trade.ticker}")

    conn = get_db_connection()
    try:
        # Get current cash balance
        row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id = ?", (USER_ID,)
        ).fetchone()
        cash_balance = row["cash_balance"] if row else 10000.0

        if trade.side == "buy":
            total_cost = trade.quantity * current_price
            if total_cost > cash_balance:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient cash. Need ${total_cost:.2f}, have ${cash_balance:.2f}",
                )

            # Update cash
            new_cash = cash_balance - total_cost
            conn.execute(
                "UPDATE users_profile SET cash_balance = ? WHERE id = ?",
                (new_cash, USER_ID),
            )

            # Upsert position
            existing = conn.execute(
                "SELECT quantity, avg_cost FROM positions WHERE user_id = ? AND ticker = ?",
                (USER_ID, trade.ticker),
            ).fetchone()

            if existing:
                new_qty = existing["quantity"] + trade.quantity
                new_avg = (
                    (existing["quantity"] * existing["avg_cost"] + trade.quantity * current_price)
                    / new_qty
                )
                conn.execute(
                    "UPDATE positions SET quantity = ?, avg_cost = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND ticker = ?",
                    (new_qty, new_avg, USER_ID, trade.ticker),
                )
            else:
                conn.execute(
                    "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost) VALUES (?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), USER_ID, trade.ticker, trade.quantity, current_price),
                )

        else:  # sell
            existing = conn.execute(
                "SELECT quantity, avg_cost FROM positions WHERE user_id = ? AND ticker = ?",
                (USER_ID, trade.ticker),
            ).fetchone()

            if not existing or existing["quantity"] < trade.quantity:
                owned = existing["quantity"] if existing else 0
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient shares. Own {owned}, trying to sell {trade.quantity}",
                )

            # Update cash
            proceeds = trade.quantity * current_price
            new_cash = cash_balance + proceeds
            conn.execute(
                "UPDATE users_profile SET cash_balance = ? WHERE id = ?",
                (new_cash, USER_ID),
            )

            # Update position
            new_qty = existing["quantity"] - trade.quantity
            if new_qty > 0:
                conn.execute(
                    "UPDATE positions SET quantity = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND ticker = ?",
                    (new_qty, USER_ID, trade.ticker),
                )
            else:
                conn.execute(
                    "DELETE FROM positions WHERE user_id = ? AND ticker = ?",
                    (USER_ID, trade.ticker),
                )

        # Record trade
        conn.execute(
            "INSERT INTO trades (id, user_id, ticker, side, quantity, price) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), USER_ID, trade.ticker, trade.side, trade.quantity, current_price),
        )

        # Record portfolio snapshot
        record_snapshot(conn, price_cache)

        conn.commit()

        return {
            "success": True,
            "trade": {
                "ticker": trade.ticker,
                "side": trade.side,
                "quantity": trade.quantity,
                "price": round(current_price, 2),
            },
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.get("/history")
async def get_portfolio_history():
    """Portfolio value snapshots over time (for P&L chart)."""
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT total_value, recorded_at FROM portfolio_snapshots WHERE user_id = ? ORDER BY recorded_at",
            (USER_ID,),
        ).fetchall()
        return [{"total_value": r["total_value"], "recorded_at": r["recorded_at"]} for r in rows]
    finally:
        conn.close()


def record_snapshot(conn, price_cache):
    """Record a portfolio value snapshot. Called after trades and periodically."""
    row = conn.execute(
        "SELECT cash_balance FROM users_profile WHERE id = ?", (USER_ID,)
    ).fetchone()
    cash = row["cash_balance"] if row else 10000.0

    positions = conn.execute(
        "SELECT ticker, quantity FROM positions WHERE user_id = ? AND quantity > 0",
        (USER_ID,),
    ).fetchall()

    total_value = cash
    for p in positions:
        price = price_cache.get_price(p["ticker"])
        if price:
            total_value += p["quantity"] * price

    conn.execute(
        "INSERT INTO portfolio_snapshots (id, user_id, total_value) VALUES (?, ?, ?)",
        (str(uuid.uuid4()), USER_ID, round(total_value, 2)),
    )
