import z from "zod";
import {
  TRADBLE_SYMBOL_SCHEMA,
  ORDER_STATUS_SCHEMA,
  SIDE_SCHEMA,
  MARGIN_TYPE_SCHEMA,
  TYPE_SCHEMA,
  USER_ID_SCHEMA,
  PRICE_SCHEMA,
  QUANTITY_SCHEMA,
  ORDER_ID_SCHEMA,
  FILL_ID_SCHEMA,
} from "./types.js";

const BASE_EVENT_SCHEMA = z.object({
  idempotencyKey: z.string(),
  type: z.literal("event"),
});

// =======================================================================================

const USER_PNL_CREATED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("userpnl.created"),
  data: z.object({
    userId: USER_ID_SCHEMA,
    pnl: z.number(),
    releasedMargin: z.number(),
  }),
});

const DEPTH_UPDATED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("depth.updated"),
  data: z.object({
    symbol: TRADBLE_SYMBOL_SCHEMA,
    depthUpdates: {
      asks: z.record(PRICE_SCHEMA, QUANTITY_SCHEMA),
      bids: z.record(PRICE_SCHEMA, QUANTITY_SCHEMA),
    },
  }),
});

const INDEXPRICE_UPDATED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("indexprice.updated"),
  data: z.object({
    price: PRICE_SCHEMA,
    symbol: TRADBLE_SYMBOL_SCHEMA,
  }),
});

const LAST_TRADED_PRICE_UPDATED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("lastTradedPrice.updated"),
  data: z.object({
    price: PRICE_SCHEMA,
    symbol: TRADBLE_SYMBOL_SCHEMA,
  }),
});

const TRADES_CREATED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("trades.created"),
  data: z.object({
    symbol: TRADBLE_SYMBOL_SCHEMA,
    trades: z.array(z.tuple([PRICE_SCHEMA, QUANTITY_SCHEMA])), // array of [price, position ]
  }),
});

const ORDER_CANCELLED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("order.cancelled"),
  data: z.object({
    orderId: ORDER_ID_SCHEMA,
  }),
});

const LIQUIDATION_STARTED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("liquidation.started"),
  data: z.object({
    userId: USER_ID_SCHEMA,
    symbol: TRADBLE_SYMBOL_SCHEMA,
  }),
});

const LIQUIDATION_COMPLETED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("liquidation.completed"),
  data: z.object({
    userId: USER_ID_SCHEMA,
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
    filledQty: QUANTITY_SCHEMA,
    orderId: ORDER_ID_SCHEMA,
    price: PRICE_SCHEMA,
    qty: QUANTITY_SCHEMA,
    userId: USER_ID_SCHEMA,
    side: SIDE_SCHEMA,
    type: TYPE_SCHEMA,
    symbol: TRADBLE_SYMBOL_SCHEMA,
    margin: PRICE_SCHEMA,
    marginType: MARGIN_TYPE_SCHEMA,
    status: ORDER_STATUS_SCHEMA,
  }),
});

const FILLS_CREATED_PAYLOAD_SCHEMA = z.object({
  type: z.literal("fills.created"),
  data: z.object({
    fills: z.array(
      z.object({
        fillId: FILL_ID_SCHEMA,
        symbol: TRADBLE_SYMBOL_SCHEMA,
        qty: QUANTITY_SCHEMA,

        price: PRICE_SCHEMA,
        bidPrice: PRICE_SCHEMA,

        buyOrderInfo: z.object({
          buyerId: USER_ID_SCHEMA,
          orderId: ORDER_ID_SCHEMA,
          filledQty: QUANTITY_SCHEMA,
          totalQty: QUANTITY_SCHEMA,
          orderStatus: ORDER_STATUS_SCHEMA,
        }),

        sellOrderInfo: z.object({
          sellerId: USER_ID_SCHEMA,
          orderId: ORDER_ID_SCHEMA,
          filledQty: QUANTITY_SCHEMA,

          totalQty: QUANTITY_SCHEMA,

          orderStatus: ORDER_STATUS_SCHEMA,
        }),
      }),
    ),
  }),
});

// =======================================================================================

type USER_PNL_CREATED_EVENT_PAYLOAD = z.infer<
  typeof USER_PNL_CREATED_PAYLOAD_SCHEMA
>;
type LIQUIDATION_STARTED_EVENT_PAYLOAD = z.infer<
  typeof LIQUIDATION_STARTED_PAYLOAD_SCHEMA
>;

type LIQUIDATION_COMPLETED_EVENT_PAYLOAD = z.infer<
  typeof LIQUIDATION_COMPLETED_PAYLOAD_SCHEMA
>;
type INDEXPRICE_UPDATED_EVENT_PAYLOAD = z.infer<
  typeof INDEXPRICE_UPDATED_PAYLOAD_SCHEMA
>;
type LAST_TRADED_PRICE_UPDATED_EVENT_PAYLOAD = z.infer<
  typeof LAST_TRADED_PRICE_UPDATED_PAYLOAD_SCHEMA
>;
type FILLS_CREATED_EVENT_PAYLOAD = z.infer<typeof FILLS_CREATED_PAYLOAD_SCHEMA>;
type TRADES_CREATED_EVENT_PAYLOAD = z.infer<
  typeof TRADES_CREATED_PAYLOAD_SCHEMA
>;
type FUNDING_EVENT_PAYLOAD = z.infer<typeof FUNDING_PAYLOAD_SCHEMA>;
type ORDER_CANCELLED_EVENT_PAYLOAD = z.infer<
  typeof ORDER_CANCELLED_PAYLOAD_SCHEMA
>;

// =======================================================================================

const ENGINE_EVENT_PAYLOAD_SCHEMA = z.union([
  DEPTH_UPDATED_PAYLOAD_SCHEMA,
  LIQUIDATION_COMPLETED_PAYLOAD_SCHEMA,
  LIQUIDATION_STARTED_PAYLOAD_SCHEMA,
  INDEXPRICE_UPDATED_PAYLOAD_SCHEMA,
  ORDER_CREATED_PAYLOAD_SCHEMA,
  FUNDING_PAYLOAD_SCHEMA,
  FILLS_CREATED_PAYLOAD_SCHEMA,
  TRADES_CREATED_PAYLOAD_SCHEMA,
  LAST_TRADED_PRICE_UPDATED_PAYLOAD_SCHEMA,
  ORDER_CANCELLED_PAYLOAD_SCHEMA,
  USER_PNL_CREATED_PAYLOAD_SCHEMA,
]);
type ENGINE_EVENT_PAYLOAD = z.infer<typeof ENGINE_EVENT_PAYLOAD_SCHEMA>;

// =======================================================================================

export { ENGINE_EVENT_PAYLOAD_SCHEMA, BASE_EVENT_SCHEMA };
export type {
  ENGINE_EVENT_PAYLOAD,
  USER_PNL_CREATED_EVENT_PAYLOAD,
  LIQUIDATION_STARTED_EVENT_PAYLOAD,
  LIQUIDATION_COMPLETED_EVENT_PAYLOAD,
  INDEXPRICE_UPDATED_EVENT_PAYLOAD,
  LAST_TRADED_PRICE_UPDATED_EVENT_PAYLOAD,
  FILLS_CREATED_EVENT_PAYLOAD,
  FUNDING_EVENT_PAYLOAD,
  TRADES_CREATED_EVENT_PAYLOAD,
  ORDER_CANCELLED_EVENT_PAYLOAD,
};

export {
  DEPTH_UPDATED_PAYLOAD_SCHEMA,
  LIQUIDATION_COMPLETED_PAYLOAD_SCHEMA,
  LIQUIDATION_STARTED_PAYLOAD_SCHEMA,
  INDEXPRICE_UPDATED_PAYLOAD_SCHEMA,
  ORDER_CREATED_PAYLOAD_SCHEMA,
  FUNDING_PAYLOAD_SCHEMA,
  FILLS_CREATED_PAYLOAD_SCHEMA,
  TRADES_CREATED_PAYLOAD_SCHEMA,
  LAST_TRADED_PRICE_UPDATED_PAYLOAD_SCHEMA,
  ORDER_CANCELLED_PAYLOAD_SCHEMA,
  USER_PNL_CREATED_PAYLOAD_SCHEMA,
};
