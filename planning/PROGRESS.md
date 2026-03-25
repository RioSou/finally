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
- **SSE fix**: replaced hand-rolled `StreamingResponse` with `sse-starlette`'s `EventSourceResponse` — eliminates Chromium-specific immediate disconnect (CancelledError) that previously caused a reconnection storm every 1000ms

### Frontend (fully implemented)
- All UI components: Watchlist, MainChart, PositionsTable, PortfolioHeatmap, PnLChart, TradeBar, Header, ConnectionStatus
- ChatPanel: fully implemented with message history, send/receive, loading indicator, inline trade/watchlist confirmations
- SSE price streaming with sparkline accumulation and price flash animations
- `React.memo` on TradeBar and ChatPanel to prevent SSE-triggered re-renders
- `useRef` in TradeBar to fix stale closure issue in React 19 concurrent mode
- `data-testid` attributes added to all interactive elements
- **Fixed SSE data parser in `useSSE.ts`**: server sends prices as a dict `{AAPL: {...}, AMZN: {...}}` — the old code wrapped the whole dict as a single "update"; now correctly iterates `Object.values(data)`
- **Fixed `AddTickerInput` re-render**: wrapped in `React.memo` so it only re-renders when `onAdd` changes
- **Fixed handler stability**: `handleAddTicker` and `handleRemoveTicker` wrapped in `useCallback`
- **Fixed `PortfolioHeatmap` crash**: Recharts `Treemap` calls `CustomContent` for its internal root/container node which has no `pnl_pct` — added `typeof pnl_pct !== "number"` guard to prevent `undefined.toFixed(1)` → uncaught error → full React tree crash → "This page couldn't load" page error

### Docker & DevOps
- Multi-stage Dockerfile (Node 20 → Python 3.12 with uv)
- Fixed Dockerfile `uv sync` layering (deps cached before source copy)
- docker-compose.yml with named volume for SQLite persistence
- start/stop scripts for macOS and Windows

### E2E Test Infrastructure
- 10 Playwright smoke test scenarios written (`test/e2e/smoke.spec.ts`)
- Fixed `waitForLoadState("networkidle")` → `"load"` (SSE keeps network active)
- Fixed selector ambiguities, added precise `data-testid` selectors throughout
- Trace recording set to `"on-first-retry"` in `playwright.config.ts`
- **Fixed test state pollution**: tests 1 and 4 failed on re-runs because previous runs had modified DB state (NFLX removed, cash spent). Fix: added `POST /api/test/reset` endpoint to backend (only active when `LLM_MOCK=true`) that wipes all tables and re-seeds defaults; added `beforeAll` to test suite that calls it before each run.

---

## Final Status: ALL 10/10 TESTS PASSING ✅

All smoke tests pass in ~31 seconds:
1. Fresh load: watchlist, $10k cash, prices streaming ✅
2. Connection status dot is green ✅
3. Add ticker to watchlist ✅
4. Remove ticker from watchlist ✅
5. Buy shares: cash decreases, position appears ✅
6. Sell shares: cash increases, position decreases ✅
7. Portfolio heatmap: AAPL rectangle visible after buying ✅
8. P&L chart: has at least one data point ✅
9. AI chat (mock): send message, receive response ✅
10. Click ticker in watchlist: main chart updates ✅

---

## What Remains (stretch goals, not required)

- Cloud deployment (AWS App Runner / Terraform) — optional
- README polish
- Additional E2E test scenarios beyond smoke tests
