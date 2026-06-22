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
import type { OrderedMap } from "js-sdsl";

export default class PositionManager {
  private positions: Map<
    EngineTypes.TRADABLE_SYMBOL,
    Map<EngineTypes.USER_ID, Position>
  > = new Map();

  private liquidationPrice: {
    LONG: Map<
      EngineTypes.TRADABLE_SYMBOL,
      OrderedMap<EngineTypes.PRICE, Set<EngineTypes.USER_ID>>
    >;
    SHORT: Map<
      EngineTypes.TRADABLE_SYMBOL,
      OrderedMap<EngineTypes.PRICE, Set<EngineTypes.USER_ID>>
    >;
  } = {
    LONG: new Map(),
    SHORT: new Map(),
  };

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
    let symbolPositions = this.positions.get(marketSymbol);
    if (!symbolPositions) {
      symbolPositions = new Map();
      this.positions.set(marketSymbol, symbolPositions);
    }

    let position = symbolPositions.get(userId);

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
      symbolPositions.set(userId, position);
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

    // remove from prev liquidation price
    this.liquidationPrice[position.type]
      .get(position.marketSymbol)
      ?.getElementByKey(position.liquidationPrice)
      ?.delete(position.userId);

    // update liquidation price
    const symbolPositionsToUpdate = this.positions.get(marketSymbol);
    const positionToUpdate = symbolPositionsToUpdate?.get(userId);
    if (positionToUpdate && symbolPositionsToUpdate) {
      if (positionToUpdate.quantity === 0) {
        symbolPositionsToUpdate.delete(userId);
      } else {
        let { liquidationPrice } =
          this.riskEngine.getLiquidationPrice(positionToUpdate);
        positionToUpdate.liquidationPrice = liquidationPrice;

        // add in new liquidaiton prive lvl
        this.liquidationPrice[position.type]
          .get(position.marketSymbol)
          ?.getElementByKey(liquidationPrice)
          ?.add(position.userId);
      }
    }

    if (symbolPositionsToUpdate && symbolPositionsToUpdate.size === 0) {
      this.positions.delete(marketSymbol);
    }
  }

  getPosition(
    userId: EngineTypes.USER_ID,
  ): Result<Partial<Record<EngineTypes.TRADABLE_SYMBOL, Position>>> {
    const result: Partial<Record<EngineTypes.TRADABLE_SYMBOL, Position>> = {};
    for (const [marketSymbol, symbolPositions] of this.positions) {
      const pos = symbolPositions.get(userId);
      if (pos) {
        result[marketSymbol] = pos;
      }
    }
    return { success: true, value: result };
  }

  handleIndexPriceUpdate(
    marketSymbol: EngineTypes.TRADABLE_SYMBOL,
    newPrice: EngineTypes.PRICE,
    prevPrice: EngineTypes.PRICE | undefined,
  ) {
    let toLiquidatePositions: Position[] = [];

    if (prevPrice) {
      // handle liquidation based on chagne

      if (prevPrice != newPrice) {
        let sideToLiquidate: "SHORT" | "LONG" =
          prevPrice < newPrice ? "SHORT" : "LONG";

        let positionsMap =
          this.liquidationPrice[sideToLiquidate].get(marketSymbol);

        while (positionsMap && !positionsMap.empty()) {
          let [price, userIds] = positionsMap.front()!;
          if (sideToLiquidate == "LONG" ? price < newPrice : price > newPrice)
            break;

          // liquidate all positions at this price
          userIds.forEach((userId) => {
            let userPosition = this.positions.get(marketSymbol)?.get(userId);
            assert(userPosition, "user position must have existed ");
            toLiquidatePositions.push(userPosition);
          });
        }
      }
    }

    // emit event
    this.eventBus.emit({
      type: "indexprice.updated",
      data: {
        price: newPrice,
        marketSymbol,
      },
    });

    return toLiquidatePositions;
  }

  autoDeleverage(
    userId: EngineTypes.USER_ID,
    marketSymbol: EngineTypes.TRADABLE_SYMBOL,
  ) {}

  applyFunding(marketSymbol: EngineTypes.TRADABLE_SYMBOL): Position[] {
    const symbolPositions = this.positions.get(marketSymbol);

    if (!symbolPositions) return [];

    const fundingRate = this.riskEngine.getFundingRate(marketSymbol);

    let toLiquidatePositions: Position[] = [];

    if (fundingRate != 0)
      symbolPositions.forEach((position, userId) => {
        let toUpdateMargin = Math.abs(
          position.price * position.quantity * fundingRate,
        );

        if (fundingRate > 0 == (position.type == "LONG")) {
          // you pay
          position.margin -= toUpdateMargin;

          this.eventBus.emit<"userpnl.created">({
            type: "userpnl.created",
            data: {
              userId,
              pnl: 0,
              releasedMargin: toUpdateMargin * -1,
            },
          });

          this.liquidationPrice[position.type]
            .get(position.marketSymbol)
            ?.getElementByKey(position.liquidationPrice)
            ?.delete(position.userId);

          let { liquidationPrice, shouldBeLiquidated } =
            this.riskEngine.getLiquidationPrice(position);
          position.liquidationPrice = liquidationPrice;

          if (shouldBeLiquidated) toLiquidatePositions.push(position);
          else {
            this.liquidationPrice[position.type]
              .get(position.marketSymbol)
              ?.getElementByKey(position.liquidationPrice)
              ?.add(position.userId);
          }
        } else {
          // you get

          this.eventBus.emit<"userpnl.created">({
            type: "userpnl.created",
            data: { userId, pnl: toUpdateMargin, releasedMargin: 0 },
          });
        }
      });

    return toLiquidatePositions;
  }
}
