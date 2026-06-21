import type { EngineTypes } from "@repo/shared-types";
import PositionManager from "../domain/positionManager.js";

interface FundingCommand {
  marketSymbol: EngineTypes.TRADABLE_SYMBOL;
}

export default class FundingHandler {
  private positionManager: PositionManager;

  constructor(positionManager: PositionManager) {
    this.positionManager = positionManager;
  }

  handle(command: FundingCommand) {
    this.positionManager.applyFunding(command.marketSymbol);
  }
}
