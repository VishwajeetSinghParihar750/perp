import "dotenv/config";
import z from "zod";
import { createClient, type RedisClientType } from "redis";
import EventBus from "./EventBus.js";
import Exchange from "./Exchange.js";
import { EngineRequest, EngineResponse } from "@repo/shared-engine-types";

import EventPublisher from "./EventPublisher.js";
import MarkPriceObserver from "./MarkPriceObserver.js";
import SnapshotManager from "./SnapshotManger.js";
import type { FILLS_INFO } from "../types/order.js";

type ENGINE_INFO_REQUEST_TYPE = "markprice_updated";

class EngineServer {
  private redisClient: RedisClientType;
  private exchange: Exchange;
  private eventBus: EventBus;
  private eventPublisher: EventPublisher;
  private markpPriceObserver: MarkPriceObserver;
  private snapshotManager: SnapshotManager;

  async handleClientRequsts(
    redisClient: RedisClientType,
    lastRedisMessageId: string,
  ) {
    // getting connected client

    const xReadResponse = await redisClient.xRead(
      [
        {
          id: lastRedisMessageId,
          key: process.env.REDIS_ENGINE_STREAM!,
        },
      ],
      { BLOCK: 0, COUNT: 100 },
    );

    console.log(xReadResponse);
    if (xReadResponse) {
      for (let perStreamRespone of xReadResponse) {
        if (perStreamRespone.name == process.env.REDIS_ENGINE_STREAM) {
          for (let { id, message } of perStreamRespone.messages) {
            try {
              // json parsing
              let request: EngineRequest.ENGINE_REQUEST = JSON.parse(
                message.data!,
              );

              // zod validation
              EngineRequest.ENGINE_REQUEST_SCHEMA.parse(request);

              // here switch based on info types
              if (request.type == "markprice_updated") {
                this.handleEngineInfoRequest(request);
              } else {
                // here sned to request handler
                let result = this.handleEngineRequest(request);
                // send back this result
                await redisClient.xAdd(request.stream, "*", {
                  data: JSON.stringify(result),
                });
              }
            } catch (error) {
              console.log(
                "error happened in parsin request, so ignoring requset handling ",
                message.data,
              );
            }

            lastRedisMessageId = id;
          }
        }
      }
    }

    this.snapshotManager.setLastRedisMessageId(lastRedisMessageId);
    // then wait again
    this.handleClientRequsts(redisClient, lastRedisMessageId);
  }

  async initialize() {
    let lastRedisMessageId = this.snapshotManager.initialize(this.exchange);

    await this.eventPublisher.initialize();
    await this.markpPriceObserver.initialize();

    let dupClient = this.redisClient.duplicate();
    await dupClient.connect();
    this.handleClientRequsts(dupClient, lastRedisMessageId);
  }

  constructor() {
    this.eventBus = new EventBus();
    this.snapshotManager = new SnapshotManager();
    this.redisClient = createClient({ url: process.env.REDIS_URL! });
    this.exchange = new Exchange(this.eventBus);
    this.eventPublisher = new EventPublisher(
      this.eventBus,
      this.redisClient.duplicate(),
    );
    this.markpPriceObserver = new MarkPriceObserver(
      this.redisClient.duplicate(),
    );
  }

  private handleSubscribeEventRequest = (
    engineRequest: EngineRequest.SUBSCRIBE_EVENT_REQUEST,
  ): EngineResponse.ENGINE_RESPONSE => {
    try {
      const { events } = engineRequest.payload;

      events.forEach((event) =>
        this.eventPublisher.subscribeEvent(event, engineRequest.stream),
      );
      return {
        requestId: engineRequest.requestId,
        type: "event_subscribed",
      };
    } catch (error) {
      return {
        requestId: engineRequest.requestId,
        type: "error",
        payload: (error as Error).message,
      };
    }
  };

  private handleUnsubscribeEventRequest = (
    engineRequest: EngineRequest.UNSUBSCRIBE_EVENT_REQUEST,
  ): EngineResponse.ENGINE_RESPONSE => {
    try {
      const { events } = engineRequest.payload;

      events.forEach((event) =>
        this.eventPublisher.unsubscribeEvent(event, engineRequest.stream),
      );
      return {
        requestId: engineRequest.requestId,
        type: "event_unsubscribed",
      };
    } catch (error) {
      return {
        requestId: engineRequest.requestId,
        type: "error",
        payload: (error as Error).message,
      };
    }
  };

  private handleGetDepthRequest = (
    engineRequest: EngineRequest.GET_DEPTH_REQUEST,
  ): EngineResponse.ENGINE_RESPONSE => {
    try {
      let { symbol } = engineRequest.payload;
      let depth = this.exchange.getDepth(symbol);
      return {
        requestId: engineRequest.requestId,
        type: "depth",
        payload: depth,
      };
    } catch (error) {
      return {
        requestId: engineRequest.requestId,
        type: "error",
        payload: (error as Error).message,
      };
    }
  };

  private handleGetBalanceRequest = (
    engineRequest: EngineRequest.GET_BALANCE_REQUEST,
  ): EngineResponse.ENGINE_RESPONSE => {
    const { userId, symbol } = engineRequest.payload;
    try {
      let balance = this.exchange.getBalance(userId, symbol);
      return {
        requestId: engineRequest.requestId,
        type: "balance",
        payload: balance,
      };
    } catch (error) {
      return {
        requestId: engineRequest.requestId,
        type: "error",
        payload: (error as Error).message,
      };
    }
  };

  private handleCancelOrderRequest = (
    engineRequest: EngineRequest.CANCEL_ORDER_REQUEST,
  ): EngineResponse.ENGINE_RESPONSE => {
    try {
      let { orderId } = engineRequest.payload;
      let { status } = this.exchange.cancelOrder(orderId);

      if (status != "CANCELLED") throw new Error(status);

      return { requestId: engineRequest.requestId, type: "order_cancelled" };
    } catch (error) {
      return {
        requestId: engineRequest.requestId,
        type: "error",
        payload: (error as Error).message,
      };
    }
  };

  private handleCreateOrderRequest = (
    engineRequest: EngineRequest.CREATE_ORDER_REQUEST,
  ): EngineResponse.ENGINE_RESPONSE => {
    try {
      let { type, side, price, qty, symbol, userId, margin, marginType } =
        engineRequest.payload;
      let res = this.exchange.createOrder(
        type,
        side,
        symbol,
        qty,
        userId,
        margin,
        marginType,
        price,
      );
      let { status } = res;
      if (status == "REJECTED")
        return {
          requestId: engineRequest.requestId,
          type: "error",
          payload: "ORDER_REJECTED",
        };

      let { fills, orderId } = res as {
        status: "OPEN" | "FILLED";
        orderId: string;
        fills: FILLS_INFO;
      };

      return {
        requestId: engineRequest.requestId,
        type: "order_created",
        payload: { status, fills, orderId },
      };
    } catch (error) {
      return {
        requestId: engineRequest.requestId,
        type: "error",
        payload: (error as Error).message,
      };
    }
  };

  private handleAddBalanceRequest = (
    engineRequest: EngineRequest.ADD_BALANCE_REQUEST,
  ): EngineResponse.ENGINE_RESPONSE => {
    try {
      const { amount, symbol, userId } = engineRequest.payload;

      this.exchange.addBalance(userId, amount, symbol);

      return { requestId: engineRequest.requestId, type: "balance_updated" };
    } catch (error) {
      return {
        requestId: engineRequest.requestId,
        type: "error",
        payload: (error as Error).message,
      };
    }
  };

  private handleUpdateMarkPriceRequest = (
    engineRequest: EngineRequest.MARK_PRICE_UDPATED_REQUEST,
  ) => {
    try {
      let { price, symbol } = engineRequest.payload;

      this.exchange.handleMarkPriceUpdate({ newPrice: +price, symbol });
    } catch (error) {
      console.error("error in hanlding mark price update ", error);
    }
  };

  private handleGetPositonRequest = (
    engineRequest: EngineRequest.GET_POSITION_REQUEST,
  ): EngineResponse.ENGINE_RESPONSE => {
    try {
      let { userId, symbol } = engineRequest.payload;
      //
      let payload = this.exchange.getPosition(userId, symbol);

      return { requestId: engineRequest.requestId, type: "position", payload };
    } catch (error) {
      return {
        requestId: engineRequest.requestId,
        type: "error",
        payload: (error as Error).message,
      };
    }
  };

  private handleGetOrderbookRequest = (
    engineRequest: EngineRequest.GET_ORDERBOOK_REQUEST,
  ): EngineResponse.ENGINE_RESPONSE => {
    try {
      let { symbol } = engineRequest.payload;

      //
      let payload = this.exchange.getOrderbookSnapshot(symbol);

      return { requestId: engineRequest.requestId, type: "orderbook", payload };
    } catch (error) {
      return {
        requestId: engineRequest.requestId,
        type: "error",
        payload: (error as Error).message,
      };
    }
  };

  private handleEngineRequest = (
    engineRequest: EngineRequest.ENGINE_REQUEST_FROM_BACKEND,
  ): EngineResponse.ENGINE_RESPONSE => {
    let { success, data } =
      EngineRequest.ENGINE_REQUEST_SCHEMA.safeParse(engineRequest);

    if (!success && "requestId" in engineRequest) {
      return {
        type: "error",
        requestId: engineRequest.requestId,
        payload: "INVALID_REQUEST_FORMAT",
      };
    }

    let response;
    switch (engineRequest.type) {
      case "add_balance":
        response = this.handleAddBalanceRequest(engineRequest);
        break;
      case "get_position":
        response = this.handleGetPositonRequest(engineRequest);
        break;
      case "get_orderbook":
        response = this.handleGetOrderbookRequest(engineRequest);
        break;
      case "cancel_order":
        response = this.handleCancelOrderRequest(engineRequest);
        break;

      case "create_order":
        response = this.handleCreateOrderRequest(engineRequest);
        break;
      case "get_balance":
        response = this.handleGetBalanceRequest(engineRequest);
        break;
      case "get_depth":
        response = this.handleGetDepthRequest(engineRequest);
        break;
      case "subscribe_event":
        response = this.handleSubscribeEventRequest(engineRequest);
        break;
      case "unsubscribe_event":
        response = this.handleUnsubscribeEventRequest(engineRequest);
        break;

      default:
        throw new Error("invalid engine request type ");
    }

    return response;
  };

  private handleEngineInfoRequest = (
    engineRequest: EngineRequest.ENGINE_INFO_REQUEST,
  ) => {
    switch (engineRequest.type) {
      case "markprice_updated":
        this.handleUpdateMarkPriceRequest(engineRequest);
        break;
      default:
        throw new Error("invalid engine request type ");
    }
  };
}

export default EngineServer;
