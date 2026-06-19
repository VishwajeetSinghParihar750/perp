import Account from "./account.js";
import Market from "./market.js";
import type { Order } from "./order.js";
import type { Position } from "./position.js";
import type { Result } from "./account.js";
import { EngineTypes } from "@repo/shared-types";

export default class RiskEngine {
  private account: Account;
  private market: Market;

  constructor(account: Account, market: Market) {
    this.account = account;
    this.market = market;
  }

  evaluateOrder(order: Order): Result<EngineTypes.PRICE> {
    return { success: true, value: 0 };
  }

  evaluateTrade(
    order1: Order,
    order2: Order,
  ): [EngineTypes.PRICE, EngineTypes.PRICE] {
    return [0, 0];
  }

  getLiquidationPrice(position: Position): EngineTypes.PRICE {
    return 0;
  }
}
