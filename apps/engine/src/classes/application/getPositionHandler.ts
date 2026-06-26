import type { EngineTypes } from "@repo/shared-types";
import PositionManager, {
  type GetPositionResult,
} from "../domain/positionManager.js";
import type { Result } from "../types.js";

export interface GetPositionCommand {
  userId: EngineTypes.USER_ID;
}

export default class GetPositionHandler {
  private positionManager: PositionManager;

  constructor(positionManager: PositionManager) {
    this.positionManager = positionManager;
  }

  handle(command: GetPositionCommand): Result<GetPositionResult> {
    return this.positionManager.getPosition(command.userId);
  }
}
