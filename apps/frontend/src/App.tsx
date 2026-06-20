import React, { useState } from "react";
import { TradingProvider, useTrading } from "./context/TradingContext";
import type { SymbolType } from "./context/TradingContext";
import { OrderBook } from "./components/OrderBook";
import { OrderPlacement } from "./components/OrderPlacement";
import { AuthModal } from "./components/AuthModal";
import {
  TrendingUp,
  LogOut,
  TrendingDown,
  Layers,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  ShieldAlert,
} from "lucide-react";

const MainLayout: React.FC = () => {
  const {
    isAuthenticated,
    user,
    currentSymbol,
    setCurrentSymbol,
    lastTradedPrice,
    indexPrice,
    positions,
    balances,
    logout,
  } = useTrading();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [activeBottomTab, setActiveBottomTab] = useState<
    "positions" | "balances"
  >("positions");

  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  // Quick 24h change mock values
  const mockChange =
    currentSymbol === "BTCUSD"
      ? "+1.42%"
      : currentSymbol === "ETHUSD"
        ? "+0.06%"
        : "-2.15%";
  const mockHigh =
    currentSymbol === "BTCUSD"
      ? 96450.0
      : currentSymbol === "ETHUSD"
        ? 1716.0
        : 138.45;
  const mockLow =
    currentSymbol === "BTCUSD"
      ? 93200.0
      : currentSymbol === "ETHUSD"
        ? 1680.0
        : 131.2;

  // Total balance sum
  const totalBalanceVal =
    (balances["USD"] || 0) +
    (balances["BTCUSD"] || 0) * (lastTradedPrice || 94500) +
    (balances["ETHUSD"] || 0) * (lastTradedPrice || 1700) +
    (balances["SOLUSD"] || 0) * (lastTradedPrice || 135);

  return (
    <div className="min-h-screen bg-[#07080A] text-gray-200 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-400">
      {/* HEADER / NAVIGATION */}
      <header className="bg-[#0B0D10] border-b border-gray-900/80 px-6 py-3.5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-8">
          {/* Logo */}
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

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-400">
            <span className="cursor-pointer hover:text-white transition-colors">
              Spot
            </span>
            <span className="cursor-pointer text-white border-b-2 border-red-500 pb-1 px-1 transition-colors">
              Futures
            </span>
            <span className="cursor-pointer hover:text-white transition-colors">
              Lend
            </span>
            <span className="cursor-pointer hover:text-white transition-colors">
              Vault
            </span>
            <span className="cursor-pointer hover:text-white transition-colors">
              Stocks
            </span>
            <span className="cursor-not-allowed text-gray-600">BP</span>
            <span className="cursor-pointer hover:text-white transition-colors text-xs bg-gray-800/40 px-2 py-1 rounded">
              More ▾
            </span>
          </nav>
        </div>

        {/* User Auth block */}
        <div className="flex items-center gap-4 text-sm">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="bg-[#14171E] border border-gray-800 rounded-xl px-3.5 py-1.5 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
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

      {/* METRIC RIBBON */}
      <section className="bg-[#0B0D10] border-b border-gray-900 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-6">
          {/* Symbol Select */}
          <div className="relative">
            <select
              value={currentSymbol}
              onChange={(e) => setCurrentSymbol(e.target.value as SymbolType)}
              className="bg-[#14171E] hover:bg-[#1C202B] border border-gray-900 text-white font-black text-sm px-4 py-1.5 rounded-xl focus:outline-none cursor-pointer transition-colors"
            >
              <option value="BTCUSD">BTC-PERP</option>
              <option value="ETHUSD">ETH-PERP</option>
              <option value="SOLUSD">SOL-PERP</option>
            </select>
          </div>

          {/* Quick price info */}
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
            <div className="space-y-0.5 hidden sm:block">
              <div className="text-gray-500">24h Change</div>
              <div
                className={`font-mono flex items-center gap-0.5 font-bold ${mockChange.startsWith("+") ? "text-emerald-400" : "text-red-500"}`}
              >
                {mockChange.startsWith("+") ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {mockChange}
              </div>
            </div>
            <div className="space-y-0.5 hidden md:block">
              <div className="text-gray-500">24h High</div>
              <div className="font-mono text-gray-400">
                ${mockHigh.toLocaleString()}
              </div>
            </div>
            <div className="space-y-0.5 hidden md:block">
              <div className="text-gray-500">24h Low</div>
              <div className="font-mono text-gray-400">
                ${mockLow.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">Exchange status:</span>
          <span className="flex items-center gap-1 font-bold text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Fully Operational
          </span>
        </div>
      </section>

      {/* MAIN CONTAINER */}
      <main className="flex-1 overflow-hidden flex flex-col lg:flex-row p-4 gap-4 h-full">
        {/* LEFT COLUMN: Open Positions & Balances */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden h-full">
          {/* POSITIONS & BALANCES BOX */}
          <div className="flex-1 bg-[#0B0D10] border border-gray-900 rounded-2xl flex flex-col overflow-hidden h-full">
            {/* Tabs */}
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
                  Active Positions ({Object.keys(positions).length})
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
                  Asset Balances
                </button>
              </div>

              {/* Quick display of Total Balance */}
              <div className="text-[10px] text-gray-500 font-mono">
                Total Equity:{" "}
                <span className="text-emerald-400 font-bold">
                  $
                  {totalBalanceVal.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  USD
                </span>
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-3 text-xs">
              {!isAuthenticated ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16 text-gray-600 gap-2">
                  <ShieldAlert className="w-8 h-8 text-amber-500/80 animate-pulse" />
                  <span className="font-bold text-gray-400 text-sm">
                    Authentication Required
                  </span>
                  <span className="text-[10px] text-gray-500 max-w-xs">
                    Please log in or sign up to access your active leverage
                    positions, asset balances, and real-time market data.
                  </span>
                </div>
              ) : activeBottomTab === "positions" ? (
                /* POSITIONS LIST */
                Object.keys(positions).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-6 text-gray-600 gap-1">
                    <AlertCircle className="w-5 h-5 text-gray-700" />
                    <span>No active positions</span>
                    <span className="text-[10px] text-gray-700 max-w-xs">
                      Use the Order Placement box on the right to open leverage
                      positions on {currentSymbol}.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-6 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 pb-1 border-b border-gray-950">
                      <span>Market</span>
                      <span>Type</span>
                      <span className="text-right">Size</span>
                      <span className="text-right">Entry Price</span>
                      <span className="text-right">Margin</span>
                      <span className="text-right">Est. PnL</span>
                    </div>
                    {Object.entries(positions).map(([symbol, pos]) => {
                      const isLong = pos.type === "LONG";
                      // Quick mock unrealized PnL based on current trade price
                      const priceDiff = lastTradedPrice
                        ? isLong
                          ? lastTradedPrice - pos.price
                          : pos.price - lastTradedPrice
                        : 0;
                      const unrealizedPnL = priceDiff * pos.qty;

                      return (
                        <div
                          key={pos.positionId}
                          className="grid grid-cols-6 items-center px-3 py-2 bg-[#14171E] rounded-xl hover:bg-[#1A202D] transition-colors font-mono"
                        >
                          <span className="font-bold text-gray-200">
                            {symbol}
                          </span>
                          <span
                            className={`font-semibold text-[10px] ${isLong ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10"} px-1.5 py-0.5 rounded w-fit`}
                          >
                            {pos.type} {pos.marginType}
                          </span>
                          <span className="text-right text-gray-300">
                            {pos.qty.toFixed(4)}
                          </span>
                          <span className="text-right text-gray-400">
                            $
                            {pos.price.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-right text-gray-400">
                            ${pos.margin.toFixed(2)}
                          </span>
                          <span
                            className={`text-right font-bold ${unrealizedPnL >= 0 ? "text-emerald-400" : "text-red-500"}`}
                          >
                            {unrealizedPnL >= 0 ? "+" : ""}$
                            {unrealizedPnL.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                /* BALANCES LIST */
                <div className="space-y-2">
                  <div className="grid grid-cols-3 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 pb-1 border-b border-gray-950">
                    <span>Asset</span>
                    <span className="text-right">Available Balance</span>
                    <span className="text-right">Estimated USD Value</span>
                  </div>

                  {/* USD */}
                  <div className="grid grid-cols-3 items-center px-3 py-2 bg-[#14171E] rounded-xl font-mono">
                    <span className="font-bold text-white">USD</span>
                    <span className="text-right text-gray-200">
                      {(balances["USD"] || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-right text-gray-400">
                      $
                      {(balances["USD"] || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {/* BTC */}
                  <div className="grid grid-cols-3 items-center px-3 py-2 bg-[#14171E] rounded-xl font-mono">
                    <span className="font-bold text-white">
                      BTCUSD (Margin Lock)
                    </span>
                    <span className="text-right text-gray-200">
                      {(balances["BTCUSD"] || 0).toFixed(6)}
                    </span>
                    <span className="text-right text-gray-400">
                      $
                      {(
                        (balances["BTCUSD"] || 0) *
                        (currentSymbol === "BTCUSD"
                          ? lastTradedPrice || 94500
                          : 94500)
                      ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* ETH */}
                  <div className="grid grid-cols-3 items-center px-3 py-2 bg-[#14171E] rounded-xl font-mono">
                    <span className="font-bold text-white">
                      ETHUSD (Margin Lock)
                    </span>
                    <span className="text-right text-gray-200">
                      {(balances["ETHUSD"] || 0).toFixed(6)}
                    </span>
                    <span className="text-right text-gray-400">
                      $
                      {(
                        (balances["ETHUSD"] || 0) *
                        (currentSymbol === "ETHUSD"
                          ? lastTradedPrice || 1700
                          : 1700)
                      ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* SOL */}
                  <div className="grid grid-cols-3 items-center px-3 py-2 bg-[#14171E] rounded-xl font-mono">
                    <span className="font-bold text-white">
                      SOLUSD (Margin Lock)
                    </span>
                    <span className="text-right text-gray-200">
                      {(balances["SOLUSD"] || 0).toFixed(6)}
                    </span>
                    <span className="text-right text-gray-400">
                      $
                      {(
                        (balances["SOLUSD"] || 0) *
                        (currentSymbol === "SOLUSD"
                          ? lastTradedPrice || 135
                          : 135)
                      ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Order Book & Recent Trades */}
        <div className="w-full lg:w-[420px] shrink-0 h-full overflow-hidden flex flex-col">
          <OrderBook />
        </div>

        {/* RIGHT COLUMN: Order Placement */}
        <div className="w-full lg:w-[320px] shrink-0 h-full overflow-hidden flex flex-col">
          <OrderPlacement onOpenAuth={openAuth} />
        </div>
      </main>

      {/* GLOBAL FOOTER BANNER */}
      <footer className="bg-[#0B0D10] border-t border-gray-900 px-6 py-2.5 text-[11px] text-gray-500 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <span>© 2026 Backpack Futures. All rights reserved.</span>
          <span className="cursor-pointer hover:text-gray-300">
            Terms of Use
          </span>
          <span className="cursor-pointer hover:text-gray-300">
            Privacy Policy
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-500 font-mono font-bold text-[10px]">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
          <span>API: Connected to Engine</span>
        </div>
      </footer>

      {/* AUTHENTICATION MODAL */}
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
