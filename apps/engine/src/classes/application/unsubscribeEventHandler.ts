import type { EngineEventType } from "@repo/shared-types";
import type { ReplyAddress } from "../infrastructure/types.js";
import type EventPublisher from "../interface/eventPublisher.js";
import type { Result } from "../types.js";

export interface UnsubscribeEventCommand {
  events: EngineEventType.ENGINE_EVENT_TYPE[];
  replyAddress: ReplyAddress;
}

export default class UnsubscribeEventHandler {
  private eventPublisher: EventPublisher;

  constructor(eventPublisher: EventPublisher) {
    this.eventPublisher = eventPublisher;
  }

  handle(
    command: UnsubscribeEventCommand,
  ): Result<EngineEventType.ENGINE_EVENT_TYPE[]> {
    return {
      success: true,
      value: this.eventPublisher.unsubscribe(
        command.replyAddress,
        command.events,
      ),
    };
  }
}
