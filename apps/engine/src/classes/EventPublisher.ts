import type { RedisClientType } from "redis";

import { EngineEvent } from "@repo/shared-types";
import type EventBus from "./EventBus.js";
import type { Snapshotable } from "./SnapshotManger.js";

type EVENT_SUBSCRIPTIONS_SNAPSHOT = {
  subscriptions: Record<EngineEvent.ENGINE_EVENT_TYPE, string[]>;
};

class EventPublisher implements Snapshotable<EVENT_SUBSCRIPTIONS_SNAPSHOT> {
  subscriptions: Map<EngineEvent.ENGINE_EVENT_TYPE, Set<string>> = new Map(); // string represents stream name that is subscribed to that event
  redisClient: RedisClientType;

  eventBus: EventBus;

  getSnapshot(): EVENT_SUBSCRIPTIONS_SNAPSHOT {
    return {
      subscriptions: this.subscriptions.keys().reduce((obj, curKey) => {
        obj[curKey] = [...this.subscriptions.get(curKey)!];
        return obj;
      }, {} as any),
    };
  }

  loadSnapshot(data: EVENT_SUBSCRIPTIONS_SNAPSHOT) {
    this.subscriptions = new Map();
    Object.entries(data.subscriptions).forEach(([key, sub]) => {
      this.subscriptions.set(
        key as EngineEvent.ENGINE_EVENT_TYPE,
        new Set(sub),
      );
    });
  }

  handleEvent = async (event: EngineEvent.ENGINE_EVENT) => {
    // send to all backends who are subbed
    let { data, type } = event.payload;
    let streams = this.subscriptions.get(type);
    if (streams)
      await Promise.all(
        [...streams].map((stream) =>
          this.redisClient.xAdd(stream, "*", {
            data: JSON.stringify({
              type: type,
              payload: data,
            }),
          }),
        ),
      );

    // TODO : send to db poller main stream
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
    let subs = this.subscriptions.getOrInsert(event, new Set());
    subs.add(stream);
    this.subscriptions.set(event, subs);
  }
  unsubscribeEvent(event: EngineEvent.ENGINE_EVENT_TYPE, stream: string) {
    // later TOOD: ideally should limit what outsiders can sub to
    this.subscriptions?.get(event)?.delete(stream);
  }
}

export default EventPublisher;

export type { EVENT_SUBSCRIPTIONS_SNAPSHOT };
