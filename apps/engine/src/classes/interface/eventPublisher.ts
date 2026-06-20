import type { EngineEventPayload, EngineEventType } from "@repo/shared-types";
import type { ReplyAddress } from "../infrastructure/types.js";
import Communicator from "../infrastructure/Communicator.js";

export default class EventPublisher {
  private subscriptions: Map<
    EngineEventType.ENGINE_EVENT_TYPE,
    Set<ReplyAddress>
  > = new Map();

  private communicator: Communicator;

  constructor(communicator: Communicator) {
    this.communicator = communicator;
  }

  emit(
    payload: EngineEventPayload.ENGINE_EVENT_PAYLOAD,
    idempotencyKey: string,
  ) {
    let subs = this.subscriptions.get(payload.type);
    if (subs)
      for (const sub of subs) {
        this.communicator.send(sub, {
          type: "event",
          idempotencyKey,
          payload,
        });
      }
  }

  subscribe(
    replyAddress: ReplyAddress,
    events: EngineEventType.ENGINE_EVENT_TYPE[],
  ) {
    events.forEach((e) => {
      let cur = this.subscriptions.getOrInsert(e, new Set());
      cur.add(replyAddress);
    });
    return events;
  }
  unsubscribe(
    replyAddress: ReplyAddress,
    events: EngineEventType.ENGINE_EVENT_TYPE[],
  ) {
    events.forEach((e) => {
      let cur = this.subscriptions.get(e);
      cur?.delete(replyAddress);
    });
    return events;
  }
}
