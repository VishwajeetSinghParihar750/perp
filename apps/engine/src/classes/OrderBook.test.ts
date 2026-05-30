import { describe, it, expect, beforeEach } from "vitest";
import EventBus from "./EventBus.js";
import OrderBook from "./OrderBook.js";

describe("OrderBook", () => {
  let eventBus: EventBus;
  let orderBook: OrderBook;

  beforeEach(() => {
    eventBus = new EventBus();
    orderBook = new OrderBook(eventBus);
  });

  describe("createOrder - MARKET BUY", () => {
    it("should match a market buy against existing limit sell orders", () => {
      orderBook.createOrder(
        "LIMIT",
        "SELL",
        "SOLUSD",
        10,
        "seller1",
        100,
        "ISOLATED",
        20,
      );
      const result = orderBook.createOrder(
        "MARKET",
        "BUY",
        "SOLUSD",
        5,
        "buyer1",
        50,
        "ISOLATED",
        20.2,
      );

      console.log(result);
      expect(result.totalFilledQuantity).toBe(5);
      expect(result.fills).toHaveLength(1);
      expect(result.fills[0].price).toBe(20);
      expect(result.fills[0].qty).toBe(5);
    });

    it("should partially fill market buy if not enough liquidity", () => {
      orderBook.createOrder(
        "LIMIT",
        "SELL",
        "SOLUSD",
        3,
        "seller1",
        100,
        "ISOLATED",
        20,
      );
      const result = orderBook.createOrder(
        "MARKET",
        "BUY",
        "SOLUSD",
        10,
        "buyer1",
        50,
        "ISOLATED",
        20.2,
      );
      expect(result.totalFilledQuantity).toBe(3);
      expect(result.fills).toHaveLength(1);
    });

    it("should match across multiple price levels on market buy", () => {
      orderBook.createOrder(
        "LIMIT",
        "SELL",
        "SOLUSD",
        5,
        "seller1",
        100,
        "ISOLATED",
        20,
      );
      orderBook.createOrder(
        "LIMIT",
        "SELL",
        "SOLUSD",
        5,
        "seller2",
        100,
        "ISOLATED",
        21,
      );
      const result = orderBook.createOrder(
        "MARKET",
        "BUY",
        "SOLUSD",
        8,
        "buyer1",
        50,
        "ISOLATED",
        21.21,
      );
      expect(result.totalFilledQuantity).toBe(8);
      expect(result.fills).toHaveLength(2);
    });
  });

  describe("createOrder - MARKET SELL", () => {
    it("should match a market sell against existing limit buy orders", () => {
      orderBook.createOrder(
        "LIMIT",
        "BUY",
        "SOLUSD",
        10,
        "buyer1",
        100,
        "ISOLATED",
        20,
      );
      const result = orderBook.createOrder(
        "MARKET",
        "SELL",
        "SOLUSD",
        5,
        "seller1",
        50,
        "ISOLATED",
        19.8,
      );
      expect(result.totalFilledQuantity).toBe(5);
      expect(result.fills).toHaveLength(1);
      expect(result.fills[0].price).toBe(20);
    });
  });

  describe("createOrder - LIMIT BUY", () => {
    it("should place a limit buy order in the orderbook when no match", () => {
      const result = orderBook.createOrder(
        "LIMIT",
        "BUY",
        "SOLUSD",
        5,
        "buyer1",
        100,
        "ISOLATED",
        20,
      );
      expect(result.totalFilledQuantity).toBe(0);
      expect(result.fills).toHaveLength(0);

      const depth = orderBook.getDepth("SOLUSD");
      expect(depth.BIDS).toHaveLength(1);
      expect(depth.BIDS[0].price).toBe(20);
      expect(depth.BIDS[0].quantity).toBe(5);
    });

    it("should match limit buy against existing sell orders at or below price", () => {
      orderBook.createOrder(
        "LIMIT",
        "SELL",
        "SOLUSD",
        5,
        "seller1",
        100,
        "ISOLATED",
        18,
      );
      const result = orderBook.createOrder(
        "LIMIT",
        "BUY",
        "SOLUSD",
        5,
        "buyer1",
        100,
        "ISOLATED",
        20,
      );
      expect(result.totalFilledQuantity).toBe(5);
      expect(result.fills).toHaveLength(1);
    });

    it("should partially fill limit buy and place remainder in orderbook", () => {
      orderBook.createOrder(
        "LIMIT",
        "SELL",
        "SOLUSD",
        3,
        "seller1",
        100,
        "ISOLATED",
        18,
      );
      const result = orderBook.createOrder(
        "LIMIT",
        "BUY",
        "SOLUSD",
        8,
        "buyer1",
        100,
        "ISOLATED",
        20,
      );
      expect(result.totalFilledQuantity).toBe(3);
      expect(result.fills).toHaveLength(1);

      const depth = orderBook.getDepth("SOLUSD");
      expect(depth.BIDS).toHaveLength(1);
      expect(depth.BIDS[0].quantity).toBe(5);
    });
  });

  describe("cancelOrder", () => {
    it("should cancel an open order and return its details", () => {
      orderBook.createOrder(
        "LIMIT",
        "BUY",
        "SOLUSD",
        5,
        "buyer1",
        100,
        "ISOLATED",
        20,
      );
      const result = orderBook.cancelOrder("0");
      expect(result.status).toBe("CANCELLED");
      expect(result.order).toBeDefined();
      const depth = orderBook.getDepth("SOLUSD");
      expect(depth.BIDS).toHaveLength(0);
    });

    it("should return NOT_CANCELLABLE for non-existent order", () => {
      const result = orderBook.cancelOrder("nonexistent");
      expect(result.status).toBe("NOT_CANCELLABLE");
    });
  });

  describe("getDepth", () => {
    it("should return empty depth for unknown symbol", () => {
      const depth = orderBook.getDepth("SOLUSD");
      expect(depth.ASKS).toEqual([]);
      expect(depth.BIDS).toEqual([]);
    });

    it("should respect count param", () => {
      for (let i = 0; i < 10; i++) {
        orderBook.createOrder(
          "LIMIT",
          "BUY",
          "SOLUSD",
          1,
          "buyer1",
          100,
          "ISOLATED",
          20 + i,
        );
      }
      const depth = orderBook.getDepth("SOLUSD", 3);
      expect(depth.BIDS).toHaveLength(3);
    });
  });

  describe("getSnapshot / loadSnapshot", () => {
    it("should roundtrip snapshot correctly", () => {
      orderBook.createOrder(
        "LIMIT",
        "BUY",
        "SOLUSD",
        5,
        "buyer1",
        100,
        "ISOLATED",
        20,
      );
      orderBook.createOrder(
        "LIMIT",
        "SELL",
        "SOLUSD",
        5,
        "seller1",
        100,
        "ISOLATED",
        25,
      );
      const snapshot = orderBook.getSnapshot();
      const newOrderBook = new OrderBook(new EventBus());
      newOrderBook.loadSnapshot(snapshot);
      expect(newOrderBook.getDepth("SOLUSD").BIDS).toHaveLength(1);
      expect(newOrderBook.getDepth("SOLUSD").ASKS).toHaveLength(1);
    });
  });
});
