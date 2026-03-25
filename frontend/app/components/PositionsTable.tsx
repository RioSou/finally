"use client";

import type { Position } from "@/app/types";

interface PositionsTableProps {
  positions: Position[];
}

export default function PositionsTable({ positions }: PositionsTableProps) {
  return (
    <div className="flex flex-col h-full bg-surface rounded border border-border" data-testid="positions-table">
      <div className="px-4 py-2 border-b border-border">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Positions
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted border-b border-border">
              <th className="text-left px-3 py-1.5">Ticker</th>
              <th className="text-right px-3 py-1.5">Qty</th>
              <th className="text-right px-3 py-1.5">Avg Cost</th>
              <th className="text-right px-3 py-1.5">Price</th>
              <th className="text-right px-3 py-1.5">P&L</th>
              <th className="text-right px-3 py-1.5">%</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                  No positions
                </td>
              </tr>
            ) : (
              positions.map((pos) => (
                <tr key={pos.ticker} className="border-b border-border/30 hover:bg-bg/50">
                  <td className="px-3 py-1.5 font-semibold text-text">{pos.ticker}</td>
                  <td className="text-right px-3 py-1.5">{pos.quantity}</td>
                  <td className="text-right px-3 py-1.5">${pos.avg_cost.toFixed(2)}</td>
                  <td className="text-right px-3 py-1.5">${pos.current_price.toFixed(2)}</td>
                  <td
                    className={`text-right px-3 py-1.5 ${
                      pos.unrealized_pnl >= 0 ? "text-green" : "text-red"
                    }`}
                  >
                    {pos.unrealized_pnl >= 0 ? "+" : ""}
                    ${pos.unrealized_pnl.toFixed(2)}
                  </td>
                  <td
                    className={`text-right px-3 py-1.5 ${
                      pos.pnl_pct >= 0 ? "text-green" : "text-red"
                    }`}
                  >
                    {pos.pnl_pct >= 0 ? "+" : ""}
                    {pos.pnl_pct.toFixed(2)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
