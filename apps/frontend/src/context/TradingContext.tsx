import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ALL_EVENTS } from "../lib/constants";
import {
  fetchCandles,
  fetchFills,
  fetchMarketTrades,
  fetchOpenOrders,
  signIn as apiSignIn,
  signUp as apiSignUp,
  type OpenOrder,
} from "../lib/api";
import { TradingSocket } from "../lib/ws/client";
import { OrderbookSync, type OrderbookView } from "../lib/sync/orderbookSync";
import { PersonalSync, type PersonalBalance } from "../lib/sync/personalSync";
import {
  CandlesSync,
  getCandleFetchLimit,
  getTimeframeConfig,
  type Candle,
  type ChartTimeframe,
} from "../lib/sync/candlesSync";
import { getLatestTradePrice, TradesSync } from "../lib/sync/tradesSync";
import type {
  BalanceSnapshot,
  DepthSnapshot,
  DepthUpdateData,
  MarginType,
  OrderType,
  PositionSnapshot,
  PriceUpdateData,
  PublicTrade,
  Side,
  TradableSymbol,
  TradesCreatedData,
  UiFill,
  UiPosition,
  UserFillData,
  WireOrder,
} from "../lib/types";

interface AuthUser {
  id: string;
  username: string;
}

function isRestingOpenOrder(order: Pick<OpenOrder, "type" | "status">): boolean {
  return (
    order.type === "LIMIT" &&
    (order.status === "OPEN" || order.status === "PARTIALLY_FILLED")
  );
}

type PriceMap = Partial<Record<TradableSymbol, number>>;

interface TradingContextValue {
  // auth
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  signUp: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; message: string }>;
  logout: () => void;

  // connection
  connected: boolean;

  // market
  currentSymbol: TradableSymbol;
  setCurrentSymbol: (symbol: TradableSymbol) => void;

  // streamed market data
  orderbook: OrderbookView;
  trades: PublicTrade[];
  candles: Candle[];
  candlesReady: boolean;
  candleTimeframe: ChartTimeframe;
  setCandleTimeframe: (timeframe: ChartTimeframe) => void;
  indexPrices: PriceMap;
  markPrices: PriceMap;
  lastPrices: PriceMap;
  indexPrice: number | null;
  markPrice: number | null;
  lastPrice: number | null;

  // account
  balance: PersonalBalance;
  positions: UiPosition[];
  openOrders: OpenOrder[];
  fills: UiFill[];

  // actions
  placeOrder: (params: {
    side: Side;
    type: OrderType;
    price: number;
    qty: number;
    margin: number;
    marginType: MarginType;
  }) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  addBalance: (amount: number) => Promise<void>;

  // notices
  error: string | null;
  notice: string | null;
  setError: (msg: string | null) => void;
  clearNotice: () => void;
}

const TradingContext = createContext<TradingContextValue | undefined>(undefined);

export function useTrading(): TradingContextValue {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error("useTrading must be used within TradingProvider");
  return ctx;
}

const EMPTY_BOOK: OrderbookView = { asks: [], bids: [] };

function decodeUser(token: string): AuthUser {
  const payload = JSON.parse(atob(token.split(".")[1]));
  return { id: payload.id, username: payload.username };
}

export function TradingProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("perp_token"),
  );
  const [user, setUser] = useState<AuthUser | null>(() => {
    const t = localStorage.getItem("perp_token");
    try {
      return t ? decodeUser(t) : null;
    } catch {
      return null;
    }
  });

  const [connected, setConnected] = useState(false);
  const [currentSymbol, setCurrentSymbolState] = useState<TradableSymbol>("SOLUSD");

  const [orderbook, setOrderbook] = useState<OrderbookView>(EMPTY_BOOK);
  const [trades, setTrades] = useState<PublicTrade[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [candlesReady, setCandlesReady] = useState(false);
  const [candleTimeframe, setCandleTimeframeState] =
    useState<ChartTimeframe>("5m");
  const [indexPrices, setIndexPrices] = useState<PriceMap>({});
  const [markPrices, setMarkPrices] = useState<PriceMap>({});
  const [lastPrices, setLastPrices] = useState<PriceMap>({});

  const [balance, setBalance] = useState<PersonalBalance>({
    available: 0,
    locked: 0,
  });
  const [positions, setPositions] = useState<UiPosition[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [fills, setFills] = useState<UiFill[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const socketRef = useRef<TradingSocket | null>(null);
  const orderbookSyncRef = useRef<OrderbookSync>(new OrderbookSync());
  const tradesSyncRef = useRef<TradesSync>(new TradesSync("SOLUSD"));
  const candlesSyncRef = useRef<CandlesSync>(new CandlesSync("SOLUSD", "5m"));
  const personalSyncRef = useRef<PersonalSync>(new PersonalSync());
  const openOrdersRef = useRef<Map<string, OpenOrder>>(new Map());
  const currentSymbolRef = useRef<TradableSymbol>(currentSymbol);
  const candleTimeframeRef = useRef<ChartTimeframe>(candleTimeframe);
  const tokenRef = useRef<string | null>(token);

  currentSymbolRef.current = currentSymbol;
  candleTimeframeRef.current = candleTimeframe;
  tokenRef.current = token;

  const clearNotice = useCallback(() => setNotice(null), []);

  const pushPersonalState = useCallback(() => {
    const sync = personalSyncRef.current;
    setBalance({ ...sync.getBalance() });
    setPositions(sync.getPositions());
    setFills(sync.getFills());
  }, []);

  const syncOpenOrders = useCallback(() => {
    setOpenOrders(
      [...openOrdersRef.current.values()].filter(isRestingOpenOrder),
    );
  }, []);

  // ---- HTTP recovery (seed on connect / symbol switch) ---------------------

  const loadOpenOrders = useCallback(async (symbol: TradableSymbol) => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;
    try {
      const orders = await fetchOpenOrders(activeToken, symbol);
      for (const order of orders) {
        if (isRestingOpenOrder(order)) {
          openOrdersRef.current.set(order.orderId, order);
        }
      }
      syncOpenOrders();
    } catch {
      // db poller may lag; live order events keep us in sync regardless
    }
  }, [syncOpenOrders]);

  const loadFills = useCallback(async () => {
    const activeToken = tokenRef.current;
    if (!activeToken || !user) return;
    try {
      const historical = await fetchFills(activeToken);
      const mapped: UiFill[] = historical.map((f) => ({
        fillId: f.fillId,
        marketSymbol: f.marketSymbol,
        side: f.longUserId === user.id ? "BUY" : "SELL",
        price: f.price,
        qty: f.qty,
        status: "FILLED",
        time: f.time,
      }));
      if (mapped.length) {
        personalSyncRef.current.seedFills(mapped);
        pushPersonalState();
      }
    } catch {
      // ignore
    }
  }, [user, pushPersonalState]);

  const loadMarketTrades = useCallback(async (symbol: TradableSymbol) => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;
    try {
      const snapshot = await fetchMarketTrades(activeToken, symbol, 100);
      tradesSyncRef.current.applySnapshot(snapshot);
      setTrades(tradesSyncRef.current.getTrades());
      const latestPrice = getLatestTradePrice(snapshot, symbol);
      if (latestPrice != null) {
        setMarkPrices((prev) => ({ ...prev, [symbol]: latestPrice }));
        setLastPrices((prev) => ({ ...prev, [symbol]: latestPrice }));
      }
    } catch {
      // live stream keeps the tape updated regardless
    }
  }, []);

  const loadCandles = useCallback(
    async (symbol: TradableSymbol, timeframe: ChartTimeframe) => {
      const activeToken = tokenRef.current;
      if (!activeToken) return;
      setCandlesReady(false);
      try {
        const { apiTimeframe } = getTimeframeConfig(timeframe);
        await candlesSyncRef.current.awaitSnapshot(() =>
          fetchCandles(
            activeToken,
            symbol,
            apiTimeframe,
            getCandleFetchLimit(timeframe),
          ),
        );
      } catch {
        candlesSyncRef.current.goLiveWithoutSnapshot();
      } finally {
        setCandles(candlesSyncRef.current.getCandles());
        setCandlesReady(true);
      }
    },
    [],
  );

  // ---- event handling ------------------------------------------------------

  const applyFillToOpenOrders = useCallback(
    (data: UserFillData) => {
      const existing = openOrdersRef.current.get(data.orderId);
      if (data.orderStatus === "FILLED" || data.orderStatus === "CANCELLED") {
        openOrdersRef.current.delete(data.orderId);
      } else if (existing) {
        openOrdersRef.current.set(data.orderId, {
          ...existing,
          filledQuantity: data.filledQty,
          status: data.orderStatus,
        });
      }
      syncOpenOrders();
    },
    [syncOpenOrders],
  );

  const handleEvent = useCallback(
    (payload: { type: string; data: unknown }) => {
      const activeSymbol = currentSymbolRef.current;

      switch (payload.type) {
        case "depth.updated": {
          const data = payload.data as DepthUpdateData;
          if (data.marketSymbol !== activeSymbol) return;
          orderbookSyncRef.current.onUpdate(data);
          setOrderbook(orderbookSyncRef.current.getView());
          return;
        }
        case "trades.created": {
          const data = payload.data as TradesCreatedData;
          const latestPrice = getLatestTradePrice(data.trades, data.marketSymbol);
          if (latestPrice != null) {
            setMarkPrices((prev) => ({
              ...prev,
              [data.marketSymbol]: latestPrice,
            }));
            setLastPrices((prev) => ({
              ...prev,
              [data.marketSymbol]: latestPrice,
            }));
          }
          if (data.marketSymbol !== activeSymbol) return;
          tradesSyncRef.current.onTradesCreated(data);
          setTrades(tradesSyncRef.current.getTrades());
          candlesSyncRef.current.onTradesCreated(data);
          setCandles(candlesSyncRef.current.getCandles());
          return;
        }
        case "indexprice.updated": {
          const data = payload.data as PriceUpdateData;
          setIndexPrices((prev) => ({ ...prev, [data.marketSymbol]: data.price }));
          return;
        }
        case "markprice.updated": {
          const data = payload.data as PriceUpdateData;
          setMarkPrices((prev) => ({ ...prev, [data.marketSymbol]: data.price }));
          return;
        }
        case "lastTradedPrice.updated": {
          const data = payload.data as PriceUpdateData;
          setLastPrices((prev) => ({ ...prev, [data.marketSymbol]: data.price }));
          return;
        }
        case "userfill.created": {
          const data = payload.data as UserFillData;
          personalSyncRef.current.onUserFill(data);
          pushPersonalState();
          applyFillToOpenOrders(data);
          return;
        }
      }
    },
    [pushPersonalState, applyFillToOpenOrders],
  );

  // ---- bootstrap on (re)connect -------------------------------------------

  const bootstrap = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return;
    const symbol = currentSymbolRef.current;

    // fresh sync engines: they buffer events until snapshots arrive
    orderbookSyncRef.current = new OrderbookSync();
    tradesSyncRef.current = new TradesSync(symbol);
    candlesSyncRef.current = new CandlesSync(
      symbol,
      candleTimeframeRef.current,
    );
    personalSyncRef.current = new PersonalSync();
    setCandles([]);
    setCandlesReady(false);

    try {
      // 1. subscribe first so depth, trades + personal fills start buffering
      await socket.subscribe(ALL_EVENTS);

      // 2. fetch snapshots
      const [depthRes, balanceRes, positionRes] = await Promise.all([
        socket.getDepth(symbol),
        socket.getBalance(),
        socket.getPosition(),
      ]);

      // 3. reconcile against buffered events
      orderbookSyncRef.current.applySnapshot(depthRes.payload as DepthSnapshot);
      setOrderbook(orderbookSyncRef.current.getView());

      personalSyncRef.current.setBalance(balanceRes.payload as BalanceSnapshot);
      personalSyncRef.current.applyPositionSnapshot(
        positionRes.payload as PositionSnapshot,
      );
      pushPersonalState();

      // 4. recover trades, candles, orders + fill history from db
      void loadMarketTrades(symbol);
      void loadCandles(symbol, candleTimeframeRef.current);
      void loadOpenOrders(symbol);
      void loadFills();
    } catch (err) {
      console.error("[bootstrap] failed", err);
    }
  }, [loadCandles, loadFills, loadMarketTrades, loadOpenOrders, pushPersonalState]);

  const doLogout = useCallback(() => {
    localStorage.removeItem("perp_token");
    setToken(null);
    setUser(null);
    setConnected(false);
    setBalance({ available: 0, locked: 0 });
    setPositions([]);
    setFills([]);
    setOrderbook(EMPTY_BOOK);
    setTrades([]);
    setCandles([]);
    setCandlesReady(false);
    openOrdersRef.current.clear();
    setOpenOrders([]);
  }, []);

  const handlersRef = useRef({ bootstrap, handleEvent, doLogout });
  handlersRef.current = { bootstrap, handleEvent, doLogout };

  // ---- socket lifecycle ----------------------------------------------------

  useEffect(() => {
    if (!token) return;

    const socket = new TradingSocket({
      onOpen: () => void handlersRef.current.bootstrap(),
      onStatusChange: setConnected,
      onEvent: (p) => handlersRef.current.handleEvent(p),
      onAuthExpired: () => {
        setError("Your session has expired. Please sign in again.");
        handlersRef.current.doLogout();
      },
    });
    socketRef.current = socket;
    socket.connect(token);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ---- auth ----------------------------------------------------------------

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      try {
        setError(null);
        const jwt = await apiSignIn(username, password);
        const userInfo = decodeUser(jwt);
        localStorage.setItem("perp_token", jwt);
        setUser(userInfo);
        setToken(jwt);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
        return false;
      }
    },
    [],
  );

  const signUp = useCallback(
    async (username: string, password: string) => {
      try {
        setError(null);
        await apiSignUp(username, password);
        return { success: true, message: "Account created. Please sign in." };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Signup failed",
        };
      }
    },
    [],
  );

  // ---- actions -------------------------------------------------------------

  const placeOrder = useCallback(
    async (params: {
      side: Side;
      type: OrderType;
      price: number;
      qty: number;
      margin: number;
      marginType: MarginType;
    }) => {
      const socket = socketRef.current;
      if (!socket?.isOpen()) {
        setError("Not connected to engine");
        return;
      }
      try {
        const res = await socket.createOrder({
          ...params,
          marketSymbol: currentSymbolRef.current,
        });
        if (res.type === "error") {
          setError(String(res.payload));
          return;
        }
        if (res.type === "order_created") {
          const order = res.payload as WireOrder;
          if (isRestingOpenOrder(order)) {
            openOrdersRef.current.set(order.orderId, {
              orderId: order.orderId,
              side: order.side,
              type: order.type,
              price: order.price,
              quantity: order.quantity,
              filledQuantity: order.filledQuantity,
              status: order.status,
              marginType: order.marginType,
              marketSymbol: order.marketSymbol,
            });
            syncOpenOrders();
          }
          setNotice("Order placed");
          // margin lock for resting orders isn't covered by fills, so re-pull
          const balRes = await socket.getBalance();
          personalSyncRef.current.setBalance(balRes.payload as BalanceSnapshot);
          pushPersonalState();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Order failed");
      }
    },
    [pushPersonalState, syncOpenOrders],
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      const socket = socketRef.current;
      if (!socket?.isOpen()) return;
      try {
        const res = await socket.cancelOrder(orderId);
        if (res.type === "error") {
          setError(String(res.payload));
          return;
        }
        openOrdersRef.current.delete(orderId);
        syncOpenOrders();
        setNotice("Order cancelled");
        const balRes = await socket.getBalance();
        personalSyncRef.current.setBalance(balRes.payload as BalanceSnapshot);
        pushPersonalState();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cancel failed");
      }
    },
    [pushPersonalState, syncOpenOrders],
  );

  const addBalance = useCallback(
    async (amount: number) => {
      const socket = socketRef.current;
      if (!socket?.isOpen()) return;
      try {
        const res = await socket.addBalance("USD", amount);
        if (res.type === "balance_updated" || res.type === "balance") {
          personalSyncRef.current.setBalance(res.payload as BalanceSnapshot);
          pushPersonalState();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Deposit failed");
      }
    },
    [pushPersonalState],
  );

  // ---- symbol switch -------------------------------------------------------

  const setCurrentSymbol = useCallback(
    (symbol: TradableSymbol) => {
      if (symbol === currentSymbolRef.current) return;
      currentSymbolRef.current = symbol;
      setCurrentSymbolState(symbol);
      setTrades([]);
      setCandles([]);
      setCandlesReady(false);
      setOrderbook(EMPTY_BOOK);

      const socket = socketRef.current;
      if (!socket?.isOpen()) return;

      // re-sync the book + trade tape for the new symbol (already subscribed)
      orderbookSyncRef.current = new OrderbookSync();
      tradesSyncRef.current = new TradesSync(symbol);
      candlesSyncRef.current = new CandlesSync(
        symbol,
        candleTimeframeRef.current,
      );
      socket
        .getDepth(symbol)
        .then((res) => {
          orderbookSyncRef.current.applySnapshot(res.payload as DepthSnapshot);
          setOrderbook(orderbookSyncRef.current.getView());
        })
        .catch(() => {});
      void loadMarketTrades(symbol);
      void loadCandles(symbol, candleTimeframeRef.current);
      void loadOpenOrders(symbol);
    },
    [loadCandles, loadMarketTrades, loadOpenOrders],
  );

  const setCandleTimeframe = useCallback(
    (timeframe: ChartTimeframe) => {
      if (timeframe === candleTimeframeRef.current) return;
      candleTimeframeRef.current = timeframe;
      setCandleTimeframeState(timeframe);
      setCandles([]);
      setCandlesReady(false);

      const symbol = currentSymbolRef.current;
      candlesSyncRef.current = new CandlesSync(symbol, timeframe);
      void loadCandles(symbol, timeframe);
    },
    [loadCandles],
  );

  const value = useMemo<TradingContextValue>(
    () => ({
      isAuthenticated: !!token,
      user,
      login,
      signUp,
      logout: doLogout,
      connected,
      currentSymbol,
      setCurrentSymbol,
      orderbook,
      trades,
      candles,
      candlesReady,
      candleTimeframe,
      setCandleTimeframe,
      indexPrices,
      markPrices,
      lastPrices,
      indexPrice: indexPrices[currentSymbol] ?? null,
      markPrice: markPrices[currentSymbol] ?? null,
      lastPrice: lastPrices[currentSymbol] ?? null,
      balance,
      positions,
      openOrders,
      fills,
      placeOrder,
      cancelOrder,
      addBalance,
      error,
      notice,
      setError,
      clearNotice,
    }),
    [
      token,
      user,
      login,
      signUp,
      doLogout,
      connected,
      currentSymbol,
      setCurrentSymbol,
      orderbook,
      trades,
      candles,
      candlesReady,
      candleTimeframe,
      setCandleTimeframe,
      indexPrices,
      markPrices,
      lastPrices,
      balance,
      positions,
      openOrders,
      fills,
      placeOrder,
      cancelOrder,
      addBalance,
      error,
      notice,
      clearNotice,
    ],
  );

  return (
    <TradingContext.Provider value={value}>{children}</TradingContext.Provider>
  );
}
