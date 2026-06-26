import "dotenv/config";
import WebSocket from "ws";
import { redisClient as redisClientGlobal } from "@repo/db";
import type { RedisClientType } from "@repo/db";
import {
  EngineRequest,
  EngineResponse,
  EngineEvent,
  EngineEventType,
} from "@repo/shared-types";

const PERSONAL_EVENT_TYPES = new Set<EngineEventType.ENGINE_EVENT_TYPE>(
  EngineEventType.PERSONAL_EVENT_TYPES,
);

import { sendMessageOnWebSocket } from "./ws/utils/messaging.js";

type EngineRequestResponse = Exclude<
  EngineResponse.ENGINE_RESPONSE,
  { type: "event" }
>;

class EngineInterface {
  redisClient: RedisClientType;

  engineSubscriptions: Set<EngineEventType.ENGINE_EVENT_TYPE> = new Set();
  eventSubscriptions: Partial<
    Record<EngineEventType.ENGINE_EVENT_TYPE, Set<WebSocket>>
  > = {};

  // userId -> their connected sockets, so personal events can be delivered
  // directly to the owning user instead of scanning every subscriber.
  userSockets: Map<string, Set<WebSocket>> = new Map();

  // saving resolve, reject functions of promise
  pendingRequests: Record<string, [(data: any) => void, (data: any) => void]> =
    {};

  private registerUserSocket(ws: WebSocket) {
    const userId = ws.user?.id;
    if (!userId) return;
    let sockets = this.userSockets.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(ws);
  }

  private unregisterUserSocket(ws: WebSocket) {
    const userId = ws.user?.id;
    if (!userId) return;
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    sockets.delete(ws);
    if (sockets.size === 0) this.userSockets.delete(userId);
  }

  private subscribeEvent(
    eventTypes: EngineEventType.ENGINE_EVENT_TYPE[],
    ws: WebSocket,
  ) {
    console.log(
      `[ENGINE_INTERFACE] User ${ws.user?.username} subscribing to events: ${eventTypes.join(", ")}`,
    );
    this.registerUserSocket(ws);
    eventTypes.forEach((eventType) => {
      if (!this.eventSubscriptions[eventType])
        this.eventSubscriptions[eventType] = new Set();

      this.eventSubscriptions[eventType].add(ws);
    });
  }
  private unsubscribeEvent(
    eventTypes: EngineEventType.ENGINE_EVENT_TYPE[] | "ALL_EVENTS",
    ws: WebSocket,
  ) {
    if (eventTypes == "ALL_EVENTS") {
      console.log(
        `[ENGINE_INTERFACE] User ${ws.user?.username} unsubscribing from ALL events`,
      );
      Object.keys(this.engineSubscriptions).forEach((eventType) => {
        this.eventSubscriptions[
          eventType as EngineEventType.ENGINE_EVENT_TYPE
        ]?.delete(ws);
      });
    } else {
      console.log(
        `[ENGINE_INTERFACE] User ${ws.user?.username} unsubscribing from events: ${eventTypes.join(", ")}`,
      );
      eventTypes.forEach((eventType) => {
        this.eventSubscriptions[eventType]?.delete(ws);
      });
    }
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
    const subscribers = this.eventSubscriptions[type];
    if (!subscribers) return;

    // personal events carry a userId and must only reach that single user:
    // look up their sockets directly and send to the ones subscribed to `type`.
    if (PERSONAL_EVENT_TYPES.has(type)) {
      const targetUserId =
        "userId" in event.payload.data ? event.payload.data.userId : undefined;
      if (!targetUserId) return;

      const userSockets = this.userSockets.get(targetUserId);
      if (!userSockets) return;

      console.log(
        `[ENGINE_INTERFACE] Broadcasting personal event of type: ${type} -> ${targetUserId}`,
      );
      userSockets.forEach((ws) => {
        if (subscribers.has(ws)) sendMessageOnWebSocket(ws, event);
      });
      return;
    }

    console.log(
      `[ENGINE_INTERFACE] Broadcasting event of type: ${type} to ${subscribers.size} subscribers`,
    );
    subscribers.forEach((ws) => sendMessageOnWebSocket(ws, event));
  };

  async handleWsDisconnected(ws: WebSocket) {
    this.unsubscribeEvent("ALL_EVENTS", ws);
    this.unregisterUserSocket(ws);
  }

  async handleEngineMessages(
    redisClient: RedisClientType,
    lastRedisMessageId = "$",
  ) {
    console.log(
      `[ENGINE_INTERFACE] Starting Redis subscription reader stream: ${process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME}`,
    );
    while (true) {
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
              const rawData = message.data!;
              console.log(
                `[ENGINE_INTERFACE] Received engine response from stream (id: ${id})`,
              );

              console.log(JSON.parse(rawData));
              // zod validation
              let response: EngineResponse.ENGINE_RESPONSE =
                EngineResponse.ENGINE_RESPONSE_SCHEMA.parse(
                  JSON.parse(rawData),
                );

              let { type } = response;

              if ("requestId" in response) {
                let { requestId } = response;
                gotRequestId = requestId;
                let payload = undefined;
                if ("payload" in response) payload = response.payload;

                console.log(
                  `[ENGINE_INTERFACE] Engine response matches pending requestId: ${requestId}, type: ${type}`,
                );
                this.pendingRequests[requestId]?.[0]?.({
                  type,
                  payload,
                  requestId,
                } as EngineRequestResponse);

                delete this.pendingRequests?.[requestId];
              } else if (type == "event") {
                this.broadcastEvent(response);
              } else {
                console.error(
                  `[ENGINE_INTERFACE] Unknown/unexpected response type received (id: ${id})`,
                );
              }
            } catch (error) {
              console.error(
                `[ENGINE_INTERFACE] Error processing/parsing engine message for request ID ${gotRequestId || "unknown"}:`,
                error,
              );
              if (gotRequestId) {
                delete this.pendingRequests?.[gotRequestId];
              }
            }
            lastRedisMessageId = id;
          }
        }
    }
  }

  private sendEngineRequest = async (
    engineRequest: EngineRequest.ENGINE_REQUEST,
  ) => {
    const reqId =
      "requestId" in engineRequest ? (engineRequest as any).requestId : "N/A";
    console.log(
      `[ENGINE_INTERFACE] Sending request of type: ${engineRequest.type} (requestId: ${reqId}) to Redis stream: ${process.env.REDIS_ENGINE_SEND_STREAM_NAME}`,
    );
    let res = await this.redisClient.xAdd(
      process.env.REDIS_ENGINE_SEND_STREAM_NAME!,
      "*",
      {
        data: JSON.stringify(engineRequest),
      },
    );
    console.log(
      `[ENGINE_INTERFACE] Request type: ${engineRequest.type} (requestId: ${reqId}) added to stream with ID: ${res}`,
    );
  };

  getEngineResponseForRequest = async (
    engineRequest: EngineRequest.ENGINE_REQUEST_FROM_BACKEND,
    ws?: WebSocket,
  ): Promise<EngineRequestResponse> => {
    const reqId =
      "requestId" in engineRequest ? (engineRequest as any).requestId : "N/A";
    console.log(
      `[ENGINE_INTERFACE] Queueing promise for request: ${reqId} (type: ${engineRequest.type})`,
    );
    let promiseToReturn = new Promise<EngineRequestResponse>(
      (res, rej) => {
        let newResolver;
        if (engineRequest.type == "subscribe_event") {
          newResolver = (data: any) => {
            console.log(
              `[ENGINE_INTERFACE] Request resolved: subscribing events for ${ws?.user?.username}`,
            );
            this.subscribeEvent(engineRequest.payload.events, ws!);
            res(data);
          };
        } else if (engineRequest.type == "unsubscribe_event") {
          newResolver = (data: any) => {
            console.log(
              `[ENGINE_INTERFACE] Request resolved: unsubscribing events for ${ws?.user?.username}`,
            );
            this.unsubscribeEvent(engineRequest.payload.events, ws!);
            res(data);
          };
        }

        this.pendingRequests[engineRequest.requestId] = [
          newResolver || res,
          rej,
        ];

        setTimeout(() => {
          console.warn(
            `[ENGINE_INTERFACE] Request TIMEOUT: ${engineRequest.requestId} (type: ${engineRequest.type}) has timed out after 20 seconds`,
          );
          rej("REQUEST_TIMED_OUT");
          delete this.pendingRequests[engineRequest.requestId];
        }, 20 * 1000); // timeout request if 20s pass before response comes
      },
    );
    await this.sendEngineRequest(engineRequest);
    return promiseToReturn;
  };
}

export default EngineInterface;
