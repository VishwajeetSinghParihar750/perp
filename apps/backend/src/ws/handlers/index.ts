import { zodBodyVerificationWebSocket } from "../../middlewares/zodBodyVerification.js";

import WebSocket from "ws";

import {
  BackendRequest,
  BackendEvent,
  BackendResponse,
} from "@repo/shared-backend-types";

import EngineInterface from "../../engineInterface.js";
import type { EngineEvent, EngineRequest } from "@repo/shared-engine-types";
import { sendMessageOnWebSocket } from "../utils/messaging.js";

const engine = new EngineInterface();

async function handleAddBalanceRequest(
  req: BackendRequest.ADD_BALANCE_REQUEST,
  ws: WebSocket,
) {
  if (
    zodBodyVerificationWebSocket(BackendRequest.ADD_BALANCE_SCHEMA, req, ws)
  ) {
    try {
      const res = await engine.getEngineResponseForRequest({
        type: "add_balance",
        requestId: crypto.randomUUID(),
        stream: process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME!,

        payload: {
          userId: ws.user.id,
          amount: req.payload.amount,
          symbol: req.payload.symbol,
        },
      });

      if (res.type == "error") {
        sendMessageOnWebSocket(ws, res);
      } else sendMessageOnWebSocket(ws, res);
    } catch (error) {
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
    try {
      const { type, price, qty, symbol, side, margin, marginType } =
        req.payload;

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
          symbol,
          side,
          userId: ws.user.id,
        },
      });

      if (res.type == "error") {
        sendMessageOnWebSocket(ws, {
          payload: res.payload,
          requestId: req.requestId,
          type: "error",
        });
      } else if (res.type == "order_created")
        sendMessageOnWebSocket(ws, {
          payload: res.payload,
          requestId: req.requestId,
          type: "order_created",
        });
    } catch (error) {
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
  if (zodBodyVerificationWebSocket(BackendRequest.GET_BALANCE_SCHEMA, req, ws))
    try {
      const res = await engine.getEngineResponseForRequest({
        type: "get_balance",
        requestId: req.requestId,
        payload: { ...req.payload, userId: ws.user.id },
        stream: process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME!,
      });

      sendMessageOnWebSocket(ws, res);
    } catch (error) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.requestId,
      });
    }
}

async function handleGetPositionsRequest(
  req: BackendRequest.GET_POSITION_REQUEST,
  ws: WebSocket,
) {
  if (zodBodyVerificationWebSocket(BackendRequest.GET_POSITION_SCHEMA, req, ws))
    try {
      const res = await engine.getEngineResponseForRequest({
        type: "get_position",
        requestId: req.requestId,
        payload: { ...req.payload, userId: ws.user.id },
        stream: process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME!,
      });

      sendMessageOnWebSocket(ws, res);
    } catch (error) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.requestId,
      });
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
        let res = await engine.getEngineResponseForRequest({
          ...req,
          stream: process.env.REDIS_ENGINE_RECEIVE_STREAM_NAME!,
        });

        sendMessageOnWebSocket(ws, res);
      }
    } catch (error) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.requestId,
      });
    }
  }
}

const handleWebSocketMessage = async (
  ws: WebSocket,
  request: BackendRequest.BACKEND_REQUEST,
) => {
  console.log(request);
  if (BackendRequest.isEngineRequset(request)) {
    await handleEngineRequest(request, ws);
  }
};

export { handleWebSocketMessage, engine as wsEngineInterface };
