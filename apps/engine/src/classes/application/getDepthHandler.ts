import type { EngineTypes } from "@repo/shared-types";
import type Orderbook from "../domain/orderbook.js";
import type { Result } from "../types.js";

export interface GetDepthCommand {
  marketSymbol: EngineTypes.TRADABLE_SYMBOL;
  lastUpdatedDepthId?: number;
}

type DepthResponse = {
  asks: { price: number; quantity: number }[];
  bids: { price: number; quantity: number }[];
  lastUpdatedDepthId: number;
};

export default class GetDepthHandler {
  private orderbook: Orderbook;

  constructor(orderbook: Orderbook) {
    this.orderbook = orderbook;
  }

  handle(command: GetDepthCommand): Result<DepthResponse> {
    const [asksDepth, bidsDepth] = this.orderbook.getDepth(command.marketSymbol);
    const lastUpdatedDepthId = this.orderbook.getLastUpdatedDepthId(
      command.marketSymbol,
    );

    return {
      success: true,
      value: {
        asks: asksDepth.map(([price, quantity]) => ({ price, quantity })),
        bids: bidsDepth.map(([price, quantity]) => ({ price, quantity })),
        lastUpdatedDepthId,
      },
    };
  }
}
