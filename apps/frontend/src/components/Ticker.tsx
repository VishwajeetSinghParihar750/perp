import { useTrading } from "../context/TradingContext";
import { MARKETS } from "../lib/constants";
import { formatPrice } from "../lib/format";

export function Ticker() {
  const { markPrices, indexPrices } = useTrading();

  const items = MARKETS.map((m) => {
    const mark = markPrices[m.symbol];
    const index = indexPrices[m.symbol];
    const change =
      mark != null && index != null && index > 0
        ? ((mark - index) / index) * 100
        : 0;
    return { ...m, mark, change };
  });

  // duplicate the list once so the -50% marquee loop is seamless
  const loop = [...items, ...items];

  return (
    <footer className="flex h-8 shrink-0 items-center overflow-hidden border-t border-[#1c1f26] bg-[#0a0b0d]">
      <div className="flex shrink-0 items-center gap-1.5 border-r border-[#1c1f26] px-3 text-[11px] font-bold text-[#16c784]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#16c784]" />
        Top Movers
      </div>
      <div className="animate-ticker flex items-center gap-6 whitespace-nowrap px-4 text-[11px] font-mono">
        {loop.map((item, i) => (
          <span key={`${item.symbol}-${i}`} className="flex items-center gap-1.5">
            <span className="font-semibold text-[#c4c9d2]">{item.label}</span>
            <span className="text-white">
              {formatPrice(item.mark, item.pricePrecision)}
            </span>
            <span className={item.change >= 0 ? "text-[#16c784]" : "text-[#f6465d]"}>
              {item.change >= 0 ? "+" : ""}
              {item.change.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </footer>
  );
}
