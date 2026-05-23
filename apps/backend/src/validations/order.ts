import z from "zod";
import { CURRENCY_SYMBOL } from "./common.js";

const CREATE_ORDER_SCHEMA = z.object({
  type: z.enum(["MARKET", "LIMIT"]),
  side: z.enum(["BUY", "SELL"]),
  qty: z.number(),
  symbol: CURRENCY_SYMBOL,
  price: z.number().optional(),
});

const GET_ORDERBOOK_SCHEMA = z.object({
  symbol: CURRENCY_SYMBOL,
});

const GET_ORDER_SCHEMA = z.object({
  orderId: z.string(),
});

const DELETE_ORDER_SCHEMA = z.object({
  orderId: z.string(),
});

const GET_DEPTH_SCHEMA = z.object({
  symbol: CURRENCY_SYMBOL,
});

export {
  CREATE_ORDER_SCHEMA,
  GET_ORDER_SCHEMA,
  DELETE_ORDER_SCHEMA,
  GET_DEPTH_SCHEMA,
  GET_ORDERBOOK_SCHEMA,
};
