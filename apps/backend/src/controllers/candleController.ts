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

  // repeating code to prevent using queryRawUnsafe since cant use table name as variable safely
  let candles: any;
  switch (timeframe) {
    case "1day":
      candles = await prismaClient.$queryRaw`
    SELECT * from candles_1d 
    WHERE symbol = ${marketSymbol} 
    ORDER BY bucket desc
    LIMIT ${limit}
    OFFSET ${offset}
     `;
      break;

    case "1hour":
      candles = await prismaClient.$queryRaw`
    SELECT * from candles_1h 
    WHERE symbol = ${marketSymbol} 
    ORDER BY bucket desc
    LIMIT ${limit}
    OFFSET ${offset}
     `;
      break;

    case "1min":
      candles = await prismaClient.$queryRaw`
    SELECT * from candles_1m 
    WHERE symbol = ${marketSymbol} 
    ORDER BY bucket desc
    LIMIT ${limit}
    OFFSET ${offset}
     `;
      break;
    default:
      throw new Error("INVALID_TIMEFRAME");
  }

  res.json({ error: false, payload: candles });
}
