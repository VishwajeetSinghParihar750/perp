import { describe, it, expect, beforeEach } from "vitest";
import EventBus from "./EventBus.js";
import Exchange from "./Exchange.js";

describe("Exchange", () => {
  let eventBus: EventBus;
  let exchange: Exchange;

  beforeEach(() => {
    eventBus = new EventBus();
    exchange = new Exchange(eventBus);
  });

  describe("addBalance", () => {
    it("should add USD balance", () => {
      exchange.addBalance("user1", 1000, "USD");
      const balance = exchange.getBalance("user1", "USD");
      expect(balance).toBe(1000);
    });
  });

  describe("createOrder", () => {
    it("should reject if margin exceeds balance", () => {
      exchange.addBalance("user1", 100, "USD");
      const result = exchange.createOrder("LIMIT", "BUY", "SOLUSD", 10, "user1", 999, "ISOLATED", 20);
      expect(result.status).toBe("REJECTED");
    });

    it("should reject if margin needed is greater than provided margin", () => {
      exchange.addBalance("user1", 1000, "USD");
      const result = exchange.createOrder("LIMIT", "BUY", "SOLUSD", 100, "user1", 1, "ISOLATED", 20);
      expect(result.status).toBe("REJECTED");
    });

    it("should reject if account is locked", () => {
      exchange.addBalance("user1", 1000, "USD");
      eventBus.emit({ type: "liquidation.started", data: { userId: "user1", symbol: "SOLUSD" } });
      const result = exchange.createOrder("LIMIT", "BUY", "SOLUSD", 5, "user1", 100, "ISOLATED", 20);
      expect(result.status).toBe("REJECTED");
    });

    it("should accept a valid limit order", () => {
      exchange.addBalance("user1", 1000, "USD");
      const result = exchange.createOrder("LIMIT", "BUY", "SOLUSD", 5, "user1", 100, "ISOLATED", 20);
      expect(result.status).toBe("OPEN");
      expect(result.orderId).toBeDefined();
    });

    it("should match buy and sell orders and return FILLED status", () => {
      exchange.addBalance("seller1", 1000, "USD");
      exchange.addBalance("buyer1", 1000, "USD");
      exchange.createOrder("LIMIT", "SELL", "SOLUSD", 5, "seller1", 100, "ISOLATED", 20);
      const result = exchange.createOrder("LIMIT", "BUY", "SOLUSD", 5, "buyer1", 100, "ISOLATED", 20);
      expect(result.status).toBe("FILLED");
      expect(result.fills).toHaveLength(1);
    });
  });

  describe("cancelOrder", () => {
    it("should cancel an open order", () => {
      exchange.addBalance("user1", 1000, "USD");
      exchange.createOrder("LIMIT", "BUY", "SOLUSD", 5, "user1", 100, "ISOLATED", 20);
      const result = exchange.cancelOrder("0");
      expect(result.status).toBe("CANCELLED");
    });

    it("should return NOT_CANCELLABLE for unknown order", () => {
      const result = exchange.cancelOrder("nonexistent");
      expect(result.status).toBe("NOT_CANCELLABLE");
    });
  });

  describe("getDepth", () => {
    it("should return depth for a symbol", () => {
      exchange.addBalance("user1", 1000, "USD");
      exchange.createOrder("LIMIT", "BUY", "SOLUSD", 5, "user1", 100, "ISOLATED", 20);
      const depth = exchange.getDepth("SOLUSD");
      expect(depth.BIDS).toHaveLength(1);
      expect(depth.ASKS).toHaveLength(0);
    });
  });

  describe("getPosition", () => {
    it("should return position for a user", () => {
      exchange.addBalance("seller1", 1000, "USD");
      exchange.addBalance("buyer1", 1000, "USD");
      exchange.createOrder("LIMIT", "SELL", "SOLUSD", 5, "seller1", 100, "ISOLATED", 20);
      exchange.createOrder("LIMIT", "BUY", "SOLUSD", 5, "buyer1", 100, "ISOLATED", 20);
      const pos = exchange.getPosition("buyer1", "SOLUSD");
      expect(pos).toBeDefined();
      expect(pos!.type).toBe("LONG");
    });
  });

  describe("handleIndexPriceUpdate", () => {
    it("should handle index price update", () => {
      exchange.addBalance("user1", 1000, "USD");
      exchange.handleIndexPriceUpdate({ symbol: "SOLUSD", newPrice: 20 });
    });
  });

  describe("handleFunding", () => {
    it("should handle funding without errors", () => {
      exchange.addBalance("user1", 1000, "USD");
      exchange.handleIndexPriceUpdate({ symbol: "SOLUSD", newPrice: 20 });
      exchange.handleFunding();
    });
  });

  describe("getSnapshot / loadSnapshot", () => {
    it("should roundtrip snapshot correctly", () => {
      exchange.addBalance("user1", 1000, "USD");
      exchange.createOrder("LIMIT", "BUY", "SOLUSD", 5, "user1", 100, "ISOLATED", 20);
      const snapshot = exchange.getSnapshot();
      const newBus = new EventBus();
      const newExchange = new Exchange(newBus);
      newExchange.loadSnapshot(snapshot);
      expect(newExchange.getBalance("user1", "USD")).toBe(900);
      expect(newExchange.getDepth("SOLUSD").BIDS).toHaveLength(1);
    });
  });
});
