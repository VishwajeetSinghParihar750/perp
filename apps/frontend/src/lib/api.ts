import { API_URL } from "./constants";
import type {
  MarginType,
  OrderStatus,
  OrderType,
  Side,
  TradableSymbol,
} from "./types";

type ApiResponse<T> = { error: boolean; payload: T };

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : parseFloat(value);
}

function toTimestamp(value: string | number | Date): number {
  return new Date(value).getTime();
}

async function apiFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = (await res.json()) as ApiResponse<T>;
  if (!res.ok || data.error) {
    throw new Error(
      typeof data.payload === "string" ? data.payload : "Request failed",
    );
  }
  return data.payload;
}

interface HttpOrder {
  id: string;
  side: Side;
  symbol: TradableSymbol;
  price: string | number;
  quantity: string | number;
  filledQuantity: string | number;
  status: OrderStatus;
  type: OrderType;
  marginType: MarginType;
  margin: string | number;
}

interface HttpFill {
  id: string;
  symbol: TradableSymbol;
  quantity: string | number;
  price: string | number;
  bidPrice: string | number;
  longUserId: string;
  shortUserId: string;
  longOrderId: string;
  shortOrderId: string;
  createdAt: string;
}

export interface OpenOrder {
  orderId: string;
  side: Side;
  type: OrderType;
  price: number;
  quantity: number;
  filledQuantity: number;
  status: OrderStatus;
  marginType: MarginType;
  marketSymbol: TradableSymbol;
}

export interface HistoricalFill {
  fillId: string;
  marketSymbol: TradableSymbol;
  price: number;
  qty: number;
  longUserId: string;
  shortUserId: string;
  time: number;
}

export async function signIn(
  username: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${API_URL}/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = (await res.json()) as ApiResponse<{ jwt_token: string }>;
  if (!res.ok || data.error || !data.payload?.jwt_token) {
    throw new Error(
      typeof data.payload === "string"
        ? data.payload
        : "Incorrect credentials",
    );
  }
  return data.payload.jwt_token;
}

export async function signUp(
  username: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = (await res.json()) as ApiResponse<string>;
  if (!res.ok || data.error) {
    throw new Error(
      typeof data.payload === "string"
        ? data.payload
        : "Username already exists",
    );
  }
}

export async function fetchOpenOrders(
  token: string,
  marketSymbol: TradableSymbol,
): Promise<OpenOrder[]> {
  const orders = await apiFetch<HttpOrder[]>(`/orders/${marketSymbol}`, token);
  return orders.map((o) => ({
    orderId: o.id,
    side: o.side,
    type: o.type,
    price: toNumber(o.price),
    quantity: toNumber(o.quantity),
    filledQuantity: toNumber(o.filledQuantity),
    status: o.status,
    marginType: o.marginType,
    marketSymbol: o.symbol,
  }));
}

export async function fetchFills(token: string): Promise<HistoricalFill[]> {
  const fills = await apiFetch<HttpFill[]>("/trades", token);
  return fills.map((f) => ({
    fillId: f.id,
    marketSymbol: f.symbol,
    price: toNumber(f.price),
    qty: toNumber(f.quantity),
    longUserId: f.longUserId,
    shortUserId: f.shortUserId,
    time: toTimestamp(f.createdAt),
  }));
}

export interface HttpCandle {
  bucket: string;
  lastTradeId: string;
  symbol: TradableSymbol;
  volume: string | number;
  trades: number;
  high: string | number;
  low: string | number;
  open: string | number;
  close: string | number;
}

export async function fetchCandles(
  token: string,
  marketSymbol: TradableSymbol,
  timeframe: "1min" | "1hour" | "1day",
  limit: number,
  offset = 0,
): Promise<HttpCandle[]> {
  return apiFetch<HttpCandle[]>(
    `/candles/${marketSymbol}/${timeframe}?limit=${limit}&offset=${offset}`,
    token,
  );
}

export async function fetchMarketTrades(
  token: string,
  marketSymbol: TradableSymbol,
  limit = 100,
): Promise<
  {
    fillId: string;
    price: number;
    qty: number;
    time: number;
    up: boolean;
  }[]
> {
  const fills = await apiFetch<HttpFill[]>(
    `/fills/${marketSymbol}?limit=${limit}`,
    token,
  );
  const trades = fills.map((f) => ({
    fillId: f.id,
    price: toNumber(f.price),
    qty: toNumber(f.quantity),
    time: toTimestamp(f.createdAt),
    up: true,
  }));
  for (let i = 0; i < trades.length - 1; i++) {
    trades[i] = {
      ...trades[i],
      up: trades[i].price >= trades[i + 1].price,
    };
  }
  return trades;
}
