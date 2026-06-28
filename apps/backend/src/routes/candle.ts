import { Router } from "express";
import { BackendRequest } from "@repo/shared-types";
import { zodBodyVerification } from "../middlewares/zodBodyVerification.js";
import { authMiddleware } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as controller from "../controllers/candleController.js";

const router: Router = Router();

router.get(
  "/candles/:marketSymbol/:timeframe",
  authMiddleware,
  zodBodyVerification(BackendRequest.GET_CANDLES_PARAMS_SCHEMA, true),
  zodBodyVerification(BackendRequest.GET_CANDLES_QUERY_SCHEMA, false, true),
  asyncHandler(controller.getCandles),
);

export { router };
