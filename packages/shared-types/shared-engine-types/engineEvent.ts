import z, { maxSize, symbol } from "zod";

const SIDE_SCHEMA = z.union([z.literal("BUY"), z.literal("SELL")]);
type SIDE = z.infer<typeof SIDE_SCHEMA>;

const TYPE_SCHEMA = z.union([z.literal("MARKET"), z.literal("LIMIT")]);
type TYPE = z.infer<typeof SIDE_SCHEMA>;

const MARGIN_TYPE_SCHEMA = z.union([z.literal("ISOLATED"), z.literal("CROSS")]);
type MARGIN_TYPE = z.infer<typeof MARGIN_TYPE_SCHEMA>;

const ORDER_STATUS_SCHEMA = z.union([
  z.literal("OPEN"),
  z.literal("CANCELLED"),
  z.literal("PARTIALLY_FILLED"),
  z.literal("FILLED"),
]);

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
  z.literal("order.created"),
  z.literal("fills.created"),
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

const MARKPRICE_UPDATED_SCHEMA = baseEventSchema.extend({
  payload: z.object({
    type: z.literal("markprice.updated"),
    data: z.object({ price: z.number(), symbol: CURRENCY_SYMBOL_SCHEMA }),
  }),
});

type MARKPRICE_UPDATED_EVENT = z.infer<typeof MARKPRICE_UPDATED_SCHEMA>;

// these are db stream events ===================================================
const ORDER_CREATED_SCHEMA = baseEventSchema.extend({
  payload: z.object({
    type: z.literal("order.created"),
    data: z.object({
      filledQty: z.number(),
      orderId: z.string(),
      price: z.number(),
      qty: z.number(),
      userId: z.string(),
      side: SIDE_SCHEMA,
      type: TYPE_SCHEMA,
      symbol: CURRENCY_SYMBOL_SCHEMA,
      margin: z.number(),
      marginType: MARGIN_TYPE_SCHEMA,
      status: ORDER_STATUS_SCHEMA,
    }),
  }),
});
type ORDER_CREATED_EVENT = z.infer<typeof ORDER_CREATED_SCHEMA>;

const FILLS_CREATED_SCHEMA = baseEventSchema.extend({
  payload: z.object({
    type: z.literal("fills.created"),
    data: z.array(
      z.object({
        fillId: z.string(),
        symbol: CURRENCY_SYMBOL_SCHEMA,
        qty: z.number(),
        price: z.number(),
        bidPrice: z.number(),
        buyOrderInfo: z.object({
          buyerId: z.string(),
          orderId: z.string(),
        }),
        sellOrderInfo: z.object({
          sellerId: z.string(),
          orderId: z.string(),
        }),
      }),
    ),
  }),
});

type FILLS_CREATED_EVENT = z.infer<typeof FILLS_CREATED_SCHEMA>;

// =======================================================================================

const ENGINE_EVENT_SCHEMA = z.union([
  DEPTH_UPDATED_BTC_USD_SCHEMA,
  DEPTH_UPDATED_SOL_USD_SCHEMA,
  DEPTH_UPDATED_ETH_USD_SCHEMA,
  LIQUIDATION_COMPLETED_SCHEMA,
  LIQUIDATION_STARTED_SCHEMA,
  MARKPRICE_UPDATED_SCHEMA,
  ORDER_CREATED_SCHEMA,
  FILLS_CREATED_SCHEMA,
]);

type ENGINE_EVENT = z.infer<typeof ENGINE_EVENT_SCHEMA>;

export {
  ENGINE_EVENT_TYPE_SCHEMA,
  ENGINE_EVENT_SCHEMA,
  SIDE_SCHEMA,
  MARGIN_TYPE_SCHEMA,
  TYPE_SCHEMA,
  MARKPRICE_UPDATED_SCHEMA,
  CURRENCY_SYMBOL_SCHEMA,
  ORDER_STATUS_SCHEMA,
  FILLS_CREATED_SCHEMA,
  ORDER_CREATED_SCHEMA,
};
export type {
  SIDE,
  FILLS_CREATED_EVENT,
  ORDER_CREATED_EVENT,
  MARGIN_TYPE,
  TYPE,
  MARKPRICE_UPDATED_EVENT,
  ENGINE_EVENT_TYPE,
  ENGINE_EVENT,
  LIQUIDATION_STARTED_EVENT,
  CURRENCY_SYMBOL,
  LIQUIDATION_COMPLETED_EVENT,
};
