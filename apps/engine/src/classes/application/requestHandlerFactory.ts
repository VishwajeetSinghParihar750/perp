import type { EngineRequest, EngineResponse } from "@repo/shared-types";
import CreateOrderHandler from "./createOrderHandler.js";

import RiskEngine from "../domain/riskEngine.js";
import { OrderFactory } from "../domain/order.js";
import Account from "../domain/account.js";
import Market from "../domain/market.js";
import EventBus from "../domain/eventBus.js";
import Orderbook from "../domain/orderbook.js";
import { TradeFactory } from "../domain/trade.js";
import type { Result } from "../types.js";
import AddBalanceHandler from "./addBalanceHandler.js";

const eventBus = new EventBus();
const account = new Account(eventBus);

// get index price first
const market = new Market(eventBus);
const riskEngine = new RiskEngine(account, market);

const orderFactory = new OrderFactory();

const tradeFactory = new TradeFactory();
const orderbook = new Orderbook(riskEngine, tradeFactory, eventBus);

const createOrderHandler = new CreateOrderHandler(
  orderFactory,
  riskEngine,
  orderbook,
  account,
);
const addBalanceHandler = new AddBalanceHandler(account);

const responseHelper = (
  req: EngineRequest.ENGINE_REQUEST,
  res: Result<any>,
): EngineResponse.ENGINE_RESPONSE => {
  if (!res.success)
    return {
      type: "error",
      payload: res.error.message,
      requestId: (req as any).requestId,
    };

  return {
    type: "order_created",
    payload: res.value,
    requestId: (req as any).requestId,
  };
};

const requestHandler = (
  request: EngineRequest.ENGINE_REQUEST,
): EngineResponse.ENGINE_RESPONSE => {
  switch (request.type) {
    case "create_order": {
      let req = request as EngineRequest.CREATE_ORDER_REQUEST;

      let res = createOrderHandler.handle({
        ...req.payload,
        marketId: req.payload.symbol,
        quantity: req.payload.qty,
      });
      return responseHelper(req, res);
    }

    case "add_balance": {
      let req = request as EngineRequest.ADD_BALANCE_REQUEST;
      let res = addBalanceHandler.handle({
        amount: req.payload.amount,
        userId: req.payload.userId,
      });
      return responseHelper(req, res);
    }
    default:
      return responseHelper(request, {
        success: false,
        error: new Error("INVALID_REQUEST_TYPE"),
      });
  }
};

export default requestHandler;
