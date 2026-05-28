import * as BackendRequest from "../shared-backend-types/backendRequest.js";

const BASE_REQUEST_SCHEMA = z.object({
  stream: z.string(),
});

import z from "zod";

// normal backend calls
const GET_POSITION_SCHEMA = BASE_REQUEST_SCHEMA.extend({
  requestId: z.string(),
  type: z.literal("get_position"),
  payload: z.object({
    userId: z.string(),
    symbol: BackendRequest.TRADBLE_SYMBOL_SCHEMA.optional(),
  }),
});

type GET_POSITION_REQUEST = z.infer<typeof GET_POSITION_SCHEMA>;

const CREATE_ORDER_SCHEMA = BASE_REQUEST_SCHEMA.extend({
  requestId: z.string(),
  type: z.literal("create_order"),
  payload: BackendRequest.CREATE_ORDER_PAYLOAD_SCHEMA.extend({
    userId: z.string(),
  }),
});
type CREATE_ORDER_REQUEST = z.infer<typeof CREATE_ORDER_SCHEMA>;

const GET_BALANCE_SCHEMA = BASE_REQUEST_SCHEMA.extend({
  requestId: z.string(),
  type: z.literal("get_balance"),
  payload: z.object({
    userId: z.string(),
    symbol: BackendRequest.CURRENCY_SYMBOL_SCHEMA.optional(),
  }),
});
type GET_BALANCE_REQUEST = z.infer<typeof GET_BALANCE_SCHEMA>;

const ADD_BALANCE_SCHEMA = BASE_REQUEST_SCHEMA.extend({
  requestId: z.string(),
  type: z.literal("add_balance"),
  payload: z.object({
    userId: z.string(),
    symbol: BackendRequest.CURRENCY_SYMBOL_SCHEMA,
    amount: z.number(),
  }),
});
type ADD_BALANCE_REQUEST = z.infer<typeof ADD_BALANCE_SCHEMA>;

const CANCEL_ORDER_SCHEMA = BASE_REQUEST_SCHEMA.extend(
  BackendRequest.CANCEL_ORDER_SCHEMA.shape,
);
type CANCEL_ORDER_REQUEST = z.infer<typeof CANCEL_ORDER_SCHEMA>;

const GET_DEPTH_SCHEMA = BASE_REQUEST_SCHEMA.extend(
  BackendRequest.GET_DEPTH_SCHEMA.shape,
);
type GET_DEPTH_REQUEST = z.infer<typeof GET_DEPTH_SCHEMA>;

const GET_ORDERBOOK_SCHEMA = BASE_REQUEST_SCHEMA.extend(
  BackendRequest.GET_ORDERBOOK_SCHEMA.shape,
);
type GET_ORDERBOOK_REQUEST = z.infer<typeof GET_ORDERBOOK_SCHEMA>;

const SUBSCRIBE_EVENT_SCHEMA = BASE_REQUEST_SCHEMA.extend(
  BackendRequest.SUBSCRIBE_EVENT_SCHEMA.shape,
);
type SUBSCRIBE_EVENT_REQUEST = z.infer<typeof SUBSCRIBE_EVENT_SCHEMA>;

const UNSUBSCRIBE_EVENT_SCHEMA = BASE_REQUEST_SCHEMA.extend(
  BackendRequest.UNSUBSCRIBE_EVENT_SCHEMA.shape,
);
type UNSUBSCRIBE_EVENT_REQUEST = z.infer<typeof UNSUBSCRIBE_EVENT_SCHEMA>;

const ENGINE_REQUEST_FROM_BACKEND_SCHEMA = z.union([
  CREATE_ORDER_SCHEMA,
  ADD_BALANCE_SCHEMA,
  GET_BALANCE_SCHEMA,
  CANCEL_ORDER_SCHEMA,
  GET_DEPTH_SCHEMA,
  GET_ORDERBOOK_SCHEMA,
  SUBSCRIBE_EVENT_SCHEMA,
  UNSUBSCRIBE_EVENT_SCHEMA,
  GET_POSITION_SCHEMA,
]);
type ENGINE_REQUEST_FROM_BACKEND = z.infer<
  typeof ENGINE_REQUEST_FROM_BACKEND_SCHEMA
>;

// binance updates
const MARK_PRICE_UPDATE_SYMBOL_SCHEMA = z.union([
  z.literal("BTCUSD"),
  z.literal("ETHUSD"),
  z.literal("SOLUSD"),
]);

const MARK_PRICE_UDPATED_SCHEMA = z.object({
  type: z.literal("indexprice_updated"),
  payload: z.object({
    price: z.string(),
    symbol: MARK_PRICE_UPDATE_SYMBOL_SCHEMA,
  }),
});

type MARK_PRICE_UDPATED_REQUEST = z.infer<typeof MARK_PRICE_UDPATED_SCHEMA>;

const FUNDING_CREATED_SCHEMA = z.object({
  type: z.literal("funding_created"),
});

const ENGINE_INFO_REQUEST_SCHEMA = z.union([
  MARK_PRICE_UDPATED_SCHEMA,
  FUNDING_CREATED_SCHEMA,
]);
type ENGINE_INFO_REQUEST = z.infer<typeof ENGINE_INFO_REQUEST_SCHEMA>;

const ENGINE_REQUEST_SCHEMA = z.union([
  ENGINE_REQUEST_FROM_BACKEND_SCHEMA,
  ENGINE_INFO_REQUEST_SCHEMA,
]);

function isEngineInfoRequst(request: unknown): request is ENGINE_INFO_REQUEST {
  return ENGINE_INFO_REQUEST_SCHEMA.safeParse(request).success;
}

type ENGINE_REQUEST = z.infer<typeof ENGINE_REQUEST_SCHEMA>;

export {
  ENGINE_REQUEST_SCHEMA,
  ADD_BALANCE_SCHEMA,
  CREATE_ORDER_SCHEMA,
  GET_BALANCE_SCHEMA,
  GET_DEPTH_SCHEMA,
  GET_POSITION_SCHEMA,
  GET_ORDERBOOK_SCHEMA,
  CANCEL_ORDER_SCHEMA,
  SUBSCRIBE_EVENT_SCHEMA,
  UNSUBSCRIBE_EVENT_SCHEMA,
};
export { isEngineInfoRequst };
export type {
  ENGINE_REQUEST,
  ENGINE_INFO_REQUEST,
  ENGINE_REQUEST_FROM_BACKEND,
  ADD_BALANCE_REQUEST,
  CREATE_ORDER_REQUEST,
  GET_BALANCE_REQUEST,
  GET_DEPTH_REQUEST,
  GET_ORDERBOOK_REQUEST,
  GET_POSITION_REQUEST,
  CANCEL_ORDER_REQUEST,
  SUBSCRIBE_EVENT_REQUEST,
  UNSUBSCRIBE_EVENT_REQUEST,
  MARK_PRICE_UDPATED_REQUEST,
};
