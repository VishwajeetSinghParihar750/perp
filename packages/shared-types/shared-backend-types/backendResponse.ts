import * as EngineResponse from "../shared-engine-types/engineResponse.js";
import { DB_RESPONSE_PAYLOAD_SCHEMA } from "./dbResponsePayload.js";

import z from "zod";

const HTTP_ERROR_RESPONSE_SCHEMA = z.object({
  error: z.literal(true),
  payload: z.string(),
});

const HTTP_SUCCESS_RESPONSE_SCHEMA = z.object({
  error: z.literal(false),
  payload: DB_RESPONSE_PAYLOAD_SCHEMA,
});

const HTTP_RESPONSE_SCHEMA = z.union([
  HTTP_ERROR_RESPONSE_SCHEMA,
  HTTP_SUCCESS_RESPONSE_SCHEMA,
]);

const DB_RESPONSE_SCHEMA = HTTP_RESPONSE_SCHEMA;

const BACKEND_RESPONSE_SCHEMA = z.union([
  EngineResponse.ENGINE_RESPONSE_SCHEMA,
  HTTP_RESPONSE_SCHEMA,
]);

type HTTP_ERROR_RESPONSE = z.infer<typeof HTTP_ERROR_RESPONSE_SCHEMA>;
type HTTP_SUCCESS_RESPONSE = z.infer<typeof HTTP_SUCCESS_RESPONSE_SCHEMA>;
type HTTP_RESPONSE = z.infer<typeof HTTP_RESPONSE_SCHEMA>;
type DB_RESPONSE = z.infer<typeof DB_RESPONSE_SCHEMA>;
type BACKEND_RESPOSNE = z.infer<typeof BACKEND_RESPONSE_SCHEMA>;

export {
  HTTP_ERROR_RESPONSE_SCHEMA,
  HTTP_SUCCESS_RESPONSE_SCHEMA,
  HTTP_RESPONSE_SCHEMA,
  DB_RESPONSE_SCHEMA,
  BACKEND_RESPONSE_SCHEMA,
};

export type {
  HTTP_ERROR_RESPONSE,
  HTTP_SUCCESS_RESPONSE,
  HTTP_RESPONSE,
  DB_RESPONSE,
  BACKEND_RESPOSNE,
};

export * from "./dbResponsePayload.js";
