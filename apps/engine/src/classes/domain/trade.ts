import type { EngineTypes } from "@repo/shared-types";

type TRADABLE_SYMBOL = EngineTypes.TRADABLE_SYMBOL;

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
  symbol: TRADABLE_SYMBOL;
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
  private symbol: TRADABLE_SYMBOL;
  private tradeIdCounter: number = 0;

  constructor(symbol: TRADABLE_SYMBOL) {
    this.symbol = symbol;
  }

  private getNextTradeId(): string {
    return this.symbol + (this.tradeIdCounter++).toString();
  }

  create(
    price: EngineTypes.PRICE,
    filledQty: EngineTypes.QUANTITY,
    symbol: TRADABLE_SYMBOL,
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
      fillId: this.getNextTradeId(),
      symbol,
      qty: filledQty,
      price,
      bidPrice: price,
      buyOrderInfo: longOrderInfo,
      sellOrderInfo: shortOrderInfo,
    };
  }
}
