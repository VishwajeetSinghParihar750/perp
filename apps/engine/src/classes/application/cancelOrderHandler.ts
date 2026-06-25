import type { EngineTypes } from "@repo/shared-types";
import type Orderbook from "../domain/orderbook.js";

import type { Result } from "../types.js";
export interface CancelOrderCommand {
  orderId: EngineTypes.ORDER_ID;
}

export default class CancelOrderHandler {
  private orderbook: Orderbook;

  constructor(orderbook: Orderbook) {
    this.orderbook = orderbook;
  }

  handle(command: CancelOrderCommand): Result<EngineTypes.ORDER_ID> {
    return this.orderbook.cancelOrder(command.orderId);
  }
}
