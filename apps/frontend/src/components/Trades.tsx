import { useTrading } from "../context/TradingContext";
import { getMarket } from "../lib/constants";
import { formatPrice, formatQty, formatTime } from "../lib/format";

export function Trades() {
  const { trades, currentSymbol } = useTrading();
  const market = getMarket(currentSymbol);

  return (
    <div className="flex h-full flex-col rounded-lg border border-[#1c1f26] bg-[#0d0f13]">
      <div className="border-b border-[#1c1f26] px-3 py-2">
        <span className="text-[13px] font-semibold text-white">Trades</span>
      </div>

      <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] uppercase tracking-wide text-[#6b7280]">
        <span>Price</span>
        <span className="text-right">Size ({market.base})</span>
        <span className="text-right">Time</span>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-[11px]">
        {trades.length === 0 ? (
          <div className="py-8 text-center font-sans text-[11px] text-[#5a606b]">
            No recent trades
          </div>
        ) : (
          trades.map((t, i) => (
            <div
              key={`${t.time}-${i}`}
              className="grid grid-cols-3 px-3 py-[3px] hover:bg-[#15181d]"
            >
              <span
                className="font-semibold"
                style={{ color: t.up ? "#16c784" : "#f6465d" }}
              >
                {formatPrice(t.price, market.pricePrecision)}
              </span>
              <span className="text-right text-[#c4c9d2]">
                {formatQty(t.qty, market.qtyPrecision)}
              </span>
              <span className="text-right text-[#6b7280]">
                {formatTime(t.time)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
