import { EngineEvent } from "@repo/shared-types";

import z from "zod";

const baseSchema = z.object({ idempotencyNumber: z.number() });
const ORDER_CREATED_SCHEMA = baseSchema.extend({
  event: EngineEvent.ORDER_CREATED_SCHEMA,
});
const FILLS_CREATED_SCHEMA = baseSchema.extend({
  event: EngineEvent.FILLS_CREATED_SCHEMA,
});

const DB_POLLER_SCHEMA = z.union([ORDER_CREATED_SCHEMA, FILLS_CREATED_SCHEMA]);

type DB_POLLER_EVENT = z.infer<typeof DB_POLLER_SCHEMA>;

type ORDER_CREATED_EVENT = z.infer<typeof ORDER_CREATED_SCHEMA>;
type FILLS_CREATED_EVENT = z.infer<typeof FILLS_CREATED_SCHEMA>;

export { DB_POLLER_SCHEMA };

export type { DB_POLLER_EVENT, ORDER_CREATED_EVENT, FILLS_CREATED_EVENT };
