import { Router } from "express";
import { router as authRouter } from "./auth.js";
import { router as orderRouter } from "./order.js";
import { router as tradeRouter } from "./fill.js";
import { router as candleRouter } from "./candle.js";

const router: Router = Router();
router.use(authRouter);
router.use(orderRouter);
router.use(tradeRouter);
router.use(candleRouter);

export default router;
