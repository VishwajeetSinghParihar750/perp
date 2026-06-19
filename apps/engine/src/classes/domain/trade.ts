import type { EngineTypes } from "@repo/shared-types";

type TRADE_SYMBOL = EngineTypes.TRADABLE_SYMBOL;

export type TradeOrderInfo = {
  buyerId?: string;
  sellerId?: string;
  orderId: string;
  filledQty: number;
  totalQty: number;
  orderStatus: EngineTypes.ORDER_STATUS;
};

export type Trade = {
  fillId: string;
  symbol: TRADE_SYMBOL;
  qty: number;
  price: number;
  bidPrice: number;
  buyOrderInfo: {
    buyerId: string;
    orderId: string;
    filledQty: number;
    totalQty: number;
    orderStatus: EngineTypes.ORDER_STATUS;
  };
  sellOrderInfo: {
    sellerId: string;
    orderId: string;
    filledQty: number;
    totalQty: number;
    orderStatus: EngineTypes.ORDER_STATUS;
  };
};

export class TradeFactory {
  private counters: Map<string, number> = new Map();

  private getNextTradeId(symbol: string): string {
    const count = this.counters.get(symbol) ?? 0;
    this.counters.set(symbol, count + 1);
    return symbol + count.toString();
  }

  create(
    price: EngineTypes.PRICE,
    filledQty: EngineTypes.QUANTITY,
    symbol: TRADE_SYMBOL,
    longOrderInfo: {
      buyerId: string;
      orderId: string;
      filledQty: number;
      totalQty: number;
      orderStatus: EngineTypes.ORDER_STATUS;
    },
    shortOrderInfo: {
      sellerId: string;
      orderId: string;
      filledQty: number;
      totalQty: number;
      orderStatus: EngineTypes.ORDER_STATUS;
    },
  ): Trade {
    return {
      fillId: this.getNextTradeId(symbol),
      symbol,
      qty: filledQty,
      price,
      bidPrice: price,
      buyOrderInfo: longOrderInfo,
      sellOrderInfo: shortOrderInfo,
    };
  }
}
