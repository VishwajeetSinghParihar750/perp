import z from "zod";

const ORDERBOOK_EVENT_TYPE = z.union([
  z.literal("depth.updated.sol_usd"),
  z.literal("depth.updated.eth_usd"),
  z.literal("depth.updated.btc_usd"),
  z.literal("users_pnl.updated"),
]);

const LIQUIDATION_EVENT_TYPE = z.union([
  z.literal("markprice.updated"),
  z.literal("liquidation.started"),
  z.literal("liquidation.completed"),
]);

const ENGINE_EVENT_TYPE_SCHEMA = z.union([
  ORDERBOOK_EVENT_TYPE,
  LIQUIDATION_EVENT_TYPE,
]);
type ENGINE_EVENT_TYPE = z.infer<typeof ENGINE_EVENT_TYPE_SCHEMA>;

//
const baseEventSchema = z.object({ type: z.literal("event") });
const DEPTH_UPDATED_SOL_USD_SCHEMA = baseEventSchema.extend({
  payload: z.object({
    type: z.literal("depth.updated.sol_usd"),
    data: z.string(),
  }),
});
const DEPTH_UPDATED_BTC_USD_SCHEMA = baseEventSchema.extend({
  payload: z.object({
    type: z.literal("depth.updated.btc_usd"),
    data: z.string(),
  }),
});
const DEPTH_UPDATED_ETH_USD_SCHEMA = baseEventSchema.extend({
  payload: z.object({
    type: z.literal("depth.updated.eth_usd"),
    data: z.string(),
  }),
});

const ENGINE_EVENT_SCHEMA = z.union([
  DEPTH_UPDATED_BTC_USD_SCHEMA,
  DEPTH_UPDATED_SOL_USD_SCHEMA,
  DEPTH_UPDATED_ETH_USD_SCHEMA,
]);

type ENGINE_EVENT = z.infer<typeof ENGINE_EVENT_SCHEMA>;

export { ENGINE_EVENT_TYPE_SCHEMA, ENGINE_EVENT_SCHEMA };
export type { ENGINE_EVENT_TYPE, ENGINE_EVENT };
