import type { EngineTypes } from "@repo/shared-types";
import type { Order } from "./order.js";
import { TradeFactory } from "./trade.js";
import EventBus from "./eventBus.js";
import RiskEngine from "./riskEngine.js";
import { LinkList, OrderedMap } from "js-sdsl";
import assert from "node:assert";
import type { Result } from "../types.js";
import type { Snapshotable } from "../infrastructure/snapshotManager.js";

type USER_ID = EngineTypes.USER_ID;
type ORDER_ID = EngineTypes.ORDER_ID;
type MARKET_SYMBOL = EngineTypes.TRADABLE_SYMBOL;
type PRICE = EngineTypes.PRICE;
type QUANTITY = EngineTypes.QUANTITY;
type SIDE = EngineTypes.SIDE;
type ORDER_TYPE = EngineTypes.TYPE;
type ORDER_STATUS = EngineTypes.ORDER_STATUS;

export interface PriceLevel {
  totalQty: QUANTITY;
  orders: LinkList<Order>;
}

type OrderIterator = ReturnType<LinkList<Order>["begin"]>;

export type SINGLE_MARKET_ORDERBOOK_SNAPSHOT = {
  bids: [PRICE, Order[]][];
  asks: [PRICE, Order[]][];
};

export class SingleMarketOrderbook implements Snapshotable<SINGLE_MARKET_ORDERBOOK_SNAPSHOT> {
  private riskEngine: RiskEngine;
  private tradeFactory: TradeFactory;
  private eventBus: EventBus;
  private marketSymbol: MARKET_SYMBOL;

  bids: OrderedMap<PRICE, PriceLevel>;
  asks: OrderedMap<PRICE, PriceLevel>;

  private orders: Map<ORDER_ID, OrderIterator> = new Map();

  getActiveOrderIds(): ORDER_ID[] {
    return Array.from(this.orders.keys());
  }

  getSnapshot(): SINGLE_MARKET_ORDERBOOK_SNAPSHOT {
    const bidsSnapshot: [PRICE, Order[]][] = [];
    for (const [price, level] of this.bids) {
      bidsSnapshot.push([price, Array.from(level.orders)]);
    }

    const asksSnapshot: [PRICE, Order[]][] = [];
    for (const [price, level] of this.asks) {
      asksSnapshot.push([price, Array.from(level.orders)]);
    }

    return {
      bids: bidsSnapshot,
      asks: asksSnapshot,
    };
  }

  loadSnapshot(data: SINGLE_MARKET_ORDERBOOK_SNAPSHOT) {
    this.bids = new OrderedMap([], (a, b) => b - a);
    this.asks = new OrderedMap();
    this.orders = new Map();

    data.bids.forEach(([price, orders]) => {
      const levelOrders = new LinkList<Order>();
      orders.forEach((o) => {
        levelOrders.pushBack(o);
        const it = levelOrders.end().pre();
        this.orders.set(o.orderId, it);
      });
      this.bids.setElement(price, {
        totalQty: orders.reduce((sum, o) => sum + (o.quantity - o.filledQuantity), 0),
        orders: levelOrders,
      });
    });

    data.asks.forEach(([price, orders]) => {
      const levelOrders = new LinkList<Order>();
      orders.forEach((o) => {
        levelOrders.pushBack(o);
        const it = levelOrders.end().pre();
        this.orders.set(o.orderId, it);
      });
      this.asks.setElement(price, {
        totalQty: orders.reduce((sum, o) => sum + (o.quantity - o.filledQuantity), 0),
        orders: levelOrders,
      });
    });
  }

  constructor(
    riskEngine: RiskEngine,
    tradeFactory: TradeFactory,
    eventBus: EventBus,
    marketSymbol: MARKET_SYMBOL,
  ) {
    this.riskEngine = riskEngine;
    this.tradeFactory = tradeFactory;
    this.eventBus = eventBus;
    this.marketSymbol = marketSymbol;

    this.asks = new OrderedMap();
    this.bids = new OrderedMap([], (a, b) => b - a);
  }

  private cancelOrderStatusAndEmit(order: Order) {
    order.status = "CANCELLED";
    this.eventBus.emit({
      type: "order.cancelled",
      data: { orderId: order.orderId },
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

    assert(tradeQuantity > 0, "Assertion failed: tradeQuantity > 0");

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
      order1.filledQuantity === order1.quantity ? "FILLED" : "PARTIALLY_FILLED";
    order2.status =
      order2.filledQuantity === order2.quantity ? "FILLED" : "PARTIALLY_FILLED";

    // emit trade
    const order1Info = {
      buyerId: order1.userId,
      sellerId: order1.userId,
      orderId: order1.orderId,
      filledQty: order1.filledQuantity,
      totalQty: order1.quantity,
      orderStatus: order1.status,
      margin: margin1Required,
      marginType: order1.marginType,
    };

    const order2Info = {
      buyerId: order2.userId,
      sellerId: order2.userId,
      orderId: order2.orderId,
      filledQty: order2.filledQuantity,
      totalQty: order2.quantity,
      orderStatus: order2.status,
      margin: margin2Required,
      marginType: order2.marginType,
    };

    const tradeEvent = this.tradeFactory.create(
      tradePrice,
      tradeQuantity,
      this.marketSymbol,
      (order1.side === "BUY" ? order1Info : order2Info) as any,
      (order1.side === "SELL" ? order1Info : order2Info) as any,
    );

    this.eventBus.emit({
      type: "fills.created",
      data: { fills: [tradeEvent] },
    });
  }

  private matchAgainstBook(
    order: Order,
    oppositePriceLevels: OrderedMap<PRICE, PriceLevel>,
  ) {
    while (
      !oppositePriceLevels.empty() &&
      order.filledQuantity < order.quantity
    ) {
      const [bestOppositePrice, oppositeLevel] = oppositePriceLevels.front()!;

      if (!oppositeLevel || oppositeLevel.orders.empty()) {
        oppositePriceLevels.eraseElementByKey(bestOppositePrice);
        continue;
      }

      const canMatch =
        order.side === "BUY"
          ? order.price >= bestOppositePrice
          : order.price <= bestOppositePrice;

      if (!canMatch) {
        break;
      }

      let it = oppositeLevel.orders.begin();
      while (
        !it.equals(oppositeLevel.orders.end()) &&
        order.filledQuantity < order.quantity
      ) {
        const makerOrder = it.pointer;
        const [marginRequired1, marginRequired2] =
          this.riskEngine.evaluateTrade(makerOrder, order);

        if (marginRequired1 > makerOrder.margin) {
          this.cancelOrderStatusAndEmit(makerOrder);
          this.orders.delete(makerOrder.orderId);
          it = oppositeLevel.orders.eraseElementByIterator(it);
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
          it = oppositeLevel.orders.eraseElementByIterator(it);
        } else {
          it = it.next();
        }
      }

      if (oppositeLevel.orders.empty()) {
        oppositePriceLevels.eraseElementByKey(bestOppositePrice);
      }
    }
  }

  private match(order: Order) {
    if (order.side === "BUY") {
      this.matchAgainstBook(order, this.asks);
    } else {
      this.matchAgainstBook(order, this.bids);
    }
  }

  private sitOnBook(order: Order, priceLevels: OrderedMap<PRICE, PriceLevel>) {
    assert(
      order.quantity > order.filledQuantity,
      "Assertion failed: order.quantity > order.filledQuantity",
    );
    assert(
      !this.orders.has(order.orderId),
      "Assertion failed: !orders.has(order.orderId)",
    );

    const orderId = order.orderId;
    const price = order.price;

    let level = priceLevels.getElementByKey(price);
    if (!level) {
      level = { totalQty: 0, orders: new LinkList() };
      priceLevels.setElement(price, level);
    }

    level.totalQty += order.quantity - order.filledQuantity;
    level.orders.pushBack(order);

    const it = level.orders.end().pre();
    this.orders.set(orderId, it);
  }

  placeOrder(order: Order): Order {
    this.match(order);

    const toReturn = { ...order };

    if (
      order.status !== "CANCELLED" &&
      order.type === "LIMIT" &&
      order.filledQuantity < order.quantity
    ) {
      if (order.side === "BUY") {
        this.sitOnBook(order, this.bids);
      } else {
        this.sitOnBook(order, this.asks);
      }
    }

    return toReturn;
  }

  cancelOrder(orderId: ORDER_ID): Result<EngineTypes.ORDER_ID> {
    const it = this.orders.get(orderId);

    if (!it)
      return { success: false, error: new Error("ORDER_DOES_NOT_EXIST") };

    const order = it.pointer;
    const price = order.price;

    if (order.side === "BUY") {
      const level = this.bids.getElementByKey(price);
      if (level) {
        level.totalQty -= order.quantity - order.filledQuantity;
        level.orders.eraseElementByIterator(it);

        if (level.totalQty <= 0 || level.orders.empty()) {
          this.bids.eraseElementByKey(price);
        }
      }
    } else {
      const level = this.asks.getElementByKey(price);
      if (level) {
        level.totalQty -= order.quantity - order.filledQuantity;
        level.orders.eraseElementByIterator(it);

        if (level.totalQty <= 0 || level.orders.empty()) {
          this.asks.eraseElementByKey(price);
        }
      }
    }

    this.orders.delete(orderId);

    // emit event
    this.eventBus.emit({
      type: "order.cancelled",
      data: { orderId },
    });

    return { success: true, value: orderId };
  }

  getDepth(): [[PRICE, QUANTITY][], [PRICE, QUANTITY][]] {
    const longDepths: [PRICE, QUANTITY][] = [];
    const shortDepths: [PRICE, QUANTITY][] = [];

    for (const [price, level] of this.asks) {
      longDepths.push([price, level.totalQty]);
    }

    for (const [price, level] of this.bids) {
      shortDepths.push([price, level.totalQty]);
    }

    return [longDepths, shortDepths];
  }
}

export type ORDERBOOK_SNAPSHOT = {
  marketOrderbooks: [MARKET_SYMBOL, SINGLE_MARKET_ORDERBOOK_SNAPSHOT][];
};

export default class Orderbook implements Snapshotable<ORDERBOOK_SNAPSHOT> {
  private riskEngine: RiskEngine;
  private tradeFactory: TradeFactory;
  private eventBus: EventBus;

  private marketOrderbooks: Map<MARKET_SYMBOL, SingleMarketOrderbook> =
    new Map();
  private orders: Map<ORDER_ID, SingleMarketOrderbook> = new Map();

  getSnapshot(): ORDERBOOK_SNAPSHOT {
    const marketSnapshots: [MARKET_SYMBOL, SINGLE_MARKET_ORDERBOOK_SNAPSHOT][] = [];
    for (const [symbol, ob] of this.marketOrderbooks.entries()) {
      marketSnapshots.push([symbol, ob.getSnapshot()]);
    }
    return {
      marketOrderbooks: marketSnapshots,
    };
  }

  loadSnapshot(data: ORDERBOOK_SNAPSHOT) {
    this.marketOrderbooks = new Map();
    this.orders = new Map();

    data.marketOrderbooks.forEach(([symbol, obSnapshot]) => {
      const ob = new SingleMarketOrderbook(
        this.riskEngine,
        this.tradeFactory,
        this.eventBus,
        symbol,
      );
      ob.loadSnapshot(obSnapshot);
      this.marketOrderbooks.set(symbol, ob);

      // reconstruct orderId mapping
      for (const orderId of ob.getActiveOrderIds()) {
        this.orders.set(orderId, ob);
      }
    });
  }

  constructor(
    riskEngine: RiskEngine,
    tradeFactory: TradeFactory,
    eventBus: EventBus,
  ) {
    this.riskEngine = riskEngine;
    this.tradeFactory = tradeFactory;
    this.eventBus = eventBus;
  }

  private getOrCreateMarketOrderbook(
    marketSymbol: MARKET_SYMBOL,
  ): SingleMarketOrderbook {
    let ob = this.marketOrderbooks.get(marketSymbol);
    if (!ob) {
      ob = new SingleMarketOrderbook(
        this.riskEngine,
        this.tradeFactory,
        this.eventBus,
        marketSymbol,
      );
      this.marketOrderbooks.set(marketSymbol, ob);
    }
    return ob;
  }

  placeOrder(order: Order): Order {
    const ob = this.getOrCreateMarketOrderbook(order.marketSymbol);
    const placed = ob.placeOrder(order);
    if (
      placed.status !== "CANCELLED" &&
      placed.status !== "FILLED" &&
      placed.type === "LIMIT"
    ) {
      this.orders.set(placed.orderId, ob);
    }
    return placed;
  }

  cancelOrder(orderId: ORDER_ID): Result<EngineTypes.ORDER_ID> {
    const ob = this.orders.get(orderId);
    if (ob) {
      this.orders.delete(orderId);
      return ob.cancelOrder(orderId);
    }
    return { success: false, error: new Error("ORDER_DOES_NOT_EXIST") };
  }

  getDepth(
    marketSymbol: MARKET_SYMBOL,
  ): [[PRICE, QUANTITY][], [PRICE, QUANTITY][]] {
    const ob = this.getOrCreateMarketOrderbook(marketSymbol);
    return ob.getDepth();
  }

  getOrderbook(marketSymbol: MARKET_SYMBOL): SingleMarketOrderbook {
    return this.getOrCreateMarketOrderbook(marketSymbol);
  }
}

export { Orderbook as Orderbook };
