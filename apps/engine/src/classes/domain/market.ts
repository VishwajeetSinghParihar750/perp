import type { EngineEventPayload, EngineTypes } from "@repo/shared-types";
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
      this.markPrices.set(fill.marketSymbol, fill.price);
    }
  }

  getIndexPrice(marketSymbol: EngineTypes.TRADABLE_SYMBOL): EngineTypes.PRICE {
    return this.indexPrices.get(marketSymbol) ?? 0;
  }

  getMarkPrice(marketSymbol: EngineTypes.TRADABLE_SYMBOL): number {
    return this.markPrices.get(marketSymbol) ?? 0;
  }

  setIndexPrice(
    marketSymbol: EngineTypes.TRADABLE_SYMBOL,
    indexPrice: EngineTypes.PRICE,
  ) {
    this.indexPrices.set(marketSymbol, indexPrice);
    return indexPrice;
  }
}
