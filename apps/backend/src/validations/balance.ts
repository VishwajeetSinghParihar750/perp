import z from "zod";
import { CURRENCY_SYMBOL } from "./common.js";

const ADD_BALANCE_SCHEMA = z.object({
  amount: z.number(),
  symbol: CURRENCY_SYMBOL,
});

const GET_BALANCE_SCHEMA = z.object({
  symbol: CURRENCY_SYMBOL.optional(),
});

export { ADD_BALANCE_SCHEMA, GET_BALANCE_SCHEMA };
