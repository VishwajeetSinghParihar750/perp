import z from "zod";

import { ENGINE_EVENT_SCHEMA } from "./engineEvent.js";
import {
  ORDER_CREATED_RESPONSE_PAYLOAD_SCHEMA,
  ORDER_CANCELLED_RESPONSE_PAYLOAD_SCHEMA,
  BALANCE_RESPONSE_PAYLOAD_SCHEMA,
  BALANCE_UPDATED_RESPONSE_PAYLOAD_SCHEMA,
  DEPTH_RESPONSE_PAYLOAD_SCHEMA,
  POSITION_RESPONSE_PAYLOAD_SCHEMA,
  ORDERBOOK_RESPONSE_PAYLOAD_SCHEMA,
  ERROR_RESPONSE_PAYLOAD_SCHEMA,
  ENGINE_RESPONSE_PAYLOAD_SCHEMA,
} from "./engineResponsePayload.js";

import {
  FILL_ID_SCHEMA,
  ORDER_ID_SCHEMA,
  PRICE_SCHEMA,
  CURRENCY_SYMBOL_SCHEMA,
  MARGIN_TYPE_SCHEMA,
} from "./types.js";

// =======================================================================================

const RESPONSE_TYPE_SCHEMA = z.union([
  z.literal("order_created"),
  z.literal("order_cancelled"),
  z.literal("event_subscribed"),
  z.literal("event_unsubscribed"),
  z.literal("balance"),
  z.literal("balance_updated"),
  z.literal("depth"),
  z.literal("position"),
  z.literal("orderbook"),
  z.literal("error"),
]);
type RESPONSE_TYPE = z.infer<typeof RESPONSE_TYPE_SCHEMA>;

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

// =======================================================================================

const ORDER_CREATED_SCHEMA = baseResponseSchema.extend({
  type: z.literal("order_created"),
  payload: ORDER_CREATED_RESPONSE_PAYLOAD_SCHEMA,
});

const ORDER_CANCELLED_SCHEMA = baseResponseSchema.extend({
  type: z.literal("order_cancelled"),
  payload: ORDER_CANCELLED_RESPONSE_PAYLOAD_SCHEMA,
});

const EVENT_SUBSCRIBED_SCHEMA = baseResponseSchema.extend({
  type: z.literal("event_subscribed"),
});

const EVENT_UNSUBSCRIBED_SCHEMA = baseResponseSchema.extend({
  type: z.literal("event_unsubscribed"),
});

const BALANCE_SCHEMA = baseResponseSchema.extend({
  type: z.literal("balance"),
  payload: BALANCE_RESPONSE_PAYLOAD_SCHEMA,
});

const BALANCE_UPDATED_SCHEMA = baseResponseSchema.extend({
  type: z.literal("balance_updated"),
  payload: BALANCE_UPDATED_RESPONSE_PAYLOAD_SCHEMA,
});

const DEPTH_SCHEMA = baseResponseSchema.extend({
  type: z.literal("depth"),
  payload: DEPTH_RESPONSE_PAYLOAD_SCHEMA,
});

const POSITION_RES_SCHEMA = baseResponseSchema.extend({
  type: z.literal("position"),
  payload: POSITION_RESPONSE_PAYLOAD_SCHEMA,
});

const ORDERBOOK_RES_SCHEMA = baseResponseSchema.extend({
  type: z.literal("orderbook"),
  payload: ORDERBOOK_RESPONSE_PAYLOAD_SCHEMA,
});

const ERROR_SCHEMA = baseResponseSchema.extend({
  type: z.literal("error"),
  payload: ERROR_RESPONSE_PAYLOAD_SCHEMA,
});

// =======================================================================================

type ORDER_CREATED_RESPONSE = z.infer<typeof ORDER_CREATED_SCHEMA>;
type ORDER_CANCELLED_RESPONSE = z.infer<typeof ORDER_CANCELLED_SCHEMA>;
type EVENT_SUBSCRIBED_RESPONSE = z.infer<typeof EVENT_SUBSCRIBED_SCHEMA>;
type EVENT_UNSUBSCRIBED_RESPONSE = z.infer<typeof EVENT_UNSUBSCRIBED_SCHEMA>;
type BALANCE_RESPONSE = z.infer<typeof BALANCE_SCHEMA>;
type BALANCE_UPDATED_RESPONSE = z.infer<typeof BALANCE_UPDATED_SCHEMA>;
type DEPTH_RESPONSE = z.infer<typeof DEPTH_SCHEMA>;
type POSITION_RES = z.infer<typeof POSITION_RES_SCHEMA>;
type ORDERBOOK_RES = z.infer<typeof ORDERBOOK_RES_SCHEMA>;
type ERROR_RESPONSE = z.infer<typeof ERROR_SCHEMA>;

// =======================================================================================

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

// =======================================================================================

export {
  ENGINE_RESPONSE_SCHEMA,
  FILL_SCHEMA,
  FILLS_SCHEMA,
  RESPONSE_TYPE_SCHEMA,
  ORDER_CREATED_SCHEMA,
  ORDER_CANCELLED_SCHEMA,
  EVENT_SUBSCRIBED_SCHEMA,
  EVENT_UNSUBSCRIBED_SCHEMA,
  BALANCE_SCHEMA,
  BALANCE_UPDATED_SCHEMA,
  DEPTH_SCHEMA,
  POSITION_RES_SCHEMA,
  ORDERBOOK_RES_SCHEMA,
  ERROR_SCHEMA,
  ENGINE_RESPONSE_PAYLOAD_SCHEMA,
};

export type {
  ENGINE_RESPONSE,
  FILL,
  FILLS,
  RESPONSE_TYPE,
  ORDER_CREATED_RESPONSE,
  ORDER_CANCELLED_RESPONSE,
  EVENT_SUBSCRIBED_RESPONSE,
  EVENT_UNSUBSCRIBED_RESPONSE,
  BALANCE_RESPONSE,
  BALANCE_UPDATED_RESPONSE,
  DEPTH_RESPONSE,
  POSITION_RES,
  ORDERBOOK_RES,
  ERROR_RESPONSE,
};
