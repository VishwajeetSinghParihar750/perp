import type { EngineTypes } from "@repo/shared-types";
import type { Result } from "../domain/account.js";
import PositionManager from "../domain/positionManager.js";
import type { Position } from "../domain/position.js";

export interface GetPositionCommand {
  userId: EngineTypes.USER_ID;
}

export default class GetDepthHandler {
  private positionManager: PositionManager;

  constructor(positionManager: PositionManager) {
    this.positionManager = positionManager;
  }

  handle(command: GetPositionCommand): Result<Position> {
    return this.positionManager.getPosition(command.userId);
  }
}
