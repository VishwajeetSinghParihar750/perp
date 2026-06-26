import { useEffect, useState } from "react";
import { TradingProvider, useTrading } from "./context/TradingContext";
import { TopNav } from "./components/TopNav";
import { MarketHeader } from "./components/MarketHeader";
import { PriceChart } from "./components/PriceChart";
import { OrderBook } from "./components/OrderBook";
import { Trades } from "./components/Trades";
import { OrderForm } from "./components/OrderForm";
import { BottomPanel } from "./components/BottomPanel";
import { Ticker } from "./components/Ticker";
import { AuthModal } from "./components/AuthModal";

type AuthMode = "signin" | "signup";

function Toasts() {
  const { error, notice, setError, clearNotice } = useTrading();

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(clearNotice, 3500);
    return () => clearTimeout(id);
  }, [notice, clearNotice]);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(id);
  }, [error, setError]);

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-72 flex-col gap-2">
      {error && (
        <div className="pointer-events-auto rounded-lg border border-[#f6465d]/40 bg-[#1a0d10] px-3 py-2.5 text-[12px] text-[#f6465d] shadow-xl">
          {error}
        </div>
      )}
      {notice && (
        <div className="pointer-events-auto rounded-lg border border-[#16c784]/40 bg-[#0c1a13] px-3 py-2.5 text-[12px] text-[#16c784] shadow-xl">
          {notice}
        </div>
      )}
    </div>
  );
}

function Layout() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0b0d] text-[#c4c9d2]">
      <TopNav onOpenAuth={openAuth} />
      <MarketHeader />

      <main className="flex flex-1 gap-2 overflow-hidden p-2">
        <div className="flex flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex flex-1 gap-2 overflow-hidden">
            <div className="min-w-0 flex-1">
              <PriceChart />
            </div>
            <div className="w-[230px] shrink-0">
              <OrderBook />
            </div>
            <div className="w-[200px] shrink-0">
              <Trades />
            </div>
          </div>
          <div className="h-[230px] shrink-0">
            <BottomPanel onOpenAuth={openAuth} />
          </div>
        </div>

        <div className="w-[300px] shrink-0">
          <OrderForm onOpenAuth={openAuth} />
        </div>
      </main>

      <Ticker />
      <Toasts />

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
}

export default function App() {
  return (
    <TradingProvider>
      <Layout />
    </TradingProvider>
  );
}
