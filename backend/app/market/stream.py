"""SSE streaming endpoint for live price updates."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse, ServerSentEvent

from .cache import PriceCache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stream", tags=["streaming"])


def create_stream_router(price_cache: PriceCache) -> APIRouter:
    """Create the SSE streaming router with a reference to the price cache."""

    @router.get("/prices")
    async def stream_prices(request: Request) -> EventSourceResponse:
        """SSE endpoint for live price updates.

        Uses sse-starlette for reliable Chromium/browser compatibility.
        Sends price updates every ~500ms. Includes built-in ping keep-alives.
        """
        client_ip = request.client.host if request.client else "unknown"
        logger.info("SSE client connected: %s", client_ip)
        return EventSourceResponse(
            _generate_events(price_cache),
            ping=15,  # comment ping every 15s to keep connection alive
        )

    return router


async def _generate_events(
    price_cache: PriceCache,
    interval: float = 0.5,
) -> AsyncGenerator[ServerSentEvent, None]:
    """Async generator that yields SSE-formatted price events.

    EventSourceResponse handles disconnect detection and cancels this generator
    when the client disconnects, so no explicit is_disconnected() check needed.
    """
    # Send retry directive so the browser reconnects after 1s if dropped
    yield ServerSentEvent(retry=1000)

    last_version = -1
    while True:
        current_version = price_cache.version
        if current_version != last_version:
            last_version = current_version
            prices = price_cache.get_all()
            if prices:
                data = {ticker: update.to_dict() for ticker, update in prices.items()}
                yield ServerSentEvent(data=json.dumps(data))

        await asyncio.sleep(interval)
