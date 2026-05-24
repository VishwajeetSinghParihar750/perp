import { Router } from "express";
import { BackendRequest } from "@repo/shared-types";
import { zodBodyVerification } from "../middlewares/zodBodyVerification.js";
import { prisma } from "@repo/db";

const router = Router();

router.get(
  "/order",
  zodBodyVerification(BackendRequest.GET_ORDER_SCHEMA),
  async (req, res) => {
    //

    try {
      const { orderId } = req.body as BackendRequest.GET_ORDER_REQUEST;
      let order = await prisma.order.findOne({
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
