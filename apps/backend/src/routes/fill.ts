import { Router } from "express";
import { BackendRequest } from "@repo/shared-types";
import { authMiddleware } from "../middlewares/auth.js";
import { zodBodyVerification } from "../middlewares/zodBodyVerification.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as controller from "../controllers/fillController.js";

const router: Router = Router();

router.get(
  "/fills/:marketSymbol",
  authMiddleware,
  zodBodyVerification(BackendRequest.GET_ORDERS_SCHEMA, true),
  asyncHandler(controller.getMarketFills),
);

router.get(
  ["/trades", "/fills"],
  authMiddleware,
  asyncHandler(controller.getTrades),
);

export { router };
