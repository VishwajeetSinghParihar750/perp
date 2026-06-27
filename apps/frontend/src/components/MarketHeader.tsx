import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTrading } from "../context/TradingContext";
import { MARKETS, getMarket } from "../lib/constants";
import { formatPrice, formatUsd } from "../lib/format";
import type { TradableSymbol } from "../lib/types";

interface SessionStat {
  open: number;
  high: number;
  low: number;
  volume: number;
}

function Stat({
  label,
  value,
  className = "text-white",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-[#6b7280]">
        {label}
      </span>
      <span className={`font-mono text-[12px] font-semibold ${className}`}>
        {value}
      </span>
    </div>
  );
}

export function MarketHeader() {
  const {
    currentSymbol,
    setCurrentSymbol,
    markPrice,
    indexPrice,
    markPrices,
    trades,
  } = useTrading();

  const market = getMarket(currentSymbol);
  const [menuOpen, setMenuOpen] = useState(false);
  const statsRef = useRef<Record<string, SessionStat>>({});

  // derive a lightweight session stat set from the streamed mark price
  useEffect(() => {
    if (markPrice == null) return;
    const prev = statsRef.current[currentSymbol];
    statsRef.current[currentSymbol] = prev
      ? {
          ...prev,
          high: Math.max(prev.high, markPrice),
          low: Math.min(prev.low, markPrice),
        }
      : { open: markPrice, high: markPrice, low: markPrice, volume: 0 };
  }, [markPrice, currentSymbol]);

  const stat = statsRef.current[currentSymbol];
  const change =
    stat && stat.open > 0 && markPrice != null
      ? ((markPrice - stat.open) / stat.open) * 100
      : 0;
  const volume = trades.reduce((sum, t) => sum + t.price * t.qty, 0);

  return (
    <div className="relative flex h-14 shrink-0 items-center gap-8 border-b border-[#1c1f26] bg-[#0a0b0d] px-4">
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#15181d]"
        >
          <span className="text-[15px] font-bold text-white">
            {market.label}
          </span>
          <span className="rounded bg-[#16c784]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#16c784]">
            10x
          </span>
          <ChevronDown className="h-4 w-4 text-[#6b7280]" />
        </button>

        {menuOpen && (
          <div className="absolute left-0 top-12 z-30 w-44 overflow-hidden rounded-xl border border-[#1c1f26] bg-[#111317] py-1 shadow-2xl">
            {MARKETS.map((m) => {
              const price = markPrices[m.symbol];
              return (
                <button
                  key={m.symbol}
                  onClick={() => {
                    setCurrentSymbol(m.symbol as TradableSymbol);
                    setMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-[#181b21] ${
                    m.symbol === currentSymbol ? "text-white" : "text-[#9aa0aa]"
                  }`}
                >
                  <span className="font-semibold">{m.label}</span>
                  <span className="font-mono text-xs text-[#6b7280]">
                    {formatPrice(price, m.pricePrecision)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-7 overflow-x-auto">
        <Stat
          label="Mark Price"
          value={formatPrice(markPrice, market.pricePrecision)}
          className="text-[#16c784]"
        />
        <Stat
          label="Index Price"
          value={formatPrice(indexPrice, market.pricePrecision)}
        />
        <Stat
          label="24h Change"
          value={`${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
          className={change >= 0 ? "text-[#16c784]" : "text-[#f6465d]"}
        />
        <Stat
          label="24h High"
          value={formatPrice(stat?.high, market.pricePrecision)}
        />
        <Stat
          label="24h Low"
          value={formatPrice(stat?.low, market.pricePrecision)}
        />
        <Stat label="24h Volume" value={formatUsd(volume, 0)} />
        <Stat label="Funding / 8h" value="0.0200%" className="text-[#16c784]" />
      </div>
    </div>
  );
}
