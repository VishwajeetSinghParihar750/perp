import { EngineEvent } from "@repo/shared-engine-types";

import z from "zod";
// todo : add db events later

const BACKEND_EVENT_SCHEMA = z.union([EngineEvent.ENGINE_EVENT_SCHEMA]);
type BACKEND_EVENT = z.infer<typeof BACKEND_EVENT_SCHEMA>;

export { BACKEND_EVENT_SCHEMA };
export type { BACKEND_EVENT };
