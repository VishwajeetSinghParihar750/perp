import { BackendRequest } from "@repo/shared-backend-types";

const BASE_REQUEST_SCHEMA = z.object({
  stream: z.string(),
  requestId: z.string(),
});

import z from "zod";
// todo : add db request bater

const GET_POSITION_SCHEMA = z.object({
  type: z.literal("get_position"),
  payload: z.object({
    userId: z.string(),
    symbol: BackendRequest.CURRENCY_SYMBOL_SCHEMA.optional(),
  }),
});
const CREATE_ORDER_SCHEMA = z.object({
  type: "create_order",
  payload: BackendRequest.CREATE_ORDER_PAYLOAD_SCHEMA.extend({
    userId: z.string(),
  }),
});

const GET_BALANCE_SCHEMA = z.object({
  type: z.literal("get_balance"),
  payload: z.object({
    userId: z.string(),
    symbol: BackendRequest.CURRENCY_SYMBOL_SCHEMA.optional(),
  }),
});

const ADD_BALANCE_SCHEMA = z.object({
  type: z.literal("add_balance"),
  payload: z.object({
    userId: z.string(),
    symbol: BackendRequest.CURRENCY_SYMBOL_SCHEMA,
    amount: z.number(),
  }),
});
const ENGINE_REQUEST_FROM_BACKEND_SCHEMA = z.union([
  BASE_REQUEST_SCHEMA.extend(CREATE_ORDER_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(GET_BALANCE_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(ADD_BALANCE_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(GET_POSITION_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.CANCEL_ORDER_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.GET_DEPTH_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.GET_ORDERBOOK_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.SUBSCRIBE_EVENT_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.UNSUBSCRIBE_EVENT_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.ENGINE_REQUEST_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.CURRENCY_SYMBOL_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.MARGIN_TYPE_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.SIDE_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.TYPE_SCHEMA),
  BASE_REQUEST_SCHEMA.extend(BackendRequest.ENGINE_REQUEST_TYPE_SCHEMA),
]);

const ENGINE_REQUEST_SCHEMA = z.union([ENGINE_REQUEST_FROM_BACKEND_SCHEMA]);

type ENGINE_REQUEST = z.infer<typeof ENGINE_REQUEST_SCHEMA>;

export { ENGINE_REQUEST_SCHEMA };
export type { ENGINE_REQUEST };
