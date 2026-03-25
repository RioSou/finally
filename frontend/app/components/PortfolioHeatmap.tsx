"use client";

import { ResponsiveContainer, Treemap } from "recharts";
import type { Position } from "@/app/types";

interface PortfolioHeatmapProps {
  positions: Position[];
}

interface TreemapNode {
  name: string;
  size: number;
  pnl_pct: number;
  fill: string;
  [key: string]: unknown;
}

function getPnlColor(pnlPct: number): string {
  if (pnlPct >= 5) return "#00b37e";
  if (pnlPct >= 2) return "#26c990";
  if (pnlPct >= 0) return "#1a3a2a";
  if (pnlPct >= -2) return "#3a1a1a";
  if (pnlPct >= -5) return "#d94050";
  return "#f75a68";
}

function CustomContent(props: Record<string, unknown>) {
  const { x, y, width, height, name, pnl_pct } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
    pnl_pct: number;
  };

  if (width < 30 || height < 20) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={getPnlColor(pnl_pct)}
        stroke="#30363d"
        strokeWidth={1}
      />
      {width > 40 && height > 30 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 5}
            textAnchor="middle"
            fill="#e6edf3"
            fontSize={11}
            fontFamily="JetBrains Mono, monospace"
            fontWeight="bold"
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="#e6edf3"
            fontSize={9}
            fontFamily="JetBrains Mono, monospace"
          >
            {pnl_pct >= 0 ? "+" : ""}
            {pnl_pct.toFixed(1)}%
          </text>
        </>
      )}
    </g>
  );
}

export default function PortfolioHeatmap({ positions }: PortfolioHeatmapProps) {
  if (positions.length === 0) {
    return (
      <div className="flex flex-col h-full bg-surface rounded border border-border" data-testid="portfolio-heatmap">
        <div className="px-3 py-1.5 border-b border-border">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Heatmap
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          No positions to display
        </div>
      </div>
    );
  }

  const totalValue = positions.reduce(
    (sum, p) => sum + p.current_price * p.quantity,
    0
  );

  const data: TreemapNode[] = positions.map((pos) => ({
    name: pos.ticker,
    size: Math.max((pos.current_price * pos.quantity) / totalValue * 100, 1),
    pnl_pct: pos.pnl_pct,
    fill: getPnlColor(pos.pnl_pct),
  }));

  return (
    <div className="flex flex-col h-full bg-surface rounded border border-border" data-testid="portfolio-heatmap">
      <div className="px-3 py-1.5 border-b border-border">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Heatmap
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            content={<CustomContent />}
            isAnimationActive={false}
          />
        </ResponsiveContainer>
      </div>
    </div>
  );
}
