import { WebSocketServer } from "ws";
import { handleWebSocketMessage } from "./handlers/index.js";
import { verifyJwtToken } from "./utils/verification.js";
import { createServer } from "node:http";
import { sendMessageOnWebSocket } from "./utils/messaging.js";

const httpServer = createServer();

const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws, req) => {
  if (!verifyJwtToken(ws, req)) {
    ws.close(400, "BAD_CONNECTION_URL");
    return;
  }

  ws.on("message", async (networkData, isBinary) => {
    if (isBinary) {
      console.error("is binary data, ignoring");
      return;
    }

    try {
      const jsonParsedData = JSON.parse(networkData.toString());
      await handleWebSocketMessage(ws, jsonParsedData);
    } catch (error) {
      // sendMessageOnWebSocket(ws, {
      // type: "error",
      // payload: "wrong message format",
      // });
      sendMessageOnWebSocket(ws, {
        type: "error",
        requestId: "0",
        payload: "error happened in either parsing request or handling request",
      });
    }
  });
});

export { httpServer as wsServer };
