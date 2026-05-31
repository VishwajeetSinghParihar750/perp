import { Router } from "express";
import { router as authRouter } from "./auth.js";
import { router as orderRouter } from "./order.js";
import { router as fillRouter } from "./fill.js";

const router: Router = Router();
router.use(authRouter);
router.use(orderRouter);
router.use(fillRouter);

export default router;
