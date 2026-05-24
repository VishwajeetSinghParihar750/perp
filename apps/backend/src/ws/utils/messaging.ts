import WebSocket from "ws";

import { BackendResponse } from "@repo/shared-types";

const sendMessageOnWebSocket = (
  ws: WebSocket,
  message: BackendResponse.BACKEND_RESPOSNE,
) => {
  ws.send(JSON.stringify(message));
};
export { sendMessageOnWebSocket };
