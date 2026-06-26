import { useMemo } from "react";
import { useTrading } from "../context/TradingContext";
import { getMarket } from "../lib/constants";
import { formatPrice, formatQty } from "../lib/format";

const ROWS = 11;

interface Row {
  price: number;
  size: number;
  total: number;
}

function buildRows(
  levels: [number, number][],
  count: number,
  topFirst: boolean,
): { rows: Row[]; maxTotal: number } {
  // levels come sorted (asks asc, bids desc). running total accumulates from
  // the best price outward.
  const sliced = levels.slice(0, count);
  let running = 0;
  const rows: Row[] = sliced.map(([price, size]) => {
    running += size;
    return { price, size, total: running };
  });
  const maxTotal = running || 1;
  return { rows: topFirst ? [...rows].reverse() : rows, maxTotal };
}

export function OrderBook() {
  const { orderbook, currentSymbol, markPrice, lastPrice } = useTrading();
  const market = getMarket(currentSymbol);

  const { asks, bids, spread, spreadPct } = useMemo(() => {
    const askData = buildRows(orderbook.asks, ROWS, true);
    const bidData = buildRows(orderbook.bids, ROWS, false);
    const bestAsk = orderbook.asks[0]?.[0];
    const bestBid = orderbook.bids[0]?.[0];
    const sp = bestAsk && bestBid ? bestAsk - bestBid : null;
    return {
      asks: askData,
      bids: bidData,
      spread: sp,
      spreadPct: sp && bestBid ? (sp / bestBid) * 100 : null,
    };
  }, [orderbook]);

  const mid = markPrice ?? lastPrice;

  return (
    <div className="flex h-full flex-col rounded-lg border border-[#1c1f26] bg-[#0d0f13]">
      <div className="flex items-center justify-between border-b border-[#1c1f26] px-3 py-2">
        <span className="text-[13px] font-semibold text-white">Book</span>
      </div>

      <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] uppercase tracking-wide text-[#6b7280]">
        <span>Price</span>
        <span className="text-right">Size ({market.base})</span>
        <span className="text-right">Total</span>
      </div>

      <div className="flex flex-1 flex-col justify-between overflow-hidden font-mono text-[11px]">
        <div className="flex flex-1 flex-col justify-end">
          {asks.rows.length === 0 ? (
            <div className="py-6 text-center font-sans text-[11px] text-[#5a606b]">
              No asks
            </div>
          ) : (
            asks.rows.map((row) => (
              <Level
                key={`a-${row.price}`}
                row={row}
                maxTotal={asks.maxTotal}
                color="#f6465d"
                barColor="rgba(246,70,93,0.12)"
                market={market}
              />
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-y border-[#1c1f26] bg-[#0a0b0d] px-3 py-1.5">
          <span
            className={`text-[14px] font-bold ${
              (spread ?? 0) >= 0 ? "text-[#16c784]" : "text-[#f6465d]"
            }`}
          >
            {formatPrice(mid, market.pricePrecision)}
          </span>
          <span className="text-[10px] text-[#6b7280]">
            Spread{" "}
            {spread != null
              ? `${formatPrice(spread, market.pricePrecision)} (${spreadPct?.toFixed(3)}%)`
              : "—"}
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-start">
          {bids.rows.length === 0 ? (
            <div className="py-6 text-center font-sans text-[11px] text-[#5a606b]">
              No bids
            </div>
          ) : (
            bids.rows.map((row) => (
              <Level
                key={`b-${row.price}`}
                row={row}
                maxTotal={bids.maxTotal}
                color="#16c784"
                barColor="rgba(22,199,132,0.12)"
                market={market}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Level({
  row,
  maxTotal,
  color,
  barColor,
  market,
}: {
  row: Row;
  maxTotal: number;
  color: string;
  barColor: string;
  market: ReturnType<typeof getMarket>;
}) {
  return (
    <div className="relative grid grid-cols-3 px-3 py-[3px]">
      <div
        className="pointer-events-none absolute inset-y-0 right-0"
        style={{ width: `${(row.total / maxTotal) * 100}%`, background: barColor }}
      />
      <span className="relative z-10 font-semibold" style={{ color }}>
        {formatPrice(row.price, market.pricePrecision)}
      </span>
      <span className="relative z-10 text-right text-[#c4c9d2]">
        {formatQty(row.size, market.qtyPrecision)}
      </span>
      <span className="relative z-10 text-right text-[#6b7280]">
        {formatQty(row.total, market.qtyPrecision)}
      </span>
    </div>
  );
}
