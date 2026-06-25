import type { EngineTypes } from "@repo/shared-types";
import Market from "../domain/market.js";
import PositionManager from "../domain/positionManager.js";
import type { Result } from "../types.js";

export interface indexPriceUpdateCommand {
  marketSymbol: EngineTypes.TRADABLE_SYMBOL;
  price: EngineTypes.PRICE;
}

export default class IndexPriceUpdateHandler {
  private market: Market;
  private positionManager: PositionManager;

  constructor(market: Market, positionManager: PositionManager) {
    this.market = market;
    this.positionManager = positionManager;
  }

  handle(command: indexPriceUpdateCommand) {
    const prevIndexPrice = this.market.getIndexPrice(command.marketSymbol);
    this.market.setIndexPrice(command.marketSymbol, command.price);
    this.positionManager.handleIndexPriceUpdate(
      command.marketSymbol,
      command.price,
      prevIndexPrice,
    );
  }
}
