import type { Request, Response } from "express";
import { prismaClient } from "@repo/db";
import { BackendRequest } from "@repo/shared-types";

export async function getCandles(req: Request, res: Response) {
  const { marketSymbol, timeframe } =
    req.params as BackendRequest.GET_CANDLES_REQUEST;
  let { limit, offset } =
    req.query as any as BackendRequest.GET_CANDLES_QUERY_REQUEST;
  offset ??= 0;

  console.log(
    `[ORDER] Fetch candles request for marketSymbol: ${marketSymbol} for timeframe: ${timeframe}`,
  );

  //
  const candles = await prismaClient.$queryRaw(`
    
    `);

  res.json({ error: false, payload: {} });
}
