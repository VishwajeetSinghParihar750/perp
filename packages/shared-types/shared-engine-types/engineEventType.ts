import z from "zod";
const ORDERBOOK_EVENT_TYPE = z.union([
  // these are for end user
  z.literal("depth.updated"),
  z.literal("lastTradedPrice.updated"),
  z.literal("trades.created"),

  // these are for db poller
  z.literal("order.created"),
  z.literal("order.cancelled"),
  z.literal("fills.created"),
]);

const BALANCE_EVENT_TYPE = z.union([z.literal("userpnl.created")]);

const LIQUIDATION_EVENT_TYPE = z.union([
  // for end user
  z.literal("indexprice.updated"),

  // use if needed, but not needed rn
  z.literal("funding.created"),
  z.literal("liquidation.started"),
  z.literal("liquidation.completed"),
]);

const ENGINE_EVENT_TYPE_SCHEMA = z.union([
  ORDERBOOK_EVENT_TYPE,
  LIQUIDATION_EVENT_TYPE,
  BALANCE_EVENT_TYPE,
]);

type ENGINE_EVENT_TYPE = z.infer<typeof ENGINE_EVENT_TYPE_SCHEMA>;

export type { ENGINE_EVENT_TYPE };
export {
  ENGINE_EVENT_TYPE_SCHEMA,
  LIQUIDATION_EVENT_TYPE,
  BALANCE_EVENT_TYPE,
  ORDERBOOK_EVENT_TYPE,
};
