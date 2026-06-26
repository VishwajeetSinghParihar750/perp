import React, { useState, useEffect } from "react";
import { useTrading } from "../context/TradingContext";
import type {
  OrderSide,
  OrderType,
  MarginType,
} from "../context/TradingContext";
import { Wallet, Info, DollarSign, ChevronDown } from "lucide-react";

interface OrderPlacementProps {
  onOpenAuth: (mode: "signin" | "signup") => void;
}

export const OrderPlacement: React.FC<OrderPlacementProps> = ({
  onOpenAuth,
}) => {
  const {
    isAuthenticated,
    currentSymbol,
    lastTradedPrice,
    balance,
    placeOrder,
    addBalance,
    wsConnected,
    error,
  } = useTrading();

  const [side, setSide] = useState<OrderSide>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [marginType, setMarginType] = useState<MarginType>("ISOLATED");
  const [leverage, setLeverage] = useState<number>(10);
  const [price, setPrice] = useState<string>("");
  const [qty, setQty] = useState<string>("");
  const [sliderPct, setSliderPct] = useState<number>(0);
  const [orderValue, setOrderValue] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const assetName = currentSymbol.replace("USD", "");
  const usdBalance = balance.available;

  // Sync price input with lastTradedPrice if MARKET order or price is empty initially
  useEffect(() => {
    if (orderType === "MARKET") {
      setPrice(lastTradedPrice ? lastTradedPrice.toString() : "Market Price");
    } else if (!price && lastTradedPrice) {
      setPrice(lastTradedPrice.toString());
    }
  }, [orderType, lastTradedPrice]);

  // Recalculate Order Value when Price or Qty changes
  useEffect(() => {
    const p = parseFloat(price);
    const q = parseFloat(qty);
    if (orderType === "MARKET" && lastTradedPrice && q) {
      setOrderValue((lastTradedPrice * q).toFixed(2));
    } else if (p && q) {
      setOrderValue((p * q).toFixed(2));
    } else {
      setOrderValue("");
    }
  }, [price, qty, orderType, lastTradedPrice]);

  // Handle Qty slider percentage change
  const handleSliderChange = (pct: number) => {
    setSliderPct(pct);
    const currentPrice =
      orderType === "MARKET" ? lastTradedPrice || 0 : parseFloat(price || "0");
    if (currentPrice <= 0) return;

    // Available buying power = usdBalance * leverage
    const buyingPower = usdBalance * leverage;
    const targetOrderValue = buyingPower * (pct / 100);
    const calculatedQty = targetOrderValue / currentPrice;

    setQty(calculatedQty > 0 ? calculatedQty.toFixed(4) : "0");
  };

  // Handle Qty input change directly
  const handleQtyChange = (val: string) => {
    setQty(val);
    const q = parseFloat(val || "0");
    const currentPrice =
      orderType === "MARKET" ? lastTradedPrice || 0 : parseFloat(price || "0");
    if (currentPrice <= 0 || q <= 0) {
      setSliderPct(0);
      return;
    }

    const value = q * currentPrice;
    const maxBuyingPower = usdBalance * leverage;
    const pct = Math.min(100, Math.round((value / maxBuyingPower) * 100));
    setSliderPct(isNaN(pct) ? 0 : pct);
  };

  // Handle Order Value change directly
  const handleOrderValueChange = (val: string) => {
    setOrderValue(val);
    const valFloat = parseFloat(val || "0");
    const currentPrice =
      orderType === "MARKET" ? lastTradedPrice || 0 : parseFloat(price || "0");
    if (currentPrice <= 0 || valFloat <= 0) {
      setQty("");
      setSliderPct(0);
      return;
    }

    const calculatedQty = valFloat / currentPrice;
    setQty(calculatedQty.toFixed(4));

    const maxBuyingPower = usdBalance * leverage;
    const pct = Math.min(100, Math.round((valFloat / maxBuyingPower) * 100));
    setSliderPct(isNaN(pct) ? 0 : pct);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || submitting) return;

    setValidationError(null);

    const orderPrice =
      orderType === "MARKET" ? lastTradedPrice || 0 : parseFloat(price);
    const orderQty = parseFloat(qty);

    if (orderType === "MARKET" && !lastTradedPrice) {
      setValidationError("Waiting for market price — check engine connection");
      return;
    }
    if (!orderPrice || orderPrice <= 0) {
      setValidationError("Enter a valid price");
      return;
    }
    if (!orderQty || orderQty <= 0) {
      setValidationError("Enter a valid quantity");
      return;
    }

    const calculatedMargin = (orderPrice * orderQty) / leverage;
    if (calculatedMargin > usdBalance) {
      setValidationError("Insufficient balance — use the USD faucet");
      return;
    }

    setSubmitting(true);
    await placeOrder({
      side,
      type: orderType,
      price: orderPrice,
      qty: orderQty,
      margin: parseFloat(calculatedMargin.toFixed(4)),
      marginType,
    });
    setSubmitting(false);
    setQty("");
    setSliderPct(0);
  };

  const handleDeposit = (amount: number) => {
    addBalance("USD", amount);
  };

  // Calculations for display
  const priceVal =
    orderType === "MARKET" ? lastTradedPrice || 0 : parseFloat(price || "0");
  const qtyVal = parseFloat(qty || "0");
  const valueOfOrder = priceVal * qtyVal;
  const marginRequired = valueOfOrder / leverage;

  // Estimated Liquidation Price (Approximate simplified formula for display purposes)
  // Long Liquidation Price = EntryPrice * (1 - 1/Leverage) + marginAdjustment
  // Short Liquidation Price = EntryPrice * (1 + 1/Leverage) - marginAdjustment
  const estLiqPrice =
    priceVal > 0 && leverage > 1
      ? side === "BUY"
        ? priceVal * (1 - 1 / leverage + 0.05)
        : priceVal * (1 + 1 / leverage - 0.05)
      : null;

  return (
    <div className="bg-[#0B0D10] text-gray-200 p-4 border border-gray-900 rounded-2xl flex flex-col h-full justify-between">
      <div>
        {/* Buy / Sell Tabs */}
        <div className="grid grid-cols-2 gap-2 mb-4 bg-[#14171E] p-1 rounded-xl">
          <button
            onClick={() => setSide("BUY")}
            className={`py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
              side === "BUY"
                ? "bg-emerald-500 text-black shadow-lg"
                : "text-emerald-500 hover:bg-gray-800"
            }`}
          >
            Buy / Long
          </button>
          <button
            onClick={() => setSide("SELL")}
            className={`py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
              side === "SELL"
                ? "bg-red-500 text-black shadow-lg"
                : "text-red-500 hover:bg-gray-800"
            }`}
          >
            Sell / Short
          </button>
        </div>

        {/* Order Type Buttons */}
        <div className="flex gap-2 mb-4 text-xs font-semibold">
          <button
            onClick={() => setOrderType("LIMIT")}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              orderType === "LIMIT"
                ? "bg-[#1C202B] text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Limit
          </button>
          <button
            onClick={() => setOrderType("MARKET")}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              orderType === "MARKET"
                ? "bg-[#1C202B] text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Market
          </button>
          <button className="px-3 py-1.5 text-gray-600 cursor-not-allowed flex items-center gap-1">
            Conditional <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <div className="flex justify-between items-center text-xs mb-4">
          <span className="text-gray-400 flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" /> Available
          </span>
          <span className="font-mono text-gray-200">
            ${usdBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
            USD
          </span>
        </div>
        {balance.locked > 0 && (
          <div className="flex justify-between items-center text-xs mb-4 -mt-2">
            <span className="text-gray-500">Locked margin</span>
            <span className="font-mono text-amber-400 text-[11px]">
              ${balance.locked.toFixed(2)}
            </span>
          </div>
        )}
        {!wsConnected && isAuthenticated && (
          <div className="mb-4 p-2 bg-amber-950/30 border border-amber-900/40 rounded-lg text-[11px] text-amber-400">
            Engine disconnected — orders may not execute
          </div>
        )}
        {(validationError || error) && (
          <div className="mb-4 p-2 bg-red-950/30 border border-red-900/40 rounded-lg text-[11px] text-red-400">
            {validationError || error}
          </div>
        )}

        {/* Price Input */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Price</span>
            <span
              className="text-emerald-400 font-mono flex items-center gap-1 cursor-pointer"
              onClick={() => setPrice(lastTradedPrice?.toString() || "")}
            >
              Last Traded: {lastTradedPrice ? lastTradedPrice.toFixed(2) : "—"}
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              disabled={orderType === "MARKET"}
              value={orderType === "MARKET" ? "Market Price" : price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#14171E] border border-gray-900 rounded-xl py-2.5 pl-4 pr-10 text-sm font-mono text-white placeholder-gray-600 focus:border-emerald-500 focus:outline-none transition-colors disabled:opacity-50"
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 font-bold text-xs">
              <DollarSign className="w-3.5 h-3.5 text-gray-500" />
            </span>
          </div>
        </div>

        {/* Quantity Input */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Quantity</span>
            <span className="text-gray-400 font-semibold">{assetName}</span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={qty}
              onChange={(e) => handleQtyChange(e.target.value)}
              placeholder="0.0000"
              className="w-full bg-[#14171E] border border-gray-900 rounded-xl py-2.5 pl-4 pr-12 text-sm font-mono text-white placeholder-gray-600 focus:border-emerald-500 focus:outline-none transition-colors"
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 font-bold text-xs uppercase font-mono">
              {assetName}
            </span>
          </div>
        </div>

        {/* Slider */}
        <div className="mb-4 space-y-1">
          <input
            type="range"
            min="0"
            max="100"
            step="25"
            value={sliderPct}
            onChange={(e) => handleSliderChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[#14171E] rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-gray-500 font-semibold font-mono">
            <span
              onClick={() => handleSliderChange(0)}
              className="cursor-pointer hover:text-white"
            >
              0%
            </span>
            <span
              onClick={() => handleSliderChange(25)}
              className="cursor-pointer hover:text-white"
            >
              25%
            </span>
            <span
              onClick={() => handleSliderChange(50)}
              className="cursor-pointer hover:text-white"
            >
              50%
            </span>
            <span
              onClick={() => handleSliderChange(75)}
              className="cursor-pointer hover:text-white"
            >
              75%
            </span>
            <span
              onClick={() => handleSliderChange(100)}
              className="cursor-pointer hover:text-white"
            >
              100%
            </span>
          </div>
        </div>

        {/* Leverage & Margin Type Selector */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Margin Type */}
          <div className="space-y-1">
            <span className="text-xs text-gray-400">Margin Type</span>
            <select
              value={marginType}
              onChange={(e) => setMarginType(e.target.value as MarginType)}
              className="w-full bg-[#14171E] border border-gray-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ISOLATED">Isolated</option>
              <option value="CROSS">Cross</option>
            </select>
          </div>

          {/* Leverage */}
          <div className="space-y-1">
            <span className="text-xs text-gray-400">Leverage: {leverage}x</span>
            <select
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="w-full bg-[#14171E] border border-gray-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="1">1x (No Lev)</option>
              <option value="5">5x</option>
              <option value="10">10x</option>
              <option value="20">20x</option>
            </select>
          </div>
        </div>

        {/* Order Value Display & Input */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Order Value</span>
            <span className="text-gray-400 font-semibold">USD</span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={orderValue}
              onChange={(e) => handleOrderValueChange(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#14171E] border border-gray-900 rounded-xl py-2.5 pl-4 pr-10 text-sm font-mono text-white placeholder-gray-600 focus:border-emerald-500 focus:outline-none transition-colors"
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 font-bold text-xs">
              <DollarSign className="w-3.5 h-3.5 text-gray-500" />
            </span>
          </div>
        </div>

        {/* Info Rows */}
        <div className="space-y-2 border-t border-gray-900 pt-3 text-xs mb-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 flex items-center gap-1">
              Margin Required <Info className="w-3 h-3" />
            </span>
            <span className="font-mono text-gray-300">
              {marginRequired > 0
                ? `$${marginRequired.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 flex items-center gap-1">
              Est. Liquidation Price <Info className="w-3 h-3" />
            </span>
            <span className="font-mono text-amber-500">
              {estLiqPrice && estLiqPrice > 0
                ? `$${estLiqPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Button Action */}
      <div className="space-y-3">
        {isAuthenticated ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || !wsConnected}
            className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              side === "BUY"
                ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                : "bg-red-500 hover:bg-red-400 text-black"
            }`}
          >
            {submitting
              ? "Submitting..."
              : side === "BUY"
                ? "Place Buy / Long Order"
                : "Place Sell / Short Order"}
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onOpenAuth("signup")}
              className="w-full py-3 bg-[#1A1E26] hover:bg-[#232934] border border-gray-800 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer text-center"
            >
              Sign up to trade
            </button>
            <button
              onClick={() => onOpenAuth("signin")}
              className="w-full py-3 bg-[#14171E] hover:bg-[#1C202B] border border-gray-800 text-gray-300 font-semibold rounded-xl text-sm transition-colors cursor-pointer text-center"
            >
              Log in to trade
            </button>
          </div>
        )}

        {/* USD Faucet Section */}
        {isAuthenticated && (
          <div className="bg-[#14171E] border border-gray-900 rounded-xl p-2.5 mt-2 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">
              Testnet USD Faucet
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => handleDeposit(100)}
                className="py-1 px-2 text-center text-xs bg-[#1F2432] hover:bg-[#272E40] rounded-md font-mono font-bold text-white transition-colors cursor-pointer"
              >
                +$100
              </button>
              <button
                onClick={() => handleDeposit(1000)}
                className="py-1 px-2 text-center text-xs bg-[#1F2432] hover:bg-[#272E40] rounded-md font-mono font-bold text-white transition-colors cursor-pointer"
              >
                +$1K
              </button>
              <button
                onClick={() => handleDeposit(10000)}
                className="py-1 px-2 text-center text-xs bg-[#1F2432] hover:bg-[#272E40] rounded-md font-mono font-bold text-white transition-colors cursor-pointer"
              >
                +$10K
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
