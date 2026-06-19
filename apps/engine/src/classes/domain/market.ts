import type { EngineEventPayload } from "@repo/shared-types";
import EventBus from "./eventBus.js";

export default class Market {
  private indexPrices: Map<string, number> = new Map();
  private markPrices: Map<string, number> = new Map();

  constructor(eventBus: EventBus) {
    eventBus.on<"fills.created">(
      "fills.created",
      (fills: EngineEventPayload.FILLS_CREATED_EVENT_PAYLOAD) => {
        this.handleFills(fills);
      },
    );
  }

  private handleFills(fills: EngineEventPayload.FILLS_CREATED_EVENT_PAYLOAD) {
    for (const fill of fills.data.fills) {
      this.markPrices.set(fill.symbol, fill.price);
    }
  }

  getIndexPrice(marketId: string): number {
    return this.indexPrices.get(marketId) ?? 0;
  }

  getMarkPrice(marketId: string): number {
    return this.markPrices.get(marketId) ?? 0;
  }

  setIndexPrice(marketId: string, indexPrice: number) {
    this.indexPrices.set(marketId, indexPrice);
  }
}
