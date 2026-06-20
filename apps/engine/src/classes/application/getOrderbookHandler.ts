import type { EngineTypes } from "@repo/shared-types";
import type { Result } from "../domain/account.js";
import type Orderbook from "../domain/orderbook.js";
import type { SingleMarketOrderbook } from "../domain/orderbook.js";

export interface GetOrderbookCommand {
  marketId: EngineTypes.TRADABLE_SYMBOL;
}

export default class GetOrderbookHandler {
  private orderbook: Orderbook;

  constructor(orderbook: Orderbook) {
    this.orderbook = orderbook;
  }

  handle(command: GetOrderbookCommand): Result<SingleMarketOrderbook> {
    return {
      success: true,
      value: this.orderbook.getOrderbook(command.marketId),
    };
  }
}
