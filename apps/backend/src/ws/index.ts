import { WebSocketServer } from "ws";
import {
  handleWebSocketMessage,
  handleWsDisconnected,
} from "./handlers/index.js";
import { verifyJwtToken } from "./utils/verification.js";
import { createServer } from "node:http";
import { sendMessageOnWebSocket } from "./utils/messaging.js";

const httpServer = createServer();

const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  console.log(
    `[WS] Received connection upgrade request from ${req.socket.remoteAddress}`,
  );
  wss.handleUpgrade(req, socket, head, (ws) => {
    if (!verifyJwtToken(ws, req)) {
      console.log(
        `[WS] Token verification failed for upgrade request from ${req.socket.remoteAddress}`,
      );
      ws.close(4001, "Unauthorized");
      return;
    }
    console.log(
      `[WS] Connection upgraded successfully for user: ${ws.user?.username} (${ws.user?.id})`,
    );
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws, req) => {
  console.log(
    `[WS] New WebSocket connection established for user: ${ws.user?.username} (${ws.user?.id})`,
  );

  ws.on("close", async (code) => {
    console.log(
      `[WS] WebSocket connection closed for user: ${ws.user?.username} (${ws.user?.id}) with code: ${code}`,
    );
    await handleWsDisconnected(ws);
  });

  ws.on("message", async (networkData, isBinary) => {
    if (isBinary) {
      console.error(
        `[WS] Binary data received from ${ws.user?.username}, ignoring`,
      );
      return;
    }

    try {
      const messageStr = networkData.toString();
      console.log(
        `[WS] Message received from user ${ws.user?.username}: ${messageStr}`,
      );
      const jsonParsedData = JSON.parse(messageStr);
      await handleWebSocketMessage(ws, jsonParsedData);
    } catch (error) {
      console.error(
        `[WS] Error processing message from user ${ws.user?.username}:`,
        error,
      );
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
