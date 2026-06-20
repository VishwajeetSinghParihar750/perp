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

    const { orderId } = req.params as BackendRequest.GET_ORDER_REQUEST;
    console.log(
      `[ORDER] Fetch order request for orderId: ${orderId} by user: ${req.user?.username} (${req.user?.id})`,
    );
    try {
      let order = await prismaClient.order.findUnique({
        where: {
          id: orderId,
        },
      });

      console.log(
        `[ORDER] Fetch order successful for orderId: ${orderId}. Found: ${!!order}`,
      );
      res.json({ error: false, payload: order });
    } catch (error) {
      console.error(
        `[ORDER] Fetch order failed for orderId: ${orderId}`,
        error,
      );
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
    const { marketSymbol } = req.params as BackendRequest.GET_ORDERS_REQUEST;
    console.log(
      `[ORDER] Fetch orders request for marketSymbol: ${marketSymbol} by user: ${req.user?.username} (${req.user?.id})`,
    );
    try {
      const orders = await prismaClient.order.findMany({
        where: { symbol: marketSymbol },
      });
      console.log(
        `[ORDER] Fetch orders successful for marketSymbol: ${marketSymbol}. Count: ${orders.length}`,
      );
      res.status(200).json({ error: false, payload: orders });
    } catch (error) {
      console.error(
        `[ORDER] Fetch orders failed for marketSymbol: ${marketSymbol}`,
        error,
      );
      res.json({
        error: "INTERNAL_SERVER_ERROR",
        payload: (error as Error).message,
      });
    }
  },
);

export { router };
