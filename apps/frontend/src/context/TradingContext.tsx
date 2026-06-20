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
  symbol: SymbolType;
  margin: number;
  marginType: MarginType;
}

export interface TradingContextProps {
  isAuthenticated: boolean;
  user: { username: string; id: string } | null;
  token: string | null;
  currentSymbol: SymbolType;
  setCurrentSymbol: (symbol: SymbolType) => void;
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
  addBalance: (symbol: string, amount: number) => void;
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

export const TradingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ username: string; id: string } | null>(
    null,
  );
  const [currentSymbol, setCurrentSymbol] = useState<SymbolType>("BTCUSD");
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

  const API_URL = "http://localhost:3001";
  const WS_URL = "ws://localhost:3000";

  const getNextRequestId = () => {
    const id = `req_${nextReqIdRef.current}`;
    nextReqIdRef.current += 1;
    return id;
  };

  const logout = useCallback(() => {
    localStorage.removeItem("perp_token");
    localStorage.removeItem("perp_user");
    setToken(null);
    setUser(null);
    setBalances({ USD: 0, BTCUSD: 0, SOLUSD: 0, ETHUSD: 0 });
    setPositions({});
    setWsConnected(false);
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

        // Simple JWT decode to extract user payload
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
  }, [sendWsMessage]);

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
          symbol: currentSymbol,
        },
      });
    },
    [currentSymbol, token, sendWsMessage],
  );

  const addBalance = useCallback(
    (symbol: string, amount: number) => {
      if (!token) return;
      sendWsMessage({
        requestId: getNextRequestId(),
        type: "add_balance",
        payload: {
          symbol,
          amount,
        },
      });
    },
    [token, sendWsMessage],
  );

  // Handle WebSocket Connection
  useEffect(() => {
    if (!token) return;
    console.log("called again");

    const ws = new WebSocket(`${WS_URL}?jwt_token=${token}`);
    console.log(token);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setError(null);

      // Subscribe to events
      ws.send(
        JSON.stringify({
          requestId: getNextRequestId(),
          type: "subscribe_event",
          payload: {
            events: [
              "depth.updated",
              "lastTradedPrice.updated",
              "trades.created",
              "indexprice.updated",
            ],
          },
        }),
      );

      // Initial data fetches
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

      ws.send(
        JSON.stringify({
          requestId: `get_orderbook_${currentSymbol}`,
          type: "get_orderbook",
          payload: {
            symbol: currentSymbol,
          },
        }),
      );
    };

    ws.onclose = (event) => {
      setWsConnected(false);
      if (event.code === 4001) {
        console.warn("WebSocket closed due to unauthorized/expired token.");
        logout();
        setError("Your session has expired. Please sign in again.");
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, payload } = msg;

        // 1. Initial orderbook fetch response
        if (type === "orderbook" && payload) {
          const asks = (payload.ASKS || []).map(([price, details]: any) => [
            parseFloat(price),
            typeof details === "object"
              ? details.totalQuantity
              : parseFloat(details),
          ]);
          const bids = (payload.BIDS || []).map(([price, details]: any) => [
            parseFloat(price),
            typeof details === "object"
              ? details.totalQuantity
              : parseFloat(details),
          ]);
          setOrderbook({
            asks: asks.sort((a: any, b: any) => a[0] - b[0]),
            bids: bids.sort((a: any, b: any) => b[0] - a[0]),
          });
        }

        // 2. Balance fetch response
        else if (type === "balance" && payload !== undefined) {
          setBalances((prev) => {
            if (typeof payload === "number") {
              return { ...prev, USD: payload }; // default USD
            } else {
              return { ...prev, ...payload };
            }
          });
        }

        // 3. Positions fetch response
        else if (type === "position" && payload) {
          setPositions(payload);
        }

        // 4. Order created notification
        else if (type === "order_created") {
          // Instantly refresh balance & positions
          setTimeout(fetchBalanceAndPositions, 100);
        }

        // 5. Error messages from engine
        else if (type === "error" && payload) {
          setError(payload);
        }

        // 6. Broadcasted events
        else if (payload && payload.type) {
          const { type: eventType, data } = payload;

          if (
            eventType === "depth.updated" &&
            data &&
            data.symbol === currentSymbol
          ) {
            setOrderbook((prev) => {
              const asksMap = new Map(prev.asks);
              const bidsMap = new Map(prev.bids);

              if (data.depthUpdates?.asks) {
                Object.entries(data.depthUpdates.asks).forEach(
                  ([priceStr, qty]: any) => {
                    const price = parseFloat(priceStr);
                    if (qty === 0) asksMap.delete(price);
                    else asksMap.set(price, qty);
                  },
                );
              }

              if (data.depthUpdates?.bids) {
                Object.entries(data.depthUpdates.bids).forEach(
                  ([priceStr, qty]: any) => {
                    const price = parseFloat(priceStr);
                    if (qty === 0) bidsMap.delete(price);
                    else bidsMap.set(price, qty);
                  },
                );
              }

              return {
                asks: Array.from(asksMap.entries()).sort((a, b) => a[0] - b[0]),
                bids: Array.from(bidsMap.entries()).sort((a, b) => b[0] - a[0]),
              };
            });
          } else if (
            eventType === "lastTradedPrice.updated" &&
            data &&
            data.symbol === currentSymbol
          ) {
            setLastTradedPrice(data.price);
          } else if (
            eventType === "indexprice.updated" &&
            data &&
            data.symbol === currentSymbol
          ) {
            setIndexPrice(data.price);
          } else if (
            eventType === "trades.created" &&
            data &&
            data.symbol === currentSymbol
          ) {
            const newTrades = (data.trades || []).map(([price, qty]: any) => ({
              price,
              qty,
              time: new Date().toLocaleTimeString(),
            }));
            setTrades((prev) => [...newTrades, ...prev].slice(0, 50));
            // Trigger fetch of balances and positions as trades indicate match executions!
            setTimeout(fetchBalanceAndPositions, 100);
          }
        }
      } catch (err) {
        console.error("Error handling message:", err);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token, currentSymbol, fetchBalanceAndPositions]);

  // Request new orderbook and trades list when symbol changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setOrderbook({ asks: [], bids: [] });
      setTrades([]);
      sendWsMessage({
        requestId: `get_orderbook_${currentSymbol}`,
        type: "get_orderbook",
        payload: {
          symbol: currentSymbol,
        },
      });
    }
  }, [currentSymbol, sendWsMessage]);

  // Regular polling interval (every 3 seconds) to keep balance and positions updated
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
