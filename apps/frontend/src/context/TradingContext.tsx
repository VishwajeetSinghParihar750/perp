import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  applyDepthSnapshot,
  applyDepthUpdate,
  createDepthSyncInfo,
  getLatestBufferedDepthId,
  reconcileBufferedDepthUpdates,
  shouldApplyLiveDepthUpdate,
  type DepthSyncInfo,
  type OrderbookState,
} from "../lib/depthSync";
import {
  fetchOpenOrders,
  fetchUserFills,
  parseDecimal,
  signIn as apiSignIn,
  signUp as apiSignUp,
  type HttpOpenOrder,
} from "../lib/api";

export type SymbolType = "BTCUSD" | "SOLUSD" | "ETHUSD";
export type OrderSide = "BUY" | "SELL";
export type OrderType = "LIMIT" | "MARKET";
export type MarginType = "ISOLATED" | "CROSS";

export interface Position {
  positionId: string;
  userId: string;
  price: number;
  qty: number;
  type: "LONG" | "SHORT";
  marketSymbol: SymbolType;
  margin: number;
  marginType: MarginType;
}

export interface OpenOrder {
  id: string;
  side: OrderSide;
  price: number;
  quantity: number;
  filledQuantity: number;
  status: string;
  type: OrderType;
  marginType: MarginType;
  marketSymbol: SymbolType;
}

export interface Trade {
  price: number;
  qty: number;
  side?: "BUY" | "SELL";
  time: string;
}

export interface BalanceInfo {
  available: number;
  locked: number;
}

export interface TradingContextProps {
  isAuthenticated: boolean;
  user: { username: string; id: string } | null;
  token: string | null;
  currentSymbol: SymbolType;
  setCurrentSymbol: (marketSymbol: SymbolType) => void;
  orderbook: OrderbookState;
  lastTradedPrice: number | null;
  indexPrice: number | null;
  lastTradedPrices: Partial<Record<SymbolType, number>>;
  indexPrices: Partial<Record<SymbolType, number>>;
  trades: Trade[];
  balance: BalanceInfo;
  positions: Record<string, Position>;
  openOrders: OpenOrder[];
  wsConnected: boolean;
  error: string | null;
  notice: string | null;
  setError: (err: string | null) => void;
  clearNotice: () => void;
  login: (username: string, password: string) => Promise<boolean>;
  signUp: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  placeOrder: (params: {
    side: OrderSide;
    type: OrderType;
    price: number;
    qty: number;
    margin: number;
    marginType: MarginType;
  }) => Promise<boolean>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  addBalance: (marketSymbol: string, amount: number) => void;
  fetchBalanceAndPositions: () => void;
  refreshOpenOrders: () => Promise<void>;
}

const TradingContext = createContext<TradingContextProps | undefined>(
  undefined,
);

export const useTrading = () => {
  const context = useContext(TradingContext);
  if (!context)
    throw new Error("useTrading must be used within a TradingProvider");
  return context;
};

const ALL_MARKET_EVENTS = [
  "depth.updated",
  "lastTradedPrice.updated",
  "trades.created",
  "indexprice.updated",
] as const;

function mapOpenOrder(order: HttpOpenOrder): OpenOrder {
  return {
    id: order.id,
    side: order.side,
    price: parseDecimal(order.price),
    quantity: parseDecimal(order.quantity),
    filledQuantity: parseDecimal(order.filledQuantity),
    status: order.status,
    type: order.type,
    marginType: order.marginType,
    marketSymbol: order.symbol,
  };
}

export const TradingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("perp_token"),
  );
  const [user, setUser] = useState<{ username: string; id: string } | null>(
    () => {
      try {
        const stored = localStorage.getItem("perp_user");
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    },
  );
  const [currentSymbol, setCurrentSymbolState] = useState<SymbolType>("BTCUSD");
  const [orderbook, setOrderbook] = useState<OrderbookState>({
    asks: [],
    bids: [],
  });
  const [lastTradedPrice, setLastTradedPrice] = useState<number | null>(null);
  const [indexPrice, setIndexPrice] = useState<number | null>(null);
  const [lastTradedPrices, setLastTradedPrices] = useState<
    Partial<Record<SymbolType, number>>
  >({});
  const [indexPrices, setIndexPrices] = useState<
    Partial<Record<SymbolType, number>>
  >({});
  const [trades, setTrades] = useState<Trade[]>([]);
  const [balance, setBalance] = useState<BalanceInfo>({
    available: 0,
    locked: 0,
  });
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextReqIdRef = useRef(1);
  const depthSyncRef = useRef<Record<string, DepthSyncInfo>>({});
  const pendingDepthRequestsRef = useRef<Map<string, SymbolType>>(new Map());
  const eventsSubscribedRef = useRef(false);
  const currentSymbolRef = useRef<SymbolType>(currentSymbol);
  const tokenRef = useRef<string | null>(token);

  const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3000";

  const getNextRequestId = useCallback(() => {
    const id = `req_${nextReqIdRef.current++}`;
    return id;
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const logout = useCallback(() => {
    localStorage.removeItem("perp_token");
    localStorage.removeItem("perp_user");
    setToken(null);
    tokenRef.current = null;
    setUser(null);
    setBalance({ available: 0, locked: 0 });
    setPositions({});
    setOpenOrders([]);
    setWsConnected(false);
    eventsSubscribedRef.current = false;
    depthSyncRef.current = {};
    pendingDepthRequestsRef.current.clear();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const login = async (
    username: string,
    password: string,
  ): Promise<boolean> => {
    try {
      setError(null);
      const jwt_token = await apiSignIn(username, password);
      const payloadBase64 = jwt_token.split(".")[1];
      const decoded = JSON.parse(atob(payloadBase64));
      const userInfo = { username: decoded.username, id: decoded.id };
      localStorage.setItem("perp_token", jwt_token);
      localStorage.setItem("perp_user", JSON.stringify(userInfo));
      tokenRef.current = jwt_token;
      setToken(jwt_token);
      setUser(userInfo);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      return false;
    }
  };

  const signUp = async (
    username: string,
    password: string,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      setError(null);
      await apiSignUp(username, password);
      return {
        success: true,
        message: "Account created successfully! Please sign in.",
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Signup failed",
      };
    }
  };

  const sendWsMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const applyBalancePayload = useCallback(
    (payload: unknown) => {
      if (
        typeof payload === "object" &&
        payload !== null &&
        "balance" in payload
      ) {
        const { balance: available, lockedBalance } = payload as {
          balance: number;
          lockedBalance: number;
        };
        setBalance({ available, locked: lockedBalance });
      }
    },
    [],
  );

  const requestDepthSnapshot = useCallback(
    (symbol: SymbolType) => {
      const existing = depthSyncRef.current[symbol];
      depthSyncRef.current[symbol] = {
        state: "fetching",
        buffer: existing?.buffer ?? [],
        lastAppliedDepthId: existing?.lastAppliedDepthId ?? 0,
      };

      const reqId = getNextRequestId();
      pendingDepthRequestsRef.current.set(reqId, symbol);

      const syncInfo = depthSyncRef.current[symbol];
      const lastUpdatedDepthId = getLatestBufferedDepthId(syncInfo.buffer);
      const payload: {
        marketSymbol: SymbolType;
        lastUpdatedDepthId?: number;
      } = { marketSymbol: symbol };
      if (lastUpdatedDepthId !== undefined) {
        payload.lastUpdatedDepthId = lastUpdatedDepthId;
      }

      sendWsMessage({
        requestId: reqId,
        type: "get_depth",
        payload,
      });
    },
    [getNextRequestId, sendWsMessage],
  );

  const startInitialDepthSync = useCallback(
    (symbol: SymbolType, subReqId: string) => {
      depthSyncRef.current[symbol] = createDepthSyncInfo(subReqId);
    },
    [],
  );

  const fetchBalanceAndPositions = useCallback(() => {
    sendWsMessage({
      requestId: getNextRequestId(),
      type: "get_balance",
      payload: {},
    });
    sendWsMessage({
      requestId: getNextRequestId(),
      type: "get_position",
      payload: {},
    });
  }, [sendWsMessage, getNextRequestId]);

  const refreshOpenOrders = useCallback(async () => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;
    try {
      const orders = await fetchOpenOrders(
        activeToken,
        currentSymbolRef.current,
      );
      setOpenOrders(orders.map(mapOpenOrder));
    } catch (err) {
      console.error("[HTTP] Failed to fetch open orders:", err);
    }
  }, []);

  const loadHistoricalTrades = useCallback(async (symbol: SymbolType) => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;
    try {
      const fills = await fetchUserFills(activeToken);
      const symbolFills = fills
        .filter((fill) => fill.symbol === symbol)
        .slice(0, 50)
        .map((fill) => ({
          price: parseDecimal(fill.price),
          qty: parseDecimal(fill.quantity),
          time: new Date().toLocaleTimeString(),
        }));
      setTrades(symbolFills);
    } catch (err) {
      console.error("[HTTP] Failed to fetch trades:", err);
    }
  }, []);

  const placeOrder = useCallback(
    async (params: {
      side: OrderSide;
      type: OrderType;
      price: number;
      qty: number;
      margin: number;
      marginType: MarginType;
    }): Promise<boolean> => {
      if (!tokenRef.current) {
        setError("Please sign in to trade");
        return false;
      }
      const reqId = getNextRequestId();
      sendWsMessage({
        requestId: reqId,
        type: "create_order",
        payload: {
          side: params.side,
          type: params.type,
          price: params.price,
          qty: params.qty,
          margin: params.margin,
          marginType: params.marginType,
          marketSymbol: currentSymbolRef.current,
        },
      });
      setNotice("Order submitted");
      return true;
    },
    [getNextRequestId, sendWsMessage],
  );

  const cancelOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      if (!tokenRef.current) return false;
      sendWsMessage({
        requestId: getNextRequestId(),
        type: "cancel_order",
        payload: { orderId },
      });
      setNotice("Cancel request sent");
      return true;
    },
    [getNextRequestId, sendWsMessage],
  );

  const addBalance = useCallback(
    (marketSymbol: string, amount: number) => {
      if (!tokenRef.current) return;
      sendWsMessage({
        requestId: getNextRequestId(),
        type: "add_balance",
        payload: { marketSymbol, amount },
      });
    },
    [getNextRequestId, sendWsMessage],
  );

  const handleDepthSnapshot = useCallback(
    (symbol: SymbolType, payload: Record<string, unknown>) => {
      const syncInfo = depthSyncRef.current[symbol];
      const snapshotDepthId = (payload.lastUpdatedDepthId as number) ?? 0;
      const snapshotBook = applyDepthSnapshot(
        (payload.asks as { price: number; quantity: number }[]) || [],
        (payload.bids as { price: number; quantity: number }[]) || [],
      );
      const buffered = syncInfo?.buffer ?? [];
      const { book, lastAppliedDepthId } = reconcileBufferedDepthUpdates(
        snapshotBook,
        snapshotDepthId,
        buffered,
      );

      if (symbol === currentSymbolRef.current) {
        setOrderbook(book);
      }

      depthSyncRef.current[symbol] = {
        state: "live",
        buffer: [],
        lastAppliedDepthId,
      };
    },
    [],
  );

  const connectWebSocket = useCallback(() => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(`${WS_URL}?jwt_token=${activeToken}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setError(null);
      eventsSubscribedRef.current = false;

      const subReqId = getNextRequestId();
      startInitialDepthSync(currentSymbolRef.current, subReqId);

      ws.send(
        JSON.stringify({
          requestId: subReqId,
          type: "subscribe_event",
          payload: { events: [...ALL_MARKET_EVENTS] },
        }),
      );

      ws.send(
        JSON.stringify({
          requestId: getNextRequestId(),
          type: "get_balance",
          payload: {},
        }),
      );
      ws.send(
        JSON.stringify({
          requestId: getNextRequestId(),
          type: "get_position",
          payload: {},
        }),
      );

      void refreshOpenOrders();
      void loadHistoricalTrades(currentSymbolRef.current);
    };

    ws.onclose = (event) => {
      setWsConnected(false);
      eventsSubscribedRef.current = false;

      if (event.code === 4001) {
        logout();
        setError("Your session has expired. Please sign in again.");
        return;
      }

      if (tokenRef.current) {
        reconnectTimerRef.current = setTimeout(() => connectWebSocket(), 3000);
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, payload, requestId } = msg;

        if (type === "depth" && payload) {
          const symbol =
            pendingDepthRequestsRef.current.get(requestId) ??
            currentSymbolRef.current;
          pendingDepthRequestsRef.current.delete(requestId);
          handleDepthSnapshot(symbol, payload);
          return;
        }

        if (type === "event_subscribed") {
          eventsSubscribedRef.current = true;
          const symbol = currentSymbolRef.current;
          const syncInfo = depthSyncRef.current[symbol];
          if (
            syncInfo?.state === "subscribing" &&
            syncInfo.subReqId === requestId
          ) {
            requestDepthSnapshot(symbol);
          }
          return;
        }

        if (type === "balance") {
          applyBalancePayload(payload);
          return;
        }

        if (type === "balance_updated") {
          applyBalancePayload(payload);
          return;
        }

        if (type === "position" && payload) {
          const mapped: Record<string, Position> = {};
          for (const [symbol, pos] of Object.entries(
            payload as Record<string, Record<string, unknown>>,
          )) {
            mapped[symbol] = {
              positionId: `${pos.userId}_${symbol}`,
              userId: String(pos.userId),
              price: Number(pos.price),
              qty: Number(pos.quantity ?? pos.qty ?? 0),
              type: pos.type as "LONG" | "SHORT",
              marketSymbol: symbol as SymbolType,
              margin: Number(pos.margin),
              marginType: pos.marginType as MarginType,
            };
          }
          setPositions(mapped);
          return;
        }

        if (type === "order_created") {
          setNotice("Order placed successfully");
          setTimeout(() => {
            fetchBalanceAndPositions();
            void refreshOpenOrders();
          }, 150);
          return;
        }

        if (type === "order_cancelled") {
          setNotice("Order cancelled");
          setTimeout(() => {
            fetchBalanceAndPositions();
            void refreshOpenOrders();
          }, 150);
          return;
        }

        if (type === "error" && payload) {
          setError(String(payload));
          return;
        }

        if (type === "event" && payload?.type) {
          const { type: eventType, data } = payload;
          const activeSymbol = currentSymbolRef.current;

          if (eventType === "depth.updated" && data) {
            const symbol = data.marketSymbol as SymbolType;
            const syncInfo = depthSyncRef.current[symbol];
            const updateId = data.lastUpdatedDepthId as number | undefined;
            if (!syncInfo || updateId === undefined) return;

            const update = {
              lastUpdatedDepthId: updateId,
              asks: data.depthUpdates?.asks ?? {},
              bids: data.depthUpdates?.bids ?? {},
            };

            if (
              syncInfo.state === "subscribing" ||
              syncInfo.state === "fetching"
            ) {
              syncInfo.buffer.push(update);
            } else if (
              syncInfo.state === "live" &&
              symbol === activeSymbol &&
              shouldApplyLiveDepthUpdate(updateId, syncInfo.lastAppliedDepthId)
            ) {
              setOrderbook((prev) => applyDepthUpdate(prev, update));
              syncInfo.lastAppliedDepthId = updateId;
            }
            return;
          }

          if (eventType === "lastTradedPrice.updated" && data) {
            const symbol = data.marketSymbol as SymbolType;
            setLastTradedPrices((prev) => ({
              ...prev,
              [symbol]: data.price,
            }));
            if (symbol === activeSymbol) {
              setLastTradedPrice(data.price);
            }
            return;
          }

          if (eventType === "indexprice.updated" && data) {
            const symbol = data.marketSymbol as SymbolType;
            setIndexPrices((prev) => ({ ...prev, [symbol]: data.price }));
            if (symbol === activeSymbol) {
              setIndexPrice(data.price);
            }
            return;
          }

          if (eventType === "trades.created" && data) {
            const symbol = data.marketSymbol as SymbolType;
            if (symbol !== activeSymbol) return;
            const newTrades = (data.trades || []).map(
              ([price, qty]: [number, number]) => ({
                price,
                qty,
                time: new Date().toLocaleTimeString(),
              }),
            );
            setTrades((prev) => [...newTrades, ...prev].slice(0, 50));
            setTimeout(fetchBalanceAndPositions, 100);
            return;
          }

          if (eventType === "fills.created") {
            setTimeout(() => {
              fetchBalanceAndPositions();
              void refreshOpenOrders();
            }, 100);
          }
        }
      } catch (err) {
        console.error("[WS] Error handling message:", err);
      }
    };
  }, [
    WS_URL,
    applyBalancePayload,
    fetchBalanceAndPositions,
    getNextRequestId,
    handleDepthSnapshot,
    loadHistoricalTrades,
    logout,
    refreshOpenOrders,
    requestDepthSnapshot,
    startInitialDepthSync,
  ]);

  useEffect(() => {
    tokenRef.current = token;
    if (!token) return;

    connectWebSocket();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
      depthSyncRef.current = {};
      pendingDepthRequestsRef.current.clear();
      eventsSubscribedRef.current = false;
    };
  }, [token, connectWebSocket]);

  const setCurrentSymbol = useCallback(
    (symbol: SymbolType) => {
      if (symbol === currentSymbolRef.current) return;
      currentSymbolRef.current = symbol;
      setCurrentSymbolState(symbol);

      setOrderbook({ asks: [], bids: [] });
      setTrades([]);
      setLastTradedPrice(lastTradedPrices[symbol] ?? null);
      setIndexPrice(indexPrices[symbol] ?? null);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        if (eventsSubscribedRef.current) {
          requestDepthSnapshot(symbol);
        }
        void refreshOpenOrders();
        void loadHistoricalTrades(symbol);
      }
    },
    [
      indexPrices,
      lastTradedPrices,
      loadHistoricalTrades,
      refreshOpenOrders,
      requestDepthSnapshot,
    ],
  );

  useEffect(() => {
    if (!wsConnected || !token) return;
    const interval = setInterval(() => {
      fetchBalanceAndPositions();
      void refreshOpenOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, [wsConnected, token, fetchBalanceAndPositions, refreshOpenOrders]);

  return (
    <TradingContext.Provider
      value={{
        isAuthenticated: !!token,
        user,
        token,
        currentSymbol,
        setCurrentSymbol,
        orderbook,
        lastTradedPrice,
        indexPrice,
        lastTradedPrices,
        indexPrices,
        trades,
        balance,
        positions,
        openOrders,
        wsConnected,
        error,
        notice,
        setError,
        clearNotice,
        login,
        signUp,
        logout,
        placeOrder,
        cancelOrder,
        addBalance,
        fetchBalanceAndPositions,
        refreshOpenOrders,
      }}
    >
      {children}
    </TradingContext.Provider>
  );
};
