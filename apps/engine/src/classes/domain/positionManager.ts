import type { Position } from "./position.js";
import EventBus from "./eventBus.js";
import RiskEngine from "./riskEngine.js";
import { type Result } from "../types.js";

import {
  type EngineResponse,
  EngineTypes,
  type EngineEventPayload,
} from "@repo/shared-types";
import assert from "node:assert";
import { OrderedMap } from "js-sdsl";
import type Market from "./market.js";
import type { Snapshotable } from "../infrastructure/snapshotManager.js";

export type POSITION_MANAGER_SNAPSHOT = {
  positions: [EngineTypes.TRADABLE_SYMBOL, [EngineTypes.USER_ID, Position][]][];
};

export default class PositionManager implements Snapshotable<POSITION_MANAGER_SNAPSHOT> {
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
  private market: Market;

  getSnapshot(): POSITION_MANAGER_SNAPSHOT {
    const serializedPositions: [
      EngineTypes.TRADABLE_SYMBOL,
      [EngineTypes.USER_ID, Position][],
    ][] = [];
    for (const [symbol, userMap] of this.positions.entries()) {
      serializedPositions.push([symbol, Array.from(userMap.entries())]);
    }
    return {
      positions: serializedPositions,
    };
  }

  loadSnapshot(snapshot: POSITION_MANAGER_SNAPSHOT) {
    this.positions = new Map();
    this.liquidationPrice = {
      LONG: new Map(),
      SHORT: new Map(),
    };
    EngineTypes.TRADABLE_SYMBOL_ARRAY.forEach((symbol) => {
      const sym = symbol as EngineTypes.TRADABLE_SYMBOL;
      this.liquidationPrice.LONG.set(sym, new OrderedMap());
      this.liquidationPrice.SHORT.set(sym, new OrderedMap());
    });

    snapshot.positions.forEach(([symbol, userPositions]) => {
      const userMap = new Map<EngineTypes.USER_ID, Position>();
      this.positions.set(symbol, userMap);

      userPositions.forEach(([userId, pos]) => {
        userMap.set(userId, pos);

        let priceMap = this.liquidationPrice[pos.type].get(symbol);
        if (!priceMap) {
          priceMap = new OrderedMap();
          this.liquidationPrice[pos.type].set(symbol, priceMap);
        }
        let userSet = priceMap.getElementByKey(pos.liquidationPrice);
        if (!userSet) {
          userSet = new Set();
          priceMap.setElement(pos.liquidationPrice, userSet);
        }
        userSet.add(userId);
      });
    });
  }

  constructor(eventBus: EventBus, riskEngine: RiskEngine, market: Market) {
    this.eventBus = eventBus;
    this.riskEngine = riskEngine;
    this.market = market;

    // Initialize liquidationPrice maps for all tradable symbols
    EngineTypes.TRADABLE_SYMBOL_ARRAY.forEach((symbol) => {
      const sym = symbol as EngineTypes.TRADABLE_SYMBOL;
      this.liquidationPrice.LONG.set(sym, new OrderedMap());
      this.liquidationPrice.SHORT.set(sym, new OrderedMap());
    });

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

  private deletePosition(position: Position) {
    this.positions.get(position.marketSymbol)?.delete(position.userId);

    this.liquidationPrice[position.type]
      ?.get(position.marketSymbol)
      ?.getElementByKey(position.liquidationPrice)
      ?.delete(position.userId);

    if (
      this.liquidationPrice[position.type]
        .get(position.marketSymbol)
        ?.getElementByKey(position.liquidationPrice)?.size == 0
    )
      this.liquidationPrice[position.type]
        ?.get(position.marketSymbol)
        ?.eraseElementByKey(position.liquidationPrice);
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
    marketSymbol?: EngineTypes.TRADABLE_SYMBOL,
  ): Result<Partial<Record<EngineTypes.TRADABLE_SYMBOL, Position>>> {
    const result: Partial<Record<EngineTypes.TRADABLE_SYMBOL, Position>> = {};

    if (marketSymbol) {
      let res = this.positions.get(marketSymbol)?.get(userId);
      if (res) result[marketSymbol] = res;
      return { success: true, value: result };
    }

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
    indexPrice: EngineTypes.PRICE,
  ) {
    //
    let userPosition = this.positions.get(marketSymbol)?.get(userId);
    assert(
      userPosition,
      "called autoDeleverage for positoin that does not exist ",
    );

    let positions = this.positions.get(marketSymbol);

    assert(positions, "positions must exist ");

    let positionsToDelete: Position[] = [];
    for (let [_, position] of positions) {
      if (position.type != userPosition.type) {
        //  is opposite

        let pnlFactor =
          (indexPrice - position.price) * (position.type == "LONG" ? 1 : -1);

        if (pnlFactor > 0) {
          // adl this guy

          let qtyToAdl = Math.min(position.quantity, userPosition.quantity);

          this.eventBus.emit<"userpnl.created">({
            type: "userpnl.created",
            data: {
              pnl: pnlFactor * qtyToAdl,
              releasedMargin: 0,
              userId: position.userId,
            },
          });

          let userPnlFactor =
            (indexPrice - userPosition.price) *
            (position.type == "LONG" ? 1 : -1);
          this.eventBus.emit<"userpnl.created">({
            type: "userpnl.created",
            data: {
              pnl: userPnlFactor * qtyToAdl,
              releasedMargin: 0,
              userId,
            },
          });

          if (qtyToAdl == position.quantity) {
            positionsToDelete.push(position);
          }
        }
      }

      if (userPosition.quantity == 0) {
        break;
      }
    }
    //
    positionsToDelete.forEach((position) => {
      this.deletePosition(position);
    });

    this.deletePosition(userPosition);
  }

  applyFunding(marketSymbol: EngineTypes.TRADABLE_SYMBOL): Position[] {
    const symbolPositions = this.positions.get(marketSymbol);

    if (!symbolPositions) return [];

    const fundingRate = this.market.getFundingRate(marketSymbol);

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
