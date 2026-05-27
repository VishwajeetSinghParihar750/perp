import { EngineEvent } from "@repo/shared-types";

import z from "zod";

const DB_POLLER_SCHEMA = z.union([
  EngineEvent.ORDER_CREATED_SCHEMA,
  EngineEvent.FILLS_CREATED_SCHEMA,
]);

type DB_POLLER_EVENT = z.infer<typeof DB_POLLER_SCHEMA>;

type ORDER_CREATED_EVENT = EngineEvent.ORDER_CREATED_EVENT;
type FILLS_CREATED_EVENT = EngineEvent.FILLS_CREATED_EVENT;

export { DB_POLLER_SCHEMA };

export type { DB_POLLER_EVENT, ORDER_CREATED_EVENT, FILLS_CREATED_EVENT };
