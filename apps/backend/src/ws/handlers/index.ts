import { zodBodyVerificationWebSocket } from "../../middlewares/zodBodyVerification.js";
import type { WS_REQUEST } from "../../types/wsServer.js";
import {
  addBalanceSchema,
  getBalanceSchema,
} from "../../validations/balance.js";
import WebSocket from "ws";
import {
  createOrderSchema,
  deleteOrderSchema,
  getDepthSchema,
  getOrderbookSchema,
  getOrderSchema,
} from "../../validations/order.js";
import { sendMessageOnWebSocket } from "../utils/messaging.js";
import {
  subscribeEventSchema,
  unsubscribeEventSchema,
} from "../../validations/subscribeEvent.js";
import EngineInterface from "../../engineInterface.js";
import { getPositionSchema } from "../../validations/positions.js";
import type { ENGINE_EVENT_TYPE } from "@repo/shared-types";

const engine = new EngineInterface();

async function handleAddBalanceRequest(req: WS_REQUEST, ws: WebSocket) {
  if (zodBodyVerificationWebSocket(addBalanceSchema, req, ws)) {
    try {
      const { type, payload } = await engine.getEngineResponseForRequest(
        "add_balance",
        {
          userId: ws.user.id,
          amount: req.payload.amount,
          symbol: req.payload.symbol,
        },
      );

      if (type == "error") {
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "error",
        });
      } else
        sendMessageOnWebSocket(ws, {
          payload: null,
          requestId: req.rqeuestId,
          type: "balance_updated",
        });
    } catch (error) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.rqeuestId,
      });
    }
  }
}

async function handleCreateOrderRequest(req: WS_REQUEST, ws: WebSocket) {
  if (zodBodyVerificationWebSocket(createOrderSchema, req, ws)) {
    try {
      const { type, price, qty, symbol, side } = req.payload;

      const { type: responseType, payload } =
        await engine.getEngineResponseForRequest("create_order", {
          type,
          side,
          price,
          qty,
          symbol,
          userId: ws.user.id,
        });

      if (responseType == "error") {
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "error",
        });
      } else
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "order_created",
        });
    } catch (error) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.rqeuestId,
      });
    }
  }
}

async function handleGetOrderRequest(req: WS_REQUEST, ws: WebSocket) {
  if (zodBodyVerificationWebSocket(getOrderSchema, req, ws)) {
    try {
      const { orderId } = req.payload;

      const { type: resType, payload } =
        await engine.getEngineResponseForRequest("get_order", { orderId });

      if (resType == "error") {
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "error",
        });
      } else
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "order",
        });
    } catch (error) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.rqeuestId,
      });
    }
  }
}

async function handleCancelOrderRequest(req: WS_REQUEST, ws: WebSocket) {
  if (zodBodyVerificationWebSocket(deleteOrderSchema, req, ws)) {
    try {
      const { orderId } = req.payload;

      const { type: resType, payload } =
        await engine.getEngineResponseForRequest("cancel_order", { orderId });

      if (resType == "error") {
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "error",
        });
      } else
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "order_cancelled",
        });
    } catch (error) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.rqeuestId,
      });
    }
  }
}

async function handleGetDepthRequest(req: WS_REQUEST, ws: WebSocket) {
  if (zodBodyVerificationWebSocket(getDepthSchema, req, ws)) {
    try {
      const { symbol } = req.payload;
      const { type: resType, payload } =
        await engine.getEngineResponseForRequest("get_depth", {
          symbol: symbol,
        });

      if (resType == "error") {
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "error",
        });
      } else
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "depth",
        });
    } catch (error) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.rqeuestId,
      });
    }
  }
}

async function handleGetOrdersRequest(req: WS_REQUEST, ws: WebSocket) {
  try {
    const { type: resType, payload } = await engine.getEngineResponseForRequest(
      "get_orders",

      {},
    );

    if (resType == "error") {
      sendMessageOnWebSocket(ws, {
        payload,
        requestId: req.rqeuestId,
        type: "error",
      });
    } else
      sendMessageOnWebSocket(ws, {
        payload,
        requestId: req.rqeuestId,
        type: "orders",
      });
  } catch (error) {
    sendMessageOnWebSocket(ws, {
      type: "error",
      payload: "INTERNAL_SERVER_ERROR",
      requestId: req.rqeuestId,
    });
  }
}

async function handleGetOrderbookRequest(req: WS_REQUEST, ws: WebSocket) {
  if (zodBodyVerificationWebSocket(getOrderbookSchema, req, ws))
    try {
      const { type: resType, payload } =
        await engine.getEngineResponseForRequest("get_orderbook", {
          symbol: req.payload.symbol,
        });

      if (resType == "error") {
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "error",
        });
      } else
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "orderbook",
        });
    } catch (error) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.rqeuestId,
      });
    }
}

async function handleGetPositionsRequest(req: WS_REQUEST, ws: WebSocket) {
  if (zodBodyVerificationWebSocket(getPositionSchema, req, ws))
    try {
      const { type: resType, payload } =
        await engine.getEngineResponseForRequest("get_position", {
          symbol: req.payload?.symbol,
        });

      if (resType == "error") {
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "error",
        });
      } else
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "position",
        });
    } catch (error) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.rqeuestId,
      });
    }
}

async function handleGetFillsRequest(req: WS_REQUEST, ws: WebSocket) {
  try {
    // const { type: resType, payload } = await engine.getEngineResponseForRequest(
    //   "get_fills",
    //   {},
    // );
    // if (resType == "error") {
    //   sendMessageOnWebSocket(ws, {
    //     payload,
    //     requestId: req.rqeuestId,
    //     type: "error",
    //   });
    // } else
    //   sendMessageOnWebSocket(ws, {
    //     payload,
    //     requestId: req.rqeuestId,
    //     type: "fills",
    //   });
  } catch (error) {
    sendMessageOnWebSocket(ws, {
      type: "error",
      payload: "INTERNAL_SERVER_ERROR",
      requestId: req.rqeuestId,
    });
  }
}

async function handleGetBalanceRequest(req: WS_REQUEST, ws: WebSocket) {
  if (zodBodyVerificationWebSocket(getBalanceSchema, req, ws)) {
    try {
      const { symbol } = req.payload;

      const { type: resType, payload } =
        await engine.getEngineResponseForRequest("get_balance", {
          userId: ws.user.id,
          symbol,
        });

      if (resType == "error") {
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "error",
        });
      } else
        sendMessageOnWebSocket(ws, {
          payload,
          requestId: req.rqeuestId,
          type: "balance",
        });
    } catch (error) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: "INTERNAL_SERVER_ERROR",
        requestId: req.rqeuestId,
      });
    }
  }
}

async function handleSubscribeEventRequest(req: WS_REQUEST, ws: WebSocket) {
  if (zodBodyVerificationWebSocket(subscribeEventSchema, req, ws)) {
    try {
      const { eventType }: { eventType: ENGINE_EVENT_TYPE } = req.payload;

      //
      await engine.subscribeEvent(eventType, ws);

      switch (eventType) {
        case "depth.updated.btc_usd":
          engine.subscribeEvent(eventType, ws);
          break;
        case "depth.updated.sol_usd":
          engine.subscribeEvent(eventType, ws);
          break;

        default:
          break;
      }

      sendMessageOnWebSocket(ws, {
        requestId: req.rqeuestId,
        type: "event_subscribed",
        payload: null,
      });
    } catch (error: any) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: error.message,
        requestId: req.rqeuestId,
      });
    }
  }
}

async function handleUnsubscribeEventRequest(req: WS_REQUEST, ws: WebSocket) {
  if (zodBodyVerificationWebSocket(unsubscribeEventSchema, req, ws)) {
    try {
      const { eventType }: { eventType: ENGINE_EVENT_TYPE } = req.payload;

      await engine.unsubscribeEvent(eventType, ws);

      sendMessageOnWebSocket(ws, {
        requestId: req.rqeuestId,
        type: "event_unsubscribed",
        payload: null,
      });
    } catch (error: any) {
      sendMessageOnWebSocket(ws, {
        type: "error",
        payload: error.message,
        requestId: req.rqeuestId,
      });
    }
  }
}

const handleWebSocketMessage = async (ws: WebSocket, request: WS_REQUEST) => {
  console.log(request);

  switch (request.type) {
    case "subscribe_event":
      await handleSubscribeEventRequest(request, ws);
      break;
    case "get_position":
      await handleGetPositionsRequest(request, ws);
      break;
    case "get_orderbook":
      await handleGetOrderbookRequest(request, ws);
      break;
    case "unsubscribe_event":
      await handleUnsubscribeEventRequest(request, ws);
      break;
    case "add_balance":
      await handleAddBalanceRequest(request, ws);
      break;
    case "cancel_order":
      await handleCancelOrderRequest(request, ws);
      break;

    case "create_order":
      await handleCreateOrderRequest(request, ws);
      break;
    case "get_balance":
      await handleGetBalanceRequest(request, ws);
      break;
    case "get_depth":
      await handleGetDepthRequest(request, ws);
      break;
    case "get_fills":
      await handleGetFillsRequest(request, ws);
      break;
    case "get_order":
      await handleGetOrderRequest(request, ws);
      break;
    case "get_orders":
      await handleGetOrdersRequest(request, ws);
      break;

    default:
      throw new Error("WRONG_REQUEST_FORMAT");
  }
};

export { handleWebSocketMessage, engine as wsEngineInterface };
