import React, { useState, useEffect } from "react";
import { TradingProvider, useTrading } from "./context/TradingContext";
import type { SymbolType } from "./context/TradingContext";
import { OrderBook } from "./components/OrderBook";
import { OrderPlacement } from "./components/OrderPlacement";
import { AuthModal } from "./components/AuthModal";
import {
  LogOut,
  Layers,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  ShieldAlert,
  X,
  ListOrdered,
} from "lucide-react";

const DEFAULT_PRICES: Record<SymbolType, number> = {
  BTCUSD: 94500,
  ETHUSD: 1700,
  SOLUSD: 135,
};

const MainLayout: React.FC = () => {
  const {
    isAuthenticated,
    user,
    currentSymbol,
    setCurrentSymbol,
    lastTradedPrice,
    indexPrice,
    lastTradedPrices,
    indexPrices,
    positions,
    balance,
    openOrders,
    logout,
    wsConnected,
    error,
    notice,
    setError,
    clearNotice,
    cancelOrder,
  } = useTrading();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [activeBottomTab, setActiveBottomTab] = useState<
    "positions" | "orders" | "balances"
  >("positions");

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clearNotice, 4000);
    return () => clearTimeout(timer);
  }, [notice, clearNotice]);

  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const getMarkPrice = (symbol: SymbolType) =>
    lastTradedPrices[symbol] ?? indexPrices[symbol] ?? DEFAULT_PRICES[symbol];

  const totalEquity =
    balance.available +
    balance.locked +
    Object.values(positions).reduce((sum, pos) => {
      const mark = getMarkPrice(pos.marketSymbol);
      const priceDiff =
        pos.type === "LONG" ? mark - pos.price : pos.price - mark;
      return sum + priceDiff * pos.qty;
    }, 0);

  return (
    <div className="min-h-screen bg-[#07080A] text-gray-200 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-400">
      {error && (
        <div className="bg-red-950/80 border-b border-red-900 px-6 py-2 flex items-center justify-between text-sm text-red-300">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </span>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="bg-emerald-950/60 border-b border-emerald-900/60 px-6 py-2 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      <header className="bg-[#0B0D10] border-b border-gray-900/80 px-6 py-3.5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="bg-red-500 text-black p-1.5 rounded-lg font-black flex items-center justify-center text-xs w-7 h-7">
              BP
            </div>
            <span className="text-white font-black text-lg tracking-wider">
              Backpack
            </span>
            <span className="text-[10px] uppercase font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
              Futures
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="bg-[#14171E] border border-gray-800 rounded-xl px-3.5 py-1.5 flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${wsConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
                />
                <span className="text-gray-300 font-bold font-mono text-xs">
                  {user?.username}
                </span>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-1 bg-[#1A1115] border border-red-950/40 hover:bg-red-950/20 text-red-400 font-semibold px-3 py-1.5 rounded-xl transition-colors cursor-pointer text-xs"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuth("signin")}
                className="text-gray-400 hover:text-white font-semibold transition-colors px-4 py-2 cursor-pointer text-xs"
              >
                Log in
              </button>
              <button
                onClick={() => openAuth("signup")}
                className="bg-white hover:bg-gray-200 text-black font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer text-xs"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="bg-[#0B0D10] border-b border-gray-900 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-6">
          <select
            value={currentSymbol}
            onChange={(e) => setCurrentSymbol(e.target.value as SymbolType)}
            className="bg-[#14171E] hover:bg-[#1C202B] border border-gray-900 text-white font-black text-sm px-4 py-1.5 rounded-xl focus:outline-none cursor-pointer transition-colors"
          >
            <option value="BTCUSD">BTC-PERP</option>
            <option value="ETHUSD">ETH-PERP</option>
            <option value="SOLUSD">SOL-PERP</option>
          </select>

          <div className="flex items-center gap-4 text-xs">
            <div className="space-y-0.5">
              <div className="text-gray-500">Last Price</div>
              <div className="font-mono font-black text-emerald-400 text-sm">
                {lastTradedPrice
                  ? `$${lastTradedPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                  : "—"}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-gray-500">Index Price</div>
              <div className="font-mono text-gray-300">
                {indexPrice
                  ? `$${indexPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">Engine:</span>
          <span
            className={`flex items-center gap-1 font-bold ${wsConnected ? "text-emerald-400" : "text-red-500"}`}
          >
            {wsConnected ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" /> Disconnected
              </>
            )}
          </span>
        </div>
      </section>

      <main className="flex-1 overflow-hidden flex flex-col lg:flex-row p-4 gap-4 h-full">
        <div className="flex-1 flex flex-col gap-4 overflow-hidden h-full">
          <div className="flex-1 bg-[#0B0D10] border border-gray-900 rounded-2xl flex flex-col overflow-hidden h-full">
            <div className="flex bg-[#11131A] px-4 py-2 border-b border-gray-900 justify-between items-center">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveBottomTab("positions")}
                  className={`font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer py-1 ${
                    activeBottomTab === "positions"
                      ? "text-emerald-400 border-b border-emerald-400"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  Positions ({Object.keys(positions).length})
                </button>
                <button
                  onClick={() => setActiveBottomTab("orders")}
                  className={`font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer py-1 ${
                    activeBottomTab === "orders"
                      ? "text-emerald-400 border-b border-emerald-400"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  Open Orders ({openOrders.length})
                </button>
                <button
                  onClick={() => setActiveBottomTab("balances")}
                  className={`font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer py-1 ${
                    activeBottomTab === "balances"
                      ? "text-emerald-400 border-b border-emerald-400"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Balances
                </button>
              </div>

              <div className="text-[10px] text-gray-500 font-mono">
                Total Equity:{" "}
                <span className="text-emerald-400 font-bold">
                  $
                  {totalEquity.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 text-xs">
              {!isAuthenticated ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16 text-gray-600 gap-2">
                  <ShieldAlert className="w-8 h-8 text-amber-500/80 animate-pulse" />
                  <span className="font-bold text-gray-400 text-sm">
                    Authentication Required
                  </span>
                  <span className="text-[10px] text-gray-500 max-w-xs">
                    Sign in to view positions, open orders, and balances.
                  </span>
                </div>
              ) : activeBottomTab === "positions" ? (
                Object.keys(positions).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-6 text-gray-600 gap-1">
                    <AlertCircle className="w-5 h-5 text-gray-700" />
                    <span>No active positions</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-6 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 pb-1 border-b border-gray-950">
                      <span>Market</span>
                      <span>Type</span>
                      <span className="text-right">Size</span>
                      <span className="text-right">Entry</span>
                      <span className="text-right">Margin</span>
                      <span className="text-right">Est. PnL</span>
                    </div>
                    {Object.entries(positions).map(([marketSymbol, pos]) => {
                      const mark = getMarkPrice(marketSymbol as SymbolType);
                      const priceDiff =
                        pos.type === "LONG"
                          ? mark - pos.price
                          : pos.price - mark;
                      const unrealizedPnL = priceDiff * pos.qty;

                      return (
                        <div
                          key={pos.positionId}
                          className="grid grid-cols-6 items-center px-3 py-2 bg-[#14171E] rounded-xl hover:bg-[#1A202D] transition-colors font-mono"
                        >
                          <span className="font-bold text-gray-200">
                            {marketSymbol}
                          </span>
                          <span
                            className={`font-semibold text-[10px] ${pos.type === "LONG" ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10"} px-1.5 py-0.5 rounded w-fit`}
                          >
                            {pos.type} {pos.marginType}
                          </span>
                          <span className="text-right text-gray-300">
                            {pos.qty.toFixed(4)}
                          </span>
                          <span className="text-right text-gray-400">
                            ${pos.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-right text-gray-400">
                            ${pos.margin.toFixed(2)}
                          </span>
                          <span
                            className={`text-right font-bold ${unrealizedPnL >= 0 ? "text-emerald-400" : "text-red-500"}`}
                          >
                            {unrealizedPnL >= 0 ? "+" : ""}$
                            {unrealizedPnL.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : activeBottomTab === "orders" ? (
                openOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-6 text-gray-600 gap-1">
                    <AlertCircle className="w-5 h-5 text-gray-700" />
                    <span>No open orders for {currentSymbol}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-7 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 pb-1 border-b border-gray-950">
                      <span>Side</span>
                      <span>Type</span>
                      <span className="text-right">Price</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Filled</span>
                      <span className="text-right">Status</span>
                      <span className="text-right">Action</span>
                    </div>
                    {openOrders.map((order) => (
                      <div
                        key={order.id}
                        className="grid grid-cols-7 items-center px-3 py-2 bg-[#14171E] rounded-xl font-mono"
                      >
                        <span
                          className={
                            order.side === "BUY"
                              ? "text-emerald-400 font-bold"
                              : "text-red-400 font-bold"
                          }
                        >
                          {order.side}
                        </span>
                        <span className="text-gray-400">{order.type}</span>
                        <span className="text-right text-gray-300">
                          ${order.price.toFixed(2)}
                        </span>
                        <span className="text-right text-gray-300">
                          {order.quantity.toFixed(4)}
                        </span>
                        <span className="text-right text-gray-400">
                          {order.filledQuantity.toFixed(4)}
                        </span>
                        <span className="text-right text-gray-500 text-[10px]">
                          {order.status}
                        </span>
                        <span className="text-right">
                          <button
                            onClick={() => void cancelOrder(order.id)}
                            className="text-red-400 hover:text-red-300 text-[10px] font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 pb-1 border-b border-gray-950">
                    <span>Asset</span>
                    <span className="text-right">Available</span>
                    <span className="text-right">Locked (Margin)</span>
                  </div>
                  <div className="grid grid-cols-3 items-center px-3 py-2 bg-[#14171E] rounded-xl font-mono">
                    <span className="font-bold text-white">USD</span>
                    <span className="text-right text-emerald-400">
                      {balance.available.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-right text-amber-400">
                      {balance.locked.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[420px] shrink-0 h-full overflow-hidden flex flex-col">
          <OrderBook />
        </div>

        <div className="w-full lg:w-[320px] shrink-0 h-full overflow-hidden flex flex-col">
          <OrderPlacement onOpenAuth={openAuth} />
        </div>
      </main>

      <footer className="bg-[#0B0D10] border-t border-gray-900 px-6 py-2.5 text-[11px] text-gray-500 flex justify-between items-center shrink-0">
        <span>© 2026 Backpack Futures</span>
        <span
          className={`font-mono font-bold text-[10px] ${wsConnected ? "text-emerald-500" : "text-red-500"}`}
        >
          {wsConnected ? "Engine connected" : "Engine disconnected"}
        </span>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
};

function App() {
  return (
    <TradingProvider>
      <MainLayout />
    </TradingProvider>
  );
}

export default App;
