import { EngineEvent } from "@repo/shared-types";

type EVENT_FROM_TYPE<T extends EngineEvent.ENGINE_EVENT_TYPE> = Extract<
  EngineEvent.ENGINE_EVENT,
  { payload: { type: T } }
>;

type EVENT_CALLBACK_FUNCTION<T extends EngineEvent.ENGINE_EVENT_TYPE> = (
  event: EVENT_FROM_TYPE<T>,
) => void;

class EventBus {
  private eventCallbacks: {
    [K in EngineEvent.ENGINE_EVENT_TYPE]?: EVENT_CALLBACK_FUNCTION<K>[];
  } = {};

  allEventCallbacks: ((event: EngineEvent.ENGINE_EVENT) => void)[] = [];

  emit = <T extends EngineEvent.ENGINE_EVENT_TYPE>(
    event: EVENT_FROM_TYPE<T>,
  ) => {
    let callbacks = this.eventCallbacks[event.payload.type] as
      | EVENT_CALLBACK_FUNCTION<T>[]
      | undefined;

    callbacks?.forEach((cb) => cb(event));

    this.allEventCallbacks.forEach((cb) => cb(event));
  };

  on<T extends EngineEvent.ENGINE_EVENT_TYPE>(
    eventType: T,
    cb: EVENT_CALLBACK_FUNCTION<T>,
  ): void;

  on(
    eventType: "ALL_EVENTS",
    cb: (event: EngineEvent.ENGINE_EVENT) => void,
  ): void;

  on(
    eventType: EngineEvent.ENGINE_EVENT_TYPE | "ALL_EVENTS",
    cb: (event: EngineEvent.ENGINE_EVENT) => void,
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
