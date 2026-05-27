import { OrderedMap } from "js-sdsl";
import type {
  MARGIN_TYPE,
  SIDE as ORDER_SIDE,
  TYPE as ORDER_TYPE,
  SIDE,
  TRADABLE_CURRENCY_SYMBOL,
  TYPE,
} from "../types/order.js";
import type { POSITION } from "../types/positions.js";
import { type CURRENCY_SYMBOL } from "../types/order.js";
import { type POSITION_TYPE } from "../types/positions.js";
import type { POSITION_UPDATES } from "../types/positions.js";
import EventBus from "./EventBus.js";
import { assert } from "node:console";
import type { Snapshotable } from "./SnapshotManger.js";

type LIQUIDATION_SNAPSHOT = {
  indexPrices: Partial<Record<CURRENCY_SYMBOL, number>>;
  positions: Record<string, POSITION>;
  liquidationPrice: Record<string, number>;
};

type LiquidationOrderInfo = {
  type: TYPE;
  side: SIDE;
  symbol: CURRENCY_SYMBOL;
  qty: number;
  userId: string;
};
class LiquidationEngine implements Snapshotable<LIQUIDATION_SNAPSHOT> {
  private readonly LIQUIDATION_LEVEL = 0.95; // at 5% margin left , liquidate

  private liquidPositions: Partial<
    Record<
      CURRENCY_SYMBOL,
      Record<POSITION_TYPE, OrderedMap<number, Set<string>>>
    >
  > = {}; // this is per symbol per liquidation_price positions
  private eventBus: EventBus;

  private _indexPrices: Partial<Record<CURRENCY_SYMBOL, number>> = {};

  private positions: Record<string, POSITION> = {}; // positions in positions being liqudated are ref of this
  private liquidationPrice: Record<string, number> = {}; // position id mapped to price

  private initializeLiquidPosition(symbol: CURRENCY_SYMBOL) {
    this.liquidPositions[symbol] = {
      LONG: new OrderedMap([], (x, y) => y - x),
      SHORT: new OrderedMap(),
    };
  }

  getSnapshot(): LIQUIDATION_SNAPSHOT {
    return {
      indexPrices: this._indexPrices,
      liquidationPrice: this.liquidationPrice,
      positions: this.positions,
    };
  }
  loadSnapshot(data: LIQUIDATION_SNAPSHOT) {
    this._indexPrices = data.indexPrices;
    this.liquidationPrice = data.liquidationPrice;
    this.positions = this.positions;

    Object.values(this.positions).forEach((position) => {
      // add to liquis positons
      if (!this.liquidPositions[position.symbol]) {
        this.initializeLiquidPosition(position.symbol);
      }
      let curVal =
        this.liquidPositions[position.symbol]![position.type].getElementByKey(
          this.liquidationPrice[position.positionId]!,
        ) || new Set<string>();

      curVal.add(position.positionId);

      this.liquidPositions[position.symbol]![position.type].setElement(
        this.liquidationPrice[position.positionId]!,
        curVal,
      );
    });
  }

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  private getLiquidationForPosition(positon: POSITION): number {
    let canTakeLoss = positon.margin * this.LIQUIDATION_LEVEL;

    // pnl = (newprice - price) * qty
    // newprice = canTakeLoss  / qty + price

    let newPrice =
      positon.price +
      (canTakeLoss / positon.qty) * (positon.type == "LONG" ? 1 : -1);

    return newPrice;
  }

  handleIndexPriceUpdate({
    symbol,
    newPrice,
  }: {
    symbol: TRADABLE_CURRENCY_SYMBOL;
    newPrice: number;
  }): { toLiquidatePositions: POSITION[] } {
    // maybe TODO :  get initial prices first through http, then update prices with ws later,  wait for getting requests until your prices are  set up
    // E is time thing, price is in string
    // maybe let the server run for 2 mins, get mark price updates, then only start serving requests

    // update index price
    this.indexPrices[symbol] = newPrice;

    // emit event
    this.eventBus.emit({
      type: "indexprice.updated",
      data: {
        price: newPrice,
        symbol,
      },
    });

    let toReturn: { toLiquidatePositions: POSITION[] } = {
      toLiquidatePositions: [],
    };

    // console.log(symbol, newPrice, this.indexPrices[symbol]);
    if (!this.indexPrices[symbol]) this.indexPrices[symbol] = newPrice;
    else {
      this.indexPrices[symbol] = newPrice;

      // handle liquidation based on chagne
      let prevPrice = this.indexPrices[symbol]!;

      if (prevPrice != newPrice) {
        let sideToLiquidate: POSITION_TYPE =
          prevPrice < newPrice ? "SHORT" : "LONG";
        let positionsMap = this.liquidPositions[symbol]?.[sideToLiquidate];

        while (positionsMap && !positionsMap.empty()) {
          let [price, positions] = positionsMap.front()!;
          if (sideToLiquidate == "LONG" ? price < newPrice : price > newPrice)
            break;

          // liquidate all positions at this price
          positions.forEach((positionId) => {
            toReturn.toLiquidatePositions.push(this.positions[positionId]!);
          });
        }
      }
    }

    return toReturn;
  }

  getMarginRequired(order: {
    symbol: CURRENCY_SYMBOL;
    qty: number;
    type: ORDER_TYPE;
    side: ORDER_SIDE;
    price: number | undefined;
  }): number {
    if (order.price) return (order.price * order.qty) / 10;

    // TODO : makr sure you have index prices before you start taking orders
    return (this.indexPrices[order.symbol]! * order.qty) / 10;
  }

  //  remove all data strcures and clear empty ds, and similarly in normal position udpats
  private handlePositonUpdateLiquidation(position: POSITION) {
    if (position.qty == 0) {
      // remmove from all data strctures

      // remove from liqudi positiosn
      let set = this.liquidPositions[position.symbol]![
        position.type
      ].getElementByKey(position.price)!;
      set.delete(position.positionId);

      if (set.size == 0) {
        this.liquidPositions[position.symbol]?.[
          position.type
        ]?.eraseElementByKey(position.price);
      }

      // remove from others
      delete this.liquidationPrice[position.positionId];
      delete this.positions[position.positionId];

      this.eventBus.emit({
        type: "liquidation.completed",
        data: {
          symbol: position.symbol,
          userId: position.userId,
        },
      });
    }

    // remove from
  }

  get indexPrices() {
    return this._indexPrices;
  }

  applyPositionUpdates(positionUpdates: POSITION_UPDATES) {
    Object.entries(positionUpdates).forEach(
      ([userId, perSymbolPositonUpdate]) => {
        Object.entries(perSymbolPositonUpdate).forEach(([_, newPosition]) => {
          let prevPosition = this.positions[newPosition.positionId];

          // remove from prev lqiudi position
          if (prevPosition) {
            this.liquidPositions[prevPosition.symbol]?.[prevPosition.type]
              .getElementByKey?.(
                this.liquidationPrice[prevPosition.positionId]!,
              )
              ?.delete(prevPosition.positionId);
            delete this.liquidationPrice[prevPosition.positionId];
          }

          if (newPosition.qty == 0) {
            // delete from liquisPosition
            if (prevPosition) {
              delete this.positions[prevPosition.positionId];
            }
          } else {
            if (!this.liquidPositions[newPosition.symbol]) {
              this.initializeLiquidPosition(newPosition.symbol);
            }

            // find new liquidation price
            let newLiquidationPrice =
              this.getLiquidationForPosition(newPosition);

            // add to liquid positions
            let positionSet =
              this.liquidPositions[newPosition.symbol]![
                newPosition.type
              ].getElementByKey(newLiquidationPrice) || new Set();

            positionSet.add(newPosition.positionId);

            // update data strcutures
            this.liquidPositions[newPosition.symbol]![
              newPosition.type
            ].setElement(newLiquidationPrice, positionSet);

            if (!prevPosition) {
              this.positions[newPosition.positionId] = newPosition;
            }
            this.liquidationPrice[newPosition.positionId] = newLiquidationPrice;
          }
        });
      },
    );
  }
}
export default LiquidationEngine;
export type { LiquidationOrderInfo, LIQUIDATION_SNAPSHOT };
