import { Router } from "express";
import { prismaClient } from "@repo/db";
import { authMiddleware } from "../middlewares/auth.js";

const router: Router = Router();

router.get("fills", authMiddleware, async (req, res) => {
  try {
    const fills = await prismaClient.fill.findMany({
      where: {
        OR: [{ longUserId: req.user!.id }, { shortUserId: req.user!.id }],
      },
    });
    res.status(200).json({ error: false, payload: fills });
  } catch (error) {
    res.json({
      error: "INTERNAL_SERVER_ERROR",
      payload: (error as Error).message,
    });
  }
});

export { router };
