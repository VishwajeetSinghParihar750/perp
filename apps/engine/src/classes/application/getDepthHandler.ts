import type { EngineTypes } from "@repo/shared-types";
import type Orderbook from "../domain/orderbook.js";
import type { Result } from "../types.js";

export interface GetDepthCommand {
  marketSymbol: EngineTypes.TRADABLE_SYMBOL;
}

type DepthResponse = {
  asks: { price: number; quantity: number }[];
  bids: { price: number; quantity: number }[];
};

export default class GetDepthHandler {
  private orderbook: Orderbook;

  constructor(orderbook: Orderbook) {
    this.orderbook = orderbook;
  }

  handle(command: GetDepthCommand): Result<DepthResponse> {
    let symOrderbook = this.orderbook.getOrderbook(command.marketSymbol);

    let value: DepthResponse = { asks: [], bids: [] };
    symOrderbook.asks.forEach((askLevel) => {
      value.asks.push({ price: askLevel[0], quantity: askLevel[1].totalQty });
    });
    symOrderbook.bids.forEach((bidLevel) => {
      value.asks.push({ price: bidLevel[0], quantity: bidLevel[1].totalQty });
    });

    return {
      success: true,
      value,
    };
  }
}
