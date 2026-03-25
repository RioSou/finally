"use client";

interface ConnectionStatusProps {
  connected: boolean;
}

export default function ConnectionStatus({ connected }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-1.5" data-testid="connection-status" data-status={connected ? "connected" : "disconnected"}>
      <div
        className={`w-2 h-2 rounded-full ${
          connected ? "bg-green connected" : "bg-red"
        }`}
      />
      <span className="text-xs text-text-muted">
        {connected ? "Live" : "Disconnected"}
      </span>
    </div>
  );
}
