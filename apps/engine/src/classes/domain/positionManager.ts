import type { Position } from "./position.js";
import EventBus from "./eventBus.js";
import RiskEngine from "./riskEngine.js";
import type { Result } from "./account.js";
import type {
  EngineResponse,
  EngineTypes,
  EngineEventPayload,
} from "@repo/shared-types";
import assert from "node:assert";

export default class PositionManager {
  private positions: Map<
    EngineTypes.USER_ID,
    Map<EngineTypes.TRADABLE_SYMBOL, Position>
  > = new Map();
  private eventBus: EventBus;
  private riskEngine: RiskEngine;

  constructor(eventBus: EventBus, riskEngine: RiskEngine) {
    this.eventBus = eventBus;
    this.riskEngine = riskEngine;

    eventBus.on<"fills.created">(
      "fills.created",
      (event: EngineEventPayload.FILLS_CREATED_EVENT_PAYLOAD) => {
        for (const trade of event.data.fills) {
          this.applyTrade(trade, "BUY");
          this.applyTrade(trade, "SELL");
        }
      },
    );
  }

  private applyTrade(
    trade: EngineEventPayload.FILLS_CREATED_EVENT_PAYLOAD["data"]["fills"][number],
    side: EngineTypes.SIDE,
  ) {
    const price = trade.price;
    const qty = trade.qty;
    const curSideTrade =
      side === "BUY" ? trade.buyOrderInfo : trade.sellOrderInfo;
    const userId =
      side === "BUY"
        ? trade.buyOrderInfo.buyerId
        : trade.sellOrderInfo.sellerId;

    const marketSymbol = trade.marketSymbol;
    let userPositions = this.positions.get(userId);
    if (!userPositions) {
      userPositions = new Map();
      this.positions.set(userId, userPositions);
    }

    let position = userPositions.get(marketSymbol);

    if (!position) {
      position = {
        userId: userId,
        price: price,
        quantity: qty,
        type: side === "BUY" ? "LONG" : "SHORT",
        marketSymbol: trade.marketSymbol,
        margin: (curSideTrade as any).margin ?? 0,
        marginType: ((curSideTrade as any).marginType ?? "ISOLATED") as any,
        liquidationPrice: 0,
        createdAt: new Date().toISOString(),
      };
      userPositions.set(marketSymbol, position);
    } else {
      if (position.type === (side === "BUY" ? "LONG" : "SHORT")) {
        const priceQtyProductSum =
          position.price * position.quantity + price * qty;
        const weighedAvgPrice = priceQtyProductSum / (position.quantity + qty);

        position.price = weighedAvgPrice;
        position.quantity += qty;
        position.margin += (curSideTrade as any).margin ?? 0;
      } else {
        // do pnl
        const minQty = Math.min(position.quantity, qty);
        const ogAmountSpent = position.price * minQty;
        const gettingAmount = price * minQty;

        const pnl =
          (gettingAmount - ogAmountSpent) * (position.type === "LONG" ? 1 : -1);
        let releasedMargin = 0;

        position.margin += (curSideTrade as any).margin ?? 0;
        if (qty < position.quantity) {
          // price will stay same
          position.quantity -= qty;
        } else if (qty > position.quantity) {
          position.type = side === "BUY" ? "LONG" : "SHORT";
          position.price = price;
          position.quantity = qty - position.quantity;
        } else {
          // release all margin
          releasedMargin = position.margin;
          position.margin = 0;
          position.quantity = 0;
        }

        this.eventBus.emit<"userpnl.created">({
          type: "userpnl.created",
          data: {
            userId: position.userId,
            pnl,
            releasedMargin,
          },
        });
      }
    }

    // update liquidation price
    const userPositionsToUpdate = this.positions.get(userId);
    const positionToUpdate = userPositionsToUpdate?.get(marketSymbol);
    if (positionToUpdate && userPositionsToUpdate) {
      if (positionToUpdate.quantity === 0) {
        userPositionsToUpdate.delete(marketSymbol);
      } else {
        positionToUpdate.liquidationPrice =
          this.riskEngine.getLiquidationPrice(positionToUpdate);
      }
    }

    if (userPositionsToUpdate && userPositionsToUpdate.size === 0) {
      this.positions.delete(userId);
    }
  }

  getPosition(
    userId: EngineTypes.USER_ID,
  ): Result<Partial<Record<EngineTypes.TRADABLE_SYMBOL, Position>>> {
    const userPositions = this.positions.get(userId);
    if (!userPositions || userPositions.size === 0) {
      return { success: true, value: {} };
    }
    const result: Partial<Record<EngineTypes.TRADABLE_SYMBOL, Position>> = {};
    for (const [marketSymbol, pos] of userPositions) {
      result[marketSymbol] = pos;
    }
    return { success: true, value: result };
  }

  applyFunding(marketSymbol: EngineTypes.TRADABLE_SYMBOL) {}
}
