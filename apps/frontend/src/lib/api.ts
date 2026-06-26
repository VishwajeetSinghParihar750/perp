import type { SymbolType, OrderSide, OrderType, MarginType } from "../context/TradingContext";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type ApiResponse<T> = { error: boolean; payload: T };

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

export interface HttpOpenOrder {
  id: string;
  userId: string;
  side: OrderSide;
  symbol: SymbolType;
  price: string | number;
  quantity: string | number;
  filledQuantity: string | number;
  status: string;
  type: OrderType;
  marginType: MarginType;
  margin: string | number;
}

export interface HttpFill {
  id: string;
  symbol: SymbolType;
  quantity: string | number;
  price: string | number;
  bidPrice: string | number;
  longUserId: string;
  shortUserId: string;
  longOrderId: string;
  shortOrderId: string;
}

export function parseDecimal(value: string | number): number {
  return typeof value === "number" ? value : parseFloat(value);
}

export async function fetchOpenOrders(
  token: string,
  marketSymbol: SymbolType,
): Promise<HttpOpenOrder[]> {
  return apiFetch<HttpOpenOrder[]>(`/orders/${marketSymbol}`, token);
}

export async function fetchUserFills(token: string): Promise<HttpFill[]> {
  return apiFetch<HttpFill[]>("/trades", token);
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
      typeof data.payload === "string" ? data.payload : "Incorrect credentials",
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
