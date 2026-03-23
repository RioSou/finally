# Market Data Design Checklist

## 10-Step Overview

1. **Define the data model** — `PriceUpdate` frozen dataclass: `ticker`, `price`, `previous_price`, `timestamp`, plus computed properties `change`, `change_percent`, `direction`.

2. **Build the price cache** — `PriceCache` thread-safe in-memory store. Holds latest `PriceUpdate` per ticker. Has a `version` counter that increments on every write (used by SSE for change detection).

3. **Define the abstract interface** — `MarketDataSource` ABC with `start(tickers)`, `stop()`, `add_ticker()`, `remove_ticker()`, `get_tickers()`. All downstream code is source-agnostic.

4. **Define seed prices & parameters** — `seed_prices.py` holds `SEED_PRICES` (realistic starting prices), `TICKER_PARAMS` (per-ticker sigma/mu), correlation group constants.

5. **Build the GBM simulator** — `GBMSimulator` generates correlated price paths using Geometric Brownian Motion + Cholesky decomposition. `SimulatorDataSource` wraps it in an async loop, writing to `PriceCache` every 500ms.

6. **Build the Massive API client** — `MassiveDataSource` polls `GET /v2/snapshot/locale/us/markets/stocks/tickers` every 15s (free tier). Runs the synchronous `RESTClient` in a thread via `asyncio.to_thread`. Writes `last_trade.price` to `PriceCache`.

7. **Write the factory** — `create_market_data_source(cache)` checks `MASSIVE_API_KEY` env var. Returns `MassiveDataSource` if set, else `SimulatorDataSource`.

8. **Build the SSE endpoint** — `create_stream_router(cache)` returns a FastAPI `APIRouter` with `GET /api/stream/prices`. Streams all ticker prices as JSON every 500ms using version-based change detection. Includes `retry: 1000` for auto-reconnect.

9. **Wire into FastAPI lifecycle** — On app startup: create `PriceCache`, call factory, call `await source.start(initial_tickers)`. On shutdown: `await source.stop()`. Watchlist add/remove calls `source.add_ticker()` / `source.remove_ticker()`.

10. **Expose public API via `__init__.py`** — Re-export `PriceUpdate`, `PriceCache`, `MarketDataSource`, `create_market_data_source`, `create_stream_router` from `app.market`. All other backend modules import from this single entry point.

---

## What I Still Need to Know More About

- How the FastAPI app entry point (`main.py` or equivalent) is structured — needed to confirm the lifecycle wiring pattern.
- Whether a `pyproject.toml` build config fix (`[tool.hatch.build.targets.wheel]`) has been applied yet.
- How the watchlist API routes will call `source.add_ticker()` / `source.remove_ticker()` — needs a shared app state pattern (e.g., FastAPI `app.state`).
