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
      this.markPrices.set(fill.marketSymbol, fill.price);
    }
  }

  getIndexPrice(marketSymbol: string): number {
    return this.indexPrices.get(marketSymbol) ?? 0;
  }

  getMarkPrice(marketSymbol: string): number {
    return this.markPrices.get(marketSymbol) ?? 0;
  }

  setIndexPrice(marketSymbol: string, indexPrice: number) {
    this.indexPrices.set(marketSymbol, indexPrice);
  }
}
