import type { EngineTypes } from "@repo/shared-types";
import type { Result } from "../domain/account.js";
import Market from "../domain/market.js";

export interface indexPriceUpdateCommand {
  marketSymbol: EngineTypes.TRADABLE_SYMBOL;
  price: EngineTypes.PRICE;
}

export default class IndexPriceUpdateHandler {
  private market: Market;

  constructor(market: Market) {
    this.market = market;
  }

  handle(command: indexPriceUpdateCommand) {
    this.market.setIndexPrice(command.marketSymbol, command.price);
  }
}
