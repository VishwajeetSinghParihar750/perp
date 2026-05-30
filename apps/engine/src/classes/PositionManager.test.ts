import { describe, it, expect, beforeEach } from "vitest";
import PositionManager from "./PositionManager.js";
import type { FILLS_INFO } from "../types/order.js";

function makeFill(overrides: Record<string, any> = {}): any {
  return {
    fillId: "f1",
    symbol: "SOLUSD",
    qty: 5,
    price: 20,
    bidPrice: 20,
    buyOrderInfo: {
      buyerId: "buyer1",
      orderId: "o1",
      totalQty: 5,
      orderStatus: "FILLED",
      filledQty: 5,
      margin: 50,
      marginType: "ISOLATED",
    },
    sellOrderInfo: {
      sellerId: "seller1",
      orderId: "o2",
      totalQty: 5,
      orderStatus: "FILLED",
      filledQty: 5,
      margin: 50,
      marginType: "ISOLATED",
    },
    ...overrides,
  };
}

describe("PositionManager", () => {
  let pm: PositionManager;

  beforeEach(() => {
    pm = new PositionManager();
  });

  describe("applyFills", () => {
    it("should create a LONG position for the buyer", () => {
      const fills: FILLS_INFO = [makeFill()];
      const result = pm.applyFills(fills);
      expect(result.positionUpdates).toBeDefined();
      const position = pm.getPosition("buyer1", "SOLUSD");
      expect(position).toBeDefined();
      expect(position!.type).toBe("LONG");
      expect(position!.qty).toBe(5);
    });

    it("should create a SHORT position for the seller", () => {
      const fills: FILLS_INFO = [makeFill()];
      pm.applyFills(fills);
      const position = pm.getPosition("seller1", "SOLUSD");
      expect(position).toBeDefined();
      expect(position!.type).toBe("SHORT");
      expect(position!.qty).toBe(5);
    });

    it("should increase position size on same-direction fill", () => {
      const fills: FILLS_INFO = [makeFill()];
      pm.applyFills(fills);
      const fills2: FILLS_INFO = [
        makeFill({
          qty: 3,
          buyOrderInfo: {
            buyerId: "buyer1",
            orderId: "o3",
            totalQty: 3,
            orderStatus: "FILLED",
            filledQty: 3,
            margin: 30,
            marginType: "ISOLATED",
          },
          sellOrderInfo: {
            sellerId: "seller2",
            orderId: "o4",
            totalQty: 3,
            orderStatus: "FILLED",
            filledQty: 3,
            margin: 30,
            marginType: "ISOLATED",
          },
        }),
      ];
      pm.applyFills(fills2);
      const position = pm.getPosition("buyer1", "SOLUSD");
      expect(position!.qty).toBe(8);
    });

    it("should reduce position size on opposite-direction fill", () => {
      const fills: FILLS_INFO = [makeFill()];
      pm.applyFills(fills);
      const fills2: FILLS_INFO = [
        makeFill({
          qty: 3,
          price: 25,
          buyOrderInfo: {
            buyerId: "seller1",
            orderId: "o3",
            totalQty: 3,
            orderStatus: "FILLED",
            filledQty: 3,
            margin: 30,
            marginType: "ISOLATED",
          },
          sellOrderInfo: {
            sellerId: "buyer1",
            orderId: "o4",
            totalQty: 3,
            orderStatus: "FILLED",
            filledQty: 3,
            margin: 30,
            marginType: "ISOLATED",
          },
          symbol: "SOLUSD",
        }),
      ];
      pm.applyFills(fills2);
      const position = pm.getPosition("buyer1", "SOLUSD");
      expect(position!.qty).toBe(2);
    });

    it("should close position when qty reaches 0 and return PnL", () => {
      const fills: FILLS_INFO = [makeFill()];
      pm.applyFills(fills);
      const fills2: FILLS_INFO = [
        makeFill({
          qty: 5,
          price: 25,
          buyOrderInfo: {
            buyerId: "seller1",
            orderId: "o3",
            totalQty: 5,
            orderStatus: "FILLED",
            filledQty: 5,
            margin: 50,
            marginType: "ISOLATED",
          },
          sellOrderInfo: {
            sellerId: "buyer1",
            orderId: "o4",
            totalQty: 5,
            orderStatus: "FILLED",
            filledQty: 5,
            margin: 50,
            marginType: "ISOLATED",
          },
        }),
      ];
      const result = pm.applyFills(fills2);
      const position = pm.getPosition("buyer1", "SOLUSD");
      expect(position).toBeUndefined();
      expect(result.pnlUpdates.buyer1).toBe(25);
    });

    it("should return correct PnL for profitable close", () => {
      const fills: FILLS_INFO = [makeFill()];
      pm.applyFills(fills);
      const fills2: FILLS_INFO = [
        makeFill({
          qty: 5,
          price: 25,
          buyOrderInfo: {
            buyerId: "seller1",
            orderId: "o3",
            totalQty: 5,
            orderStatus: "FILLED",
            filledQty: 5,
            margin: 50,
            marginType: "ISOLATED",
          },
          sellOrderInfo: {
            sellerId: "buyer1",
            orderId: "o4",
            totalQty: 5,
            orderStatus: "FILLED",
            filledQty: 5,
            margin: 50,
            marginType: "ISOLATED",
          },
        }),
      ];
      const result = pm.applyFills(fills2);
      expect(result.pnlUpdates.buyer1).toBeGreaterThan(0);
    });
  });

  describe("applyFunding", () => {
    it("should apply funding rate to positions", () => {
      const fills: FILLS_INFO = [makeFill()];
      pm.applyFills(fills);
      const result = pm.applyFunding({ SOLUSD: 0.001 });
      const position = pm.getPosition("buyer1", "SOLUSD");
      expect(position).toBeDefined();
    });

    it("should not modify positions when no funding rate", () => {
      const fills: FILLS_INFO = [makeFill()];
      pm.applyFills(fills);
      const positionBefore = pm.getPosition("buyer1", "SOLUSD");
      pm.applyFunding({});
      const positionAfter = pm.getPosition("buyer1", "SOLUSD");
      expect(positionAfter!.qty).toBe(positionBefore!.qty);
    });
  });

  describe("performAdl", () => {
    it("should perform auto-deleveraging", () => {
      const fills: FILLS_INFO = [makeFill()];
      pm.applyFills(fills);
      const position = pm.getPosition("buyer1", "SOLUSD")!;
      const result = pm.performAdl(position, 20);
      expect(result.usersPnl).toBeDefined();
      expect(result.positionUpdates).toBeDefined();
    });
  });

  describe("getSnapshot / loadSnapshot", () => {
    it("should roundtrip snapshot correctly", () => {
      const fills: FILLS_INFO = [makeFill()];
      pm.applyFills(fills);
      const snapshot = pm.getSnapshot();
      const newPm = new PositionManager();
      newPm.loadSnapshot(snapshot);
      expect(newPm.getPosition("buyer1", "SOLUSD")!.qty).toBe(5);
    });
  });
});
