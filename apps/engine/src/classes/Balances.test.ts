import { describe, it, expect, beforeEach } from "vitest";
import EventBus from "./EventBus.js";
import Balances from "./Balances.js";
import { InsufficientBalanceError } from "./Errors/Balances.js";

describe("Balances", () => {
  let eventBus: EventBus;
  let balances: Balances;

  beforeEach(() => {
    eventBus = new EventBus();
    balances = new Balances(eventBus);
  });

  describe("addBalance", () => {
    it("should set balance for a new user", () => {
      balances.addBalance("user1", "USD", 1000);
      expect(balances.getBalance("user1", "USD")).toBe(1000);
    });

    it("should increment balance for existing user", () => {
      balances.addBalance("user1", "USD", 1000);
      balances.addBalance("user1", "USD", 500);
      expect(balances.getBalance("user1", "USD")).toBe(1500);
    });
  });

  describe("removeBalance", () => {
    it("should decrement balance", () => {
      balances.addBalance("user1", "USD", 1000);
      balances.removeBalance("user1", "USD", 300);
      expect(balances.getBalance("user1", "USD")).toBe(700);
    });

    it("should throw InsufficientBalanceError when balance is too low", () => {
      balances.addBalance("user1", "USD", 100);
      expect(() => balances.removeBalance("user1", "USD", 200)).toThrow(InsufficientBalanceError);
    });

    it("should throw InsufficientBalanceError when no balance exists", () => {
      expect(() => balances.removeBalance("nonexistent", "USD", 1)).toThrow(InsufficientBalanceError);
    });
  });

  describe("getBalance", () => {
    it("should return 0 for unknown user", () => {
      expect(balances.getBalance("unknown", "USD")).toBe(0);
    });

    it("should return all balances when no symbol given", () => {
      balances.addBalance("user1", "USD", 100);
      expect(balances.getBalance("user1", undefined)).toEqual({ USD: 100 });
    });
  });

  describe("applyUsersPnl", () => {
    it("should add positive PnL to balance", () => {
      balances.addBalance("user1", "USD", 1000);
      balances.applyUsersPnl({ user1: 200 });
      expect(balances.getBalance("user1", "USD")).toBe(1200);
    });

    it("should subtract negative PnL from balance", () => {
      balances.addBalance("user1", "USD", 1000);
      balances.applyUsersPnl({ user1: -200 });
      expect(balances.getBalance("user1", "USD")).toBe(800);
    });

    it("should not let balance go below 0 on negative PnL", () => {
      balances.addBalance("user1", "USD", 50);
      balances.applyUsersPnl({ user1: -200 });
      expect(balances.getBalance("user1", "USD")).toBe(0);
    });
  });

  describe("account locking via events", () => {
    it("should lock and unlock accounts on liquidation events", () => {
      expect(balances.isAccountLocked("user1", "SOLUSD")).toBe(false);
      eventBus.emit({ type: "liquidation.started", data: { userId: "user1", symbol: "SOLUSD" } });
      expect(balances.isAccountLocked("user1", "SOLUSD")).toBe(true);
      eventBus.emit({ type: "liquidation.completed", data: { userId: "user1", symbol: "SOLUSD" } });
      expect(balances.isAccountLocked("user1", "SOLUSD")).toBe(false);
    });
  });

  describe("getSnapshot / loadSnapshot", () => {
    it("should roundtrip snapshot correctly", () => {
      balances.addBalance("user1", "USD", 1000);
      eventBus.emit({ type: "liquidation.started", data: { userId: "user1", symbol: "SOLUSD" } });
      const snapshot = balances.getSnapshot();
      const newBus = new EventBus();
      const newBalances = new Balances(newBus);
      newBalances.loadSnapshot(snapshot);
      expect(newBalances.getBalance("user1", "USD")).toBe(1000);
      expect(newBalances.isAccountLocked("user1", "SOLUSD")).toBe(true);
    });
  });
});
