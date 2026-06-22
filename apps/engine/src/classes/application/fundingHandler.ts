import type { EngineTypes } from "@repo/shared-types";
import PositionManager from "../domain/positionManager.js";
import type { Position } from "../domain/position.js";
import Orderbook from "../domain/orderbook.js";
import type { Order, OrderFactory } from "../domain/order.js";
import RiskEngine from "../domain/riskEngine.js";

interface FundingCommand {
  marketSymbol: EngineTypes.TRADABLE_SYMBOL;
}

export default class FundingHandler {
  private positionManager: PositionManager;
  private orderbook: Orderbook;
  private orderFactory: OrderFactory;
  private riskEngine: RiskEngine;

  constructor(
    positionManager: PositionManager,
    orderbook: Orderbook,
    orderFactory: OrderFactory,
    riskEngine: RiskEngine,
  ) {
    this.positionManager = positionManager;
    this.orderbook = orderbook;
    this.orderFactory = orderFactory;
    this.riskEngine = riskEngine;
  }

  private createLiquidationOrder(position: Position): Order {
    return this.orderFactory.create(
      position.userId,
      this.riskEngine.getLiquidationOrderPrice(position),
      position.quantity,
      0,
      position.marketSymbol,
      position.type == "LONG" ? "SELL" : "BUY",
      "MARKET",
      "ISOLATED",
    );
  }

  handle(command: FundingCommand) {
    let toLiquidatePositions: Position[] = this.positionManager.applyFunding(
      command.marketSymbol,
    );

    toLiquidatePositions.forEach((position) => {
      let placedOrder = this.orderbook.placeOrder(
        this.createLiquidationOrder(position),
      );

      if (placedOrder.filledQuantity < placedOrder.quantity)
        this.positionManager.autoDeleverage(
          position.userId,
          position.marketSymbol,
        );
    });
  }
}
