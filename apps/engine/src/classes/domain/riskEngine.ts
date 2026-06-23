import Account from "./account.js";
import Market from "./market.js";
import type { Order } from "./order.js";
import type { Position } from "./position.js";
import type { Result } from "./account.js";
import { EngineTypes } from "@repo/shared-types";
import PositionManager from "./positionManager.js";

export default class RiskEngine {
  private readonly maxLeverage = 100; // 1 percent of notional value
  private readonly liquidationMargin = 0.5; // .5 percent left

  private account: Account;
  private market: Market;

  constructor(account: Account, market: Market) {
    this.account = account;
    this.market = market;
  }
  private getGenericLiquidationPrice(
    price: EngineTypes.PRICE,
    quantity: EngineTypes.QUANTITY,
    margin: EngineTypes.PRICE,
  ) {
    //
  }

  private evaluateOrderWithoutPosition(order: Order): Result<any> {
    const notional = order.price * order.quantity;

    if (notional > order.margin * this.maxLeverage) {
      return { success: false, error: new Error("NOT_ENOUGH_MARGIN") };
    }

    const indexPrice = this.market.getIndexPrice(order.marketSymbol);

    if (!indexPrice) {
      return {
        success: false,
        error: new Error("MARKET_DOES_NOT_HAVE_INDEX_PRICE_YET"),
      };
    }

    const canTakeLoss = (order.margin * (100 - this.liquidationMargin)) / 100;
    const acceptablePriceDelta = canTakeLoss / order.quantity;

    const liquidationPrice =
      order.side == "BUY"
        ? indexPrice - acceptablePriceDelta
        : indexPrice + acceptablePriceDelta;

    if (
      (order.side == "BUY" && order.price < liquidationPrice) ||
      (order.side == "SELL" && order.price > liquidationPrice)
    ) {
      return {
        success: false,
        error: new Error("ORDER_PRICE_ALREADY_CROSSING_LIQUDATION_PRICE"),
      };
    }

    return { success: true, value: "" };
  }

  evaluateOrder(order: Order, position: Position | undefined): Result<any> {
    // find the new position if this is exchanged
    // and evaluate order based on that
    let newOrder = { ...order };
    if (position) {
      newOrder.margin += position.margin;

      if (
        position.type == "LONG" ? order.side == "BUY" : order.side == "SELL"
      ) {
        newOrder.quantity += position.quantity;

        newOrder.price =
          (order.price * order.quantity + position.price * position.quantity) /
          (order.quantity + position.quantity);
      } else {
        let willExchange = Math.min(position.quantity, order.quantity);

        let pnl =
          (order.price - position.price) *
          willExchange *
          (order.side == "SELL" ? 1 : -1);

        newOrder.margin += pnl;

        if (newOrder.quantity >= position.quantity) {
          newOrder.quantity -= position.quantity;

          // price stays as order price
        } else {
          newOrder.price = position.price;
          newOrder.side = newOrder.side == "BUY" ? "SELL" : "BUY";
          newOrder.quantity = position.quantity - newOrder.quantity;
        }
      }
    }

    return this.evaluateOrderWithoutPosition(newOrder);
  }

  evaluateTrade(
    order1: Order,
    order2: Order,
  ): [EngineTypes.PRICE, EngineTypes.PRICE] {
    return [0, 0];
  }

  getLiquidationPrice(position: Position): {
    liquidationPrice: EngineTypes.PRICE;
    shouldBeLiquidated: boolean;
  } {
    return { liquidationPrice: 100, shouldBeLiquidated: false };
  }
  getLiquidationOrderPrice(position: Position): EngineTypes.PRICE {
    return 0;
  }
}
