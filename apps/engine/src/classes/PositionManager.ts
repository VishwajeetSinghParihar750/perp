import type {
  TRADABLE_CURRENCY_SYMBOL,
  MARGIN_TYPE,
  ORDER,
} from "../types/order.js";
import type { POSITION, POSITION_UPDATES } from "../types/positions.js";
import type { Snapshotable } from "./SnapshotManger.js";
import type { FILLS_INFO } from "../types/order.js";

type ORDER_UPDATES = Record<
  string, // userid
  Record<
    string, // orderid
    {
      positionUpdatePriceQtyProduct: number;
      positionUpdateQty: number;
      symbol: TRADABLE_CURRENCY_SYMBOL;
      totalQty: number;
      margin: number;
      marginType: MARGIN_TYPE;
    }
  >
>;
type POSITION_SNAPSHOT = {
  isolatedPositions: Partial<
    Record<
      TRADABLE_CURRENCY_SYMBOL,
      Record<
        string, // userid
        POSITION
      >
    >
  >;
  ids: {
    positionId: number;
  };
};

class PositionManager implements Snapshotable<POSITION_SNAPSHOT> {
  // just isolated
  private isolatedPositions: Partial<
    Record<
      TRADABLE_CURRENCY_SYMBOL,
      Record<
        string, // userid
        POSITION
      >
    >
  > = {}; // this is per user per symbol per price positions

  ids = {
    positionId: 0,
  };

  getSnapshot(): POSITION_SNAPSHOT {
    return { isolatedPositions: this.isolatedPositions, ids: this.ids };
  }
  loadSnapshot(data: POSITION_SNAPSHOT) {
    this.ids = data.ids;
    this.isolatedPositions = data.isolatedPositions;
  }
  getPosition(userId: string, symbol?: TRADABLE_CURRENCY_SYMBOL) {
    if (!symbol) {
      return undefined;
    }
    return this.isolatedPositions[symbol]?.[userId];
  }

  private calculateOrderUpdates(fills: FILLS_INFO) {
    // there can be position updates at diff price levels for a single user
    // so keep seller id map to orderid to updates
    let orderUpdates: ORDER_UPDATES = {};

    //  get positon updates
    fills.forEach((fill) => {
      const { buyOrderInfo, sellOrderInfo, price, symbol, qty } = fill;

      const { buyerId, orderId: buyOrderId } = buyOrderInfo;
      const { sellerId, orderId: sellOrderId } = sellOrderInfo;

      orderUpdates[buyerId] ??= {};
      orderUpdates[buyerId][buyOrderId] ??= {
        positionUpdatePriceQtyProduct: 0,
        positionUpdateQty: 0,
        margin: buyOrderInfo.margin,
        marginType: buyOrderInfo.marginType,
        totalQty: buyOrderInfo.totalQty,
        symbol,
      };

      orderUpdates[sellerId] ??= {};
      orderUpdates[sellerId][sellOrderId] ??= {
        positionUpdatePriceQtyProduct: 0,
        positionUpdateQty: 0,
        margin: sellOrderInfo.margin,
        marginType: sellOrderInfo.marginType,
        totalQty: sellOrderInfo.totalQty,
        symbol,
      };

      orderUpdates[buyerId][buyOrderId]!.positionUpdatePriceQtyProduct +=
        price * qty;
      orderUpdates[buyerId][buyOrderId]!.positionUpdateQty += qty;

      orderUpdates[sellerId][sellOrderId]!.positionUpdatePriceQtyProduct -=
        price * qty;
      orderUpdates[sellerId][sellOrderId]!.positionUpdateQty -= qty;
    });

    return orderUpdates;
  }
  private applyOrderUpdates(orderUpdates: ORDER_UPDATES) {
    //
    let usersPnlUpdate: Record<string, number> = {};
    let positionUpdates: POSITION_UPDATES = {};

    for (const [userId, orderUpdate] of Object.entries(orderUpdates)) {
      for (const [
        _,
        {
          positionUpdatePriceQtyProduct, // this will be negative for short
          positionUpdateQty, // this will be negative for short
          symbol,
          totalQty: totalOrderQty,
          margin,
          marginType,
        },
      ] of Object.entries(orderUpdate)) {
        let weighedAvgPrice = positionUpdatePriceQtyProduct / positionUpdateQty;
        let newPosition = this.isolatedPositions[symbol]?.[userId];

        let filledRecentQty = Math.abs(positionUpdateQty);
        let unrealizedPnl = 0;

        // doing partial margin filling for diff price positions made by same order

        if (!newPosition) {
          newPosition = {
            positionId: String(this.ids.positionId++),
            createdAt: new Date().toISOString(),
            margin: (margin * filledRecentQty) / totalOrderQty,
            marginType: marginType,
            price: weighedAvgPrice,
            qty: Math.abs(positionUpdateQty),
            symbol: symbol,
            type: positionUpdateQty >= 0 ? "LONG" : "SHORT",
            userId,
          };
        } else {
          let updatedQty = 0;
          let updatedPrice = 0;

          let curretPositionType = newPosition.type;
          let orderType = positionUpdateQty >= 0 ? "LONG" : "SHORT";

          if (curretPositionType == orderType) {
            updatedQty = newPosition.qty + Math.abs(positionUpdateQty);

            // do weighed avg
            updatedPrice =
              (Math.abs(positionUpdatePriceQtyProduct) +
                newPosition.price * newPosition.qty) /
              updatedQty;
          } else {
            // reduce qty

            updatedQty = newPosition.qty - Math.abs(positionUpdateQty);

            if (updatedQty > 0) {
              updatedPrice =
                curretPositionType == "LONG"
                  ? newPosition.price
                  : weighedAvgPrice;
            } else if (updatedQty < 0) {
              updatedPrice =
                curretPositionType == "LONG"
                  ? weighedAvgPrice
                  : newPosition.price;
            }
            // else what if 0 = we dont give af ignore price,coz it would be removed from positions now

            // find pnl
            let qtyForPnl = Math.min(
              newPosition.qty,
              Math.abs(positionUpdateQty),
            );

            unrealizedPnl = (weighedAvgPrice - newPosition.price) * qtyForPnl;
          }

          newPosition.price = updatedPrice;
          newPosition.margin += (margin * filledRecentQty) / totalOrderQty;
          newPosition.qty = updatedQty;
          newPosition.type = newPosition.qty >= 0 ? "LONG" : "SHORT";
          newPosition.marginType = marginType;
          newPosition.symbol;
        }

        // update positions
        positionUpdates[newPosition.userId] ??= {};
        positionUpdates[newPosition.userId]![newPosition.symbol] = newPosition;

        if (newPosition.qty == 0) {
          // return back their margin
          unrealizedPnl += newPosition.margin;
          delete this.isolatedPositions[symbol]?.[userId];
        } else {
          this.isolatedPositions[symbol] ??= {};
          this.isolatedPositions[symbol]![userId] = newPosition;
        }

        if (unrealizedPnl != 0) {
          usersPnlUpdate[userId] ??= 0;
          usersPnlUpdate[userId] += unrealizedPnl;
        }
      }
    }
    return { pnlUpdates: usersPnlUpdate, positionUpdates };
  }

  applyFills(fills: FILLS_INFO) {
    let orderUpdates = this.calculateOrderUpdates(fills);

    let { pnlUpdates, positionUpdates } = this.applyOrderUpdates(orderUpdates);

    return { pnlUpdates, positionUpdates };
  }

  // get funding rate per symbol in params
  applyFunding(
    fundingRate: Partial<Record<TRADABLE_CURRENCY_SYMBOL, number>>,
  ): { usersPnl: Record<string, number>; positionUpdates: POSITION_UPDATES } {
    let usersPnl: Record<string, number> = {};
    let positionUpdates: POSITION_UPDATES = {};

    Object.entries(this.isolatedPositions).forEach(
      ([symbol, perUserPositions]) => {
        if (!perUserPositions) return;

        Object.entries(perUserPositions).forEach(([userId, position]) => {
          let curFundingRate = fundingRate[symbol as TRADABLE_CURRENCY_SYMBOL];
          if (curFundingRate) {
            let toUpdateMargin = Math.abs(
              position.price * position.qty * curFundingRate,
            );

            if (curFundingRate > 0 == (position.type == "LONG")) {
              // you pay
              position.margin -= toUpdateMargin;
              positionUpdates[userId] ??= {};
              positionUpdates[userId][position.symbol] = position;
            } else {
              // you get
              usersPnl[userId] ??= 0;
              usersPnl[userId] += toUpdateMargin;
            }
          }
        });
      },
    );
    return { usersPnl, positionUpdates };
  }

  // adl winnign positions against this guy
  performAdl(
    position: POSITION,
    indexPrice: number,
  ): {
    usersPnl: Record<string, number>;
    positionUpdates: POSITION_UPDATES;
  } {
    //

    // maintaining best winner at all times is complicated/ no easy way to do it
    // TODO : find winners effectively

    let positions = Object.entries(this.isolatedPositions[position.symbol]!);

    positions.sort(([_, posa], [__, posb]) => {
      let profita =
        posa.qty * (indexPrice - posa.price) * (posa.type == "LONG" ? 1 : -1);
      let profitb =
        posb.qty * (indexPrice - posb.price) * (posb.type == "LONG" ? 1 : -1);

      return profitb - profita;
    });

    // create random order for current position
    let positionChanges: ORDER_UPDATES = {
      [position.userId]: {
        [crypto.randomUUID()]: {
          margin: 0,
          marginType: "ISOLATED",
          positionUpdatePriceQtyProduct:
            position.qty * position.price * (position.type == "LONG" ? -1 : 1),
          positionUpdateQty: position.qty,
          symbol: position.symbol,
          totalQty: position.qty,
        },
      },
    };

    // create random order for opposote winning people
    for (let [userId, pos] of positions) {
      let qtyToAdl = Math.min(position.qty, pos.qty);
      positionChanges[userId] = {
        [crypto.randomUUID()]: {
          margin: 0,
          marginType: "ISOLATED",
          positionUpdatePriceQtyProduct:
            qtyToAdl * position.price * (position.type == "LONG" ? -1 : 1),
          positionUpdateQty: position.qty,
          symbol: position.symbol,
          totalQty: qtyToAdl,
        },
      };

      position.qty -= qtyToAdl;
      if (position.qty == 0) break;
    }

    let { pnlUpdates, positionUpdates } =
      this.applyOrderUpdates(positionChanges);

    return { usersPnl: pnlUpdates, positionUpdates };
  }
}

export default PositionManager;

export type { POSITION_SNAPSHOT };
