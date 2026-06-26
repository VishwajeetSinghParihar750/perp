import type { EngineTypes } from "@repo/shared-types";
import type RiskEngine from "../domain/riskEngine.js";
import type Orderbook from "../domain/orderbook.js";
import type Account from "../domain/account.js";
import type { Order } from "../domain/order.js";
import { OrderFactory } from "../domain/order.js";
import type { Result } from "../types.js";
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

    console.log("[CREATE_ORDER] Placing order", {
      orderId: order.orderId,
      userId: order.userId,
      marketSymbol: order.marketSymbol,
      side: order.side,
      type: order.type,
      price: order.price,
      quantity: order.quantity,
      margin: order.margin,
    });

    // check preconditions
    const positionRes = this.positionManager.getPosition(
      order.userId,
      order.marketSymbol,
    );
    let position: Position | undefined = undefined;
    if (positionRes.success)
      position = positionRes.value.positions[order.marketSymbol];

    const evaluateRes = this.riskEngine.evaluateOrder(order, position);
    if (!evaluateRes.success) {
      console.warn("[CREATE_ORDER] Risk check failed", {
        orderId: order.orderId,
        error: evaluateRes.error.message,
      });
      return { success: false, error: evaluateRes.error };
    }

    const lockRes = this.account.lockBalance(order.userId, order.margin);
    if (!lockRes.success) {
      console.warn("[CREATE_ORDER] Balance lock failed", {
        orderId: order.orderId,
        userId: order.userId,
        margin: order.margin,
        error: lockRes.error.message,
      });
      return { success: false, error: lockRes.error };
    }

    const placedOrder = this.orderbook.placeOrder(order);
    console.log("[CREATE_ORDER] Order placed", {
      orderId: placedOrder.orderId,
      status: placedOrder.status,
    });
    return { success: true, value: placedOrder };
  }
}
