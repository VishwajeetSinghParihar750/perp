import type {
  EngineRequest,
  EngineResponse,
  EngineResponsePayload,
} from "@repo/shared-types";
import CreateOrderHandler from "../application/createOrderHandler.js";

import RiskEngine from "../domain/riskEngine.js";
import { OrderFactory } from "../domain/order.js";
import Account from "../domain/account.js";
import Market from "../domain/market.js";
import EventBus from "../domain/eventBus.js";
import Orderbook from "../domain/orderbook.js";
import { TradeFactory } from "../domain/trade.js";
import type { Result } from "../types.js";
import AddBalanceHandler from "../application/addBalanceHandler.js";
import PositionManager from "../domain/positionManager.js";
import GetBalanceHandler from "../application/getBalanceHandler.js";
import GetDepthHandler from "../application/getDepthHandler.js";
import CancelOrderHandler from "../application/cancelOrderHandler.js";
import GetPositionHandler from "../application/getPositionHandler.js";

const eventBus = new EventBus();
const account = new Account(eventBus);

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
const getDepthHandler = new GetDepthHandler(orderbook);
const cancelOrderHandler = new CancelOrderHandler(orderbook);

const positionManager = new PositionManager(eventBus, riskEngine);
const getPositionHandler = new GetPositionHandler(positionManager);

const responseHelper = (
  req: EngineRequest.ENGINE_REQUEST,
  res: Result<EngineResponsePayload.ENGINE_RESPONSE_PAYLOAD>,
  type: EngineResponse.RESPONSE_TYPE,
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
  } as any;
};

const requestHandler = (
  request: EngineRequest.ENGINE_REQUEST,
): EngineResponse.ENGINE_RESPONSE => {
  switch (request.type) {
    case "create_order": {
      let req = request as EngineRequest.CREATE_ORDER_REQUEST;

      let res = createOrderHandler.handle({
        ...req.payload,
        quantity: req.payload.qty,
      });
      return responseHelper(req, res, "order_created");
    }
    case "cancel_order": {
      let req = request as EngineRequest.CANCEL_ORDER_REQUEST;

      let res = cancelOrderHandler.handle({
        ...req.payload,
      });
      return responseHelper(req, res, "order_cancelled");
    }

    case "add_balance": {
      let req = request as EngineRequest.ADD_BALANCE_REQUEST;
      let res = addBalanceHandler.handle({
        ...req.payload,
      });
      return responseHelper(req, res, "balance_updated");
    }

    case "get_balance": {
      let req = request as EngineRequest.GET_BALANCE_REQUEST;
      let res = getBalanceHandler.handle({ ...req.payload });
      return responseHelper(req, res, "balance");
    }

    case "get_depth": {
      let req = request as EngineRequest.GET_DEPTH_REQUEST;
      let res = getDepthHandler.handle({
        ...req.payload,
      });
      return responseHelper(req, res, "depth");
    }

    case "get_position": {
      let req = request as EngineRequest.GET_POSITION_REQUEST;
      let res = getPositionHandler.handle({ ...req.payload });

      return responseHelper(req, res, "position");
    }

    case "subscribe_event": {
      //
    }
    case "unsubscribe_event": {
      //
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
