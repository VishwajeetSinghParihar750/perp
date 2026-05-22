import z from "zod";
import { CURRENCY_SYMBOL } from "./common.js";

const getPositionSchema = z.object({
  symbol: CURRENCY_SYMBOL.optional(),
});

export { getPositionSchema };
