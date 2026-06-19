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
import PositionManager from "../domain/positionManager.js";
import GetBalanceHandler from "./getBalanceHandler.js";

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
const getBalanceHandler = new GetBalanceHandler(account);

const positionManager = new PositionManager(eventBus, riskEngine);

const responseHelper = (
  req: EngineRequest.ENGINE_REQUEST,
  res: Result<any>,
  type: any,
): EngineResponse.ENGINE_RESPONSE => {
  if (!res.success)
    return {
      type: "error",
      payload: res.error.message,
      requestId: (req as any).requestId,
    };

  return {
    type,
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
      return responseHelper(req, res, "order_created");
    }

    case "add_balance": {
      let req = request as EngineRequest.ADD_BALANCE_REQUEST;
      let res = addBalanceHandler.handle({
        amount: req.payload.amount,
        userId: req.payload.userId,
      });
      return responseHelper(req, res, "balance_updated");
    }

    case "get_balance": {
      let req = request as EngineRequest.GET_BALANCE_REQUEST;
      let res = getBalanceHandler.handle({ userId: req.payload.userId });
      return responseHelper(req, res, "balance");
    }

    default:
      return responseHelper(
        request,
        {
          success: false,
          error: new Error("INVALID_REQUEST_TYPE"),
        },
        "error",
      );
  }
};

export default requestHandler;
