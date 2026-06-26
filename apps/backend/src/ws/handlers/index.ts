import { zodBodyVerificationWebSocket } from "../../middlewares/zodBodyVerification.js";

import WebSocket from "ws";

import { BackendRequest } from "@repo/shared-types";

import EngineInterface from "../../engineInterface.js";
import { sendMessageOnWebSocket } from "../utils/messaging.js";

const engine = new EngineInterface();

function withClientRequestId<T extends { requestId: string }>(
  response: T,
  clientRequestId: string,
): T {
  return { ...response, requestId: clientRequestId };
}

async function handleAddBalanceRequest(
  req: BackendRequest.ADD_BALANCE_REQUEST,
  ws: WebSocket,
) {
  if (
    zodBodyVerificationWebSocket(BackendRequest.ADD_BALANCE_SCHEMA, req, ws)
  ) {
    console.log(
      `[WS_HANDLER] Add balance request from user: ${ws.user?.username} (${ws.user?.id}) for amount: ${req.payload.amount} marketSymbol: ${req.payload.marketSymbol}`,
    );
    try {
      const res = await engine.getEngineResponseForRequest({
        type: "add_balance",
        requestId: crypto.randomUUID(),
        stream: process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME!,

        payload: {
          userId: ws.user.id,
          amount: req.payload.amount,
          marketSymbol: req.payload.marketSymbol,
        },
      });

      console.log(
        `[WS_HANDLER] Add balance response for user: ${ws.user?.username}: ${JSON.stringify(res)}`,
      );
      sendMessageOnWebSocket(ws, withClientRequestId(res, req.requestId));
    } catch (error) {
      console.error(
        `[WS_HANDLER] Add balance failed for user: ${ws.user?.username}`,
        error,
      );
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.requestId,
      });
    }
  }
}

async function handleCreateOrderRequest(
  req: BackendRequest.CREATE_ORDER_REQUEST,
  ws: WebSocket,
) {
  if (
    zodBodyVerificationWebSocket(BackendRequest.CREATE_ORDER_SCHEMA, req, ws)
  ) {
    const { type, price, qty, marketSymbol, side, margin, marginType } =
      req.payload;
    console.log(
      `[WS_HANDLER] Create order request from user: ${ws.user?.username} (${ws.user?.id}) - ${side} ${qty} ${marketSymbol} @ $${price} (Margin: ${margin} ${marginType}, Type: ${type})`,
    );
    try {
      const res = await engine.getEngineResponseForRequest({
        type: "create_order",
        requestId: crypto.randomUUID(),
        stream: process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME!,

        payload: {
          margin,
          marginType,
          type,
          price,
          qty,
          marketSymbol,
          side,
          userId: ws.user.id,
        },
      });

      console.log(
        `[WS_HANDLER] Create order response for user: ${ws.user?.username}: ${JSON.stringify(res)}`,
      );
      if (res.type == "error") {
        sendMessageOnWebSocket(ws, withClientRequestId(res, req.requestId));
      } else if (res.type == "order_created") {
        sendMessageOnWebSocket(ws, withClientRequestId(res, req.requestId));
      }
    } catch (error) {
      console.error(
        `[WS_HANDLER] Create order failed for user: ${ws.user?.username}`,
        error,
      );

      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.requestId,
      });
    }
  }
}

async function handleGetBalanceRequest(
  req: BackendRequest.GET_BALANCE_REQUEST,
  ws: WebSocket,
) {
  if (
    zodBodyVerificationWebSocket(BackendRequest.GET_BALANCE_SCHEMA, req, ws)
  ) {
    console.log(
      `[WS_HANDLER] Get balance request from user: ${ws.user?.username} (${ws.user?.id})`,
    );
    try {
      const res = await engine.getEngineResponseForRequest({
        type: "get_balance",
        requestId: crypto.randomUUID(),
        payload: { ...req.payload, userId: ws.user.id },
        stream: process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME!,
      });

      console.log(
        `[WS_HANDLER] Get balance response for user: ${ws.user?.username}: ${JSON.stringify(res)}`,
      );
      sendMessageOnWebSocket(ws, withClientRequestId(res, req.requestId));
    } catch (error) {
      console.error(
        `[WS_HANDLER] Get balance failed for user: ${ws.user?.username}`,
        error,
      );
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.requestId,
      });
    }
  }
}

async function handleGetPositionsRequest(
  req: BackendRequest.GET_POSITION_REQUEST,
  ws: WebSocket,
) {
  if (
    zodBodyVerificationWebSocket(BackendRequest.GET_POSITION_SCHEMA, req, ws)
  ) {
    console.log(
      `[WS_HANDLER] Get position request from user: ${ws.user?.username} (${ws.user?.id})`,
    );
    try {
      const res = await engine.getEngineResponseForRequest({
        type: "get_position",
        requestId: crypto.randomUUID(),
        payload: { ...req.payload, userId: ws.user.id },
        stream: process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME!,
      });

      console.log(
        `[WS_HANDLER] Get position response for user: ${ws.user?.username}: ${JSON.stringify(res)}`,
      );
      sendMessageOnWebSocket(ws, withClientRequestId(res, req.requestId));
    } catch (error) {
      console.error(
        `[WS_HANDLER] Get position failed for user: ${ws.user?.username}`,
        error,
      );
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.requestId,
      });
    }
  }
}
async function handleEngineRequest(
  req: BackendRequest.ENGINE_REQUEST,
  ws: WebSocket,
) {
  if (
    zodBodyVerificationWebSocket(BackendRequest.ENGINE_REQUEST_SCHEMA, req, ws)
  ) {
    try {
      if (req.type == "create_order") await handleCreateOrderRequest(req, ws);
      else if (req.type == "add_balance")
        await handleAddBalanceRequest(req, ws);
      else if (req.type == "get_balance")
        await handleGetBalanceRequest(req, ws);
      else if (req.type == "get_position")
        await handleGetPositionsRequest(req, ws);
      else {
        console.log(
          `[WS_HANDLER] Fallback engine request of type: ${req.type} from user: ${ws.user?.username} (${ws.user?.id})`,
        );
        let res = await engine.getEngineResponseForRequest(
          {
            ...req,
            requestId: crypto.randomUUID(),
            stream: process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME!,
          },
          ws,
        );

        console.log(
          `[WS_HANDLER] Fallback engine request response for type: ${req.type}, user: ${ws.user?.username}: ${JSON.stringify(res)}`,
        );
        sendMessageOnWebSocket(ws, withClientRequestId(res, req.requestId));
      }
    } catch (error) {
      console.error(
        `[WS_HANDLER] Engine request failed of type: ${req.type} for user: ${ws.user?.username}`,
        error,
      );
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.requestId,
      });
    }
  }
}

const handleWsDisconnected = async (ws: WebSocket) => {
  console.log(
    `[WS_HANDLER] Handling disconnect for user: ${ws.user?.username} (${ws.user?.id})`,
  );
  await engine.handleWsDisconnected(ws);
};

const handleWebSocketMessage = async (
  ws: WebSocket,
  request: BackendRequest.BACKEND_REQUEST,
) => {
  if (BackendRequest.isEngineRequset(request)) {
    console.log(
      `[WS_HANDLER] Processing WebSocket engine message of type: ${request.type} from user: ${ws.user?.username} (${ws.user?.id})`,
    );
    if (
      zodBodyVerificationWebSocket(
        BackendRequest.ENGINE_REQUEST_SCHEMA,
        request,
        ws,
      )
    ) {
      await handleEngineRequest(request, ws);
    }
  } else {
    console.log(
      `[WS_HANDLER] Processing other/DB WebSocket message from user: ${ws.user?.username} (${ws.user?.id})`,
    );
  }
};

export {
  handleWebSocketMessage,
  handleWsDisconnected,
  engine as wsEngineInterface,
};
