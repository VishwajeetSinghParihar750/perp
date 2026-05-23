import z from "zod";
import { EngineEvent } from "@repo/shared-engine-types";

const SIDE_SCHEMA = z.union([z.literal("BUY"), z.literal("SELL")]);
type SIDE = z.infer<typeof SIDE_SCHEMA>;

const TYPE_SCHEMA = z.union([z.literal("MARKET"), z.literal("LIMIT")]);
type TYPE = z.infer<typeof SIDE_SCHEMA>;

const CURRENCY_SYMBOL_SCHEMA = z.union([
  z.literal("USD"),
  z.literal("BTCUSD"),
  z.literal("SOLUSD"),
  z.literal("ETHUSD"),
]);
type CURRENCY_SYMBOL = z.infer<typeof CURRENCY_SYMBOL_SCHEMA>;

const MARGIN_TYPE_SCHEMA = z.union([z.literal("ISOLATED"), z.literal("CROSS")]);
type MARGIN_TYPE = z.infer<typeof MARGIN_TYPE_SCHEMA>;

const ENGINE_REQUEST_TYPE_SCHEMA = z.union([
  z.literal("create_order"),
  z.literal("cancel_order"),
  z.literal("get_position"),
  z.literal("get_balance"),
  z.literal("add_balance"),
  z.literal("get_depth"),
  z.literal("get_orderbook"),
  z.literal("subscribe_event"),
  z.literal("unsubscribe_event"),
]);
type ENGINE_REQUEST_TYPE = z.infer<typeof ENGINE_REQUEST_TYPE_SCHEMA>;

const CREATE_ORDER_PAYLOAD_SCHEMA = z.object({
  side: SIDE_SCHEMA,
  price: z.number(),
  qty: z.number(),
  symbol: CURRENCY_SYMBOL_SCHEMA,
  margin: z.number(),
  marginType: MARGIN_TYPE_SCHEMA,
  type: TYPE_SCHEMA,
});

const CREATE_ORDER_SCHEMA = z.object({
  type: z.literal("create_order"),
  payload: CREATE_ORDER_PAYLOAD_SCHEMA,
});

const CANCEL_ORDER_SCHEMA = z.object({
  type: z.literal("cancel_order"),
  payload: z.object({ orderId: z.string() }),
});

const GET_BALANCE_SCHEMA = z.object({
  type: z.literal("get_balance"),
  payload: z.object({
    symbol: CURRENCY_SYMBOL_SCHEMA.optional(),
  }),
});

const ADD_BALANCE_SCHEMA = z.object({
  type: z.literal("add_balance"),
  payload: z.object({
    symbol: CURRENCY_SYMBOL_SCHEMA,
    amount: z.number(),
  }),
});

const GET_DEPTH_SCHEMA = z.object({
  type: z.literal("get_depth"),
  payload: z.object({
    symbol: CURRENCY_SYMBOL_SCHEMA,
  }),
});
const GET_ORDERBOOK_SCHEMA = z.object({
  type: z.literal("get_orderbook"),
  payload: z.object({
    symbol: CURRENCY_SYMBOL_SCHEMA,
  }),
});
const GET_POSITION_SCHEMA = z.object({
  type: z.literal("get_position"),
  payload: z.object({
    symbol: CURRENCY_SYMBOL_SCHEMA.optional(),
  }),
});
const SUBSCRIBE_EVENT_SCHEMA = z.object({
  type: z.literal("subscribe_event"),
  payload: z.object({
    event: EngineEvent.ENGINE_EVENT_TYPE_SCHEMA,
    stream: z.string(),
  }),
});

const UNSUBSCRIBE_EVENT_SCHEMA = z.object({
  type: z.literal("unsubscribe_event"),
  payload: z.object({
    event: EngineEvent.ENGINE_EVENT_TYPE_SCHEMA,
    stream: z.string(),
  }),
});

const ENGINE_REQUEST_SCHEMA = z.union([
  UNSUBSCRIBE_EVENT_SCHEMA,
  SUBSCRIBE_EVENT_SCHEMA,
  GET_POSITION_SCHEMA,
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
type GET_ORDERBOOK_REQUEST = z.infer<typeof GET_ORDERBOOK_SCHEMA>;
type GET_POSITION_REQUEST = z.infer<typeof GET_POSITION_SCHEMA>;
type SUBSCRIBE_EVENT_REQUEST = z.infer<typeof SUBSCRIBE_EVENT_SCHEMA>;
type UNSUBSCRIBE_EVENT_REQUEST = z.infer<typeof UNSUBSCRIBE_EVENT_SCHEMA>;

type ENGINE_REQUEST = z.infer<typeof ENGINE_REQUEST_SCHEMA>;

export type {
  CREATE_ORDER_REQUEST,
  CANCEL_ORDER_REQUEST,
  GET_BALANCE_REQUEST,
  ADD_BALANCE_REQUEST,
  GET_DEPTH_REQUEST,
  GET_ORDERBOOK_REQUEST,
  GET_POSITION_REQUEST,
  SUBSCRIBE_EVENT_REQUEST,
  UNSUBSCRIBE_EVENT_REQUEST,
  ENGINE_REQUEST,
  CURRENCY_SYMBOL,
  MARGIN_TYPE,
  SIDE,
  TYPE,
  ENGINE_REQUEST_TYPE,
};

export {
  CREATE_ORDER_SCHEMA,
  CANCEL_ORDER_SCHEMA,
  GET_BALANCE_SCHEMA,
  ADD_BALANCE_SCHEMA,
  GET_DEPTH_SCHEMA,
  GET_ORDERBOOK_SCHEMA,
  GET_POSITION_SCHEMA,
  SUBSCRIBE_EVENT_SCHEMA,
  UNSUBSCRIBE_EVENT_SCHEMA,
  ENGINE_REQUEST_SCHEMA,
  CURRENCY_SYMBOL_SCHEMA,
  MARGIN_TYPE_SCHEMA,
  SIDE_SCHEMA,
  TYPE_SCHEMA,
  ENGINE_REQUEST_TYPE_SCHEMA,
  CREATE_ORDER_PAYLOAD_SCHEMA,
};
