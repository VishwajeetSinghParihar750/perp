import z from "zod";

const SIDE_SCHEMA = z.union([z.literal("BUY"), z.literal("SELL")]);
type SIDE = z.infer<typeof SIDE_SCHEMA>;

const TYPE_SCHEMA = z.union([z.literal("MARKET"), z.literal("LIMIT")]);
type TYPE = z.infer<typeof TYPE_SCHEMA>;

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

const TRADBLE_SYMBOL_SCHEMA = z.union([
  z.literal("BTCUSD"),
  z.literal("SOLUSD"),
  z.literal("ETHUSD"),
]);
type TRADABLE_SYMBOL = z.infer<typeof TRADBLE_SYMBOL_SCHEMA>;

const ORDERBOOK_EVENT_TYPE = z.union([
  z.literal("depth.updated.sol_usd"),
  z.literal("depth.updated.eth_usd"),
  z.literal("depth.updated.btc_usd"),
  z.literal("users_pnl.updated"),
  z.literal("order.created"),
  z.literal("fills.created"),
]);

const LIQUIDATION_EVENT_TYPE = z.union([
  z.literal("indexprice.updated"),
  z.literal("liquidation.started"),
  z.literal("liquidation.completed"),
]);

const ENGINE_EVENT_TYPE_SCHEMA = z.union([
  ORDERBOOK_EVENT_TYPE,
  LIQUIDATION_EVENT_TYPE,
]);

type ENGINE_EVENT_TYPE = z.infer<typeof ENGINE_EVENT_TYPE_SCHEMA>;

// =======================================================================================

const BASE_EVENT_SCHEMA = z.object({
  idempotencyKey: z.string(),
  type: z.literal("event"),
});

// =======================================================================================

const DEPTH_UPDATED_SOL_USD_PAYLOAD_SCHEMA = z.object({
  type: z.literal("depth.updated.sol_usd"),
  data: z.string(),
});

const DEPTH_UPDATED_BTC_USD_PAYLOAD_SCHEMA = z.object({
  type: z.literal("depth.updated.btc_usd"),
  data: z.string(),
});

const DEPTH_UPDATED_ETH_USD_PAYLOAD_SCHEMA = z.object({
  type: z.literal("depth.updated.eth_usd"),
  data: z.string(),
});
const LIQUIDATION_STARTED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("liquidation.started"),
  data: z.object({
    userId: z.string(),
    symbol: TRADBLE_SYMBOL_SCHEMA,
  }),
});

const LIQUIDATION_COMPLETED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("liquidation.completed"),
  data: z.object({
    userId: z.string(),
    symbol: TRADBLE_SYMBOL_SCHEMA,
  }),
});

const MARKPRICE_UPDATED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("indexprice.updated"),
  data: z.object({
    price: z.number(),
    symbol: TRADBLE_SYMBOL_SCHEMA,
  }),
});

const FUNDING_PAYLOAD_SCHEMA = z.object({
  type: z.literal("funding.created"),
  data: z.object({
    symbol: z.array(TRADBLE_SYMBOL_SCHEMA),
  }),
});

const ORDER_CREATED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("order.created"),
  data: z.object({
    filledQty: z.number(),
    orderId: z.string(),
    price: z.number(),
    qty: z.number(),
    userId: z.string(),
    side: SIDE_SCHEMA,
    type: TYPE_SCHEMA,
    symbol: TRADBLE_SYMBOL_SCHEMA,
    margin: z.number(),
    marginType: MARGIN_TYPE_SCHEMA,
    status: ORDER_STATUS_SCHEMA,
  }),
});

const FILLS_CREATED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("fills.created"),
  data: z.object({
    fills: z.array(
      z.object({
        fillId: z.string(),
        symbol: TRADBLE_SYMBOL_SCHEMA,
        qty: z.number(),
        price: z.number(),
        bidPrice: z.number(),

        buyOrderInfo: z.object({
          buyerId: z.string(),
          orderId: z.string(),
          filledQty: z.number(),
          totalQty: z.number(),
          orderStatus: ORDER_STATUS_SCHEMA,
        }),

        sellOrderInfo: z.object({
          sellerId: z.string(),
          orderId: z.string(),
          filledQty: z.number(),
          totalQty: z.number(),
          orderStatus: ORDER_STATUS_SCHEMA,
        }),
      }),
    ),
  }),
});

// =======================================================================================

const DEPTH_UPDATED_SOL_USD_SCHEMA = BASE_EVENT_SCHEMA.extend({
  payload: DEPTH_UPDATED_SOL_USD_PAYLOAD_SCHEMA,
});

const DEPTH_UPDATED_BTC_USD_SCHEMA = BASE_EVENT_SCHEMA.extend({
  payload: DEPTH_UPDATED_BTC_USD_PAYLOAD_SCHEMA,
});

const DEPTH_UPDATED_ETH_USD_SCHEMA = BASE_EVENT_SCHEMA.extend({
  payload: DEPTH_UPDATED_ETH_USD_PAYLOAD_SCHEMA,
});

const LIQUIDATION_STARTED_SCHEMA = BASE_EVENT_SCHEMA.extend({
  payload: LIQUIDATION_STARTED_PAYLOAD_SCHEMA,
});

const LIQUIDATION_COMPLETED_SCHEMA = BASE_EVENT_SCHEMA.extend({
  payload: LIQUIDATION_COMPLETED_PAYLOAD_SCHEMA,
});

const MARKPRICE_UPDATED_SCHEMA = BASE_EVENT_SCHEMA.extend({
  payload: MARKPRICE_UPDATED_PAYLOAD_SCHEMA,
});

const FUNDING_SCHEMA = BASE_EVENT_SCHEMA.extend({
  payload: FUNDING_PAYLOAD_SCHEMA,
});

const ORDER_CREATED_SCHEMA = BASE_EVENT_SCHEMA.extend({
  payload: ORDER_CREATED_PAYLOAD_SCHEMA,
});

const FILLS_CREATED_SCHEMA = BASE_EVENT_SCHEMA.extend({
  payload: FILLS_CREATED_PAYLOAD_SCHEMA,
});

// =======================================================================================

type LIQUIDATION_STARTED_EVENT = z.infer<typeof LIQUIDATION_STARTED_SCHEMA>;
type LIQUIDATION_STARTED_EVENT_PAYLOAD = z.infer<
  typeof LIQUIDATION_STARTED_PAYLOAD_SCHEMA
>;
type LIQUIDATION_COMPLETED_EVENT = z.infer<typeof LIQUIDATION_COMPLETED_SCHEMA>;
type LIQUIDATION_COMPLETED_EVENT_PAYLOAD = z.infer<
  typeof LIQUIDATION_COMPLETED_PAYLOAD_SCHEMA
>;

type MARKPRICE_UPDATED_EVENT = z.infer<typeof MARKPRICE_UPDATED_SCHEMA>;
type MARKPRICE_UPDATED_EVENT_PAYLOAD = z.infer<
  typeof MARKPRICE_UPDATED_PAYLOAD_SCHEMA
>;

type FUNDING_EVENT = z.infer<typeof FUNDING_SCHEMA>;
type FUNDING_EVENT_PAYLOAD = z.infer<typeof FUNDING_PAYLOAD_SCHEMA>;

type ORDER_CREATED_EVENT = z.infer<typeof ORDER_CREATED_SCHEMA>;

type FILLS_CREATED_EVENT = z.infer<typeof FILLS_CREATED_SCHEMA>;

// =======================================================================================

const ENGINE_EVENT_PAYLOAD_SCHEMA = z.union([
  DEPTH_UPDATED_BTC_USD_PAYLOAD_SCHEMA,
  DEPTH_UPDATED_SOL_USD_PAYLOAD_SCHEMA,
  DEPTH_UPDATED_ETH_USD_PAYLOAD_SCHEMA,
  LIQUIDATION_COMPLETED_PAYLOAD_SCHEMA,
  LIQUIDATION_STARTED_PAYLOAD_SCHEMA,
  MARKPRICE_UPDATED_PAYLOAD_SCHEMA,
  ORDER_CREATED_PAYLOAD_SCHEMA,
  FUNDING_PAYLOAD_SCHEMA,
  FILLS_CREATED_PAYLOAD_SCHEMA,
]);

const ENGINE_EVENT_SCHEMA = z.union([
  DEPTH_UPDATED_BTC_USD_SCHEMA,
  DEPTH_UPDATED_SOL_USD_SCHEMA,
  DEPTH_UPDATED_ETH_USD_SCHEMA,
  LIQUIDATION_COMPLETED_SCHEMA,
  FUNDING_SCHEMA,
  LIQUIDATION_STARTED_SCHEMA,
  MARKPRICE_UPDATED_SCHEMA,
  ORDER_CREATED_SCHEMA,
  FILLS_CREATED_SCHEMA,
]);

type ENGINE_EVENT = z.infer<typeof ENGINE_EVENT_SCHEMA>;
type ENGINE_EVENT_PAYLOAD = z.infer<typeof ENGINE_EVENT_PAYLOAD_SCHEMA>;

// =======================================================================================

export {
  ENGINE_EVENT_TYPE_SCHEMA,
  ENGINE_EVENT_SCHEMA,
  ENGINE_EVENT_PAYLOAD_SCHEMA,
  SIDE_SCHEMA,
  MARGIN_TYPE_SCHEMA,
  TYPE_SCHEMA,
  MARKPRICE_UPDATED_SCHEMA,
  CURRENCY_SYMBOL_SCHEMA,
  ORDER_STATUS_SCHEMA,
  FILLS_CREATED_SCHEMA,
  ORDER_CREATED_SCHEMA,
  TRADBLE_SYMBOL_SCHEMA,
  DEPTH_UPDATED_SOL_USD_PAYLOAD_SCHEMA,
  DEPTH_UPDATED_BTC_USD_PAYLOAD_SCHEMA,
  DEPTH_UPDATED_ETH_USD_PAYLOAD_SCHEMA,
  LIQUIDATION_STARTED_PAYLOAD_SCHEMA,
  LIQUIDATION_COMPLETED_PAYLOAD_SCHEMA,
  MARKPRICE_UPDATED_PAYLOAD_SCHEMA,
  ORDER_CREATED_PAYLOAD_SCHEMA,
  FILLS_CREATED_PAYLOAD_SCHEMA,
  FUNDING_PAYLOAD_SCHEMA,
  FUNDING_SCHEMA,
};

export type {
  SIDE,
  TRADABLE_SYMBOL,
  FILLS_CREATED_EVENT,
  ENGINE_EVENT_PAYLOAD,
  LIQUIDATION_COMPLETED_EVENT_PAYLOAD,
  LIQUIDATION_STARTED_EVENT_PAYLOAD,
  MARKPRICE_UPDATED_EVENT_PAYLOAD,
  ORDER_CREATED_EVENT,
  MARGIN_TYPE,
  TYPE,
  MARKPRICE_UPDATED_EVENT,
  ENGINE_EVENT_TYPE,
  ENGINE_EVENT,
  LIQUIDATION_STARTED_EVENT,
  LIQUIDATION_COMPLETED_EVENT,
  FUNDING_EVENT,
  FUNDING_EVENT_PAYLOAD,
  CURRENCY_SYMBOL,
};
