import type { Position } from "./position.js";
import EventBus from "./eventBus.js";
import RiskEngine from "./riskEngine.js";
import type { Result } from "./account.js";
import type {
  EngineResponse,
  EngineTypes,
  EngineEventPayload,
} from "@repo/shared-types";

export default class PositionManager {
  private positions: Map<EngineTypes.USER_ID, Position> = new Map();
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

    let position = this.positions.get(userId);

    if (!position) {
      position = {
        userId: userId,
        price: price,
        quantity: qty,
        side: "BUY",
        marketId: trade.symbol,
        margin: (curSideTrade as any).margin ?? 0,
        marginType: ((curSideTrade as any).marginType ?? "ISOLATED") as any,
        liquidationPrice: 0,
      };
      this.positions.set(userId, position);
    } else {
      if (position.side === "BUY") {
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

        const pnl = (gettingAmount - ogAmountSpent) * (side === "BUY" ? 1 : -1);
        let releasedMargin = 0;

        position.margin += (curSideTrade as any).margin ?? 0;
        if (qty < position.quantity) {
          // price will stay same
          position.quantity -= qty;
        } else if (qty > position.quantity) {
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
    const userIdToUpdate =
      side === "BUY"
        ? trade.buyOrderInfo.buyerId
        : trade.sellOrderInfo.sellerId;
    const positionToUpdate = this.positions.get(userIdToUpdate)!;
    positionToUpdate.liquidationPrice =
      this.riskEngine.getLiquidationPrice(positionToUpdate);
  }

  getPosition(userId: EngineTypes.USER_ID): Result<Position> {
    const pos = this.positions.get(userId);
    if (!pos) {
      return { success: false, error: new Error("NOT_FOUND") };
    }
    return { success: true, value: pos };
  }

  applyFunding() {}
}
