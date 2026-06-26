import { EngineTypes, type EngineEventPayload } from "@repo/shared-types";
import EventBus from "./eventBus.js";
import type { ReplyAddress } from "../infrastructure/types.js";
import type Communicator from "../infrastructure/communicator.js";
import type { Snapshotable } from "../infrastructure/snapshotManager.js";

export type MARKET_SNAPSHOT = {
  indexPrices: [EngineTypes.TRADABLE_SYMBOL, number][];
  markPrices: [EngineTypes.TRADABLE_SYMBOL, number][];
};

export default class Market implements Snapshotable<MARKET_SNAPSHOT> {
  private indexPrices: Map<EngineTypes.TRADABLE_SYMBOL, number> = new Map();
  private markPrices: Map<EngineTypes.TRADABLE_SYMBOL, number> = new Map();

  getSnapshot(): MARKET_SNAPSHOT {
    return {
      indexPrices: Array.from(this.indexPrices.entries()),
      markPrices: Array.from(this.markPrices.entries()),
    };
  }

  loadSnapshot(snapshot: MARKET_SNAPSHOT) {
    this.indexPrices = new Map(snapshot.indexPrices);
    this.markPrices = new Map(snapshot.markPrices);
  }

  private communicator: Communicator;
  private sendFundingTo: ReplyAddress;
  private eventBus: EventBus;

  private readonly fundingInterval = 8 * 60 * 1000 * 1000;
  private readonly fundingRate = 0.02; // would get about 20% return per year

  private async sendFunding() {
    for (const marketSymbol in EngineTypes.TRADABLE_SYMBOL_ARRAY)
      await this.communicator.send(this.sendFundingTo, {
        type: "funding.created",
        payload: {
          marketSymbol,
        },
      });
  }

  constructor(
    eventBus: EventBus,
    sendFundingTo: ReplyAddress,
    communicator: Communicator,
  ) {
    eventBus.on<"fills.created">(
      "fills.created",
      (fills: EngineEventPayload.FILLS_CREATED_EVENT_PAYLOAD) => {
        this.handleFills(fills);
      },
    );

    this.communicator = communicator;
    this.sendFundingTo = sendFundingTo;
    this.eventBus = eventBus;
    setInterval(this.sendFunding.bind(this), this.fundingInterval);
  }

  private handleFills(fills: EngineEventPayload.FILLS_CREATED_EVENT_PAYLOAD) {
    for (const fill of fills.data.fills) {
      const prevMarkPrice = this.markPrices.get(fill.marketSymbol);
      this.markPrices.set(fill.marketSymbol, fill.price);

      if (prevMarkPrice !== fill.price) {
        this.eventBus.emit({
          type: "markprice.updated",
          data: { marketSymbol: fill.marketSymbol, price: fill.price },
        });
      }
    }
  }

  getFundingRate(marketSymbol: EngineTypes.TRADABLE_SYMBOL) {
    return this.fundingRate;
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
