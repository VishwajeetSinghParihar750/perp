import { EngineTypes, type EngineEventPayload } from "@repo/shared-types";
import EventBus from "./eventBus.js";
import type { ReplyAddress } from "../infrastructure/types.js";
import type Communicator from "../infrastructure/communicator.js";

export default class Market {
  private indexPrices: Map<EngineTypes.TRADABLE_SYMBOL, number> = new Map();
  private markPrices: Map<EngineTypes.TRADABLE_SYMBOL, number> = new Map();

  private communicator: Communicator;
  private sendFundingTo: ReplyAddress;

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
    setInterval(this.sendFunding.bind(this), this.fundingInterval);
  }

  private handleFills(fills: EngineEventPayload.FILLS_CREATED_EVENT_PAYLOAD) {
    for (const fill of fills.data.fills) {
      this.markPrices.set(fill.marketSymbol, fill.price);
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
