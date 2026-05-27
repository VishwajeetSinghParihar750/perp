import type { RedisClientType } from "@repo/db";

import { EngineEvent } from "@repo/shared-types";
import type EventBus from "./EventBus.js";
import type { Snapshotable } from "./SnapshotManger.js";

type EVENT_PUBLISHER_SNAPSHOT = {
  subscriptions: Record<EngineEvent.ENGINE_EVENT_TYPE, string[]>;
  idempotencyKey: Partial<Record<EngineEvent.ENGINE_EVENT_TYPE, number>>;
  globalidempotencyKey: number;
};

class EventPublisher implements Snapshotable<EVENT_PUBLISHER_SNAPSHOT> {
  subscriptions: Map<EngineEvent.ENGINE_EVENT_TYPE, Set<string>> = new Map(); // string represents stream name that is subscribed to that event
  redisClient: RedisClientType;

  idempotencyKey: Partial<Record<EngineEvent.ENGINE_EVENT_TYPE, number>> = {};
  globalidempotencyKey: number = 0;

  eventsBuffer: EngineEvent.ENGINE_EVENT_PAYLOAD[] = []; // this is not needed in snaposhot coz

  eventBus: EventBus;

  getSnapshot(): EVENT_PUBLISHER_SNAPSHOT {
    return {
      idempotencyKey: this.idempotencyKey,
      globalidempotencyKey: this.globalidempotencyKey,
      subscriptions: this.subscriptions.keys().reduce((obj, curKey) => {
        obj[curKey] = [...this.subscriptions.get(curKey)!];
        return obj;
      }, {} as any),
    };
  }

  loadSnapshot(data: EVENT_PUBLISHER_SNAPSHOT) {
    this.idempotencyKey = data.idempotencyKey;
    this.globalidempotencyKey = data.globalidempotencyKey;
    this.subscriptions = new Map();
    Object.entries(data.subscriptions).forEach(([key, sub]) => {
      this.subscriptions.set(
        key as EngineEvent.ENGINE_EVENT_TYPE,
        new Set(sub),
      );
    });
  }

  startObservingEvents = () => {
    this.eventsBuffer = [];
  };
  publishEvents = async () => {
    // if (event.payload.type != "markprice.updated") console.log(event);
    for (let event of this.eventsBuffer) {
      let perEventIdemNumber = (this.idempotencyKey[event.type] ??= 0);
      let globalIdemNumber = this.globalidempotencyKey;

      this.idempotencyKey[event.type]++;
      this.globalidempotencyKey++;

      // send to all backends who are subbed
      let streams = this.subscriptions.get(event.type);
      if (streams)
        await Promise.all(
          [...streams].map((stream) =>
            this.redisClient.xAdd(stream, "*", {
              data: JSON.stringify({
                idempotencyKey: String(perEventIdemNumber),
                type: "event",
                payload: event,
              }),
            }),
          ),
        );

      // send to db poller main stream
      if (event.type == "order.created" || event.type == "fills.created") {
        let res = await this.redisClient.xAdd(
          process.env.DB_POLLER_REDIS_STREAM!,
          "*",
          {
            data: JSON.stringify({
              idempotencyKey: String(globalIdemNumber),
              type: "event",
              payload: event,
            }),
          },
        );
        console.log(res);
      }
    }
    this.eventsBuffer = [];
  };

  handleEvent = async (event: EngineEvent.ENGINE_EVENT_PAYLOAD) => {
    this.eventsBuffer.push(event);
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
