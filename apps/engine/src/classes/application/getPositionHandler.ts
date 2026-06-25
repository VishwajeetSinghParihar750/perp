import type { EngineTypes } from "@repo/shared-types";
import PositionManager from "../domain/positionManager.js";
import type { Position } from "../domain/position.js";
import type { Result } from "../types.js";

export interface GetPositionCommand {
  userId: EngineTypes.USER_ID;
}

export default class GetPositionHandler {
  private positionManager: PositionManager;

  constructor(positionManager: PositionManager) {
    this.positionManager = positionManager;
  }

  handle(
    command: GetPositionCommand,
  ): Result<Partial<Record<EngineTypes.TRADABLE_SYMBOL, Position>>> {
    return this.positionManager.getPosition(command.userId);
  }
}
