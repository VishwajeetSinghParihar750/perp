import type { EngineTypes } from "@repo/shared-types";
import type RiskEngine from "../domain/riskEngine.js";
import type Orderbook from "../domain/orderbook.js";
import type Account from "../domain/account.js";
import type { Order } from "../domain/order.js";
import { OrderFactory } from "../domain/order.js";
import type { Result } from "../domain/account.js";
import type PositionManager from "../domain/positionManager.js";
import type { Position } from "../domain/position.js";

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
  private positionManager: PositionManager;

  constructor(
    orderFactory: OrderFactory,
    riskEngine: RiskEngine,
    orderbook: Orderbook,
    account: Account,
    positionManager: PositionManager,
  ) {
    this.riskEngine = riskEngine;
    this.orderbook = orderbook;
    this.account = account;
    this.orderFactory = orderFactory;
    this.positionManager = positionManager;
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
    const positionRes = this.positionManager.getPosition(
      order.userId,
      order.marketSymbol,
    );
    let position: Position | undefined = undefined;
    if (positionRes.success) position = positionRes.value[order.marketSymbol];

    const evaluateRes = this.riskEngine.evaluateOrder(order, position);
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
