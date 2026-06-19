import React, { useState } from "react";
import { useTrading } from "../context/TradingContext";
import { ShieldAlert, Wifi, WifiOff } from "lucide-react";

export const OrderBook: React.FC = () => {
  const {
    orderbook,
    lastTradedPrice,
    indexPrice,
    trades,
    currentSymbol,
    wsConnected,
    isAuthenticated,
  } = useTrading();

  const [activeTab, setActiveTab] = useState<"book" | "trades">("book");

  const assetName = currentSymbol.replace("USD", ""); // BTC, SOL, ETH

  // limit asks and bids to top 15 for display
  const asks = orderbook.asks.slice(-15); // lowest asks at the bottom of asks list
  const bids = orderbook.bids.slice(0, 15);  // highest bids at the top of bids list

  // Calculate maximum total volume for depth bar rendering
  const maxAskQty = asks.length > 0 ? Math.max(...asks.map(([, qty]) => qty)) : 1;
  const maxBidQty = bids.length > 0 ? Math.max(...bids.map(([, qty]) => qty)) : 1;
  const maxQty = Math.max(maxAskQty, maxBidQty);

  // Spread calculation
  const bestBid = bids.length > 0 ? bids[0][0] : null;
  const bestAsk = asks.length > 0 ? asks[asks.length - 1][0] : null;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : null;
  const spreadPct = spread && bestBid ? (spread / bestBid) * 100 : null;

  return (
    <div className="bg-[#0B0D10] text-gray-300 border border-gray-900 rounded-2xl flex flex-col h-full overflow-hidden">
      {/* WS Status & Tabs */}
      <div className="flex justify-between items-center px-4 py-3 bg-[#11131A] border-b border-gray-900">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("book")}
            className={`font-semibold text-sm transition-colors cursor-pointer ${
              activeTab === "book" ? "text-emerald-400 border-b-2 border-emerald-400 pb-1" : "text-gray-400 hover:text-white"
            }`}
          >
            Order Book
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={`font-semibold text-sm transition-colors cursor-pointer ${
              activeTab === "trades" ? "text-emerald-400 border-b-2 border-emerald-400 pb-1" : "text-gray-400 hover:text-white"
            }`}
          >
            Recent Trades
          </button>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          {wsConnected ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <Wifi className="w-3.5 h-3.5 animate-pulse" /> Live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-500">
              <WifiOff className="w-3.5 h-3.5" /> Disconnected
            </span>
          )}
        </div>
      </div>

      {activeTab === "book" ? (
        <div className="flex-1 flex flex-col justify-between overflow-hidden text-xs">
          {/* Table Headers */}
          <div className="grid grid-cols-3 px-4 py-2 font-semibold text-gray-500 border-b border-gray-950">
            <span>Price (USD)</span>
            <span className="text-right">Size ({assetName})</span>
            <span className="text-right">Total ({assetName})</span>
          </div>

          {/* Book Content Container */}
          <div className="flex-1 flex flex-col justify-between overflow-y-auto font-mono">
            
            {/* ASKS (Sells - Top section) */}
            <div className="flex-1 flex flex-col justify-end min-h-[140px]">
              {asks.length === 0 ? (
                <div className="text-center text-gray-600 py-8 text-xs font-sans">No asks active</div>
              ) : (
                asks.map(([price, qty], index) => {
                  // Running total from top ask down to bottom ask
                  let cumulativeQty = 0;
                  for (let i = index; i < asks.length; i++) {
                    cumulativeQty += asks[i][1];
                  }

                  const depthPct = (qty / maxQty) * 100;

                  return (
                    <div
                      key={`ask-${price}-${index}`}
                      className="relative grid grid-cols-3 px-4 py-1 hover:bg-red-950/10 transition-colors"
                    >
                      {/* Depth Bar Background */}
                      <div
                        className="absolute right-0 top-0 bottom-0 bg-red-950/20 pointer-events-none transition-all duration-300"
                        style={{ width: `${depthPct}%` }}
                      ></div>
                      
                      <span className="text-red-500 font-bold relative z-10">
                        {price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-right text-gray-300 relative z-10">
                        {qty.toFixed(4)}
                      </span>
                      <span className="text-right text-gray-400 relative z-10">
                        {cumulativeQty.toFixed(4)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* SPREAD / LAST PRICE BANNER */}
            <div className="bg-[#11131A] border-y border-gray-900/60 px-4 py-2 flex justify-between items-center font-sans text-xs">
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold font-mono ${spread && spread < 0 ? "text-red-500" : "text-emerald-400"}`}>
                  {lastTradedPrice
                    ? lastTradedPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "—"}
                </span>
                {indexPrice && (
                  <span className="text-gray-500 text-[10px] font-mono">
                    Index: ${indexPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <div className="text-right font-mono text-[10px] text-gray-500">
                {spread ? (
                  <span>
                    Spread: ${spread.toFixed(2)} ({spreadPct?.toFixed(2)}%)
                  </span>
                ) : (
                  <span>Spread: —</span>
                )}
              </div>
            </div>

            {/* BIDS (Buys - Bottom section) */}
            <div className="flex-1 flex flex-col justify-start min-h-[140px]">
              {bids.length === 0 ? (
                <div className="text-center text-gray-600 py-8 text-xs font-sans">No bids active</div>
              ) : (
                bids.map(([price, qty], index) => {
                  // Running total from top bid down to current bid
                  let cumulativeQty = 0;
                  for (let i = 0; i <= index; i++) {
                    cumulativeQty += bids[i][1];
                  }

                  const depthPct = (qty / maxQty) * 100;

                  return (
                    <div
                      key={`bid-${price}-${index}`}
                      className="relative grid grid-cols-3 px-4 py-1 hover:bg-emerald-950/10 transition-colors"
                    >
                      {/* Depth Bar Background */}
                      <div
                        className="absolute right-0 top-0 bottom-0 bg-emerald-950/20 pointer-events-none transition-all duration-300"
                        style={{ width: `${depthPct}%` }}
                      ></div>

                      <span className="text-emerald-400 font-bold relative z-10">
                        {price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-right text-gray-300 relative z-10">
                        {qty.toFixed(4)}
                      </span>
                      <span className="text-right text-gray-400 relative z-10">
                        {cumulativeQty.toFixed(4)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {!isAuthenticated && (
            <div className="p-3 bg-[#11131A] text-center text-gray-500 text-[11px] border-t border-gray-900 flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>Real-time streams are secured. Sign in to view live orderbook.</span>
            </div>
          )}
        </div>
      ) : (
        /* TRADES TAB */
        <div className="flex-1 flex flex-col justify-between overflow-hidden text-xs">
          {/* Table Headers */}
          <div className="grid grid-cols-3 px-4 py-2 font-semibold text-gray-500 border-b border-gray-950">
            <span>Price (USD)</span>
            <span className="text-right">Size ({assetName})</span>
            <span className="text-right">Time</span>
          </div>

          {/* Trades Content Container */}
          <div className="flex-1 overflow-y-auto font-mono">
            {trades.length === 0 ? (
              <div className="text-center text-gray-600 py-16 font-sans">
                {isAuthenticated
                  ? "Waiting for trades to execute..."
                  : "Sign in to subscribe to public trades stream"}
              </div>
            ) : (
              trades.map((trade, index) => {
                // Determine direction based on trade index price change compared to next trade
                const nextTrade = trades[index + 1];
                const isPriceUp = nextTrade ? trade.price >= nextTrade.price : true;

                return (
                  <div
                    key={`trade-${index}`}
                    className="grid grid-cols-3 px-4 py-1.5 hover:bg-gray-900/40 transition-colors"
                  >
                    <span className={`font-bold ${isPriceUp ? "text-emerald-400" : "text-red-500"}`}>
                      {trade.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-right text-gray-300">{trade.qty.toFixed(4)}</span>
                    <span className="text-right text-gray-500 text-[10px]">{trade.time}</span>
                  </div>
                );
              })
            )}
          </div>

          {!isAuthenticated && (
            <div className="p-3 bg-[#11131A] text-center text-gray-500 text-[11px] border-t border-gray-900 flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>Sign in to listen to real-time execution matches.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
