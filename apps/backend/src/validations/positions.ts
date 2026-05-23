import z from "zod";
import { CURRENCY_SYMBOL } from "./common.js";

const GET_POSITION_SCHEMA = z.object({
  symbol: CURRENCY_SYMBOL.optional(),
});

export { GET_POSITION_SCHEMA };
