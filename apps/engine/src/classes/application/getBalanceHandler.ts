import type { EngineTypes } from "@repo/shared-types";
import type Account from "../domain/account.js";
import type { BALANCE, Result } from "../domain/account.js";

export interface GetBalanceCommand {
  userId: EngineTypes.USER_ID;
}

export default class GetBalanceHandler {
  private account: Account;

  constructor(account: Account) {
    this.account = account;
  }

  handle(command: GetBalanceCommand): Result<BALANCE> {
    return { success: true, value: this.account.getBalance(command.userId) };
  }
}
