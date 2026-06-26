import type { EngineEventPayload, EngineEventType } from "@repo/shared-types";
import {
  getReplyAddressKey,
  type ReplyAddress,
} from "../infrastructure/types.js";
import type Communicator from "../infrastructure/communicator.js";
import type EventBus from "../domain/eventBus.js";
import type { Snapshotable } from "../infrastructure/snapshotManager.js";

export type EVENT_PUBLISHER_SNAPSHOT = {
  subscriptions: Record<EngineEventType.ENGINE_EVENT_TYPE, ReplyAddress[]>;
  idempotencyKey: Partial<Record<EngineEventType.ENGINE_EVENT_TYPE, number>>;
  globalidempotencyKey: number;
};

export default class EventPublisher implements Snapshotable<EVENT_PUBLISHER_SNAPSHOT> {
  private subscriptions: Map<
    EngineEventType.ENGINE_EVENT_TYPE,
    Map<string, ReplyAddress>
  > = new Map();

  private communicator: Communicator;
  private idempotencyKey: Partial<Record<EngineEventType.ENGINE_EVENT_TYPE, number>> = {};
  private globalidempotencyKey: number = 0;
  private eventsBuffer: EngineEventPayload.ENGINE_EVENT_PAYLOAD[] = [];

  constructor(eventBus: EventBus, communicator: Communicator) {
    this.communicator = communicator;
    eventBus.on("ALL_EVENTS", this.handleEvent);
  }

  getSnapshot(): EVENT_PUBLISHER_SNAPSHOT {
    const subscriptionsSnapshot: Record<string, ReplyAddress[]> = {};
    for (const [key, value] of this.subscriptions.entries()) {
      subscriptionsSnapshot[key] = Array.from(value.values());
    }

    return {
      idempotencyKey: this.idempotencyKey,
      globalidempotencyKey: this.globalidempotencyKey,
      subscriptions: subscriptionsSnapshot as any,
    };
  }

  loadSnapshot(data: EVENT_PUBLISHER_SNAPSHOT) {
    this.idempotencyKey = data.idempotencyKey;
    this.globalidempotencyKey = data.globalidempotencyKey;
    this.subscriptions = new Map();
    Object.entries(data.subscriptions).forEach(([key, sub]) => {
      const byKey = new Map<string, ReplyAddress>();
      for (const address of sub) {
        byKey.set(getReplyAddressKey(address), address);
      }
      this.subscriptions.set(key as EngineEventType.ENGINE_EVENT_TYPE, byKey);
    });
  }

  startObservingEvents = () => {
    this.eventsBuffer = [];
  };

  publishEvents = async () => {
    for (const event of this.eventsBuffer) {
      const perEventIdemNumber = (this.idempotencyKey[event.type] ??= 0);
      const globalIdemNumber = this.globalidempotencyKey;

      this.idempotencyKey[event.type] = (this.idempotencyKey[event.type] ?? 0) + 1;
      this.globalidempotencyKey++;

      // send to all backends who are subbed
      const subs = this.subscriptions.get(event.type);
      if (subs) {
        await Promise.allSettled(
          Array.from(subs.values()).map((replyAddress) =>
            this.communicator.send(replyAddress, {
              idempotencyKey: String(perEventIdemNumber),
              type: "event",
              payload: event,
            }),
          ),
        );
      }

      // send to db poller main stream
      if (
        event.type === "order.created" ||
        event.type === "fills.created" ||
        event.type === "order.cancelled"
      ) {
        await this.communicator.send(
          { redisStreamId: process.env.DB_POLLER_REDIS_STREAM! },
          {
            idempotencyKey: String(globalIdemNumber),
            type: "event",
            payload: event,
          },
        );
      }
    }
    this.eventsBuffer = [];
  };

  private handleEvent = (event: EngineEventPayload.ENGINE_EVENT_PAYLOAD) => {
    this.eventsBuffer.push(event);
  };

  subscribe(
    replyAddress: ReplyAddress,
    events: EngineEventType.ENGINE_EVENT_TYPE[],
  ) {
    events.forEach((e) => {
      let cur = this.subscriptions.get(e);
      if (!cur) {
        cur = new Map();
        this.subscriptions.set(e, cur);
      }
      cur.set(getReplyAddressKey(replyAddress), replyAddress);
    });
    return events;
  }

  unsubscribe(
    replyAddress: ReplyAddress,
    events: EngineEventType.ENGINE_EVENT_TYPE[],
  ) {
    events.forEach((e) => {
      const cur = this.subscriptions.get(e);
      cur?.delete(getReplyAddressKey(replyAddress));
    });
    return events;
  }
}
