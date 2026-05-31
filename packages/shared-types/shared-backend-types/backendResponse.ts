import * as EngineResponse from "../shared-engine-types/engineResponse.js";

import z from "zod";
// todo : add db request bater
// todo : add mroe contracts when frontend actually exists

const BACKEND_RESPONSE_SCHEMA = z.union([
  EngineResponse.ENGINE_RESPONSE_SCHEMA,
]);

type BACKEND_RESPOSNE = z.infer<typeof BACKEND_RESPONSE_SCHEMA>;

export { BACKEND_RESPONSE_SCHEMA };
export type { BACKEND_RESPOSNE };
