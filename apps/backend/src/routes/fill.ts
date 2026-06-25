import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as controller from "../controllers/fillController.js";

const router: Router = Router();

router.get(
  ["/trades", "/fills"],
  authMiddleware,
  asyncHandler(controller.getTrades),
);

export { router };
