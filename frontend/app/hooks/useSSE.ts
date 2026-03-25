"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PriceUpdate } from "@/app/types";

const MAX_SPARKLINE_POINTS = 60;

interface SSEState {
  prices: Record<string, PriceUpdate>;
  sparklines: Record<string, number[]>;
  connected: boolean;
}

export function useSSE(): SSEState {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({});
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/api/stream/prices");
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle array of price updates or single update
        const updates: PriceUpdate[] = Array.isArray(data) ? data : [data];

        setPrices((prev) => {
          const next = { ...prev };
          for (const update of updates) {
            next[update.ticker] = update;
          }
          return next;
        });

        setSparklines((prev) => {
          const next = { ...prev };
          for (const update of updates) {
            const existing = next[update.ticker] || [];
            const updated = [...existing, update.price];
            next[update.ticker] =
              updated.length > MAX_SPARKLINE_POINTS
                ? updated.slice(-MAX_SPARKLINE_POINTS)
                : updated;
          }
          return next;
        });
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects, but we track status
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);

  return { prices, sparklines, connected };
}
