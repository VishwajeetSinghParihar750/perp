import z from "zod";
import {
  SIDE_SCHEMA,
  CURRENCY_SYMBOL_SCHEMA,
  MARGIN_TYPE_SCHEMA,
} from "../shared-backend-types/backendRequest.js";

import { ENGINE_EVENT_SCHEMA } from "./engineEvent.js";
import {
  FILL_ID_SCHEMA,
  ORDER_ID_SCHEMA,
  ORDER_STATUS_SCHEMA,
  PRICE_SCHEMA,
  QUANTITY_SCHEMA,
  TRADBLE_SYMBOL_SCHEMA,
  USER_ID_SCHEMA,
} from "./types.js";

const ORDER_TYPE_SCHEMA = z.union([z.literal("MARKET"), z.literal("LIMIT")]);
const ORDER_SCHEMA = z.object({
  userId: USER_ID_SCHEMA,
  price: PRICE_SCHEMA,

  quantity: QUANTITY_SCHEMA,
  side: SIDE_SCHEMA,
  marketId: TRADBLE_SYMBOL_SCHEMA,
  type: ORDER_TYPE_SCHEMA,
  filledQuantity: QUANTITY_SCHEMA,
  orderId: ORDER_ID_SCHEMA,
  //
  createdAt: z.iso.datetime(),

  //  for perp
  margin: PRICE_SCHEMA,
  marginType: MARGIN_TYPE_SCHEMA,

  status: ORDER_STATUS_SCHEMA,
});

const PRICE_LEVEL_SCHEMA = z.object({
  totalQuantity: QUANTITY_SCHEMA,
  orders: z.array(ORDER_SCHEMA),
});
const SYMBOL_ORDERBOOK_SCHEMA = z.object({
  BIDS: z.array(z.tuple([PRICE_SCHEMA, PRICE_LEVEL_SCHEMA])),
  ASKS: z.array(z.tuple([PRICE_SCHEMA, PRICE_LEVEL_SCHEMA])),
});

const POSITION_TYPE_SCHEMA = z.union([z.literal("LONG"), z.literal("SHORT")]);
const POSITION_SCHEMA = z.object({
  userId: USER_ID_SCHEMA,
  price: PRICE_SCHEMA,
  qty: z.number(),
  type: POSITION_TYPE_SCHEMA,
  symbol: CURRENCY_SYMBOL_SCHEMA,
  createdAt: z.iso.datetime(),
  margin: PRICE_SCHEMA,
  marginType: MARGIN_TYPE_SCHEMA,
});

const FILL_SCHEMA = z.object({
  fillId: FILL_ID_SCHEMA,
  symbol: CURRENCY_SYMBOL_SCHEMA,
  qty: z.number(),
  price: PRICE_SCHEMA,
  bidPrice: PRICE_SCHEMA,
  buyOrderInfo: z.object({
    buyerId: z.string(),
    orderId: ORDER_ID_SCHEMA,
    totalQty: z.number(),
    margin: PRICE_SCHEMA,
    marginType: MARGIN_TYPE_SCHEMA,
  }),
  sellOrderInfo: z.object({
    sellerId: z.string(),
    orderId: ORDER_ID_SCHEMA,
    totalQty: z.number(),
    margin: PRICE_SCHEMA,
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
    ...ORDER_SCHEMA.shape,
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
  payload: z.object({
    balance: QUANTITY_SCHEMA,
    lockedBalance: QUANTITY_SCHEMA,
  }),
});
const BALANCE_UPDATED_SCHEMA = baseResponseSchema.extend({
  type: z.literal("balance_updated"),
  payload: z.object({
    balance: QUANTITY_SCHEMA,
    lockedBalance: QUANTITY_SCHEMA,
  }),
});

const DEPTH_SCHEMA = baseResponseSchema.extend({
  type: z.literal("depth"),
  payload: z.object({
    BIDS: z.array(z.object({ price: PRICE_SCHEMA, quantity: z.number() })),
    ASKS: z.array(z.object({ price: PRICE_SCHEMA, quantity: z.number() })),
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
  ENGINE_EVENT_SCHEMA,
]);

type ENGINE_RESPONSE = z.infer<typeof ENGINE_RESPONSE_SCHEMA>;

export { ENGINE_RESPONSE_SCHEMA, FILL_SCHEMA, FILLS_SCHEMA };
export type { ENGINE_RESPONSE, FILL, FILLS };
