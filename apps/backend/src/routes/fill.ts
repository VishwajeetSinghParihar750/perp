import { Router } from "express";
import { prismaClient } from "@repo/db";
import { authMiddleware } from "../middlewares/auth.js";

const router: Router = Router();

router.get("/fills", authMiddleware, async (req, res) => {
  console.log(`[FILL] Fetch fills request by user: ${req.user?.username} (${req.user?.id})`);
  try {
    const fills = await prismaClient.fill.findMany({
      where: {
        OR: [{ longUserId: req.user!.id }, { shortUserId: req.user!.id }],
      },
    });
    console.log(`[FILL] Fetch fills successful for user: ${req.user?.username}. Count: ${fills.length}`);
    res.status(200).json({ error: false, payload: fills });
  } catch (error) {
    console.error(`[FILL] Fetch fills failed for user: ${req.user?.username}`, error);
    res.json({
      error: "INTERNAL_SERVER_ERROR",
      payload: (error as Error).message,
    });
  }
});

export { router };
