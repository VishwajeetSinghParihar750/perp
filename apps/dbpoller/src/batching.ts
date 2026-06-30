import { EngineEvent, EngineEventPayload } from "@repo/shared-types";

import {
  DB_POLLER_SCHEMA,
  type DB_POLLER_EVENT,
  type DB_POLLER_EVENT_PAYLOAD,
  type ORDER_CREATED_EVENT_PAYLOAD,
  type FILLS_CREATED_EVENT_PAYLOAD,
} from "./validations.ts";
import { prismaClient } from "@repo/db";

type orderUpdate = {
  type: "order.updated";
  data: {
    id: string;
    filledQty?: number;
    status?: string;
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

  await prismaClient.$transaction(async (tx) => {
    const idemResult = await tx.processedEvent.findMany({
      where: {
        id: {
          in: idempotencyKeys,
        },
      },
    });
    //
  });
};

export { handleBatchEvents };
