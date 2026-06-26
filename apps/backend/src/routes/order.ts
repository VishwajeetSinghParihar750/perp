import { Router } from "express";
import { BackendRequest } from "@repo/shared-types";
import { zodBodyVerification } from "../middlewares/zodBodyVerification.js";
import { authMiddleware } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as controller from "../controllers/orderController.js";

const router: Router = Router();

router.get(
  "/order/:orderId",
  authMiddleware,
  zodBodyVerification(BackendRequest.GET_ORDER_SCHEMA, true),
  asyncHandler(controller.getOrder),
);

router.get(
  "/orders/:marketSymbol",
  authMiddleware,
  zodBodyVerification(BackendRequest.GET_ORDERS_SCHEMA, true),
  asyncHandler(controller.getOrders),
);

export { router };
