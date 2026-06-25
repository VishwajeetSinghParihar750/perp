import { Router } from "express";
import { zodBodyVerification } from "../middlewares/zodBodyVerification.js";
import { SIGNIN_SCHEMA, SIGNUP_SCHEMA } from "../validations/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as controller from "../controllers/authController.js";

const router: Router = Router();
router.post(
  "/signup",
  zodBodyVerification(SIGNUP_SCHEMA),
  asyncHandler(controller.signup),
);
router.post(
  "/signin",
  zodBodyVerification(SIGNIN_SCHEMA),
  asyncHandler(controller.signin),
);

export { router };
