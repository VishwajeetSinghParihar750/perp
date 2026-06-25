import {
  type RedisClientType,
  redisClient as globalRedisClient,
} from "@repo/db";

import { EngineRequest } from "@repo/shared-types";
import type { ReplyAddress } from "./types.js";
import RequestHandler from "../interface/requestHandler.js";
import type EventPublisher from "../interface/eventPublisher.js";
import type SnapshotManager from "./snapshotManager.js";
import { assert } from "node:console";

export default class Communicator {
  //
  private redisClient: RedisClientType = globalRedisClient.duplicate();

  private requestHandler: RequestHandler;
  private eventPublisher: EventPublisher | undefined;
  private snapshotManager: SnapshotManager | undefined;

  constructor(requestHandler: RequestHandler) {
    this.requestHandler = requestHandler;
  }

  setSnapshotDeps(
    eventPublisher: EventPublisher,
    snapshotManager: SnapshotManager,
  ) {
    this.eventPublisher = eventPublisher;
    this.snapshotManager = snapshotManager;
  }
  async initialize() {
    await this.redisClient.connect();
  }

  async receiveRequests(lastRedisMessageId: string = "0") {
    await this.redisClient.connect();

    console.log(
      "handling messgaes from stream  ",
      process.env.REDIS_ENGINE_STREAM!,
    );
    // getting connected client
    while (true) {
      const xReadResponse = await this.redisClient.xRead(
        [
          {
            id: lastRedisMessageId,
            key: process.env.REDIS_ENGINE_STREAM!,
          },
        ],
        { BLOCK: 0, COUNT: 100 },
      );

      // error here in processing reading request and sending resonse shuld not be caught
      // it should make process exit and must be restarted to keep state reliable across services
      if (xReadResponse) {
        for (let perStreamRespone of xReadResponse) {
          if (perStreamRespone.name == process.env.REDIS_ENGINE_STREAM) {
            for (let { id, message } of perStreamRespone.messages) {
              // json parsing
              let request: EngineRequest.ENGINE_REQUEST = JSON.parse(
                message.data!,
              );
              console.log(
                `[ENGINE_SERVER] Received message ID: ${id}, request type: ${request.type}`,
              );

              let zodError = false;
              try {
                // zod validation
                EngineRequest.ENGINE_REQUEST_SCHEMA.parse(request);
              } catch (error) {
                console.error(
                  `[ENGINE_SERVER] Zod validation failed for message ID: ${id}`,
                  error,
                );
                zodError = true;
                this.snapshotManager?.onMessageProcessed(id);
                this.snapshotManager?.onFullMessageProcessed(id);
              }

              if (!zodError) {
                const req = request;
                console.log(
                  `[ENGINE_SERVER] Processing trade request: ${req.type} `,
                  "requestId" in req
                    ? ` (requestId: ${req.requestId})`
                    : " no request id",
                );

                this.eventPublisher?.startObservingEvents();

                let result = this.requestHandler.handleRequest(req);

                this.snapshotManager?.onMessageProcessed(id);

                assert(
                  this.eventPublisher,
                  "handling requests without setting the event publisher ",
                );

                await this.eventPublisher!.publishEvents();

                if (result && "stream" in req)
                  await this.redisClient.xAdd(req.stream, "*", {
                    data: JSON.stringify(result),
                  });

                this.snapshotManager?.onFullMessageProcessed(id);
              }

              lastRedisMessageId = id;
            }
          }
        }
      }
    }
  }

  async send(replyAddress: ReplyAddress, message: any) {
    if ("redisQueueId" in replyAddress) {
      //
      await this.redisClient.rPush(
        replyAddress.redisQueueId,
        JSON.stringify(message),
      );
    } else if ("redisStreamId" in replyAddress) {
      //
      await this.redisClient.xAdd(replyAddress.redisStreamId, "*", {
        data: JSON.stringify(message),
      });
    }
  }
}
