import {
  DB_POLLER_SCHEMA,
  type ORDER_CREATED_EVENT_PAYLOAD,
  type FILLS_CREATED_EVENT_PAYLOAD,
} from "./validations.ts";
import { Prisma, prismaClient } from "@repo/db";

type orderUpdate = {
  type: "order.updated";
  data: {
    id: string;
    filledQty?: number;
    status: string;
  };
};

let currentOrders: Map<string, ORDER_CREATED_EVENT_PAYLOAD> = new Map();
let currentFills: FILLS_CREATED_EVENT_PAYLOAD = {
  type: "fills.created",
  data: { fills: [] },
};
let currentUpdatedOrders: Map<string, orderUpdate> = new Map();
let idempotencyKeys = [];

const handleBatchEvents = async (messages: any[]) => {
  //
  currentOrders = new Map();
  currentFills.data.fills = [];
  currentUpdatedOrders = new Map();

  const events = messages.map((msg) =>
    DB_POLLER_SCHEMA.parse(JSON.parse(msg.data)),
  );

  for (const event of events) {
    idempotencyKeys.push(event.idempotencyKey);
    switch (event.payload.type) {
      case "order.created":
        currentOrders.set(event.payload.data.orderId, event.payload);
        break;
      case "fills.created":
        for (const fill of event.payload.data.fills) {
          currentFills.data.fills.push(fill);

          for (const toUpdateOrderInfo of [
            fill.buyOrderInfo,
            fill.sellOrderInfo,
          ]) {
            let toUpdateOrder = currentUpdatedOrders.get(
              toUpdateOrderInfo.orderId,
            ) ??
              currentOrders.get(toUpdateOrderInfo.orderId) ?? {
                type: "order.updated",
                data: {
                  id: toUpdateOrderInfo.orderId,
                  status: "",
                },
              };

            toUpdateOrder.data.filledQty = toUpdateOrderInfo.filledQty;
            toUpdateOrder.data.status = toUpdateOrderInfo.orderStatus;

            if (toUpdateOrder.type == "order.updated")
              currentUpdatedOrders.set(toUpdateOrder.data.id, toUpdateOrder);
            else currentOrders.set(toUpdateOrder.data.orderId, toUpdateOrder);
          }
        }
        break;
      case "order.cancelled":
        const orderId = event.payload.data.orderId;
        let toUpdateOrder = currentUpdatedOrders.get(orderId) ??
          currentOrders.get(orderId) ?? {
            type: "order.updated",
            data: {
              id: orderId,
              status: "",
            },
          };
        toUpdateOrder.data.status = "CANCELLED";

        if (toUpdateOrder.type == "order.updated")
          currentUpdatedOrders.set(toUpdateOrder.data.id, toUpdateOrder);
        else currentOrders.set(toUpdateOrder.data.orderId, toUpdateOrder);

        break;
      default:
        break;
    }
  }

  let orderUpdateValues = Prisma.join(
    Array.from(currentUpdatedOrders.entries()).map(
      ([id, updateObj]) =>
        Prisma.sql`(${id} ${updateObj.data.filledQty ?? "NULL"} ${updateObj.data.status})`,
    ),
  );

  try {
    await prismaClient.$transaction(async (tx) => {
      const idemResult = await tx.processedEvent.findMany({
        where: {
          id: {
            in: idempotencyKeys,
          },
        },
      });
      if (idemResult.length > 0) {
        throw new Error("IDEMPOTENCY_KEY_EXISTS");
      }

      await tx.order.createMany({
        data: Array.from(currentOrders.entries()).map(([orderId, orderObj]) => {
          const {
            filledQty,
            margin,
            marginType,
            price,
            qty,
            side,
            status,
            marketSymbol,
            type,
            userId,
          } = orderObj.data;

          return {
            id: orderId,
            userId,
            side,
            symbol: marketSymbol,
            margin,
            price,
            filledQuantity: filledQty,
            quantity: qty,
            status,
            type,
            marginType,
          };
        }),
      });

      await tx.fill.createMany({
        data: currentFills.data.fills.map((fill) => {
          const {
            bidPrice,
            buyOrderInfo,
            fillId,
            price,
            qty,
            sellOrderInfo,
            marketSymbol,
          } = fill;

          return {
            id: fillId,
            bidPrice,
            price,
            quantity: qty,
            symbol: marketSymbol,
            longOrderId: buyOrderInfo.orderId,
            longUserId: buyOrderInfo.buyerId,
            shortOrderId: sellOrderInfo.orderId,
            shortUserId: sellOrderInfo.sellerId,
          };
        }),
      });

      //
      await tx.$executeRaw(
        Prisma.sql`
    UPDATE order o
    SET filledQuantity = v.filledQty, status = v.status
    FROM (
      VALUES ${orderUpdateValues}
    ) as v(id, filledQty, status)
    WHERE o.id = v.id
    `,
      );
    });
  } catch (error) {
    if ((error as Error).message == "IDEMPOTENCY_KEY_EXISTS") {
      // fine
      //
    } else throw error;
  }
};

export { handleBatchEvents };
