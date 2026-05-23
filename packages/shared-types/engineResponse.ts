import z from "zod";
import {
  CURRENCY_SYMBOL_SCHEMA,
  MARGIN_TYPE_SCHEMA,
  SIDE_SCHEMA,
} from "./engineRequest.js";

const ORDER_STATUS_SCHEMA = z.union([
  z.literal("OPEN"),
  z.literal("CANCELLED"),
  z.literal("PARTIALLY_FILLED"),
  z.literal("FILLED"),
]);
const ORDER_TYPE_SCHEMA = z.union([z.literal("MARKET"), z.literal("LIMIT")]);
const ORDER_SCHEMA = z.object({
  userId: z.string(),
  price: z.number(),
  qty: z.number(),
  side: SIDE_SCHEMA,
  symbol: CURRENCY_SYMBOL_SCHEMA,
  type: ORDER_TYPE_SCHEMA,
  filledQty: z.number(),
  orderId: z.string(),
  createdAt: z.date(),

  //  for perp
  margin: z.number(),
  marginType: MARGIN_TYPE_SCHEMA,

  status: ORDER_STATUS_SCHEMA,
});

const PRICE_LEVEL_SCHEMA = z.object({
  totalQuantity: z.number(),
  orders: z.array(ORDER_SCHEMA),
});
const SYMBOL_ORDERBOOK_SCHEMA = z.object({
  BIDS: z.array(z.tuple([z.number(), PRICE_LEVEL_SCHEMA])),
});

const POSITION_TYPE_SCHEMA = z.union([z.literal("LONG"), z.literal("SHORT")]);
const POSITION_SCHEMA = z.object({
  positionId: z.string(),
  userId: z.string(),
  price: z.number(),
  qty: z.number(),
  type: POSITION_TYPE_SCHEMA,
  symbol: CURRENCY_SYMBOL_SCHEMA,
  createdAt: z.date(),
  margin: z.number(),
  marginType: MARGIN_TYPE_SCHEMA,
});

const FILL_SCHEMA = z.object({
  fillId: z.string(),
  symbol: CURRENCY_SYMBOL_SCHEMA,
  qty: z.number(),
  price: z.number(),
  bidPrice: z.number(),
  buyOrderInfo: z.object({
    buyerId: z.string(),
    orderId: z.string(),
    totalQty: z.number(),
    margin: z.number(),
    marginType: MARGIN_TYPE_SCHEMA,
  }),
  sellOrderInfo: z.object({
    sellerId: z.string(),
    orderId: z.string(),
    totalQty: z.number(),
    margin: z.number(),
    marginType: MARGIN_TYPE_SCHEMA,
  }),
});

type FILL = z.infer<typeof FILL_SCHEMA>;

const FILLS_SCHEMA = z.array(FILL_SCHEMA);
type FILLS = z.infer<typeof FILLS_SCHEMA>;

const baseResponseSchema = z.object({ requestId: z.string() });

const ORDER_CREATED_SCHEMA = baseResponseSchema.extend({
  type: z.literal("order_created"),
  payload: z.object({
    status: ORDER_STATUS_SCHEMA,
    fills: FILLS_SCHEMA,
    orderId: z.string(),
  }),
});

const ORDER_CANCELLED_SCHEMA = baseResponseSchema.extend({
  type: z.literal("order_cancelled"),
});
const EVENT_SUBSCRIBED_SCHEMA = baseResponseSchema.extend({
  type: z.literal("event_subscribed"),
});
const EVENT_UNSUBSCRIBED_SCHEMA = baseResponseSchema.extend({
  type: z.literal("event_unsubscribed"),
});
const BALANCE_SCHEMA = baseResponseSchema.extend({
  type: z.literal("balance"),
  payload: z.union([
    z.number(),
    z.partialRecord(CURRENCY_SYMBOL_SCHEMA, z.number()),
  ]),
});
const BALANCE_UPDATED_SCHEMA = baseResponseSchema.extend({
  type: z.literal("balance_updated"),
});

const DEPTH_SCHEMA = baseResponseSchema.extend({
  type: z.literal("depth"),
  payload: z.object({
    BIDS: z.array(z.object({ price: z.number(), quantity: z.number() })),
    ASKS: z.array(z.object({ price: z.number(), quantity: z.number() })),
  }),
});

const POSITION_RES_SCHEMA = baseResponseSchema.extend({
  type: z.literal("position"),
  payload: z.union([
    POSITION_SCHEMA,
    z.partialRecord(CURRENCY_SYMBOL_SCHEMA, POSITION_SCHEMA),
    z.undefined(),
  ]),
});

const ORDERBOOK_RES_SCHEMA = baseResponseSchema.extend({
  type: z.literal("orderbook"),
  payload: SYMBOL_ORDERBOOK_SCHEMA,
});

const ERROR_SCHEMA = baseResponseSchema.extend({
  type: z.literal("error"),
  payload: z.string(), // TODO LATER : this could be error names we define , to keep it simple
});

const ENGINE_RESPONSE_SCHEMA = z.union([
  ORDER_CREATED_SCHEMA,
  ORDER_CANCELLED_SCHEMA,
  BALANCE_SCHEMA,
  ERROR_SCHEMA,
  ORDERBOOK_RES_SCHEMA,
  POSITION_RES_SCHEMA,
  DEPTH_SCHEMA,
  BALANCE_UPDATED_SCHEMA,
  EVENT_SUBSCRIBED_SCHEMA,
  EVENT_UNSUBSCRIBED_SCHEMA,
]);

type ENGINE_RESPONSE = z.infer<typeof ENGINE_RESPONSE_SCHEMA>;

export { ENGINE_RESPONSE_SCHEMA };
export type { ENGINE_RESPONSE };
