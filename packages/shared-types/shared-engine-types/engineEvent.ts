import z from "zod";

const CURRENCY_SYMBOL_SCHEMA = z.union([
  z.literal("USD"),
  z.literal("BTCUSD"),
  z.literal("SOLUSD"),
  z.literal("ETHUSD"),
]);
type CURRENCY_SYMBOL = z.infer<typeof CURRENCY_SYMBOL_SCHEMA>;

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

const LIQUIDATION_STARTED_SCHEMA = baseEventSchema.extend({
  payload: z.object({
    type: z.literal("liquidation.started"),
    data: z.object({ userId: z.string(), symbol: CURRENCY_SYMBOL_SCHEMA }),
  }),
});
type LIQUIDATION_STARTED_EVENT = z.infer<typeof LIQUIDATION_STARTED_SCHEMA>;

const LIQUIDATION_COMPLETED_SCHEMA = baseEventSchema.extend({
  payload: z.object({
    type: z.literal("liquidation.completed"),
    data: z.object({ userId: z.string(), symbol: CURRENCY_SYMBOL_SCHEMA }),
  }),
});
type LIQUIDATION_COMPLETED_EVENT = z.infer<typeof LIQUIDATION_COMPLETED_SCHEMA>;

const ENGINE_EVENT_SCHEMA = z.union([
  DEPTH_UPDATED_BTC_USD_SCHEMA,
  DEPTH_UPDATED_SOL_USD_SCHEMA,
  DEPTH_UPDATED_ETH_USD_SCHEMA,
  LIQUIDATION_COMPLETED_SCHEMA,
  LIQUIDATION_STARTED_SCHEMA,
]);

type ENGINE_EVENT = z.infer<typeof ENGINE_EVENT_SCHEMA>;

export {
  ENGINE_EVENT_TYPE_SCHEMA,
  ENGINE_EVENT_SCHEMA,
  CURRENCY_SYMBOL_SCHEMA,
};
export type {
  ENGINE_EVENT_TYPE,
  ENGINE_EVENT,
  LIQUIDATION_STARTED_EVENT,
  CURRENCY_SYMBOL,
  LIQUIDATION_COMPLETED_EVENT,
};
