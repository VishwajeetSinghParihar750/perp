import type { EngineEvent, EngineTypes } from "@repo/shared-types";

type SIDE = EngineTypes.SIDE;
type ORDER_TYPE = EngineTypes.TYPE;
type MARGIN_TYPE = EngineTypes.MARGIN_TYPE;
type ORDER_STATUS = EngineTypes.ORDER_STATUS;
type USER_ID = EngineTypes.USER_ID;
type ORDER_ID = EngineTypes.ORDER_ID;
type MARKET_SYMBOL = EngineTypes.TRADABLE_SYMBOL;
type PRICE = EngineTypes.PRICE;
type QUANTITY = EngineTypes.QUANTITY;

export interface Order {
  orderId: ORDER_ID;
  userId: USER_ID;
  price: PRICE;
  quantity: QUANTITY;
  margin: PRICE;
  filledQuantity: QUANTITY;
  marketSymbol: MARKET_SYMBOL;
  status: ORDER_STATUS;
  side: SIDE;
  type: ORDER_TYPE;
  marginType: MARGIN_TYPE;
}

export class OrderFactory {
  private counters: Map<string, number> = new Map();

  private getNextOrderId(marketSymbol: string): string {
    const count = this.counters.get(marketSymbol) ?? 0;
    this.counters.set(marketSymbol, count + 1);
    return marketSymbol + count.toString();
  }

  create(
    userId: USER_ID,
    price: PRICE,
    quantity: QUANTITY,
    margin: PRICE,
    marketSymbol: MARKET_SYMBOL,
    side: SIDE,
    type: ORDER_TYPE,
    marginType: MARGIN_TYPE,
    filledQuantity: QUANTITY = 0,
    status: ORDER_STATUS = "OPEN",
  ): Order {
    return {
      orderId: this.getNextOrderId(marketSymbol),
      userId,
      price,
      quantity,
      margin,
      filledQuantity,
      marketSymbol,
      status,
      side,
      type,
      marginType,
    };
  }
}
