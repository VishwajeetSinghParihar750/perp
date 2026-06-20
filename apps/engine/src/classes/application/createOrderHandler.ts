import type { EngineTypes } from "@repo/shared-types";
import type RiskEngine from "../domain/riskEngine.js";
import type Orderbook from "../domain/orderbook.js";
import type Account from "../domain/account.js";
import type { Order } from "../domain/order.js";
import { OrderFactory } from "../domain/order.js";
import type { Result } from "../domain/account.js";

export interface CreateOrderCommand {
  userId: EngineTypes.USER_ID;
  price: EngineTypes.PRICE;
  quantity: EngineTypes.QUANTITY;
  margin: EngineTypes.PRICE;
  marketSymbol: EngineTypes.TRADABLE_SYMBOL;
  side: EngineTypes.SIDE;
  type: EngineTypes.TYPE;
  marginType: EngineTypes.MARGIN_TYPE;
}

export default class CreateOrderHandler {
  private riskEngine: RiskEngine;
  private orderbook: Orderbook;
  private account: Account;
  private orderFactory: OrderFactory;

  constructor(
    orderFactory: OrderFactory,
    riskEngine: RiskEngine,
    orderbook: Orderbook,
    account: Account,
  ) {
    this.riskEngine = riskEngine;
    this.orderbook = orderbook;
    this.account = account;
    this.orderFactory = orderFactory;
  }

  private commandToOrder(command: CreateOrderCommand): Order {
    return this.orderFactory.create(
      command.userId,
      command.price,
      command.quantity,
      command.margin,
      command.marketSymbol,
      command.side,
      command.type,
      command.marginType,
    );
  }

  handle(command: CreateOrderCommand): Result<Order> {
    const order = this.commandToOrder(command);

    // check preconditions
    const evaluateRes = this.riskEngine.evaluateOrder(order);
    if (!evaluateRes.success) {
      return { success: false, error: evaluateRes.error };
    }

    const lockRes = this.account.lockBalance(order.userId, order.margin);
    if (!lockRes.success) {
      return { success: false, error: lockRes.error };
    }

    const placedOrder = this.orderbook.placeOrder(order);
    return { success: true, value: placedOrder };
  }
}
