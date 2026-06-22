import type { EngineEventPayload, EngineTypes } from "@repo/shared-types";
import EventBus from "./eventBus.js";

export default class Market {
  private indexPrices: Map<EngineTypes.TRADABLE_SYMBOL, number> = new Map();
  private markPrices: Map<EngineTypes.TRADABLE_SYMBOL, number> = new Map();

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

  getIndexPrice(
    marketSymbol: EngineTypes.TRADABLE_SYMBOL,
  ): EngineTypes.PRICE | undefined {
    return this.indexPrices.get(marketSymbol);
  }

  getMarkPrice(marketSymbol: EngineTypes.TRADABLE_SYMBOL): number | undefined {
    return this.markPrices.get(marketSymbol);
  }

  setIndexPrice(
    marketSymbol: EngineTypes.TRADABLE_SYMBOL,
    indexPrice: EngineTypes.PRICE,
  ) {
    this.indexPrices.set(marketSymbol, indexPrice);
    return indexPrice;
  }
}
