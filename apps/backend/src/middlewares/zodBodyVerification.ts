import { type NextFunction, type Request, type Response } from "express";
import z from "zod";
import { sendMessageOnWebSocket } from "../ws/utils/messaging.js";
import WebSocket from "ws";
import { BackendRequest } from "@repo/shared-types";

const zodBodyVerification =
  (schema: z.ZodObject) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({ error: true, payload: "WRONG_REQUEST_FORMAT" });
    }
  };

const zodBodyVerificationWebSocket = (
  schema: z.ZodType,
  request: BackendRequest.ENGINE_REQUEST,
  ws: WebSocket,
): boolean => {
  const { success, error } = schema.safeParse(request);

  console.log(request);

  if (!success) {
    // console.log(request, error);
    sendMessageOnWebSocket(ws, {
      requestId: request.requestId,
      type: "error",
      payload: "INVALID_REQUEST_FORMAT",
    });
    return false;
  }
  return true;
};

export { zodBodyVerification, zodBodyVerificationWebSocket };
