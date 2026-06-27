import { useState } from "react";
import { useTrading } from "../context/TradingContext";
import { getMarket } from "../lib/constants";
import { formatPrice, formatQty, formatSignedUsd, formatUsd, formatTime } from "../lib/format";

type Tab = "balances" | "positions" | "orders" | "fills";

const TABS: { id: Tab; label: string }[] = [
  { id: "balances", label: "Balances" },
  { id: "positions", label: "Positions" },
  { id: "orders", label: "Open Orders" },
  { id: "fills", label: "Fill History" },
];

const DECORATIVE = ["Borrows", "TWAP", "Order History", "Position History", "Funding History"];

export function BottomPanel({ onOpenAuth }: { onOpenAuth: (mode: "signin" | "signup") => void }) {
  const { isAuthenticated, positions, openOrders, fills, balance, markPrices, indexPrices } =
    useTrading();
  const [tab, setTab] = useState<Tab>("balances");

  return (
    <div className="flex h-full flex-col rounded-lg border border-[#1c1f26] bg-[#0d0f13]">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[#1c1f26] px-2">
        {TABS.map((t) => {
          const count =
            t.id === "positions"
              ? positions.length
              : t.id === "orders"
                ? openOrders.length
                : null;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative whitespace-nowrap px-3 py-2.5 text-[12px] font-semibold transition-colors ${
                tab === t.id ? "text-white" : "text-[#6b7280] hover:text-[#9aa0aa]"
              }`}
            >
              {t.label}
              {count != null && count > 0 ? ` (${count})` : ""}
              {tab === t.id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#16c784]" />
              )}
            </button>
          );
        })}
        {DECORATIVE.map((d) => (
          <span
            key={d}
            className="cursor-not-allowed whitespace-nowrap px-3 py-2.5 text-[12px] font-medium text-[#3a3f49]"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {!isAuthenticated ? (
          <Empty>
            Please{" "}
            <button
              onClick={() => onOpenAuth("signin")}
              className="text-[#16c784] hover:underline"
            >
              log in
            </button>{" "}
            or{" "}
            <button
              onClick={() => onOpenAuth("signup")}
              className="text-[#16c784] hover:underline"
            >
              sign up
            </button>{" "}
            first
          </Empty>
        ) : tab === "balances" ? (
          <Balances balance={balance} />
        ) : tab === "positions" ? (
          <Positions positions={positions} markPrices={markPrices} indexPrices={indexPrices} />
        ) : tab === "orders" ? (
          <OpenOrders />
        ) : (
          <Fills fills={fills} />
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center py-10 text-[13px] text-[#6b7280]">
      {children}
    </div>
  );
}

function Balances({ balance }: { balance: { available: number; locked: number } }) {
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wide text-[#6b7280]">
          <th className="px-4 py-2 font-medium">Asset</th>
          <th className="px-4 py-2 text-right font-medium">Available</th>
          <th className="px-4 py-2 text-right font-medium">Locked (Margin)</th>
          <th className="px-4 py-2 text-right font-medium">Total Equity</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        <tr className="border-t border-[#15181d]">
          <td className="px-4 py-2.5 font-sans font-bold text-white">USD</td>
          <td className="px-4 py-2.5 text-right text-[#c4c9d2]">
            {formatUsd(balance.available)}
          </td>
          <td className="px-4 py-2.5 text-right text-[#e6a700]">
            {formatUsd(balance.locked)}
          </td>
          <td className="px-4 py-2.5 text-right font-bold text-white">
            {formatUsd(balance.available + balance.locked)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Positions({
  positions,
  markPrices,
  indexPrices,
}: {
  positions: ReturnType<typeof useTrading>["positions"];
  markPrices: ReturnType<typeof useTrading>["markPrices"];
  indexPrices: ReturnType<typeof useTrading>["indexPrices"];
}) {
  if (positions.length === 0) return <Empty>No open positions</Empty>;

  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wide text-[#6b7280]">
          <th className="px-4 py-2 font-medium">Market</th>
          <th className="px-4 py-2 font-medium">Side</th>
          <th className="px-4 py-2 text-right font-medium">Size</th>
          <th className="px-4 py-2 text-right font-medium">Entry</th>
          <th className="px-4 py-2 text-right font-medium">Mark</th>
          <th className="px-4 py-2 text-right font-medium">Liq. Price</th>
          <th className="px-4 py-2 text-right font-medium">Margin</th>
          <th className="px-4 py-2 text-right font-medium">Unrealized PnL</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {positions.map((p) => {
          const market = getMarket(p.marketSymbol);
          const mark = markPrices[p.marketSymbol] ?? p.entryPrice;
          const index = indexPrices[p.marketSymbol] ?? p.entryPrice;
          const diff = p.type === "LONG" ? index - p.entryPrice : p.entryPrice - index;
          const pnl = diff * p.quantity;
          const pnlPct = p.margin > 0 ? (pnl / p.margin) * 100 : 0;
          return (
            <tr key={p.marketSymbol} className="border-t border-[#15181d] hover:bg-[#15181d]">
              <td className="px-4 py-2.5 font-sans font-bold text-white">{market.label}</td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    p.type === "LONG"
                      ? "bg-[#16c784]/15 text-[#16c784]"
                      : "bg-[#f6465d]/15 text-[#f6465d]"
                  }`}
                >
                  {p.type} · {p.marginType}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right text-[#c4c9d2]">
                {formatQty(p.quantity, market.qtyPrecision)}
              </td>
              <td className="px-4 py-2.5 text-right text-[#9aa0aa]">
                {formatPrice(p.entryPrice, market.pricePrecision)}
              </td>
              <td className="px-4 py-2.5 text-right text-[#9aa0aa]">
                {formatPrice(mark, market.pricePrecision)}
              </td>
              <td className="px-4 py-2.5 text-right text-[#e6a700]">
                {formatPrice(p.liquidationPrice, market.pricePrecision)}
              </td>
              <td className="px-4 py-2.5 text-right text-[#9aa0aa]">
                {formatUsd(p.margin)}
              </td>
              <td
                className={`px-4 py-2.5 text-right font-semibold ${
                  pnl >= 0 ? "text-[#16c784]" : "text-[#f6465d]"
                }`}
              >
                {formatSignedUsd(pnl)} ({pnlPct >= 0 ? "+" : ""}
                {pnlPct.toFixed(2)}%)
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function OpenOrders() {
  const { openOrders, cancelOrder } = useTrading();
  if (openOrders.length === 0) return <Empty>No open orders</Empty>;

  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wide text-[#6b7280]">
          <th className="px-4 py-2 font-medium">Market</th>
          <th className="px-4 py-2 font-medium">Side</th>
          <th className="px-4 py-2 font-medium">Type</th>
          <th className="px-4 py-2 text-right font-medium">Price</th>
          <th className="px-4 py-2 text-right font-medium">Size</th>
          <th className="px-4 py-2 text-right font-medium">Filled</th>
          <th className="px-4 py-2 text-right font-medium">Status</th>
          <th className="px-4 py-2 text-right font-medium">Action</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {openOrders.map((o) => {
          const market = getMarket(o.marketSymbol);
          return (
            <tr key={o.orderId} className="border-t border-[#15181d] hover:bg-[#15181d]">
              <td className="px-4 py-2.5 font-sans font-bold text-white">{market.label}</td>
              <td
                className={`px-4 py-2.5 font-bold ${
                  o.side === "BUY" ? "text-[#16c784]" : "text-[#f6465d]"
                }`}
              >
                {o.side}
              </td>
              <td className="px-4 py-2.5 text-[#9aa0aa]">{o.type}</td>
              <td className="px-4 py-2.5 text-right text-[#c4c9d2]">
                {formatPrice(o.price, market.pricePrecision)}
              </td>
              <td className="px-4 py-2.5 text-right text-[#c4c9d2]">
                {formatQty(o.quantity, market.qtyPrecision)}
              </td>
              <td className="px-4 py-2.5 text-right text-[#9aa0aa]">
                {formatQty(o.filledQuantity, market.qtyPrecision)}
              </td>
              <td className="px-4 py-2.5 text-right text-[10px] text-[#6b7280]">
                {o.status}
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={() => void cancelOrder(o.orderId)}
                  className="rounded border border-[#f6465d]/30 px-2 py-0.5 text-[11px] font-semibold text-[#f6465d] transition-colors hover:bg-[#f6465d]/10"
                >
                  Cancel
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Fills({ fills }: { fills: ReturnType<typeof useTrading>["fills"] }) {
  if (fills.length === 0) return <Empty>No fills yet</Empty>;

  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wide text-[#6b7280]">
          <th className="px-4 py-2 font-medium">Market</th>
          <th className="px-4 py-2 font-medium">Side</th>
          <th className="px-4 py-2 text-right font-medium">Price</th>
          <th className="px-4 py-2 text-right font-medium">Size</th>
          <th className="px-4 py-2 text-right font-medium">Status</th>
          <th className="px-4 py-2 text-right font-medium">Time</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {fills.map((f, i) => {
          const market = getMarket(f.marketSymbol);
          return (
            <tr key={`${f.fillId}-${i}`} className="border-t border-[#15181d] hover:bg-[#15181d]">
              <td className="px-4 py-2.5 font-sans font-bold text-white">{market.label}</td>
              <td
                className={`px-4 py-2.5 font-bold ${
                  f.side === "BUY" ? "text-[#16c784]" : "text-[#f6465d]"
                }`}
              >
                {f.side}
              </td>
              <td className="px-4 py-2.5 text-right text-[#c4c9d2]">
                {formatPrice(f.price, market.pricePrecision)}
              </td>
              <td className="px-4 py-2.5 text-right text-[#c4c9d2]">
                {formatQty(f.qty, market.qtyPrecision)}
              </td>
              <td className="px-4 py-2.5 text-right text-[10px] text-[#6b7280]">
                {f.status}
              </td>
              <td className="px-4 py-2.5 text-right text-[#6b7280]">
                {formatTime(f.time)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
