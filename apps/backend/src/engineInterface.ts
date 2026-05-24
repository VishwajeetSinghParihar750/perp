import "dotenv/config";
import WebSocket from "ws";
import { redisClient as redisClientGlobal } from "@repo/db";
import type { RedisClientType } from "redis";
import { EngineRequest, EngineResponse, EngineEvent } from "@repo/shared-types";

import { sendMessageOnWebSocket } from "./ws/utils/messaging.js";

class EngineInterface {
  redisClient: RedisClientType;

  engineSubscriptions: Set<EngineEvent.ENGINE_EVENT_TYPE> = new Set();
  eventSubscriptions: Partial<
    Record<EngineEvent.ENGINE_EVENT_TYPE, Set<WebSocket>>
  > = {};

  // saving resolve, reject functions of promise
  pendingRequests: Record<string, [(data: any) => void, (data: any) => void]> =
    {};

  async subscribeEvent(
    eventType: EngineEvent.ENGINE_EVENT_TYPE,
    ws: WebSocket,
  ) {
    let res = await this.getEngineResponseForRequest({
      requestId: crypto.randomUUID(),
      stream: process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME!,
      type: "subscribe_event",
      payload: { events: [eventType] },
    });

    if (res.type == "error") throw new Error();

    if (!this.eventSubscriptions[eventType])
      this.eventSubscriptions[eventType] = new Set();

    this.eventSubscriptions[eventType].add(ws);
  }
  async unsubscribeEvent(
    eventType: EngineEvent.ENGINE_EVENT_TYPE,
    ws: WebSocket,
  ) {
    let res = await this.getEngineResponseForRequest({
      requestId: crypto.randomUUID(),
      stream: process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME!,
      type: "unsubscribe_event",
      payload: { events: [eventType] },
    });

    if (res.type == "error") throw new Error();

    this.eventSubscriptions[eventType]?.delete(ws);
  }

  private setupEventHandling = async () => {
    console.log("setup event subsciption handling");
    this.redisClient.on("error", (err) => {
      console.log("redis error : ", err);
    });

    await this.redisClient.connect();

    console.log("redis client connected ");

    let dupClient = this.redisClient.duplicate();
    await dupClient.connect();
    this.handleEngineMessages(dupClient); // for now just doing depth updates

    console.log("REDIS SUBSCRIPTION HANDLIKNG SETUP");
  };

  constructor() {
    this.redisClient = redisClientGlobal.duplicate();
  }

  initialize = async () => {
    console.log("INITIALIZING REDIS SUBSCRIPTION HANDLING");
    await this.setupEventHandling();
  };

  private broadcastEvent = (event: EngineEvent.ENGINE_EVENT) => {
    let { type } = event.payload;
    this.eventSubscriptions[type]?.forEach((ws) => {
      sendMessageOnWebSocket(ws, event);
    });
  };

  async handleEngineMessages(
    redisClient: RedisClientType,
    lastRedisMessageId = "$",
  ) {
    let xreadRes = await redisClient.xRead(
      [
        {
          id: lastRedisMessageId,
          key: process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME!,
        },
      ],
      { BLOCK: 0, COUNT: 100 },
    );
    if (xreadRes)
      for (let streamReadResponse of xreadRes) {
        for (const { id, message } of streamReadResponse.messages) {
          // it has a request id , means it was personal
          let gotRequestId = "";
          try {
            let response: EngineResponse.ENGINE_RESPONSE =
              EngineResponse.ENGINE_RESPONSE_SCHEMA.parse(
                JSON.parse(message.data!),
              );

            // zod validation
            EngineResponse.ENGINE_RESPONSE_SCHEMA.parse(response);

            let { type } = response;

            if ("requestId" in response) {
              let { requestId } = response;
              let payload = undefined;
              if ("payload" in response) payload = response.payload;

              if (type == "error")
                this.pendingRequests[requestId]?.[1]?.({ type, payload });
              else this.pendingRequests[requestId]?.[0]?.({ type, payload });

              delete this.pendingRequests[requestId];
            } else if (type == "event") {
              this.broadcastEvent(response);
            } else {
              // wtf
              console.error("why is xread res coming here");
            }
          } catch (error) {
            console.log("error in parsing engine message", error);
            this.pendingRequests[gotRequestId]?.[1]?.(error);
          }
          lastRedisMessageId = id;
        }
      }

    // here resolve the requests
    // maybe TODO :maybe even timeout the resolver after some minutes, reject after 5 min of waiting maybe

    this.handleEngineMessages(redisClient, lastRedisMessageId);
  }

  private sendEngineRequest = async (
    engineRequest: EngineRequest.ENGINE_REQUEST,
  ) => {
    let res = await this.redisClient.xAdd(
      process.env.REDIS_ENGINE_SEND_STREAM_NAME!,
      "*",
      {
        data: JSON.stringify(engineRequest),
      },
    );
    console.log("res", res);
  };

  getEngineResponseForRequest = async (
    engineRequest: EngineRequest.ENGINE_REQUEST_FROM_BACKEND,
  ): Promise<EngineResponse.ENGINE_RESPONSE> => {
    let promiseToReturn = new Promise<EngineResponse.ENGINE_RESPONSE>(
      (res, rej) => {
        this.pendingRequests[engineRequest.requestId] = [res, rej];
      },
    );
    await this.sendEngineRequest(engineRequest);
    return promiseToReturn;
  };
}

export default EngineInterface;
