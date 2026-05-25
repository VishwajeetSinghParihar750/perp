import type { RedisClientType } from "@repo/db";

import { EngineEvent } from "@repo/shared-types";
import type EventBus from "./EventBus.js";
import type { Snapshotable } from "./SnapshotManger.js";

type EVENT_PUBLISHER_SNAPSHOT = {
  subscriptions: Record<EngineEvent.ENGINE_EVENT_TYPE, string[]>;
  idempotencyNumber: Partial<Record<EngineEvent.ENGINE_EVENT_TYPE, number>>;
  globalIdempotencyNumber: number;
};

class EventPublisher implements Snapshotable<EVENT_PUBLISHER_SNAPSHOT> {
  subscriptions: Map<EngineEvent.ENGINE_EVENT_TYPE, Set<string>> = new Map(); // string represents stream name that is subscribed to that event
  redisClient: RedisClientType;

  idempotencyNumber: Partial<Record<EngineEvent.ENGINE_EVENT_TYPE, number>> =
    {};
  globalIdempotencyNumber: number = 0;

  eventBus: EventBus;

  getSnapshot(): EVENT_PUBLISHER_SNAPSHOT {
    return {
      idempotencyNumber: this.idempotencyNumber,
      globalIdempotencyNumber: this.globalIdempotencyNumber,
      subscriptions: this.subscriptions.keys().reduce((obj, curKey) => {
        obj[curKey] = [...this.subscriptions.get(curKey)!];
        return obj;
      }, {} as any),
    };
  }

  loadSnapshot(data: EVENT_PUBLISHER_SNAPSHOT) {
    this.idempotencyNumber = data.idempotencyNumber;
    this.globalIdempotencyNumber = data.globalIdempotencyNumber;
    this.subscriptions = new Map();
    Object.entries(data.subscriptions).forEach(([key, sub]) => {
      this.subscriptions.set(
        key as EngineEvent.ENGINE_EVENT_TYPE,
        new Set(sub),
      );
    });
  }

  handleEvent = async (event: EngineEvent.ENGINE_EVENT) => {
    if (event.payload.type != "markprice.updated") console.log(event);
    let idempotencyNumber = (this.idempotencyNumber[event.payload.type] ??= 0);
    let globalIdemNumber = this.globalIdempotencyNumber;

    this.idempotencyNumber[event.payload.type]++;
    this.globalIdempotencyNumber++;

    // send to all backends who are subbed
    let streams = this.subscriptions.get(event.payload.type);
    if (streams)
      await Promise.all(
        [...streams].map((stream) =>
          this.redisClient.xAdd(stream, "*", {
            data: JSON.stringify({
              idempotencyNumber,
              event,
            }),
          }),
        ),
      );

    // send to db poller main stream
    if (
      event.payload.type == "order.created" ||
      event.payload.type == "fills.created"
    ) {
      let res = await this.redisClient.xAdd(
        process.env.DB_POLLER_REDIS_STREAM!,
        "*",
        {
          data: JSON.stringify({
            idempotencyNumber: globalIdemNumber,
            event,
          }),
        },
      );
      console.log(res);
    }
  };

  async initialize() {
    await this.redisClient.connect();
    this.eventBus.on("ALL_EVENTS", this.handleEvent);
  }

  constructor(eventBus: EventBus, redisClient: RedisClientType) {
    this.redisClient = redisClient;
    this.eventBus = eventBus;
  }

  subscribeEvent(event: EngineEvent.ENGINE_EVENT_TYPE, stream: string) {
    // later TOOD: ideally should limit what outsiders can sub to
    let subs = this.subscriptions.get(event);
    if (!subs) subs = new Set();

    subs.add(stream);
    this.subscriptions.set(event, subs);
  }
  unsubscribeEvent(event: EngineEvent.ENGINE_EVENT_TYPE, stream: string) {
    // later TOOD: ideally should limit what outsiders can sub to
    this.subscriptions?.get(event)?.delete(stream);
  }
}

export default EventPublisher;

export type { EVENT_PUBLISHER_SNAPSHOT };
