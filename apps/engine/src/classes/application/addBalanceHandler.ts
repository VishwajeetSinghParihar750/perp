import type { EngineTypes } from "@repo/shared-types";
import type Account from "../domain/account.js";
import type { BALANCE, Result } from "../domain/account.js";

export interface AddBalanceCommand {
  userId: EngineTypes.USER_ID;
  amount: EngineTypes.QUANTITY;
}

export default class AddBalanceHandler {
  private account: Account;

  constructor(account: Account) {
    this.account = account;
  }

  handle(command: AddBalanceCommand): Result<BALANCE> {
    return this.account.addBalance(command.userId, command.amount);
  }
}
