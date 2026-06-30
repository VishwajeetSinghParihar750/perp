import { handleEvent } from "./handlers.ts";
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

const handleBatchEvents = async (messages: any[]) => {
  console.log(
    `[DB_POLLER] [BATCH] Starting batch processing for ${messages.length} message(s)`,
  );

  currentOrders = new Map();
  currentFills.data.fills = [];
  currentUpdatedOrders = new Map();
  const idempotencyKeys: string[] = [];

  const events = messages.map((msg) => {
    console.log(`[DB_POLLER] [BATCH] Parsing message id: ${msg.id}`);
    return DB_POLLER_SCHEMA.parse(JSON.parse(msg.message.data));
  });

  for (const event of events) {
    idempotencyKeys.push(event.idempotencyKey);
    switch (event.payload.type) {
      case "order.created":
        console.log(
          `[DB_POLLER] [BATCH] Aggregating order.created for order: ${event.payload.data.orderId} (idempotencyKey: ${event.idempotencyKey})`,
        );
        currentOrders.set(event.payload.data.orderId, event.payload);
        break;
      case "fills.created":
        console.log(
          `[DB_POLLER] [BATCH] Aggregating fills.created with ${event.payload.data.fills.length} fill(s) (idempotencyKey: ${event.idempotencyKey})`,
        );
        for (const fill of event.payload.data.fills) {
          console.log(
            `[DB_POLLER] [BATCH] Queuing fill: ${fill.fillId} for marketSymbol: ${fill.marketSymbol}, price: ${fill.price}, qty: ${fill.qty}`,
          );
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

            console.log(
              `[DB_POLLER] [BATCH] Queuing order update from fill: ${toUpdateOrderInfo.orderId} -> status: ${toUpdateOrderInfo.orderStatus}, filledQty: ${toUpdateOrderInfo.filledQty}`,
            );

            if (toUpdateOrder.type == "order.updated")
              currentUpdatedOrders.set(toUpdateOrder.data.id, toUpdateOrder);
            else currentOrders.set(toUpdateOrder.data.orderId, toUpdateOrder);
          }
        }
        break;
      case "order.cancelled":
        const orderId = event.payload.data.orderId;
        console.log(
          `[DB_POLLER] [BATCH] Aggregating order.cancelled for order: ${orderId} (idempotencyKey: ${event.idempotencyKey})`,
        );
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

  console.log(
    `[DB_POLLER] [BATCH] Aggregation complete — orders to create: ${currentOrders.size}, fills to create: ${currentFills.data.fills.length}, orders to update: ${currentUpdatedOrders.size}`,
  );

  try {
    await prismaClient.$transaction(async (tx) => {
      console.log(
        `[DB_POLLER] [BATCH] Checking idempotency for ${idempotencyKeys.length} key(s)`,
      );
      const idemResult = await tx.processedEvent.findMany({
        where: {
          id: {
            in: idempotencyKeys,
          },
        },
      });
      if (idemResult.length > 0) {
        console.log(
          `[DB_POLLER] [BATCH] Idempotency conflict — ${idemResult.length} key(s) already processed: ${idemResult.map((e) => e.id).join(", ")}`,
        );
        throw new Error("IDEMPOTENCY_KEY_EXISTS");
      }

      const orderCreates = Array.from(currentOrders.entries()).map(
        ([orderId, orderObj]) => {
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
        },
      );
      if (orderCreates.length > 0) {
        console.log(
          `[DB_POLLER] [BATCH] Creating ${orderCreates.length} order(s): ${orderCreates.map((o) => o.id).join(", ")}`,
        );
        await tx.order.createMany({ data: orderCreates });
      }

      const fillCreates = currentFills.data.fills.map((fill) => {
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
      });
      if (fillCreates.length > 0) {
        console.log(
          `[DB_POLLER] [BATCH] Creating ${fillCreates.length} fill(s): ${fillCreates.map((f) => f.id).join(", ")}`,
        );
        await tx.fill.createMany({ data: fillCreates });
      }

      if (currentUpdatedOrders.size > 0) {
        console.log(
          `[DB_POLLER] [BATCH] Updating ${currentUpdatedOrders.size} order(s): ${Array.from(currentUpdatedOrders.keys()).join(", ")}`,
        );
        const orderUpdateValues = Prisma.join(
          Array.from(currentUpdatedOrders.entries()).map(
            ([id, updateObj]) =>
              Prisma.sql`(${id}, ${updateObj.data.filledQty ?? null}, ${updateObj.data.status})`,
          ),
        );

        await tx.$executeRaw(
          Prisma.sql`
    UPDATE "Order" o
    SET "filledQuantity" = COALESCE(v.filledQty, o."filledQuantity"),
        status = v.status
    FROM (
      VALUES ${orderUpdateValues}
    ) as v(id, filledQty, status)
    WHERE o.id = v.id
    `,
        );
      }

      console.log(
        `[DB_POLLER] [BATCH] Marking ${idempotencyKeys.length} event(s) as processed`,
      );
      await tx.processedEvent.createMany({
        data: idempotencyKeys.map((id) => ({ id })),
      });
    });
    console.log(`[DB_POLLER] [BATCH] Batch transaction committed successfully`);
  } catch (error) {
    if ((error as Error).message == "IDEMPOTENCY_KEY_EXISTS") {
      console.log(
        `[DB_POLLER] [BATCH] Falling back to one-by-one processing for ${events.length} event(s)`,
      );
      for (const event of events) await handleEvent(event);
    } else throw error;
  }
};

export { handleBatchEvents };
