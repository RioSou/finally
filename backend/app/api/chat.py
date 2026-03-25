"""AI chat endpoint — LLM integration via LiteLLM/OpenRouter with Cerebras."""

import json
import os
import uuid

from fastapi import APIRouter, Request
from litellm import completion
from pydantic import BaseModel, Field

from app.db import get_db_connection

router = APIRouter(prefix="/api/chat", tags=["chat"])

USER_ID = "default"
MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You are FinAlly, an AI trading assistant for a simulated trading workstation.

You have access to the user's portfolio and watchlist. You can:
- Analyze portfolio composition, risk concentration, and P&L
- Suggest trades with reasoning
- Execute trades when the user asks or agrees
- Manage the watchlist (add/remove tickers)

Rules:
- Be concise and data-driven
- When suggesting trades, include your reasoning
- When the user asks you to buy/sell, include the trade in your response
- When adding/removing watchlist tickers, include the change in your response
- Always respond with valid structured JSON matching the required schema

Current portfolio context:
{context}"""


class LlmTrade(BaseModel):
    ticker: str
    side: str
    quantity: float


class LlmWatchlistChange(BaseModel):
    ticker: str
    action: str


class LlmResponse(BaseModel):
    """Structured output schema for the LLM."""
    message: str
    trades: list[LlmTrade] = Field(default_factory=list)
    watchlist_changes: list[LlmWatchlistChange] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str


def _build_portfolio_context(price_cache) -> str:
    """Build a text summary of the user's portfolio for the LLM system prompt."""
    conn = get_db_connection()
    try:
        # Cash
        row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id = ?", (USER_ID,)
        ).fetchone()
        cash = row["cash_balance"] if row else 10000.0

        # Positions
        positions = conn.execute(
            "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = ? AND quantity > 0",
            (USER_ID,),
        ).fetchall()

        pos_lines = []
        total_value = cash
        for p in positions:
            current_price = price_cache.get_price(p["ticker"]) or p["avg_cost"]
            market_val = p["quantity"] * current_price
            pnl = market_val - (p["quantity"] * p["avg_cost"])
            total_value += market_val
            pos_lines.append(
                f"  {p['ticker']}: {p['quantity']} shares, avg cost ${p['avg_cost']:.2f}, "
                f"current ${current_price:.2f}, P&L ${pnl:.2f}"
            )

        # Watchlist with prices
        watchlist = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY added_at",
            (USER_ID,),
        ).fetchall()
        wl_lines = []
        for w in watchlist:
            price = price_cache.get_price(w["ticker"])
            if price:
                wl_lines.append(f"  {w['ticker']}: ${price:.2f}")
            else:
                wl_lines.append(f"  {w['ticker']}: no price")

        parts = [
            f"Cash: ${cash:.2f}",
            f"Total Portfolio Value: ${total_value:.2f}",
        ]
        if pos_lines:
            parts.append("Positions:\n" + "\n".join(pos_lines))
        else:
            parts.append("Positions: none")
        parts.append("Watchlist:\n" + "\n".join(wl_lines))

        return "\n".join(parts)
    finally:
        conn.close()


def _load_chat_history() -> list[dict]:
    """Load last 20 messages from chat_messages table."""
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
            (USER_ID,),
        ).fetchall()
        # Reverse so oldest first
        messages = [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
        return messages
    finally:
        conn.close()


def _mock_response(user_message: str) -> LlmResponse:
    """Return a deterministic mock response for testing."""
    msg_lower = user_message.lower()

    if "buy" in msg_lower:
        return LlmResponse(
            message="I've executed a buy order for 10 shares of AAPL.",
            trades=[LlmTrade(ticker="AAPL", side="buy", quantity=10)],
        )
    elif "sell" in msg_lower:
        return LlmResponse(
            message="I've executed a sell order for 5 shares of AAPL.",
            trades=[LlmTrade(ticker="AAPL", side="sell", quantity=5)],
        )
    elif "add" in msg_lower:
        return LlmResponse(
            message="I've added PYPL to your watchlist.",
            watchlist_changes=[LlmWatchlistChange(ticker="PYPL", action="add")],
        )
    elif "remove" in msg_lower:
        return LlmResponse(
            message="I've removed NFLX from your watchlist.",
            watchlist_changes=[LlmWatchlistChange(ticker="NFLX", action="remove")],
        )
    else:
        return LlmResponse(
            message="Your portfolio is looking good! You have a diversified mix of tech stocks. "
            "Would you like me to analyze any specific positions or make any trades?",
        )


def _execute_trade(ticker: str, side: str, quantity: float, price_cache) -> dict:
    """Execute a single trade. Returns result dict with success/error."""
    current_price = price_cache.get_price(ticker)
    if current_price is None:
        return {"ticker": ticker, "side": side, "quantity": quantity, "error": f"No price for {ticker}"}

    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id = ?", (USER_ID,)
        ).fetchone()
        cash = row["cash_balance"] if row else 10000.0

        if side == "buy":
            cost = quantity * current_price
            if cost > cash:
                return {
                    "ticker": ticker, "side": side, "quantity": quantity,
                    "error": f"Insufficient cash. Need ${cost:.2f}, have ${cash:.2f}",
                }
            conn.execute(
                "UPDATE users_profile SET cash_balance = ? WHERE id = ?",
                (cash - cost, USER_ID),
            )
            existing = conn.execute(
                "SELECT quantity, avg_cost FROM positions WHERE user_id = ? AND ticker = ?",
                (USER_ID, ticker),
            ).fetchone()
            if existing:
                new_qty = existing["quantity"] + quantity
                new_avg = (existing["quantity"] * existing["avg_cost"] + quantity * current_price) / new_qty
                conn.execute(
                    "UPDATE positions SET quantity = ?, avg_cost = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND ticker = ?",
                    (new_qty, new_avg, USER_ID, ticker),
                )
            else:
                conn.execute(
                    "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost) VALUES (?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), USER_ID, ticker, quantity, current_price),
                )

        elif side == "sell":
            existing = conn.execute(
                "SELECT quantity, avg_cost FROM positions WHERE user_id = ? AND ticker = ?",
                (USER_ID, ticker),
            ).fetchone()
            if not existing or existing["quantity"] < quantity:
                owned = existing["quantity"] if existing else 0
                return {
                    "ticker": ticker, "side": side, "quantity": quantity,
                    "error": f"Insufficient shares. Own {owned}, trying to sell {quantity}",
                }
            proceeds = quantity * current_price
            conn.execute(
                "UPDATE users_profile SET cash_balance = ? WHERE id = ?",
                (cash + proceeds, USER_ID),
            )
            new_qty = existing["quantity"] - quantity
            if new_qty > 0:
                conn.execute(
                    "UPDATE positions SET quantity = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND ticker = ?",
                    (new_qty, USER_ID, ticker),
                )
            else:
                conn.execute(
                    "DELETE FROM positions WHERE user_id = ? AND ticker = ?",
                    (USER_ID, ticker),
                )
        else:
            return {"ticker": ticker, "side": side, "quantity": quantity, "error": f"Invalid side: {side}"}

        # Record trade log
        conn.execute(
            "INSERT INTO trades (id, user_id, ticker, side, quantity, price) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), USER_ID, ticker, side, quantity, current_price),
        )
        conn.commit()
        return {"ticker": ticker, "side": side, "quantity": quantity, "price": round(current_price, 2)}
    except Exception as e:
        conn.rollback()
        return {"ticker": ticker, "side": side, "quantity": quantity, "error": str(e)}
    finally:
        conn.close()


async def _apply_watchlist_change(ticker: str, action: str, request: Request) -> dict:
    """Apply a single watchlist change. Returns result dict."""
    ticker = ticker.upper().strip()
    market_source = request.app.state.market_source
    conn = get_db_connection()
    try:
        if action == "add":
            existing = conn.execute(
                "SELECT id FROM watchlist WHERE user_id = ? AND ticker = ?",
                (USER_ID, ticker),
            ).fetchone()
            if existing:
                return {"ticker": ticker, "action": action, "error": f"{ticker} already in watchlist"}
            conn.execute(
                "INSERT INTO watchlist (id, user_id, ticker) VALUES (?, ?, ?)",
                (str(uuid.uuid4()), USER_ID, ticker),
            )
            conn.commit()
            await market_source.add_ticker(ticker)
            return {"ticker": ticker, "action": "add"}

        elif action == "remove":
            result = conn.execute(
                "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
                (USER_ID, ticker),
            )
            if result.rowcount == 0:
                return {"ticker": ticker, "action": action, "error": f"{ticker} not in watchlist"}
            conn.commit()
            await market_source.remove_ticker(ticker)
            return {"ticker": ticker, "action": "remove"}

        else:
            return {"ticker": ticker, "action": action, "error": f"Invalid action: {action}"}
    except Exception as e:
        conn.rollback()
        return {"ticker": ticker, "action": action, "error": str(e)}
    finally:
        conn.close()


def _store_message(role: str, content: str, actions: dict | None = None):
    """Store a chat message in the database."""
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO chat_messages (id, user_id, role, content, actions) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), USER_ID, role, content, json.dumps(actions) if actions else None),
        )
        conn.commit()
    finally:
        conn.close()


@router.post("")
async def chat(body: ChatRequest, request: Request):
    """Send a message and receive AI response with auto-executed actions."""
    price_cache = request.app.state.price_cache

    # Store user message
    _store_message("user", body.message)

    # Check for mock mode
    if os.environ.get("LLM_MOCK", "").lower() == "true":
        llm_result = _mock_response(body.message)
    else:
        # Build context and history
        context = _build_portfolio_context(price_cache)
        history = _load_chat_history()

        # Build messages for LLM
        messages = [{"role": "system", "content": SYSTEM_PROMPT.format(context=context)}]
        messages.extend(history)
        messages.append({"role": "user", "content": body.message})

        try:
            response = completion(
                model=MODEL,
                messages=messages,
                response_format=LlmResponse,
                reasoning_effort="low",
                extra_body=EXTRA_BODY,
            )
            raw = response.choices[0].message.content
            llm_result = LlmResponse.model_validate_json(raw)
        except Exception as e:
            error_msg = f"Sorry, I'm having trouble connecting to the AI service. Error: {e}"
            _store_message("assistant", error_msg)
            return {"message": error_msg, "trades_executed": [], "watchlist_changes": [], "errors": [str(e)]}

    # Auto-execute trades
    trades_executed = []
    errors = []
    for trade in llm_result.trades:
        result = _execute_trade(trade.ticker.upper(), trade.side, trade.quantity, price_cache)
        if "error" in result:
            errors.append(result["error"])
        else:
            trades_executed.append(result)

    # Apply watchlist changes
    watchlist_changes = []
    for change in llm_result.watchlist_changes:
        result = await _apply_watchlist_change(change.ticker, change.action, request)
        if "error" in result:
            errors.append(result["error"])
        else:
            watchlist_changes.append(result)

    # Build actions summary for DB storage
    actions = {}
    if trades_executed:
        actions["trades"] = trades_executed
    if watchlist_changes:
        actions["watchlist_changes"] = watchlist_changes
    if errors:
        actions["errors"] = errors

    # Store assistant response
    _store_message("assistant", llm_result.message, actions if actions else None)

    return {
        "message": llm_result.message,
        "trades_executed": trades_executed,
        "watchlist_changes": watchlist_changes,
        "errors": errors,
    }


@router.get("/history")
async def get_chat_history():
    """Return last 50 chat messages."""
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT id, role, content, actions, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at",
            (USER_ID,),
        ).fetchall()
        # Limit to last 50
        rows = rows[-50:] if len(rows) > 50 else rows
        return [
            {
                "id": r["id"],
                "role": r["role"],
                "content": r["content"],
                "actions": json.loads(r["actions"]) if r["actions"] else None,
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()
