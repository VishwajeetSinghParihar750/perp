import Account from "./account.js";
import Market from "./market.js";
import type { Order } from "./order.js";
import type { Position } from "./position.js";
import type { Result } from "./account.js";
import { EngineTypes } from "@repo/shared-types";
import PositionManager from "./positionManager.js";
import { assert } from "node:console";

export default class RiskEngine {
  private readonly maxLeverage = 100; // 1 percent of notional value
  private readonly liquidationMargin = 0.5; // .5 percent left

  private account: Account;
  private market: Market;

  constructor(account: Account, market: Market) {
    this.account = account;
    this.market = market;
  }
  private getAcceptablePriceDelta(
    quantity: EngineTypes.QUANTITY,
    margin: EngineTypes.PRICE,
  ) {
    const canTakeLoss = (margin * (100 - this.liquidationMargin)) / 100;
    return canTakeLoss / quantity;
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

    const acceptablePriceDelta = this.getAcceptablePriceDelta(
      order.quantity,
      order.margin,
    );

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

    if (newOrder.quantity === 0) {
      return { success: true, value: "" };
    }

    return this.evaluateOrderWithoutPosition(newOrder);
  }

  evaluateTrade(
    order1: Order,
    order2: Order,
  ): [EngineTypes.PRICE, EngineTypes.PRICE] {
    const tradePrice = Math.min(order1.price, order2.price);
    const tradeQuantity = Math.min(
      order1.quantity - order1.filledQuantity,
      order2.quantity - order2.filledQuantity,
    );

    if (tradeQuantity <= 0) {
      return [0, 0];
    }

    const remainingQty1 = order1.quantity - order1.filledQuantity;
    const margin1Required =
      remainingQty1 > 0 ? (order1.margin * tradeQuantity) / remainingQty1 : 0;

    const remainingQty2 = order2.quantity - order2.filledQuantity;
    const margin2Required =
      remainingQty2 > 0 ? (order2.margin * tradeQuantity) / remainingQty2 : 0;

    const indexPrice = this.market.getIndexPrice(order1.marketSymbol)!;

    assert(
      indexPrice != undefined,
      "trade should not have happened if indexprice is not definet yet",
    );
    // order1
    const acceptablePriceDelta1 = this.getAcceptablePriceDelta(
      tradeQuantity,
      margin1Required,
    );
    const liquidationPrice1 =
      order1.side === "BUY"
        ? tradePrice - acceptablePriceDelta1
        : tradePrice + acceptablePriceDelta1;

    const crossed1 =
      order1.side === "BUY"
        ? indexPrice <= liquidationPrice1
        : indexPrice >= liquidationPrice1;

    //  order2
    const acceptablePriceDelta2 = this.getAcceptablePriceDelta(
      tradeQuantity,
      margin2Required,
    );
    const liquidationPrice2 =
      order2.side === "BUY"
        ? tradePrice - acceptablePriceDelta2
        : tradePrice + acceptablePriceDelta2;

    const crossed2 =
      order2.side === "BUY"
        ? indexPrice <= liquidationPrice2
        : indexPrice >= liquidationPrice2;

    if (crossed1 || crossed2) {
      // reject
      return [order1.margin + 1, order2.margin + 1];
    }

    return [
      Math.min(order1.margin, margin1Required),
      Math.min(order2.margin, margin2Required),
    ];
  }

  getLiquidationPrice(position: Position): {
    liquidationPrice: EngineTypes.PRICE;
    shouldBeLiquidated: boolean;
  } {
    const acceptablePriceDelta = this.getAcceptablePriceDelta(
      position.quantity,
      position.margin,
    );

    const liquidationPrice =
      position.type === "LONG"
        ? Math.max(0, position.price - acceptablePriceDelta)
        : position.price + acceptablePriceDelta;

    const indexPrice = this.market.getIndexPrice(position.marketSymbol)!;

    assert(
      indexPrice !== undefined,
      "you should not have accepted orders until index price was defined ",
    );

    let shouldBeLiquidated =
      position.type === "LONG"
        ? indexPrice <= liquidationPrice
        : indexPrice >= liquidationPrice;

    return { liquidationPrice, shouldBeLiquidated };
  }
  getLiquidationOrderPrice(position: Position): EngineTypes.PRICE {
    const totalMarginLossDelta = position.margin / position.quantity;
    const bankruptcyPrice =
      position.type === "LONG"
        ? Math.max(0, position.price - totalMarginLossDelta)
        : position.price + totalMarginLossDelta;
    return bankruptcyPrice;
  }
}
