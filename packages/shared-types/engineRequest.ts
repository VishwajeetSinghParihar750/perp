import z from "zod";
import { ENGINE_EVENT_TYPE_SCHEMA } from "./engineEvent.js";

const SIDE_SCHEMA = z.union([z.literal("BUY"), z.literal("SELL")]);
type SIDE = z.infer<typeof SIDE_SCHEMA>;

const CURRENCY_SYMBOL_SCHEMA = z.union([
  z.literal("USD"),
  z.literal("BTCUSD"),
  z.literal("SOLUSD"),
  z.literal("ETHUSD"),
]);
type CURRENCY_SYMBOL = z.infer<typeof CURRENCY_SYMBOL_SCHEMA>;

const MARGIN_TYPE_SCHEMA = z.union([z.literal("ISOLATED"), z.literal("CROSS")]);
type MARGIN_TYPE = z.infer<typeof MARGIN_TYPE_SCHEMA>;

const baseSchema = z.object({
  stream: z.string(),
  requestId: z.string(),
});

const CREATE_ORDER_SCHEMA = baseSchema.extend({
  type: z.literal("create_order"),
  payload: z.object({
    side: SIDE_SCHEMA,
    price: z.number(),
    qty: z.number(),
    symbol: CURRENCY_SYMBOL_SCHEMA,
    userId: z.string(),
    margin: z.number(),
    marginType: MARGIN_TYPE_SCHEMA,
  }),
});

const CANCEL_ORDER_SCHEMA = baseSchema.extend({
  type: z.literal("cancel_order"),
  payload: z.object({ orderId: z.string() }),
});
const GET_BALANCE_SCHEMA = baseSchema.extend({
  type: z.literal("get_balance"),
  payload: z.object({
    userId: z.string(),
    symbol: CURRENCY_SYMBOL_SCHEMA.optional(),
  }),
});

const ADD_BALANCE_SCHEMA = baseSchema.extend({
  type: z.literal("add_balance"),
  payload: z.object({
    userId: z.string(),
    symbol: CURRENCY_SYMBOL_SCHEMA,
    amount: z.number(),
  }),
});

const GET_DEPTH_SCHEMA = baseSchema.extend({
  type: z.literal("get_depth"),
  payload: z.object({
    symbol: CURRENCY_SYMBOL_SCHEMA,
  }),
});
const GET_ORDERS_SCHEMA = baseSchema.extend({
  type: z.literal("get_orders"),
  payload: z.object({ userId: z.string(), symbol: CURRENCY_SYMBOL_SCHEMA }),
});
const GET_ORDER_SCHEMA = baseSchema.extend({
  type: z.literal("get_order"),
  payload: z.object({
    orderId: z.string(),
  }),
});
const GET_ORDERBOOK_SCHEMA = baseSchema.extend({
  type: z.literal("get_orderbook"),
  payload: z.object({
    symbol: CURRENCY_SYMBOL_SCHEMA,
  }),
});
const GET_POSITION_SCHEMA = baseSchema.extend({
  type: z.literal("get_position"),
  payload: z.object({
    userId: z.string(),
    symbol: CURRENCY_SYMBOL_SCHEMA.optional(),
  }),
});
const SUBSCRIBE_EVENT_SCHEMA = baseSchema.extend({
  type: z.literal("subscribe_event"),
  payload: z.object({ event: ENGINE_EVENT_TYPE_SCHEMA, stream: z.string() }),
});

const UNSUBSCRIBE_EVENT_SCHEMA = baseSchema.extend({
  type: z.literal("unsubscribe_event"),
  payload: z.object({
    event: ENGINE_EVENT_TYPE_SCHEMA,
    stream: z.string(),
  }),
});

const ENGINE_REQUEST_SCHEMA = z.union([
  UNSUBSCRIBE_EVENT_SCHEMA,

  SUBSCRIBE_EVENT_SCHEMA,
  GET_POSITION_SCHEMA,
  GET_ORDER_SCHEMA,
  GET_ORDER_SCHEMA,
  GET_ORDERBOOK_SCHEMA,
  GET_DEPTH_SCHEMA,
  ADD_BALANCE_SCHEMA,
  GET_BALANCE_SCHEMA,
  CANCEL_ORDER_SCHEMA,
  CREATE_ORDER_SCHEMA,
]);
type CREATE_ORDER_REQUEST = z.infer<typeof CREATE_ORDER_SCHEMA>;
type CANCEL_ORDER_REQUEST = z.infer<typeof CANCEL_ORDER_SCHEMA>;
type GET_BALANCE_REQUEST = z.infer<typeof GET_BALANCE_SCHEMA>;
type ADD_BALANCE_REQUEST = z.infer<typeof ADD_BALANCE_SCHEMA>;
type GET_DEPTH_REQUEST = z.infer<typeof GET_DEPTH_SCHEMA>;
type GET_ORDERS_REQUEST = z.infer<typeof GET_ORDERS_SCHEMA>;
type GET_ORDER_REQUEST = z.infer<typeof GET_ORDER_SCHEMA>;
type GET_ORDERBOOK_REQUEST = z.infer<typeof GET_ORDERBOOK_SCHEMA>;
type GET_POSITION_REQUEST = z.infer<typeof GET_POSITION_SCHEMA>;
type SUBSCRIBE_EVENT_REQUEST = z.infer<typeof SUBSCRIBE_EVENT_SCHEMA>;
type UNSUBSCRIBE_EVENT_REQUEST = z.infer<typeof UNSUBSCRIBE_EVENT_SCHEMA>;

type ENGINE_REQUEST =
  | CREATE_ORDER_REQUEST
  | CANCEL_ORDER_REQUEST
  | GET_BALANCE_REQUEST
  | ADD_BALANCE_REQUEST
  | GET_DEPTH_REQUEST
  | GET_ORDER_REQUEST
  | GET_ORDERS_REQUEST
  | GET_ORDERBOOK_REQUEST
  | GET_POSITION_REQUEST
  | SUBSCRIBE_EVENT_REQUEST
  | UNSUBSCRIBE_EVENT_REQUEST;

export type {
  CREATE_ORDER_REQUEST,
  CANCEL_ORDER_REQUEST,
  GET_BALANCE_REQUEST,
  ADD_BALANCE_REQUEST,
  GET_DEPTH_REQUEST,
  GET_ORDER_REQUEST,
  GET_ORDERS_REQUEST,
  GET_ORDERBOOK_REQUEST,
  GET_POSITION_REQUEST,
  SUBSCRIBE_EVENT_REQUEST,
  UNSUBSCRIBE_EVENT_REQUEST,
  ENGINE_REQUEST,
  CURRENCY_SYMBOL,
  MARGIN_TYPE,
  SIDE,
};

export {
  CREATE_ORDER_SCHEMA,
  CANCEL_ORDER_SCHEMA,
  GET_BALANCE_SCHEMA,
  ADD_BALANCE_SCHEMA,
  GET_DEPTH_SCHEMA,
  GET_ORDER_SCHEMA,
  GET_ORDERS_SCHEMA,
  GET_ORDERBOOK_SCHEMA,
  GET_POSITION_SCHEMA,
  SUBSCRIBE_EVENT_SCHEMA,
  UNSUBSCRIBE_EVENT_SCHEMA,
  ENGINE_REQUEST_SCHEMA,
  CURRENCY_SYMBOL_SCHEMA,
  MARGIN_TYPE_SCHEMA,
  SIDE_SCHEMA,
};
