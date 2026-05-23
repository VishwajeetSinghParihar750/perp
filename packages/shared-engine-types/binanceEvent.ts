import z from "zod";

const MARK_PRICE_UPDATED_SCHEMA = z.object({
  type: "markprice_updated",
  payload: z.object({
    // symbol :
  }),
});
