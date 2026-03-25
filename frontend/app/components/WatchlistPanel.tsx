"use client";

import type { PriceUpdate } from "@/app/types";
import PriceFlash from "./PriceFlash";
import SparklineChart from "./SparklineChart";

interface WatchlistPanelProps {
  tickers: string[];
  prices: Record<string, PriceUpdate>;
  sparklines: Record<string, number[]>;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  onRemoveTicker: (ticker: string) => void;
  onAddTicker: (ticker: string) => void;
}

export default function WatchlistPanel({
  tickers,
  prices,
  sparklines,
  selectedTicker,
  onSelectTicker,
  onRemoveTicker,
  onAddTicker,
}: WatchlistPanelProps) {
  return (
    <div className="flex flex-col h-full border-r border-border bg-surface">
      <div className="px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Watchlist
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tickers.length === 0 ? (
          <div className="px-3 py-8 text-center text-text-muted text-xs">
            No tickers in watchlist
          </div>
        ) : (
          tickers.map((ticker) => {
            const price = prices[ticker];
            const sparkData = sparklines[ticker] || [];
            return (
              <div
                key={ticker}
                onClick={() => onSelectTicker(ticker)}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b border-border/50 hover:bg-bg/50 transition-colors ${
                  selectedTicker === ticker ? "bg-bg" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold text-text">{ticker}</span>
                    {price && (
                      <PriceFlash price={price.price} direction={price.direction}>
                        <span className="text-sm text-text" data-testid="price">
                          ${price.price.toFixed(2)}
                        </span>
                      </PriceFlash>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <SparklineChart data={sparkData} width={60} height={18} />
                    {price ? (
                      <span
                        className={`text-xs ${
                          price.direction === "up"
                            ? "text-green"
                            : price.direction === "down"
                            ? "text-red"
                            : "text-text-muted"
                        }`}
                      >
                        {price.change_pct >= 0 ? "+" : ""}
                        {price.change_pct.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">--</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTicker(ticker);
                  }}
                  className="text-text-muted hover:text-red text-xs ml-2"
                  title="Remove"
                >
                  x
                </button>
              </div>
            );
          })
        )}
      </div>
      <AddTickerInput onAdd={onAddTicker} />
    </div>
  );
}

function AddTickerInput({ onAdd }: { onAdd: (ticker: string) => void }) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("ticker") as HTMLInputElement;
    const value = input.value.trim().toUpperCase();
    if (value) {
      onAdd(value);
      input.value = "";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 border-t border-border">
      <input
        name="ticker"
        type="text"
        placeholder="Add ticker..."
        className="w-full px-2 py-1 text-xs bg-bg border border-border rounded text-text placeholder-text-muted focus:outline-none focus:border-blue-primary"
      />
    </form>
  );
}
