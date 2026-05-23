import { BackendRequest } from "@repo/shared-backend-types";

const BASE_REQUEST_SCHEMA = z.object({
  stream: z.string(),
});

import z from "zod";
// todo : add db request bater

const GET_POSITION_SCHEMA = z.object({
  requestId: z.string(),
  type: z.literal("get_position"),
  payload: z.object({
    userId: z.string(),
    symbol: BackendRequest.CURRENCY_SYMBOL_SCHEMA.optional(),
  }),
});
const CREATE_ORDER_SCHEMA = z.object({
  requestId: z.string(),
  type: "create_order",
  payload: BackendRequest.CREATE_ORDER_PAYLOAD_SCHEMA.extend({
    userId: z.string(),
  }),
});

const GET_BALANCE_SCHEMA = z.object({
  requestId: z.string(),
  type: z.literal("get_balance"),
  payload: z.object({
    userId: z.string(),
    symbol: BackendRequest.CURRENCY_SYMBOL_SCHEMA.optional(),
  }),
});

const ADD_BALANCE_SCHEMA = z.object({
  requestId: z.string(),
  type: z.literal("add_balance"),
  payload: z.object({
    userId: z.string(),
    symbol: BackendRequest.CURRENCY_SYMBOL_SCHEMA,
    amount: z.number(),
  }),
});
const ENGINE_REQUEST_FROM_BACKEND_SCHEMA = z.union([
  BASE_REQUEST_SCHEMA.extend(CREATE_ORDER_SCHEMA.shape),
  BASE_REQUEST_SCHEMA.extend(GET_BALANCE_SCHEMA.shape),
  BASE_REQUEST_SCHEMA.extend(ADD_BALANCE_SCHEMA.shape),
  BASE_REQUEST_SCHEMA.extend(GET_POSITION_SCHEMA.shape),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.CANCEL_ORDER_SCHEMA.shape),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.GET_DEPTH_SCHEMA.shape),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.GET_ORDERBOOK_SCHEMA.shape),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.SUBSCRIBE_EVENT_SCHEMA.shape),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.UNSUBSCRIBE_EVENT_SCHEMA.shape),
]);

const ENGINE_REQUEST_SCHEMA = z.union([ENGINE_REQUEST_FROM_BACKEND_SCHEMA]);

type ENGINE_REQUEST = z.infer<typeof ENGINE_REQUEST_SCHEMA>;
type ENGINE_REQUEST_TYPE = BackendRequest.ENGINE_REQUEST_TYPE; // more can be here like from binance one

export { ENGINE_REQUEST_SCHEMA };
export type { ENGINE_REQUEST, ENGINE_REQUEST_TYPE };
