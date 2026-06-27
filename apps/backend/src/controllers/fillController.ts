import type { Request, Response } from "express";
import { prismaClient } from "@repo/db";
import { BackendRequest } from "@repo/shared-types";

const MAX_MARKET_FILLS = 100;

export async function getMarketFills(req: Request, res: Response) {
  const { marketSymbol } = req.params as BackendRequest.GET_ORDERS_REQUEST;
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.floor(rawLimit)), MAX_MARKET_FILLS)
    : MAX_MARKET_FILLS;

  console.log(
    `[TRADE] Fetch market fills for ${marketSymbol} (limit=${limit}) by user: ${req.user?.username}`,
  );

  const fills = await prismaClient.fill.findMany({
    where: { symbol: marketSymbol },
    orderBy: {
      id: "desc",
    },
    take: 100,
  });

  console.log(
    `[TRADE] Fetch market fills successful for ${marketSymbol}. Count: ${fills.length}`,
  );
  res.status(200).json({ error: false, payload: fills });
}

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
