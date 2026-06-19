import type { EngineTypes } from "@repo/shared-types";

type SIDE = EngineTypes.SIDE;
type ORDER_TYPE = EngineTypes.TYPE;
type MARGIN_TYPE = EngineTypes.MARGIN_TYPE;
type ORDER_STATUS = EngineTypes.ORDER_STATUS;
type USER_ID = EngineTypes.USER_ID;
type ORDER_ID = EngineTypes.ORDER_ID;
type MARKET_ID = string;
type PRICE = EngineTypes.PRICE;
type QUANTITY = EngineTypes.QUANTITY;

export interface Order {
  orderId: ORDER_ID;
  userId: USER_ID;
  price: PRICE;
  quantity: QUANTITY;
  margin: PRICE;
  filledQuantity: QUANTITY;
  marketId: MARKET_ID;
  status: ORDER_STATUS;
  side: SIDE;
  type: ORDER_TYPE;
  marginType: MARGIN_TYPE;
}

export class OrderFactory {
  private marketId: MARKET_ID;
  private orderIdCounter: number = 0;

  constructor(marketId: MARKET_ID) {
    this.marketId = marketId;
  }

  private getNextOrderId(): ORDER_ID {
    return this.marketId + (this.orderIdCounter++).toString();
  }

  create(
    userId: USER_ID,
    price: PRICE,
    quantity: QUANTITY,
    margin: PRICE,
    marketId: MARKET_ID,
    side: SIDE,
    type: ORDER_TYPE,
    marginType: MARGIN_TYPE,
    filledQuantity: QUANTITY = 0,
    status: ORDER_STATUS = "OPEN"
  ): Order {
    return {
      orderId: this.getNextOrderId(),
      userId,
      price,
      quantity,
      margin,
      filledQuantity,
      marketId,
      status,
      side,
      type,
      marginType,
    };
  }
}
