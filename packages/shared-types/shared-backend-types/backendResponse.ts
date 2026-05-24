import * as EngineResponse from "../shared-engine-types/engineResponse.js";

import z from "zod";
// todo : add db request bater

const BACKEND_RESPOSNE_SCHEMA = z.union([
  EngineResponse.ENGINE_RESPONSE_SCHEMA,
]);

type BACKEND_RESPOSNE = z.infer<typeof BACKEND_RESPOSNE_SCHEMA>;

export { BACKEND_RESPOSNE_SCHEMA };
export type { BACKEND_RESPOSNE };
