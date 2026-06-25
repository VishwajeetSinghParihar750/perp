import type {
  EngineRequest,
  EngineResponse,
  EngineResponsePayload,
} from "@repo/shared-types";

import type { Result } from "../types.js";

import CreateOrderHandler from "../application/createOrderHandler.js";
import AddBalanceHandler from "../application/addBalanceHandler.js";
import GetBalanceHandler from "../application/getBalanceHandler.js";
import GetDepthHandler from "../application/getDepthHandler.js";
import CancelOrderHandler from "../application/cancelOrderHandler.js";
import GetPositionHandler from "../application/getPositionHandler.js";
import SubscribeEventHandler from "../application/subscribeEventHandler.js";
import UnsubscribeEventHandler from "../application/unsubscribeEventHandler.js";
import { assert } from "node:console";
import IndexPriceUpdateHandler from "../application/indexPriceHandler.js";
import type FundingHandler from "../application/fundingHandler.js";

export type RequestHandlerDeps = {
  createOrderHandler: CreateOrderHandler;
  cancelOrderHandler: CancelOrderHandler;
  addBalanceHandler: AddBalanceHandler;
  getBalanceHandler: GetBalanceHandler;
  getDepthHandler: GetDepthHandler;
  getPositionHandler: GetPositionHandler;
  subscribeEventHandler: SubscribeEventHandler;
  unsubscribeEventHandler: UnsubscribeEventHandler;
  indexPriceUpdateHandler: IndexPriceUpdateHandler;
  fundingHandler: FundingHandler;
};

export default class RequestHandler {
  private deps: RequestHandlerDeps | undefined;

  setDeps(deps: RequestHandlerDeps) {
    this.deps = deps;
  }

  private responseHelper(
    req: EngineRequest.ENGINE_REQUEST,
    res: Result<EngineResponsePayload.ENGINE_RESPONSE_PAYLOAD>,
    type: EngineResponse.RESPONSE_TYPE,
  ): EngineResponse.ENGINE_RESPONSE {
    if (!res.success) {
      return {
        type: "error",
        payload: res.error.message,
        requestId: (req as any).requestId,
      };
    }

    return {
      type,
      payload: res.value,
      requestId: (req as any).requestId,
    } as any;
  }

  handleRequest(
    request: EngineRequest.ENGINE_REQUEST | EngineRequest.ENGINE_INFO_REQUEST,
  ): EngineResponse.ENGINE_RESPONSE | undefined {
    assert(!this.deps, "dependencies are still undefined");

    switch (request.type) {
      case "create_order": {
        const req = request as EngineRequest.CREATE_ORDER_REQUEST;

        const res = this.deps!.createOrderHandler.handle({
          ...req.payload,
          quantity: req.payload.qty,
        });

        return this.responseHelper(req, res, "order_created");
      }

      case "cancel_order": {
        const req = request as EngineRequest.CANCEL_ORDER_REQUEST;

        const res = this.deps!.cancelOrderHandler.handle({
          ...req.payload,
        });

        return this.responseHelper(req, res, "order_cancelled");
      }

      case "add_balance": {
        const req = request as EngineRequest.ADD_BALANCE_REQUEST;

        const res = this.deps!.addBalanceHandler.handle({
          ...req.payload,
        });

        return this.responseHelper(req, res, "balance_updated");
      }

      case "get_balance": {
        const req = request as EngineRequest.GET_BALANCE_REQUEST;

        const res = this.deps!.getBalanceHandler.handle({
          ...req.payload,
        });

        return this.responseHelper(req, res, "balance");
      }

      case "get_depth": {
        const req = request as EngineRequest.GET_DEPTH_REQUEST;

        const res = this.deps!.getDepthHandler.handle({
          ...req.payload,
        });

        return this.responseHelper(req, res, "depth");
      }

      case "get_position": {
        const req = request as EngineRequest.GET_POSITION_REQUEST;

        const res = this.deps!.getPositionHandler.handle({
          ...req.payload,
        });

        return this.responseHelper(req, res, "position");
      }

      case "subscribe_event": {
        const req = request as EngineRequest.SUBSCRIBE_EVENT_REQUEST;

        const res = this.deps!.subscribeEventHandler.handle({
          ...req.payload,
          replyAddress: { redisStreamId: req.stream },
        });

        return this.responseHelper(req, res, "event_subscribed");
      }

      case "unsubscribe_event": {
        const req = request as EngineRequest.UNSUBSCRIBE_EVENT_REQUEST;

        const res = this.deps!.unsubscribeEventHandler.handle({
          ...req.payload,
          replyAddress: { redisStreamId: req.stream },
        });

        return this.responseHelper(req, res, "event_unsubscribed");
      }

      case "funding_created": {
        const req = request as EngineRequest.FUNDING_CREATED_REQUEST;

        this.deps!.fundingHandler.handle({ ...req.payload });
        return undefined;
      }

      case "indexprice_updated": {
        const req = request as EngineRequest.INDEX_PRICE_UDPATED_REQUEST;

        this.deps!.indexPriceUpdateHandler.handle({
          ...req.payload,
        });
        return undefined;
      }

      default:
        return this.responseHelper(
          request,
          {
            success: false,
            error: new Error("INVALID_REQUEST_TYPE"),
          },
          "error",
        );
    }
  }
}
