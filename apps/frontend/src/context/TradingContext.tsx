import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

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

export interface TradingContextProps {
  isAuthenticated: boolean;
  user: { username: string; id: string } | null;
  token: string | null;
  currentSymbol: SymbolType;
  setCurrentSymbol: (marketSymbol: SymbolType) => void;
  orderbook: { asks: [number, number][]; bids: [number, number][] };
  lastTradedPrice: number | null;
  indexPrice: number | null;
  trades: { price: number; qty: number; side?: "BUY" | "SELL"; time: string }[];
  balances: Record<string, number>;
  positions: Record<string, Position>;
  wsConnected: boolean;
  error: string | null;
  setError: (err: string | null) => void;
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
  }) => void;
  addBalance: (marketSymbol: string, amount: number) => void;
  fetchBalanceAndPositions: () => void;
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

// ─── Depth sync state machine ────────────────────────────────────────────────
// For each symbol we can be in one of three states:
//   "subscribing"  → subscribe_event sent, waiting for confirmation
//   "fetching"     → subscription confirmed, get_depth sent, buffering updates
//   "live"         → snapshot applied, processing updates normally
type DepthSyncState = "subscribing" | "fetching" | "live";

interface DepthSyncInfo {
  state: DepthSyncState;
  // Buffered depth updates that arrived while we were in "fetching" state
  buffer: Array<{
    asks: Record<string, number>;
    bids: Record<string, number>;
  }>;
}

export const TradingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("perp_token");
  });
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
  const [orderbook, setOrderbook] = useState<{
    asks: [number, number][];
    bids: [number, number][];
  }>({ asks: [], bids: [] });
  const [lastTradedPrice, setLastTradedPrice] = useState<number | null>(null);
  const [indexPrice, setIndexPrice] = useState<number | null>(null);
  const [trades, setTrades] = useState<
    { price: number; qty: number; side?: "BUY" | "SELL"; time: string }[]
  >([]);
  const [balances, setBalances] = useState<Record<string, number>>({
    USD: 0,
    BTCUSD: 0,
    SOLUSD: 0,
    ETHUSD: 0,
  });
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const nextReqIdRef = useRef<number>(1);
  // Track depth sync state per symbol
  const depthSyncRef = useRef<Record<string, DepthSyncInfo>>({});
  // Keep a ref to currentSymbol so message handlers can read it without stale closure
  const currentSymbolRef = useRef<SymbolType>(currentSymbol);

  const API_URL = "http://localhost:3001";
  const WS_URL = "ws://localhost:3000";

  const getNextRequestId = useCallback(() => {
    const id = `req_${nextReqIdRef.current}`;
    nextReqIdRef.current += 1;
    return id;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("perp_token");
    localStorage.removeItem("perp_user");
    setToken(null);
    setUser(null);
    setBalances({ USD: 0, BTCUSD: 0, SOLUSD: 0, ETHUSD: 0 });
    setPositions({});
    setWsConnected(false);
    depthSyncRef.current = {};
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
      const res = await fetch(`${API_URL}/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && !data.error && data.payload?.jwt_token) {
        const jwt_token = data.payload.jwt_token;
        try {
          const payloadBase64 = jwt_token.split(".")[1];
          const decoded = JSON.parse(atob(payloadBase64));
          const userInfo = { username: decoded.username, id: decoded.id };
          localStorage.setItem("perp_token", jwt_token);
          localStorage.setItem("perp_user", JSON.stringify(userInfo));
          setToken(jwt_token);
          setUser(userInfo);
          return true;
        } catch (err) {
          setError("Failed to decode token");
          return false;
        }
      } else {
        setError(data.payload || "Incorrect credentials");
        return false;
      }
    } catch (err) {
      setError("Network error connecting to auth server");
      return false;
    }
  };

  const signUp = async (
    username: string,
    password: string,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        return {
          success: true,
          message: "Account created successfully! Please sign in.",
        };
      } else {
        return {
          success: false,
          message: data.payload || "Username already exists",
        };
      }
    } catch (err) {
      return { success: false, message: "Network error during signup" };
    }
  };

  const sendWsMessage = useCallback((msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const fetchBalanceAndPositions = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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
    }
  }, [sendWsMessage, getNextRequestId]);

  /**
   * Apply a depth snapshot to the orderbook state.
   */
  const applyDepthSnapshot = useCallback(
    (
      snapshotAsks: { price: number; quantity: number }[],
      snapshotBids: { price: number; quantity: number }[],
    ) => {
      const asksMap = new Map<number, number>();
      const bidsMap = new Map<number, number>();

      for (const { price, quantity } of snapshotAsks) {
        if (quantity > 0) asksMap.set(price, quantity);
      }
      for (const { price, quantity } of snapshotBids) {
        if (quantity > 0) bidsMap.set(price, quantity);
      }

      return {
        asks: Array.from(asksMap.entries()).sort((a, b) => a[0] - b[0]) as [number, number][],
        bids: Array.from(bidsMap.entries()).sort((a, b) => b[0] - a[0]) as [number, number][],
      };
    },
    [],
  );

  /**
   * Apply a single depth delta update to an existing orderbook map state.
   */
  const applyDepthUpdate = useCallback(
    (
      prev: { asks: [number, number][]; bids: [number, number][] },
      update: { asks: Record<string, number>; bids: Record<string, number> },
    ): { asks: [number, number][]; bids: [number, number][] } => {
      const asksMap = new Map<number, number>(prev.asks);
      const bidsMap = new Map<number, number>(prev.bids);

      if (update.asks) {
        for (const [priceStr, qty] of Object.entries(update.asks)) {
          const price = parseFloat(priceStr);
          if (qty === 0) asksMap.delete(price);
          else asksMap.set(price, qty);
        }
      }

      if (update.bids) {
        for (const [priceStr, qty] of Object.entries(update.bids)) {
          const price = parseFloat(priceStr);
          if (qty === 0) bidsMap.delete(price);
          else bidsMap.set(price, qty);
        }
      }

      return {
        asks: Array.from(asksMap.entries()).sort((a, b) => a[0] - b[0]) as [number, number][],
        bids: Array.from(bidsMap.entries()).sort((a, b) => b[0] - a[0]) as [number, number][],
      };
    },
    [],
  );

  /**
   * Initiate depth sync for a given symbol.
   * 
   * Protocol (Binance-style without explicit sequence IDs since engine doesn't send them):
   *   1. Send subscribe_event for depth.updated
   *   2. Buffer all depth.updated events that arrive
   *   3. Once subscribe_event is confirmed (event_subscribed), send get_depth
   *   4. When depth snapshot arrives, apply it, then replay all buffered updates on top
   *   5. Subsequent updates are applied directly (live state)
   * 
   * NOTE: Since the engine does not send lastUpdateId sequence numbers,
   * we can't do ID-based filtering. Instead we rely on ordering:
   *   - All buffered updates were emitted AFTER we started listening (step 1)
   *   - The snapshot is a point-in-time view taken AFTER buffering started  
   *   - So snapshot >= buffer start ⟹ all buffered updates after the snapshot
   *     are valid deltas. But we can't know which buffered updates are before
   *     the snapshot vs after. The safest approach: after receiving snapshot,
   *     discard the buffer (the snapshot already includes those changes) OR
   *     apply buffer naively on top (may double-apply but self-corrects next update).
   * 
   * Since the engine sends FULL level quantities (not just deltas to a running total),
   * applying buffer updates on top of the snapshot is idempotent and safe.
   * qty=0 removes the level, qty>0 sets/overwrites the level.
   */
  const startDepthSync = useCallback(
    (symbol: SymbolType) => {
      console.log(`[DEPTH] Starting sync for ${symbol}`);

      // Reset state for this symbol
      depthSyncRef.current[symbol] = {
        state: "subscribing",
        buffer: [],
      };

      // Step 1: Subscribe to depth.updated events FIRST
      const subReqId = `sub_depth_${symbol}_${Date.now()}`;
      sendWsMessage({
        requestId: subReqId,
        type: "subscribe_event",
        payload: {
          events: ["depth.updated"],
        },
      });

      console.log(`[DEPTH] Subscribe sent for ${symbol}, reqId: ${subReqId}`);
      // The onmessage handler will catch event_subscribed response,
      // then send get_depth and transition to "fetching" state
      // We store the subReqId so we know which response corresponds to this subscription
      depthSyncRef.current[symbol].buffer = [];
      // @ts-ignore - stash for response matching
      depthSyncRef.current[symbol].subReqId = subReqId;
    },
    [sendWsMessage],
  );

  const placeOrder = useCallback(
    (params: {
      side: OrderSide;
      type: OrderType;
      price: number;
      qty: number;
      margin: number;
      marginType: MarginType;
    }) => {
      if (!token) {
        setError("Please sign in to trade");
        return;
      }
      sendWsMessage({
        requestId: getNextRequestId(),
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
    },
    [token, sendWsMessage, getNextRequestId],
  );

  const addBalance = useCallback(
    (marketSymbol: string, amount: number) => {
      if (!token) return;
      sendWsMessage({
        requestId: getNextRequestId(),
        type: "add_balance",
        payload: {
          marketSymbol,
          amount,
        },
      });
    },
    [token, sendWsMessage, getNextRequestId],
  );

  // ─── WebSocket Connection Lifecycle ────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    console.log("[WS] Connecting to WebSocket");

    const ws = new WebSocket(`${WS_URL}?jwt_token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setError(null);
      console.log("[WS] Connected");

      // Subscribe to non-depth events immediately
      ws.send(
        JSON.stringify({
          requestId: getNextRequestId(),
          type: "subscribe_event",
          payload: {
            events: [
              "lastTradedPrice.updated",
              "trades.created",
              "indexprice.updated",
            ],
          },
        }),
      );

      // Fetch balance and positions
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

      // Start depth sync for current symbol
      // (startDepthSync is defined below, but onopen runs after mount so ref is stable)
      startDepthSync(currentSymbolRef.current);
    };

    ws.onclose = (event) => {
      setWsConnected(false);
      depthSyncRef.current = {};
      if (event.code === 4001) {
        console.warn("[WS] Closed: unauthorized/expired token");
        logout();
        setError("Your session has expired. Please sign in again.");
      } else {
        console.log(`[WS] Closed with code: ${event.code}`);
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, payload, requestId } = msg;

        // ── Direct responses (type-dispatched) ──────────────────────────────

        // Depth snapshot response
        if (type === "depth" && payload) {
          const symbol = currentSymbolRef.current;
          const syncInfo = depthSyncRef.current[symbol];
          console.log(`[DEPTH] Snapshot received for ${symbol}, state: ${syncInfo?.state}`);

          if (!syncInfo || syncInfo.state !== "fetching") {
            // Unexpected or stale snapshot — still apply it as best effort
            console.warn(`[DEPTH] Received snapshot in unexpected state for ${symbol}`);
          }

          // Build snapshot orderbook
          const snapshotBook = applyDepthSnapshot(
            payload.asks || [],
            payload.bids || [],
          );

          // Replay all buffered updates on top of the snapshot
          const buffered = syncInfo?.buffer ?? [];
          console.log(`[DEPTH] Replaying ${buffered.length} buffered updates for ${symbol}`);

          let book = snapshotBook;
          for (const update of buffered) {
            book = applyDepthUpdate(book, update);
          }

          setOrderbook(book);

          // Transition to live
          if (depthSyncRef.current[symbol]) {
            depthSyncRef.current[symbol].state = "live";
            depthSyncRef.current[symbol].buffer = [];
          }
          return;
        }

        // event_subscribed — check if this is a depth subscription confirmation
        if (type === "event_subscribed" && payload) {
          // Check if we're waiting for a depth subscription to confirm
          const symbol = currentSymbolRef.current;
          const syncInfo = depthSyncRef.current[symbol];

          // @ts-ignore
          if (syncInfo && syncInfo.state === "subscribing" && requestId === syncInfo.subReqId) {
            console.log(`[DEPTH] Subscription confirmed for ${symbol}, sending get_depth`);
            syncInfo.state = "fetching";

            // Step 3: Now send get_depth
            const depthReqId = `get_depth_${symbol}_${Date.now()}`;
            // @ts-ignore
            syncInfo.depthReqId = depthReqId;
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  requestId: depthReqId,
                  type: "get_depth",
                  payload: { marketSymbol: symbol },
                }),
              );
            }
          }
          return;
        }

        // Balance response
        if (type === "balance" && payload !== undefined) {
          const usdBalance =
            typeof payload === "object" && payload !== null && "balance" in payload
              ? (payload as { balance: number; lockedBalance: number }).balance
              : typeof payload === "number"
                ? payload
                : 0;
          setBalances((prev) => ({ ...prev, USD: usdBalance }));
          return;
        }

        // Positions response
        if (type === "position" && payload) {
          const mapped: Record<string, Position> = {};
          for (const [symbol, pos] of Object.entries(
            payload as Record<string, any>,
          )) {
            mapped[symbol] = {
              positionId: `${pos.userId}_${symbol}`,
              userId: pos.userId,
              price: pos.price,
              qty: pos.quantity ?? pos.qty ?? 0,
              type: pos.type,
              marketSymbol: symbol as any,
              margin: pos.margin,
              marginType: pos.marginType,
            };
          }
          setPositions(mapped);
          return;
        }

        // Order created
        if (type === "order_created") {
          setTimeout(fetchBalanceAndPositions, 100);
          return;
        }

        // Balance updated
        if (type === "balance_updated" && payload !== undefined) {
          const usdBalance =
            typeof payload === "object" && payload !== null && "balance" in payload
              ? (payload as { balance: number; lockedBalance: number }).balance
              : 0;
          setBalances((prev) => ({ ...prev, USD: usdBalance }));
          return;
        }

        // Error
        if (type === "error" && payload) {
          setError(payload);
          return;
        }

        // ── Broadcasted engine events ────────────────────────────────────────
        // Engine events have shape: { type: "event", idempotencyKey: ..., payload: { type: "...", data: {...} } }
        if (type === "event" && payload && payload.type) {
          const { type: eventType, data } = payload;
          const activeSymbol = currentSymbolRef.current;

          if (eventType === "depth.updated" && data) {
            // Always buffer or apply depending on sync state
            const symbol = data.marketSymbol as SymbolType;
            const syncInfo = depthSyncRef.current[symbol];

            if (!syncInfo) {
              // No sync started for this symbol — ignore
              console.log(`[DEPTH] Received update for ${symbol} but no sync started, ignoring`);
              return;
            }

            const update = {
              asks: data.depthUpdates?.asks ?? {},
              bids: data.depthUpdates?.bids ?? {},
            };

            if (syncInfo.state === "subscribing" || syncInfo.state === "fetching") {
              // Buffer the update — we haven't received the snapshot yet
              syncInfo.buffer.push(update);
              console.log(`[DEPTH] Buffered update for ${symbol} (state: ${syncInfo.state}), buffer size: ${syncInfo.buffer.length}`);
            } else if (syncInfo.state === "live") {
              // Apply immediately to the current orderbook
              if (symbol === activeSymbol) {
                setOrderbook((prev) => applyDepthUpdate(prev, update));
              }
            }
            return;
          }

          if (
            eventType === "lastTradedPrice.updated" &&
            data &&
            data.marketSymbol === currentSymbolRef.current
          ) {
            setLastTradedPrice(data.price);
            return;
          }

          if (
            eventType === "indexprice.updated" &&
            data &&
            data.marketSymbol === currentSymbolRef.current
          ) {
            setIndexPrice(data.price);
            return;
          }

          if (
            eventType === "trades.created" &&
            data &&
            data.marketSymbol === currentSymbolRef.current
          ) {
            const newTrades = (data.trades || []).map(([price, qty]: any) => ({
              price,
              qty,
              time: new Date().toLocaleTimeString(),
            }));
            setTrades((prev) => [...newTrades, ...prev].slice(0, 50));
            setTimeout(fetchBalanceAndPositions, 100);
            return;
          }
        }
      } catch (err) {
        console.error("[WS] Error handling message:", err);
      }
    };

    return () => {
      console.log("[WS] Cleaning up WebSocket connection");
      ws.close();
      wsRef.current = null;
      depthSyncRef.current = {};
    };
  }, [token]); // Only reconnect when token changes

  // ─── Symbol Change Handler ─────────────────────────────────────────────────
  const setCurrentSymbol = useCallback(
    (symbol: SymbolType) => {
      if (symbol === currentSymbolRef.current) return;
      currentSymbolRef.current = symbol;
      setCurrentSymbolState(symbol);

      // Reset market data for new symbol
      setOrderbook({ asks: [], bids: [] });
      setTrades([]);
      setLastTradedPrice(null);
      setIndexPrice(null);

      // Start fresh depth sync for the new symbol
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        startDepthSync(symbol);
      }
    },
    [startDepthSync],
  );

  // ─── Sync currentSymbolRef when state changes ──────────────────────────────
  // (currentSymbolRef is already updated in setCurrentSymbol directly)

  // ─── Polling for balance/positions ─────────────────────────────────────────
  useEffect(() => {
    if (!wsConnected || !token) return;

    const interval = setInterval(() => {
      fetchBalanceAndPositions();
    }, 3000);

    return () => clearInterval(interval);
  }, [wsConnected, token, fetchBalanceAndPositions]);

  const isAuthenticated = !!token;

  return (
    <TradingContext.Provider
      value={{
        isAuthenticated,
        user,
        token,
        currentSymbol,
        setCurrentSymbol,
        orderbook,
        lastTradedPrice,
        indexPrice,
        trades,
        balances,
        positions,
        wsConnected,
        error,
        setError,
        login,
        signUp,
        logout,
        placeOrder,
        addBalance,
        fetchBalanceAndPositions,
      }}
    >
      {children}
    </TradingContext.Provider>
  );
};
