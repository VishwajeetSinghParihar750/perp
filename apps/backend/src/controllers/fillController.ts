import type { Request, Response } from "express";
import { prismaClient } from "@repo/db";

export async function getTrades(req: Request, res: Response) {
  console.log(
    `[TRADE] Fetch trades request by user: ${req.user?.username} (${req.user?.id})`,
  );
  const trades = await prismaClient.fill.findMany({
    where: {
      OR: [{ longUserId: req.user!.id }, { shortUserId: req.user!.id }],
    },
  });
  console.log(
    `[TRADE] Fetch trades successful for user: ${req.user?.username}. Count: ${trades.length}`,
  );
  res.status(200).json({ error: false, payload: trades });
}
