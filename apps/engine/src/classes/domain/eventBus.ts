import type { EngineEventType, EngineEventPayload } from "@repo/shared-types";

type EVENT_FROM_TYPE<T extends EngineEventType.ENGINE_EVENT_TYPE> = Extract<
  EngineEventPayload.ENGINE_EVENT_PAYLOAD,
  { type: T }
>;

type EVENT_CALLBACK_FUNCTION<T extends EngineEventType.ENGINE_EVENT_TYPE> = (
  event: EVENT_FROM_TYPE<T>,
) => void;

class EventBus {
  private eventCallbacks: {
    [K in EngineEventType.ENGINE_EVENT_TYPE]?: EVENT_CALLBACK_FUNCTION<K>[];
  } = {};

  allEventCallbacks: ((event: EngineEventPayload.ENGINE_EVENT_PAYLOAD) => void)[] = [];

  emit = <T extends EngineEventType.ENGINE_EVENT_TYPE>(
    event: EVENT_FROM_TYPE<T>,
  ) => {
    let callbacks = this.eventCallbacks[event.type] as
      | EVENT_CALLBACK_FUNCTION<T>[]
      | undefined;

    callbacks?.forEach((cb) => cb(event));

    this.allEventCallbacks.forEach((cb) => cb(event));
  };

  on<T extends EngineEventType.ENGINE_EVENT_TYPE>(
    eventType: T,
    cb: EVENT_CALLBACK_FUNCTION<T>,
  ): void;

  on(
    eventType: "ALL_EVENTS",
    cb: (event: EngineEventPayload.ENGINE_EVENT_PAYLOAD) => void,
  ): void;

  on(
    eventType: EngineEventType.ENGINE_EVENT_TYPE | "ALL_EVENTS",
    cb: (event: EngineEventPayload.ENGINE_EVENT_PAYLOAD) => void,
  ) {
    if (eventType == "ALL_EVENTS") {
      this.allEventCallbacks.push(cb);
    } else {
      this.eventCallbacks[eventType] ??= [];
      this.eventCallbacks[eventType].push(cb);
    }
  }

  // there could be remove cb function too, but not needed rn
}

export default EventBus;
