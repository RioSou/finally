export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: string;
  direction: "up" | "down" | "flat";
  change_pct: number;
}

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  unrealized_pnl: number;
  pnl_pct: number;
}

export interface Trade {
  id: string;
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  executed_at: string;
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  added_at: string;
}

export interface Portfolio {
  cash_balance: number;
  total_value: number;
  positions: Position[];
}

export interface PortfolioSnapshot {
  total_value: number;
  recorded_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: ChatActions | null;
  created_at: string;
}

export interface ChatActions {
  trades?: TradeAction[];
  watchlist_changes?: WatchlistAction[];
}

export interface TradeAction {
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price?: number;
  error?: string;
}

export interface WatchlistAction {
  ticker: string;
  action: "add" | "remove";
}
