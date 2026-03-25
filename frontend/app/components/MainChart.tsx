"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, LineSeries } from "lightweight-charts";

interface MainChartProps {
  ticker: string | null;
  price?: number;
  changePct?: number;
  sparklineData?: number[];
}

export default function MainChart({ ticker, price, changePct, sparklineData }: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Create chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#1a1a2e" },
        textColor: "#8b949e",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#30363d" },
        horzLines: { color: "#30363d" },
      },
      crosshair: {
        vertLine: { color: "#8b949e", width: 1, style: 2 },
        horzLine: { color: "#8b949e", width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: "#30363d",
      },
      timeScale: {
        borderColor: "#30363d",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(LineSeries, {
      color: "#209dd7",
      lineWidth: 2,
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: "#209dd7",
      priceLineVisible: true,
      priceLineColor: "#209dd7",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update data when sparklineData or ticker changes
  useEffect(() => {
    if (!seriesRef.current || !sparklineData || sparklineData.length === 0) {
      seriesRef.current?.setData([]);
      return;
    }

    // Convert sparkline data to lightweight-charts format
    // Use timestamp-based time values
    const now = Date.now();
    const interval = 500; // ~500ms between SSE updates
    const data = sparklineData.map((value, i) => ({
      time: ((now - (sparklineData.length - 1 - i) * interval) / 1000) as import("lightweight-charts").UTCTimestamp,
      value,
    }));

    seriesRef.current.setData(data);

    // Update line color based on direction
    const first = sparklineData[0];
    const last = sparklineData[sparklineData.length - 1];
    seriesRef.current.applyOptions({
      color: last >= first ? "#00b37e" : "#f75a68",
      priceLineColor: last >= first ? "#00b37e" : "#f75a68",
    });
  }, [sparklineData, ticker]);

  return (
    <div className="flex flex-col h-full bg-surface rounded border border-border" data-testid="main-chart">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-text">
            {ticker ?? "Select a ticker"}
          </span>
          {price !== undefined && (
            <span className="text-sm text-text">
              ${price.toFixed(2)}
            </span>
          )}
          {changePct !== undefined && (
            <span
              className={`text-xs ${
                changePct >= 0 ? "text-green" : "text-red"
              }`}
            >
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
          )}
        </div>
        <span className="text-xs text-text-muted uppercase tracking-wider">
          Chart
        </span>
      </div>
      <div className="flex-1 min-h-0" ref={containerRef}>
        {!ticker && (
          <div className="flex items-center justify-center h-full text-text-muted text-xs">
            Click a ticker to view chart
          </div>
        )}
      </div>
    </div>
  );
}
