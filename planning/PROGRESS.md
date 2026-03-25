# FinAlly — Progress Summary

## Completed

### Backend (fully implemented and tested)
- All API endpoints: portfolio, trades, watchlist, chat, SSE stream, health
- SQLite database: schema, lazy initialization, seed data (10 tickers, $10k cash)
- Market data: GBM simulator (default) + Massive API (optional via env var)
- LLM integration: LiteLLM → OpenRouter → Cerebras, structured output, auto-execution of trades/watchlist changes, mock mode (`LLM_MOCK=true`)
- Bug fix: `change_percent` → `change_pct` in SSE stream to match frontend types
- Added `python-dotenv` loading for local dev
- Added graceful error handling around LLM call
- 73 backend unit tests passing

### Frontend (fully implemented)
- All UI components: Watchlist, MainChart, PositionsTable, PortfolioHeatmap, PnLChart, TradeBar, Header, ConnectionStatus
- ChatPanel: fully implemented with message history, send/receive, loading indicator, inline trade/watchlist confirmations
- SSE price streaming with sparkline accumulation and price flash animations
- `React.memo` on TradeBar and ChatPanel to prevent SSE-triggered re-renders
- `useRef` in TradeBar to fix stale closure issue in React 19 concurrent mode
- `data-testid` attributes added to all interactive elements
- **Fixed SSE data parser in `useSSE.ts`**: server sends prices as a dict `{AAPL: {...}, AMZN: {...}}` — the old code wrapped the whole dict as a single "update" (treating it as a single PriceUpdate); now correctly iterates `Object.values(data)` to get individual PriceUpdate objects
- **Fixed `AddTickerInput` re-render**: wrapped in `React.memo` so it only re-renders when `onAdd` changes, not on every SSE price update (was detaching from DOM every 500ms)
- **Fixed handler stability**: `handleAddTicker` and `handleRemoveTicker` in `page.tsx` wrapped in `useCallback` to give `AddTickerInput` a stable `onAdd` prop
- **Added `data-testid="watchlist-add-input"`** to the watchlist add ticker input

### Backend SSE Fixes
- Removed `Connection: keep-alive` header from SSE response (not valid for streaming in all contexts; may cause Chromium to close the connection)
- Added keep-alive SSE comment (`": keep-alive\n\n"`) when no price data has changed, to prevent browser connection timeouts

### Docker & DevOps
- Multi-stage Dockerfile (Node 20 → Python 3.12 with uv)
- Fixed Dockerfile `uv sync` layering (deps cached before source copy)
- docker-compose.yml with named volume for SQLite persistence
- start/stop scripts for macOS and Windows

### E2E Test Infrastructure
- 10 Playwright smoke test scenarios written (`test/e2e/smoke.spec.ts`)
- Fixed `waitForLoadState("networkidle")` → `"load"` (SSE keeps network active)
- Fixed selector ambiguities, added precise `data-testid` selectors throughout
- Enabled always-on trace recording (`trace: "on"`) in `playwright.config.ts` for debugging

---

## Current Status: Tests 1–4 Passing, Tests 5–10 Failing

### What passes (4/10):
1. Fresh load: watchlist, $10k cash, prices streaming ✅
2. Connection status dot is green ✅
3. Add ticker to watchlist ✅
4. Remove ticker from watchlist ✅

### What fails (6/10) — with root cause analysis:

**Test 5 (Buy shares — cash decreases):**
- The buy button click works and the trade executes (POST /api/portfolio/trade returns 200 OK)
- The database correctly reflects the new cash balance (verified via curl after the test)
- BUT: the UI cash balance display does NOT update within the 10-second polling window
- Suspected cause: `fetchPortfolio` is called after the trade but the React state update from it is somehow being dropped or overwritten (possibly due to SSE-driven concurrent renders interfering with the async portfolio fetch)

**Tests 6–9 (Sell shares, Heatmap, P&L chart, AI chat):**
- Page shows "This page couldn't load" error (Chrome ERR-level crash) DURING the test — after `beforeEach` loads the page successfully, something causes the page to crash while clicking the trade input or chat input
- Elements (`trade-quantity`, `chat-input`) are "detected, stable, scrolled into view, then detached from DOM" — consistent with the page crashing or a catastrophic re-mount
- No POST requests to trade API are made for tests 6–9 (confirmed via container logs)

**Test 10 (Click ticker in watchlist):**
- The watchlist `watchlist-row` elements are not found after the 10-second wait
- Suspected cause: the accumulated database modifications from tests 3–9 (PYPL added, NFLX removed, AAPL position created) leave the page in an unexpected state; or the page has crashed before the watchlist can load

### Root cause that remains unsolved — SSE immediately cancelled in Chromium:
In every Playwright test, the server logs show:
```
SSE client connected: 192.168.65.1
SSE stream cancelled for: 192.168.65.1
```
The SSE connection is established but the server receives `asyncio.CancelledError` immediately — meaning the browser closes the HTTP connection right after connecting. This behavior does NOT occur with `curl` (curl holds the connection open for seconds and receives data). `curl` confirms the endpoint returns correct `Content-Type: text/event-stream`, status 200, and sends price events every 500ms.

This Chromium-specific SSE behaviour is the likely root cause of test 5's cash-update failure and tests 6–9's page crash:
- Without a live SSE stream, the EventSource retries every 1000ms; each retry causes `onerror` → `setConnected(false)` → React re-render
- This 1 re-render/second cycle, combined with concurrent mode interleaving, may be disrupting the portfolio fetch state update (test 5) and eventually causing a fatal React render error / page crash (tests 6–9)

---

## What Still Needs to Be Done

### Priority 1 — Fix SSE Chromium disconnect (root cause of most failures)

The SSE stream is immediately cancelled when Playwright's Chromium connects. The fix must make the SSE connection stable in the browser. Options to investigate:

1. **Try `sse-starlette` library** — a battle-tested SSE implementation for FastAPI/Starlette that handles all edge cases, instead of the hand-rolled `StreamingResponse` generator
2. **Add the `Transfer-Encoding: chunked` header explicitly** to the SSE response
3. **Check if uvicorn HTTP/2 is being negotiated** — add `--http h11` flag to uvicorn startup to force HTTP/1.1
4. **Add a `ping` loop** — yield `: ping\n\n` immediately on connect (before the while loop), so the browser receives data before any async operations can interrupt
5. **Check if the issue is related to Playwright browser version** — try running with `--browser=firefox` to see if Firefox has the same issue

### Priority 2 — Fix test 5 (cash update after trade)

Once SSE is stable (so React isn't in a constant re-render state), test 5 may fix itself. If not:
- The `onTradeComplete` → `fetchPortfolio` chain needs to be verified in the browser
- Could add a `waitForResponse` in the test to explicitly wait for the portfolio API call to complete before checking cash

### Priority 3 — Stabilize tests 6–9 (page crash)

Likely fixed once SSE is stable. If the page is crashing due to accumulated React re-renders from SSE retry storms, fixing SSE should eliminate the crash.

### Priority 4 — Fix test 10 (watchlist tickers)

The tests share a single SQLite database (no per-test reset). By test 10, the watchlist has been modified by tests 3, 4. MSFT should still be there but may not be loading due to page state issues. Options:
- Add a test setup that resets the database to a known state before each test
- OR add a wait for the watchlist to populate before asserting

### Priority 5 — Final cleanup (once all 10 tests pass)

- Reset playwright.config.ts `trace` back to `"on-first-retry"`
- Commit all changes on `agent-teams` branch
- Merge `agent-teams` → `main`
- Update README if needed
