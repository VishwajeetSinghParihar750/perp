import type { EngineTypes, EngineEventPayload } from "@repo/shared-types";
import EventBus from "./eventBus.js";
import { assert } from "node:console";
import type { Snapshotable } from "../infrastructure/snapshotManager.js";
import { type Result } from "../types.js";

type USER_ID = EngineTypes.USER_ID;

export type BALANCE = { balance: number; lockedBalance: number };

export type ACCOUNT_SNAPSHOT = {
  balances: [USER_ID, BALANCE][];
};

export default class Account implements Snapshotable<ACCOUNT_SNAPSHOT> {
  private balances: Map<USER_ID, BALANCE> = new Map();

  getSnapshot(): ACCOUNT_SNAPSHOT {
    return {
      balances: Array.from(this.balances.entries()),
    };
  }

  loadSnapshot(snapshot: ACCOUNT_SNAPSHOT) {
    this.balances = new Map(snapshot.balances);
  }

  constructor(eventBus: EventBus) {
    eventBus.on<"userpnl.created">("userpnl.created", (userPnl) => {
      this.handleUserPnl(userPnl);
    });
  }

  private handleUserPnl(
    userPnl: EngineEventPayload.USER_PNL_CREATED_EVENT_PAYLOAD,
  ) {
    const bal = this.getBalance(userPnl.data.userId);
    bal.balance += userPnl.data.pnl;
    bal.lockedBalance -= userPnl.data.releasedMargin;

    assert(bal.balance >= 0);
    assert(bal.lockedBalance >= 0);
  }

  getBalance(userId: USER_ID): BALANCE {
    let bal = this.balances.get(userId);
    if (!bal) {
      bal = { balance: 0, lockedBalance: 0 };
      this.balances.set(userId, bal);
    }
    return bal;
  }

  addBalance(userId: USER_ID, amount: number): Result<BALANCE> {
    const curBal = this.getBalance(userId);
    curBal.balance += amount;
    return { success: true, value: curBal };
  }

  removeBalance(userId: USER_ID, amount: number): Result<BALANCE> {
    const curBal = this.getBalance(userId);
    if (curBal.balance < amount) {
      return { success: false, error: new Error("INSUFFICIENT_BALANCE") };
    }

    curBal.balance -= amount;
    return { success: true, value: curBal };
  }

  lockBalance(userId: USER_ID, amount: number): Result<BALANCE> {
    const curBal = this.getBalance(userId);
    if (curBal.balance < amount) {
      return { success: false, error: new Error("INSUFFICIENT_BALANCE") };
    }

    curBal.balance -= amount;
    curBal.lockedBalance += amount;
    return { success: true, value: curBal };
  }

  unlockBalance(userId: USER_ID, amount: number): void {
    const curBal = this.getBalance(userId);
    if (curBal.lockedBalance < amount) {
      throw new Error("Assertion failed: lockedBalance < amount");
    }

    curBal.balance += amount;
    curBal.lockedBalance -= amount;
  }
}
