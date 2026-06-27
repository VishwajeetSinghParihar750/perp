import { useEffect, useMemo, useState } from "react";
import { useTrading } from "../context/TradingContext";
import { getMarket } from "../lib/constants";
import { formatUsd } from "../lib/format";
import type { MarginType, OrderType, Side } from "../lib/types";

const LEVERAGES = [1, 3, 5, 10, 20, 50];
const FAUCET = [100, 1000, 10000];
const MARKET_SLIPPAGE = 0.01;

interface OrderFormProps {
  onOpenAuth: (mode: "signin" | "signup") => void;
}

export function OrderForm({ onOpenAuth }: OrderFormProps) {
  const {
    isAuthenticated,
    connected,
    currentSymbol,
    markPrice,
    lastPrice,
    indexPrice,
    orderbook,
    balance,
    placeOrder,
    addBalance,
  } = useTrading();

  const market = getMarket(currentSymbol);

  const [side, setSide] = useState<Side>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [marginType, setMarginType] = useState<MarginType>("ISOLATED");
  const [leverage, setLeverage] = useState(10);
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [sliderPct, setSliderPct] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const limitPrice = parseFloat(price) || 0;
  const bookMid =
    orderbook.asks[0]?.[0] != null && orderbook.bids[0]?.[0] != null
      ? (orderbook.asks[0][0] + orderbook.bids[0][0]) / 2
      : null;
  const basePrice =
    lastPrice ??
    markPrice ??
    indexPrice ??
    bookMid ??
    (limitPrice > 0 ? limitPrice : null);

  useEffect(() => {
    if (orderType === "LIMIT" && !price && basePrice) {
      setPrice(basePrice.toFixed(market.pricePrecision));
    }
  }, [orderType, basePrice, price, market.pricePrecision]);

  const submitPrice =
    orderType === "MARKET" && basePrice != null
      ? side === "BUY"
        ? basePrice * (1 + MARKET_SLIPPAGE)
        : basePrice * (1 - MARKET_SLIPPAGE)
      : limitPrice;
  const displayPrice = orderType === "MARKET" ? basePrice ?? 0 : limitPrice;
  const sizingPrice = submitPrice > 0 ? submitPrice : displayPrice;
  const qtyNum = parseFloat(qty) || 0;
  const orderValue = displayPrice * qtyNum;
  const marginRequired =
    leverage > 0 ? (submitPrice * qtyNum) / leverage : 0;
  const buyingPower = balance.available * leverage;

  const estLiqPrice = useMemo(() => {
    if (submitPrice <= 0 || leverage <= 1) return null;
    return side === "BUY"
      ? submitPrice * (1 - 1 / leverage)
      : submitPrice * (1 + 1 / leverage);
  }, [submitPrice, leverage, side]);

  const applySlider = (pct: number) => {
    setSliderPct(pct);
    if (sizingPrice <= 0) return;
    const target = buyingPower * (pct / 100);
    setQty((target / sizingPrice).toFixed(market.qtyPrecision));
  };

  const onQtyChange = (val: string) => {
    setQty(val);
    const q = parseFloat(val) || 0;
    if (sizingPrice <= 0 || buyingPower <= 0) {
      setSliderPct(0);
      return;
    }
    setSliderPct(
      Math.min(100, Math.round(((q * sizingPrice) / buyingPower) * 100)),
    );
  };

  const submit = async () => {
    if (!isAuthenticated || submitting) return;
    setFormError(null);

    if (orderType === "MARKET" && !basePrice) {
      setFormError("Waiting for price feed");
      return;
    }
    if (submitPrice <= 0) {
      setFormError("Enter a valid price");
      return;
    }
    if (qtyNum <= 0) {
      setFormError("Enter a valid quantity");
      return;
    }
    if (marginRequired > balance.available) {
      setFormError("Insufficient equity — use the faucet");
      return;
    }

    setSubmitting(true);
    await placeOrder({
      side,
      type: orderType,
      price: submitPrice,
      qty: qtyNum,
      margin: parseFloat(marginRequired.toFixed(4)),
      marginType,
    });
    setSubmitting(false);
    setQty("");
    setSliderPct(0);
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-[#1c1f26] bg-[#0d0f13] p-3">
      <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-lg bg-[#15181d] p-1">
        <button
          onClick={() => setSide("BUY")}
          className={`rounded-md py-2 text-sm font-bold transition-all ${
            side === "BUY"
              ? "bg-[#16c784] text-black"
              : "text-[#16c784] hover:bg-[#1c2027]"
          }`}
        >
          Buy / Long
        </button>
        <button
          onClick={() => setSide("SELL")}
          className={`rounded-md py-2 text-sm font-bold transition-all ${
            side === "SELL"
              ? "bg-[#f6465d] text-black"
              : "text-[#f6465d] hover:bg-[#1c2027]"
          }`}
        >
          Sell / Short
        </button>
      </div>

      <div className="mb-3 flex gap-4 text-[13px] font-medium">
        {(["LIMIT", "MARKET"] as OrderType[]).map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={`capitalize transition-colors ${
              orderType === t ? "text-white" : "text-[#6b7280] hover:text-white"
            }`}
          >
            {t.toLowerCase()}
          </button>
        ))}
        <span className="cursor-not-allowed text-[#3a3f49]">Conditional</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-[#9aa0aa]">Available Equity</span>
          <span className="font-mono text-white">
            {formatUsd(balance.available)}
          </span>
        </div>
        {balance.locked > 0 && (
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[#9aa0aa]">Locked Margin</span>
            <span className="font-mono text-[#e6a700]">
              {formatUsd(balance.locked)}
            </span>
          </div>
        )}

        <Field label="Price" suffix="USD">
          <input
            inputMode="decimal"
            disabled={orderType === "MARKET"}
            value={orderType === "MARKET" ? "Market" : price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent font-mono text-sm text-white outline-none placeholder:text-[#4a505b] disabled:text-[#6b7280]"
          />
        </Field>

        <Field label="Quantity" suffix={market.base}>
          <input
            inputMode="decimal"
            value={qty}
            onChange={(e) => onQtyChange(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent font-mono text-sm text-white outline-none placeholder:text-[#4a505b]"
          />
        </Field>

        <div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={sliderPct}
            onChange={(e) => applySlider(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] font-mono text-[#6b7280]">
            {[0, 25, 50, 75, 100].map((p) => (
              <button key={p} onClick={() => applySlider(p)} className="hover:text-white">
                {p}%
              </button>
            ))}
          </div>
        </div>

        <Field label="Order Value" suffix="USD">
          <span className="w-full font-mono text-sm text-[#c4c9d2]">
            {orderValue > 0 ? orderValue.toFixed(2) : "0.00"}
          </span>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[11px] text-[#9aa0aa]">Margin</span>
            <select
              value={marginType}
              onChange={(e) => setMarginType(e.target.value as MarginType)}
              className="w-full rounded-lg border border-[#1c1f26] bg-[#15181d] px-2 py-1.5 text-xs text-white outline-none"
            >
              <option value="ISOLATED">Isolated</option>
              <option value="CROSS">Cross</option>
            </select>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] text-[#9aa0aa]">Leverage</span>
            <select
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full rounded-lg border border-[#1c1f26] bg-[#15181d] px-2 py-1.5 text-xs text-white outline-none"
            >
              {LEVERAGES.map((l) => (
                <option key={l} value={l}>
                  {l}x
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-[#1c1f26] pt-2 text-[12px]">
          <Row label="Margin Required" value={formatUsd(marginRequired)} />
          <Row
            label="Est. Liquidation Price"
            value={estLiqPrice ? formatUsd(estLiqPrice) : "—"}
            valueClass="text-[#e6a700]"
          />
          {orderType === "MARKET" && (
            <Row label="Max Slippage" value="1%" />
          )}
        </div>

        {formError && (
          <div className="rounded-lg border border-[#f6465d]/30 bg-[#f6465d]/10 px-2.5 py-1.5 text-[11px] text-[#f6465d]">
            {formError}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {isAuthenticated ? (
          <button
            onClick={submit}
            disabled={submitting || !connected}
            className={`w-full rounded-lg py-3 text-sm font-bold transition-all disabled:opacity-50 ${
              side === "BUY"
                ? "bg-[#16c784] text-black hover:bg-[#13b377]"
                : "bg-[#f6465d] text-black hover:bg-[#e23e54]"
            }`}
          >
            {submitting
              ? "Submitting…"
              : side === "BUY"
                ? "Buy / Long"
                : "Sell / Short"}
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => onOpenAuth("signup")}
              className="w-full rounded-lg bg-[#16c784] py-3 text-sm font-bold text-black transition-colors hover:bg-[#13b377]"
            >
              Sign up to trade
            </button>
            <button
              onClick={() => onOpenAuth("signin")}
              className="w-full rounded-lg border border-[#1c1f26] bg-[#15181d] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1c2027]"
            >
              Log in to trade
            </button>
          </div>
        )}

        {isAuthenticated && (
          <div className="rounded-lg border border-[#1c1f26] bg-[#15181d] p-2">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#16c784]">
              Testnet USD Faucet
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {FAUCET.map((amt) => (
                <button
                  key={amt}
                  onClick={() => void addBalance(amt)}
                  className="rounded-md bg-[#1c2027] py-1 font-mono text-[11px] font-bold text-white transition-colors hover:bg-[#242a33]"
                >
                  +${amt >= 1000 ? `${amt / 1000}K` : amt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  suffix,
  children,
}: {
  label: string;
  suffix: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] text-[#9aa0aa]">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-[#1c1f26] bg-[#15181d] px-3 py-2">
        {children}
        <span className="shrink-0 text-[11px] font-semibold text-[#6b7280]">
          {suffix}
        </span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass = "text-[#c4c9d2]",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#6b7280]">{label}</span>
      <span className={`font-mono ${valueClass}`}>{value}</span>
    </div>
  );
}
