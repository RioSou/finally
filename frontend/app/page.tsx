"use client";

import { useState, useEffect, useCallback } from "react";
import type { Position, Portfolio } from "@/app/types";
import { useSSE } from "@/app/hooks/useSSE";
import Header from "@/app/components/Header";
import WatchlistPanel from "@/app/components/WatchlistPanel";
import MainChart from "@/app/components/MainChart";
import PositionsTable from "@/app/components/PositionsTable";
import TradeBar from "@/app/components/TradeBar";
import PortfolioHeatmap from "@/app/components/PortfolioHeatmap";
import PnLChart from "@/app/components/PnLChart";
import ChatPanel from "@/app/components/ChatPanel";

export default function Home() {
  const { prices, sparklines, connected } = useSSE();
  const [selectedTicker, setSelectedTicker] = useState<string | null>("AAPL");
  const [chatVisible, setChatVisible] = useState(true);
  const [tickers, setTickers] = useState<string[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [cashBalance, setCashBalance] = useState(10000);
  const [totalValue, setTotalValue] = useState(10000);

  // Fetch watchlist on mount
  useEffect(() => {
    fetch("/api/watchlist")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTickers(data.map((item: { ticker: string }) => item.ticker));
        }
      })
      .catch(() => {
        // Fallback to defaults if API not available
        setTickers(["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]);
      });
  }, []);

  // Fetch portfolio
  const fetchPortfolio = useCallback(() => {
    fetch("/api/portfolio")
      .then((res) => res.json())
      .then((data: Portfolio) => {
        setPositions(data.positions || []);
        setCashBalance(data.cash_balance);
        setTotalValue(data.total_value);
      })
      .catch(() => {
        // API not available yet
      });
  }, []);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  // Update position current prices from SSE
  const livePositions = positions.map((pos) => {
    const livePrice = prices[pos.ticker];
    if (!livePrice) return pos;
    const currentPrice = livePrice.price;
    const unrealizedPnl = (currentPrice - pos.avg_cost) * pos.quantity;
    const pnlPct = pos.avg_cost > 0 ? ((currentPrice - pos.avg_cost) / pos.avg_cost) * 100 : 0;
    return { ...pos, current_price: currentPrice, unrealized_pnl: unrealizedPnl, pnl_pct: pnlPct };
  });

  const handleAddTicker = useCallback(async (ticker: string) => {
    if (tickers.includes(ticker)) return;
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (res.ok) {
        setTickers((prev) => [...prev, ticker]);
      }
    } catch {
      setTickers((prev) => [...prev, ticker]);
    }
  }, [tickers]);

  const handleRemoveTicker = useCallback(async (ticker: string) => {
    try {
      await fetch(`/api/watchlist/${ticker}`, { method: "DELETE" });
    } catch {
      // Remove locally anyway
    }
    setTickers((prev) => prev.filter((t) => t !== ticker));
    if (selectedTicker === ticker) {
      setSelectedTicker(null);
    }
  }, [selectedTicker]);

  const selectedPrice = selectedTicker ? prices[selectedTicker] : undefined;

  return (
    <div className="flex flex-col h-full">
      <Header
        totalValue={totalValue}
        cashBalance={cashBalance}
        connected={connected}
        onToggleChat={() => setChatVisible(!chatVisible)}
        chatVisible={chatVisible}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Watchlist */}
        <div className="w-[280px] shrink-0">
          <WatchlistPanel
            tickers={tickers}
            prices={prices}
            sparklines={sparklines}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onRemoveTicker={handleRemoveTicker}
            onAddTicker={handleAddTicker}
          />
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top: Chart */}
          <div className="flex-1 min-h-0 p-2">
            <MainChart
              ticker={selectedTicker}
              price={selectedPrice?.price}
              changePct={selectedPrice?.change_pct}
              sparklineData={selectedTicker ? sparklines[selectedTicker] : undefined}
            />
          </div>

          {/* Middle: Positions + Heatmap/P&L */}
          <div className="flex h-[240px] shrink-0 gap-2 px-2 pb-2">
            <div className="flex-1 min-w-0">
              <PositionsTable positions={livePositions} />
            </div>
            <div className="w-[300px] shrink-0 flex flex-col gap-2">
              <div className="flex-1 min-h-0">
                <PortfolioHeatmap positions={livePositions} />
              </div>
              <div className="flex-1 min-h-0">
                <PnLChart />
              </div>
            </div>
          </div>

          {/* Bottom: Trade bar */}
          <TradeBar
            selectedTicker={selectedTicker}
            onTradeComplete={fetchPortfolio}
          />
        </div>

        {/* Right sidebar — Chat */}
        {chatVisible && (
          <div className="w-[320px] shrink-0">
            <ChatPanel visible={chatVisible} onTradeComplete={fetchPortfolio} />
          </div>
        )}
      </div>
    </div>
  );
}
