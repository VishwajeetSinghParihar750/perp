import type { EngineTypes, EngineEventPayload } from "@repo/shared-types";
import EventBus from "./eventBus.js";

type MARKET_ID = string;
type PRICE = EngineTypes.PRICE;

export default class Market {
  private marketId: MARKET_ID;
  private indexPrice: PRICE;
  private markPrice: PRICE;

  constructor(marketId: MARKET_ID, indexPrice: PRICE, eventBus: EventBus) {
    this.marketId = marketId;
    this.indexPrice = indexPrice;
    this.markPrice = 0;

    eventBus.on<"fills.created">(
      "fills.created",
      (fills: EngineEventPayload.FILLS_CREATED_EVENT_PAYLOAD) => {
        this.handleFills(fills);
      },
    );
  }

  private handleFills(fills: EngineEventPayload.FILLS_CREATED_EVENT_PAYLOAD) {
    for (let fill of fills.data.fills) {
      if (fill.symbol == this.marketId) {
        this.markPrice = fill.price;
      }
    }
  }

  getIndexPrice(): PRICE {
    return this.indexPrice;
  }

  getMarkPrice(): PRICE {
    return this.markPrice;
  }

  setIndexPrice(indexPrice: PRICE) {
    this.indexPrice = indexPrice;
  }
}
