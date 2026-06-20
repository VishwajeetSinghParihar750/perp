import { Router } from "express";
import { prismaClient } from "@repo/db";
import { authMiddleware } from "../middlewares/auth.js";

const router: Router = Router();

router.get(["/trades", "/fills"], authMiddleware, async (req, res) => {
  console.log(
    `[TRADE] Fetch trades request by user: ${req.user?.username} (${req.user?.id})`,
  );
  try {
    const trades = await prismaClient.fill.findMany({
      where: {
        OR: [{ longUserId: req.user!.id }, { shortUserId: req.user!.id }],
      },
    });
    console.log(
      `[TRADE] Fetch trades successful for user: ${req.user?.username}. Count: ${trades.length}`,
    );
    res.status(200).json({ error: false, payload: trades });
  } catch (error) {
    console.error(
      `[TRADE] Fetch trades failed for user: ${req.user?.username}`,
      error,
    );
    res.json({
      error: "INTERNAL_SERVER_ERROR",
      payload: (error as Error).message,
    });
  }
});

export { router };
