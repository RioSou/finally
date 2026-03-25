"use client";

import ConnectionStatus from "./ConnectionStatus";

interface HeaderProps {
  totalValue: number;
  cashBalance: number;
  connected: boolean;
  onToggleChat: () => void;
  chatVisible: boolean;
}

export default function Header({
  totalValue,
  cashBalance,
  connected,
  onToggleChat,
  chatVisible,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-accent-yellow tracking-wider">
          FinAlly
        </h1>
        <span className="text-xs text-text-muted">AI Trading Workstation</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-text-muted mr-1">Portfolio</span>
            <span className="text-text font-semibold">
              ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-text-muted mr-1">Cash</span>
            <span className="text-text font-semibold" data-testid="cash-balance">
              ${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ConnectionStatus connected={connected} />
          <button
            onClick={onToggleChat}
            data-testid="chat-toggle"
            className="text-xs px-2 py-1 rounded border border-border text-text-muted hover:text-text hover:border-text-muted transition-colors"
          >
            {chatVisible ? "Hide Chat" : "Show Chat"}
          </button>
        </div>
      </div>
    </header>
  );
}
