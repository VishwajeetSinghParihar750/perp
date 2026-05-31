import { Router } from "express";
import { BackendRequest } from "@repo/shared-types";
import { zodBodyVerification } from "../middlewares/zodBodyVerification.js";
import { prismaClient } from "@repo/db";
import { authMiddleware } from "../middlewares/auth.js";

const router: Router = Router();

router.get(
  "/order:orderId",
  authMiddleware,
  zodBodyVerification(BackendRequest.GET_ORDER_SCHEMA, true),
  async (req, res) => {
    //

    try {
      const { orderId } = req.params as BackendRequest.GET_ORDER_REQUEST;
      let order = await prismaClient.order.findUnique({
        where: {
          id: orderId,
        },
      });

      res.json({ error: false, payload: order });
    } catch (error) {
      res.json({
        error: "INTERNAL_SERVER_ERROR",
        payload: (error as Error).message,
      });
    }

    //
  },
);

router.get(
  "/orders/:marketSymbol",
  authMiddleware,
  zodBodyVerification(BackendRequest.GET_ORDERS_SCHEMA, true),
  async (req, res) => {
    try {
      const { marketSymbol } = req.params as BackendRequest.GET_ORDERS_REQUEST;

      const orders = await prismaClient.order.findMany({
        where: { symbol: marketSymbol },
      });
      res.status(200).json({ error: false, payload: orders });
    } catch (error) {
      res.json({
        error: "INTERNAL_SERVER_ERROR",
        payload: (error as Error).message,
      });
    }
  },
);

export { router };
