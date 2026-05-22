import { Router } from "express";
import { router as authRouter } from "./auth.js";

const router = Router();
router.use(authRouter);

export default router;
