import type { EngineTypes } from "@repo/shared-types";
import type { Result } from "../domain/account.js";
import type Orderbook from "../domain/orderbook.js";

export interface GetDepthCommand {
  marketId: EngineTypes.TRADABLE_SYMBOL;
}

type DepthResponse = {
  asks: [number, number][];
  bids: [number, number][];
};

export default class GetDepthHandler {
  private orderbook: Orderbook;

  constructor(orderbook: Orderbook) {
    this.orderbook = orderbook;
  }

  handle(command: GetDepthCommand): Result<DepthResponse> {
    let symOrderbook = this.orderbook.getOrderbook(command.marketId);

    let value: DepthResponse = { asks: [], bids: [] };
    symOrderbook.asks.forEach((askLevel) => {
      value.asks.push([askLevel[0], askLevel[1].totalQty]);
    });
    symOrderbook.bids.forEach((bidLevel) => {
      value.asks.push([bidLevel[0], bidLevel[1].totalQty]);
    });

    return {
      success: true,
      value,
    };
  }
}
