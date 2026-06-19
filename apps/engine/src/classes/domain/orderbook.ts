import type { EngineTypes } from "@repo/shared-types";
import type { Order } from "./order.js";
import { TradeFactory } from "./trade.js";
import EventBus from "./eventBus.js";
import RiskEngine from "./riskEngine.js";

type USER_ID = EngineTypes.USER_ID;
type ORDER_ID = EngineTypes.ORDER_ID;
type MARKET_ID = EngineTypes.TRADABLE_SYMBOL;
type PRICE = EngineTypes.PRICE;
type QUANTITY = EngineTypes.QUANTITY;
type SIDE = EngineTypes.SIDE;
type ORDER_TYPE = EngineTypes.TYPE;
type ORDER_STATUS = EngineTypes.ORDER_STATUS;

interface PriceLevel {
  totalQty: QUANTITY;
  orders: Order[];
}

interface SingleMarketOrderbook {
  asksPrices: PRICE[];
  bidsPrices: PRICE[];
  askPriceLevels: Map<PRICE, PriceLevel>;
  bidPriceLevels: Map<PRICE, PriceLevel>;
}

export default class Orderbook {
  private riskEngine: RiskEngine;
  private tradeFactory: TradeFactory;
  private eventBus: EventBus;

  private marketOrderbooks: Map<MARKET_ID, SingleMarketOrderbook> = new Map();
  private orders: Map<ORDER_ID, Order> = new Map();

  constructor(
    riskEngine: RiskEngine,
    tradeFactory: TradeFactory,
    eventBus: EventBus,
  ) {
    this.riskEngine = riskEngine;
    this.tradeFactory = tradeFactory;
    this.eventBus = eventBus;
  }

  private getOrCreateMarketOrderbook(marketId: MARKET_ID): SingleMarketOrderbook {
    let ob = this.marketOrderbooks.get(marketId);
    if (!ob) {
      ob = {
        asksPrices: [],
        bidsPrices: [],
        askPriceLevels: new Map(),
        bidPriceLevels: new Map(),
      };
      this.marketOrderbooks.set(marketId, ob);
    }
    return ob;
  }

  private cancelOrderStatusAndEmit(order: Order) {
    order.status = "CANCELLED";
    this.eventBus.emit({
      type: "order.cancelled",
      data: { orderId: order.orderId }
    });
  }

  private matchOrders(
    order1: Order,
    order2: Order,
    margin1Required: PRICE,
    margin2Required: PRICE,
  ) {
    const tradePrice = Math.min(order1.price, order2.price);
    const tradeQuantity = Math.min(
      order2.quantity - order2.filledQuantity,
      order1.quantity - order1.filledQuantity,
    );

    if (tradeQuantity <= 0) {
      throw new Error("Assertion failed: tradeQuantity > 0");
    }

    order1.margin -= margin1Required;
    order2.margin -= margin2Required;

    if (order1.margin < 0) {
      order1.margin = 0;
    }
    if (order2.margin < 0) {
      order2.margin = 0;
    }

    order1.filledQuantity += tradeQuantity;
    order2.filledQuantity += tradeQuantity;

    order1.status =
      order1.filledQuantity === order1.quantity
        ? "FILLED"
        : "PARTIALLY_FILLED";
    order2.status =
      order2.filledQuantity === order2.quantity
        ? "FILLED"
        : "PARTIALLY_FILLED";

    const ob = this.getOrCreateMarketOrderbook(order1.marketId as MARKET_ID);

    // Update level quantities
    const lvl1 = (
      order1.side === "BUY" ? ob.bidPriceLevels : ob.askPriceLevels
    ).get(order1.price);
    if (lvl1) {
      lvl1.totalQty -= tradeQuantity;
    }
    const lvl2 = (
      order2.side === "BUY" ? ob.bidPriceLevels : ob.askPriceLevels
    ).get(order2.price);
    if (lvl2) {
      lvl2.totalQty -= tradeQuantity;
    }

    // emit trade
    const order1Info = {
      buyerId: order1.userId,
      sellerId: order1.userId,
      orderId: order1.orderId,
      filledQty: order1.filledQuantity,
      totalQty: order1.quantity,
      orderStatus: order1.status,
    };

    const order2Info = {
      buyerId: order2.userId,
      sellerId: order2.userId,
      orderId: order2.orderId,
      filledQty: order2.filledQuantity,
      totalQty: order2.quantity,
      orderStatus: order2.status,
    };

    const tradeEvent = this.tradeFactory.create(
      tradePrice,
      tradeQuantity,
      order1.marketId as MARKET_ID,
      (order1.side === "BUY" ? order1Info : order2Info) as any,
      (order1.side === "SELL" ? order1Info : order2Info) as any,
    );

    this.eventBus.emit({
      type: "fills.created",
      data: { fills: [tradeEvent] }
    });
  }

  private matchAgainstBook(
    order: Order,
    oppositePrices: PRICE[],
    oppositePriceLevels: Map<PRICE, PriceLevel>,
  ) {
    while (oppositePrices.length > 0 && order.filledQuantity < order.quantity) {
      const bestOppositePrice = oppositePrices[0]!;

      const oppositeLevel = oppositePriceLevels.get(bestOppositePrice);
      if (!oppositeLevel || oppositeLevel.orders.length === 0) {
        oppositePrices.shift();
        continue;
      }

      const canMatch =
        order.side === "BUY"
          ? order.price >= bestOppositePrice
          : order.price <= bestOppositePrice;

      if (!canMatch) {
        break;
      }

      let i = 0;
      while (
        i < oppositeLevel.orders.length &&
        order.filledQuantity < order.quantity
      ) {
        const makerOrder = oppositeLevel.orders[i]!;
        const [marginRequired1, marginRequired2] =
          this.riskEngine.evaluateTrade(makerOrder, order);

        if (marginRequired1 > makerOrder.margin) {
          this.cancelOrderStatusAndEmit(makerOrder);
          this.orders.delete(makerOrder.orderId);
          oppositeLevel.orders.splice(i, 1);
          oppositeLevel.totalQty -=
            makerOrder.quantity - makerOrder.filledQuantity;
          continue;
        }

        if (marginRequired2 > order.margin) {
          this.cancelOrderStatusAndEmit(order);
          return;
        }

        this.matchOrders(makerOrder, order, marginRequired1, marginRequired2);

        if (makerOrder.filledQuantity === makerOrder.quantity) {
          this.orders.delete(makerOrder.orderId);
          oppositeLevel.orders.splice(i, 1);
        } else {
          i++;
        }
      }

      if (oppositeLevel.orders.length === 0) {
        oppositePriceLevels.delete(bestOppositePrice);
        oppositePrices.shift();
      }
    }
  }

  private match(order: Order) {
    const ob = this.getOrCreateMarketOrderbook(order.marketId as MARKET_ID);
    if (order.side === "BUY") {
      this.matchAgainstBook(order, ob.asksPrices, ob.askPriceLevels);
    } else {
      this.matchAgainstBook(order, ob.bidsPrices, ob.bidPriceLevels);
    }
  }

  private sitOnBook(
    order: Order,
    priceLevels: Map<PRICE, PriceLevel>,
    oppositePrices: PRICE[],
    isAscending: boolean,
  ) {
    if (order.quantity <= order.filledQuantity) {
      throw new Error(
        "Assertion failed: order.quantity > order.filledQuantity",
      );
    }
    if (this.orders.has(order.orderId)) {
      throw new Error("Assertion failed: !orders.has(order.orderId)");
    }

    const orderId = order.orderId;
    const price = order.price;

    let level = priceLevels.get(price);
    if (!level) {
      oppositePrices.push(price);
      if (isAscending) {
        oppositePrices.sort((a, b) => a - b);
      } else {
        oppositePrices.sort((a, b) => b - a);
      }
      level = { totalQty: 0, orders: [] };
      priceLevels.set(price, level);
    }

    level.totalQty += order.quantity - order.filledQuantity;
    level.orders.push(order);
    this.orders.set(orderId, order);
  }

  placeOrder(order: Order): Order {
    this.match(order);

    const toReturn = { ...order };

    if (
      order.status !== "CANCELLED" &&
      order.type === "LIMIT" &&
      order.filledQuantity < order.quantity
    ) {
      const ob = this.getOrCreateMarketOrderbook(order.marketId as MARKET_ID);
      if (order.side === "BUY") {
        this.sitOnBook(order, ob.bidPriceLevels, ob.bidsPrices, false);
      } else {
        this.sitOnBook(order, ob.askPriceLevels, ob.asksPrices, true);
      }
    }

    return toReturn;
  }

  cancelOrder(orderId: ORDER_ID) {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Assertion failed: orders.has(${orderId})`);
    }

    const price = order.price;
    const ob = this.getOrCreateMarketOrderbook(order.marketId as MARKET_ID);

    if (order.side === "BUY") {
      const level = ob.bidPriceLevels.get(price);
      if (level) {
        const remaining = order.quantity - order.filledQuantity;
        level.totalQty -= remaining;
        const index = level.orders.findIndex((o) => o.orderId === orderId);
        if (index !== -1) {
          level.orders.splice(index, 1);
        }

        if (level.totalQty <= 0 || level.orders.length === 0) {
          ob.bidPriceLevels.delete(price);
          const pIndex = ob.bidsPrices.indexOf(price);
          if (pIndex !== -1) {
            ob.bidsPrices.splice(pIndex, 1);
          }
        }
      }
    } else {
      const level = ob.askPriceLevels.get(price);
      if (level) {
        const remaining = order.quantity - order.filledQuantity;
        level.totalQty -= remaining;
        const index = level.orders.findIndex((o) => o.orderId === orderId);
        if (index !== -1) {
          level.orders.splice(index, 1);
        }

        if (level.totalQty <= 0 || level.orders.length === 0) {
          ob.askPriceLevels.delete(price);
          const pIndex = ob.asksPrices.indexOf(price);
          if (pIndex !== -1) {
            ob.asksPrices.splice(pIndex, 1);
          }
        }
      }
    }

    this.orders.delete(orderId);

    // emit event
    this.eventBus.emit({
      type: "order.cancelled",
      data: { orderId }
    });
  }

  getDepth(marketId: MARKET_ID): [[PRICE, QUANTITY][], [PRICE, QUANTITY][]] {
    const ob = this.getOrCreateMarketOrderbook(marketId);
    const longDepths: [PRICE, QUANTITY][] = [];
    const shortDepths: [PRICE, QUANTITY][] = [];

    for (const [price, level] of ob.askPriceLevels) {
      longDepths.push([price, level.totalQty]);
    }

    for (const [price, level] of ob.bidPriceLevels) {
      shortDepths.push([price, level.totalQty]);
    }

    return [longDepths, shortDepths];
  }
}
export { Orderbook as Orderbook };
