import type { Request, Response } from "express";
import { prismaClient } from "@repo/db";
import { BackendRequest } from "@repo/shared-types";

export async function getOrder(req: Request, res: Response) {
  const { orderId } = req.params as BackendRequest.GET_ORDER_REQUEST;
  console.log(
    `[ORDER] Fetch order request for orderId: ${orderId} by user: ${req.user?.username} (${req.user?.id})`,
  );

  const order = await prismaClient.order.findUnique({ where: { id: orderId } });
  console.log(
    `[ORDER] Fetch order successful for orderId: ${orderId}. Found: ${!!order}`,
  );
  res.json({ error: false, payload: order });
}

export async function getOrders(req: Request, res: Response) {
  const { marketSymbol } = req.params as BackendRequest.GET_ORDERS_REQUEST;
  console.log(
    `[ORDER] Fetch orders request for marketSymbol: ${marketSymbol} by user: ${req.user?.username} (${req.user?.id})`,
  );

  const orders = await prismaClient.order.findMany({
    where: {
      symbol: marketSymbol,
      userId: req.user!.id,
      status: { in: ["OPEN", "PARTIALLY_FILLED"] },
    },
    orderBy: { price: "desc" },
  });
  console.log(
    `[ORDER] Fetch orders successful for marketSymbol: ${marketSymbol}. Count: ${orders.length}`,
  );
  res.status(200).json({ error: false, payload: orders });
}
