"use client";

import { memo, useState, useEffect, useRef, useCallback } from "react";
import type { ChatMessage, TradeAction, WatchlistAction } from "@/app/types";

interface ChatPanelProps {
  visible: boolean;
  onTradeComplete?: () => void;
}

const ChatPanel = memo(function ChatPanel({ visible, onTradeComplete }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Fetch chat history on mount
  useEffect(() => {
    fetch("/api/chat/history")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMessages(data);
        }
      })
      .catch(() => {
        // API not available yet
      });
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      actions: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      // Build actions from response
      const actions: ChatMessage["actions"] = {};
      if (data.trades_executed?.length) {
        actions.trades = data.trades_executed;
      }
      if (data.watchlist_changes?.length) {
        actions.watchlist_changes = data.watchlist_changes;
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        actions: Object.keys(actions).length > 0 ? actions : null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Notify parent if trades were executed
      if (data.trades_executed?.length && onTradeComplete) {
        onTradeComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!visible) return null;

  return (
    <div className="flex flex-col h-full border-l border-border bg-surface">
      <div className="px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          AI Assistant
        </h2>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !loading && (
          <p className="text-text-muted text-xs text-center mt-8">
            Ask FinAlly about your portfolio, or tell it to make trades.
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] px-3 py-2 rounded-lg bg-blue-primary/20 text-text text-xs">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div data-testid="chat-message-assistant" className="space-y-1.5">
                <div className="max-w-[85%] px-3 py-2 rounded-lg bg-bg text-text text-xs whitespace-pre-wrap">
                  {msg.content}
                </div>
                {msg.actions?.trades?.map((t: TradeAction, i: number) => (
                  <div
                    key={i}
                    className={`text-[10px] px-2 py-1 rounded ${
                      t.error
                        ? "bg-red-500/10 text-red-400"
                        : t.side === "buy"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {t.error
                      ? `Failed: ${t.error}`
                      : `${t.side === "buy" ? "Bought" : "Sold"} ${t.quantity} ${t.ticker}${t.price ? ` @ $${t.price.toFixed(2)}` : ""}`}
                  </div>
                ))}
                {msg.actions?.watchlist_changes?.map((w: WatchlistAction, i: number) => (
                  <div
                    key={`wl-${i}`}
                    className="text-[10px] px-2 py-1 rounded bg-accent-yellow/10 text-accent-yellow"
                  >
                    {w.action === "add" ? `Added ${w.ticker} to watchlist` : `Removed ${w.ticker} from watchlist`}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div data-testid="chat-message-assistant" className="flex items-center gap-1 text-text-muted text-xs px-3 py-2">
            <span className="animate-pulse">Thinking</span>
            <span className="animate-pulse">...</span>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 px-3 py-2 bg-red-500/10 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border">
        <div className="flex gap-2">
          <input
            data-testid="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask FinAlly..."
            disabled={loading}
            className="flex-1 px-2 py-1.5 text-xs bg-bg border border-border rounded text-text placeholder-text-muted focus:outline-none focus:border-blue-primary"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-purple-secondary text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
});

export default ChatPanel;
