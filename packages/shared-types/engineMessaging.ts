type ENGINE_REQUEST_TYPE =
  | "create_order"
  | "cancel_order"
  | "get_balance"
  | "add_balance"
  | "get_depth"
  | "get_orders"
  | "get_order"
  | "get_orderbook"
  | "get_position"
  | "subscribe_event"
  | "unsubscribe_event";

type ENGINE_RESPONSE_TYPE =
  | "order_created"
  | "order_cancelled"
  | "event_subscribed"
  | "event_unsubscribed"
  | "balance"
  | "balance_updated"
  | "depth"
  | "position"
  | "orders"
  | "orderbook"
  | "order"
  | "fills"
  | "error"; // for anything that did not succeed

type ENGINE_REQUEST = {
  stream: string;
  requestId: string;
  type: ENGINE_REQUEST_TYPE;
  payload?: any;
};
type ENGINE_RESPONSE = {
  requestId: string;
  type: ENGINE_RESPONSE_TYPE;
  payload?: any;
};
export type {
  ENGINE_REQUEST,
  ENGINE_REQUEST_TYPE,
  ENGINE_RESPONSE,
  ENGINE_RESPONSE_TYPE,
};
