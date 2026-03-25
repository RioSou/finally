"use client";

import { useState } from "react";

interface TradeBarProps {
  selectedTicker: string | null;
  onTradeComplete: () => void;
}

export default function TradeBar({ selectedTicker, onTradeComplete }: TradeBarProps) {
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);

  const activeTicker = ticker || selectedTicker || "";

  const executeTrade = async (side: "buy" | "sell") => {
    const qty = parseFloat(quantity);
    if (!activeTicker || isNaN(qty) || qty <= 0) {
      setMessage({ text: "Enter a valid ticker and quantity", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/portfolio/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: activeTicker, quantity: qty, side }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: `${side.toUpperCase()} ${qty} ${activeTicker} @ $${data.price?.toFixed(2) ?? "?"}`, type: "success" });
        setQuantity("");
        onTradeComplete();
      } else {
        setMessage({ text: data.detail || "Trade failed", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-surface border-t border-border">
      <input
        type="text"
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        placeholder={selectedTicker ?? "Ticker"}
        data-testid="trade-ticker"
        className="w-20 px-2 py-1 text-xs bg-bg border border-border rounded text-text placeholder-text-muted focus:outline-none focus:border-blue-primary"
      />
      <input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="Qty"
        min="0"
        step="1"
        data-testid="trade-quantity"
        className="w-20 px-2 py-1 text-xs bg-bg border border-border rounded text-text placeholder-text-muted focus:outline-none focus:border-blue-primary"
      />
      <button
        onClick={() => executeTrade("buy")}
        disabled={loading}
        data-testid="buy-button"
        className="px-3 py-1 text-xs font-semibold rounded bg-blue-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        BUY
      </button>
      <button
        onClick={() => executeTrade("sell")}
        disabled={loading}
        data-testid="sell-button"
        className="px-3 py-1 text-xs font-semibold rounded bg-red text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        SELL
      </button>
      {message && (
        <span className={`text-xs ${message.type === "success" ? "text-green" : "text-red"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
