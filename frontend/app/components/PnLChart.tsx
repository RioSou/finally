"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { PortfolioSnapshot } from "@/app/types";

interface ChartDataPoint {
  time: string;
  value: number;
}

export default function PnLChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);

  const fetchHistory = () => {
    fetch("/api/portfolio/history")
      .then((res) => res.json())
      .then((snapshots: PortfolioSnapshot[]) => {
        if (Array.isArray(snapshots)) {
          setData(
            snapshots.map((s) => ({
              time: new Date(s.recorded_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              value: s.total_value,
            }))
          );
        }
      })
      .catch(() => {
        // API not available yet
      });
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  const hasData = data.length > 0;
  const latestValue = hasData ? data[data.length - 1].value : 10000;
  const startValue = hasData ? data[0].value : 10000;
  const lineColor = latestValue >= startValue ? "#00b37e" : "#f75a68";

  return (
    <div className="flex flex-col h-full bg-surface rounded border border-border" data-testid="pnl-chart">
      <div className="px-3 py-1.5 border-b border-border">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          P&L
        </span>
      </div>
      <div className="flex-1 min-h-0">
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-text-muted text-xs">
            No history yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <XAxis
                dataKey="time"
                tick={{ fill: "#8b949e", fontSize: 9 }}
                stroke="#30363d"
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#8b949e", fontSize: 9 }}
                stroke="#30363d"
                tickLine={false}
                domain={["dataMin - 100", "dataMax + 100"]}
                tickFormatter={(v: number) => `$${v.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a2e",
                  border: "1px solid #30363d",
                  borderRadius: 4,
                  fontSize: 10,
                  color: "#e6edf3",
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, "Value"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
