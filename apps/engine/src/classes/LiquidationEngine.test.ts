import { describe, it, expect, beforeEach } from "vitest";
import EventBus from "./EventBus.js";
import LiquidationEngine from "./LiquidationEngine.js";

describe("LiquidationEngine", () => {
  let eventBus: EventBus;
  let engine: LiquidationEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    engine = new LiquidationEngine(eventBus);
  });

  describe("getMarginRequired", () => {
    it("should calculate margin using price when provided", () => {
      const margin = engine.getMarginRequired({
        symbol: "SOLUSD", qty: 10, type: "LIMIT", side: "BUY", price: 20,
      });
      expect(margin).toBe(20);
    });

    it("should calculate margin using index price when no price", () => {
      engine.handleIndexPriceUpdate({ symbol: "SOLUSD", newPrice: 30 });
      const margin = engine.getMarginRequired({
        symbol: "SOLUSD", qty: 10, type: "MARKET", side: "BUY", price: undefined,
      });
      expect(margin).toBe(30);
    });

    it("should throw when no index price and no price given", () => {
      expect(() => engine.getMarginRequired({
        symbol: "SOLUSD", qty: 10, type: "MARKET", side: "BUY", price: undefined,
      })).toThrow();
    });
  });

  describe("handleIndexPriceUpdate", () => {
    it("should store the index price", () => {
      engine.handleIndexPriceUpdate({ symbol: "SOLUSD", newPrice: 25 });
      expect(engine.indexPrices["SOLUSD"]).toBe(25);
    });

    it("should emit indexprice.updated event", () => {
      let emitted: any = null;
      eventBus.on("indexprice.updated", (e) => { emitted = e; });
      engine.handleIndexPriceUpdate({ symbol: "SOLUSD", newPrice: 25 });
      expect(emitted).not.toBeNull();
      expect(emitted.data.price).toBe(25);
    });

    it("should return empty liquidations when no positions exist", () => {
      engine.handleIndexPriceUpdate({ symbol: "SOLUSD", newPrice: 20 });
      const result = engine.handleIndexPriceUpdate({ symbol: "SOLUSD", newPrice: 25 });
      expect(result.toLiquidatePositions).toHaveLength(0);
    });
  });

  describe("applyPositionUpdates", () => {
    it("should add a position to tracking", () => {
      engine.handleIndexPriceUpdate({ symbol: "SOLUSD", newPrice: 20 });
      const position = {
        positionId: "pos1",
        userId: "user1",
        price: 20,
        qty: 10,
        type: "LONG" as const,
        symbol: "SOLUSD" as const,
        createdAt: new Date().toISOString(),
        margin: 100,
        marginType: "ISOLATED" as const,
      };
      engine.applyPositionUpdates({ user1: { SOLUSD: position } });
    });
  });

  describe("getSnapshot / loadSnapshot", () => {
    it("should roundtrip snapshot", () => {
      engine.handleIndexPriceUpdate({ symbol: "SOLUSD", newPrice: 20 });
      const snapshot = engine.getSnapshot();
      const newBus = new EventBus();
      const newEngine = new LiquidationEngine(newBus);
      newEngine.loadSnapshot(snapshot);
      expect(newEngine.indexPrices["SOLUSD"]).toBe(20);
    });
  });
});
