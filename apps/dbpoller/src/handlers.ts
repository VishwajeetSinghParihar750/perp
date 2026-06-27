import { prismaClient } from "@repo/db";
import {
  DB_POLLER_SCHEMA,
  type FILLS_CREATED_EVENT,
  type ORDER_CANCELLED_EVENT,
  type ORDER_CREATED_EVENT,
} from "./validations.ts";

const handleFillsCreated = async (event: FILLS_CREATED_EVENT) => {
  const { idempotencyKey } = event;
  console.log(
    `[DB_POLLER] Processing fills.created event (idempotencyKey: ${idempotencyKey})`,
  );

  await prismaClient.$transaction(async (tx) => {
    let exists = await tx.processedEvent.findFirst({
      where: { id: idempotencyKey },
    });

    if (exists) {
      console.log(`[DB_POLLER] Event already processed: ${idempotencyKey}`);
      return;
    }

    await tx.processedEvent.create({ data: { id: idempotencyKey } });

    for (let fill of event.payload.data.fills) {
      const {
        bidPrice,
        buyOrderInfo,
        fillId,
        price,
        qty,
        sellOrderInfo,
        marketSymbol,
      } = fill;

      console.log(
        `[DB_POLLER] Creating fill: ${fillId} for marketSymbol: ${marketSymbol}, price: ${price}, qty: ${qty}`,
      );
      await tx.fill.create({
        data: {
          id: fillId,
          bidPrice,
          price,
          quantity: qty,
          symbol: marketSymbol,
          longOrderId: buyOrderInfo.orderId,
          longUserId: buyOrderInfo.buyerId,
          shortOrderId: sellOrderInfo.orderId,
          shortUserId: sellOrderInfo.sellerId,
        },
      });

      console.log(
        `[DB_POLLER] Updating long order status: ${buyOrderInfo.orderId} to status: ${buyOrderInfo.orderStatus}`,
      );
      await tx.order.update({
        where: { id: fill.buyOrderInfo.orderId },
        data: {
          filledQuantity: fill.buyOrderInfo.filledQty,
          status: fill.buyOrderInfo.orderStatus,
        },
      });

      console.log(
        `[DB_POLLER] Updating short order status: ${sellOrderInfo.orderId} to status: ${sellOrderInfo.orderStatus}`,
      );
      await tx.order.update({
        where: { id: fill.sellOrderInfo.orderId },
        data: {
          filledQuantity: fill.sellOrderInfo.filledQty,
          status: fill.sellOrderInfo.orderStatus,
        },
      });
    }
  });
};

const handleOrderCreated = async (event: ORDER_CREATED_EVENT) => {
  const { idempotencyKey } = event;
  const {
    filledQty,
    margin,
    marginType,
    orderId,
    price,
    qty,
    side,
    status,
    marketSymbol,
    type,
    userId,
  } = event.payload.data;
  console.log(
    `[DB_POLLER] Processing order.created event for order: ${orderId} (idempotencyKey: ${idempotencyKey})`,
  );

  await prismaClient.$transaction(async (tx) => {
    let exists = await tx.processedEvent.findFirst({
      where: { id: idempotencyKey },
    });

    if (exists) {
      console.log(`[DB_POLLER] Event already processed: ${idempotencyKey}`);
      return;
    }

    await tx.processedEvent.create({
      data: { id: idempotencyKey },
    });

    console.log(
      `[DB_POLLER] Inserting order: ${orderId} in database, side: ${side}, status: ${status}`,
    );
    await tx.order.create({
      data: {
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
      },
    });
  });
};

const handleOrderCancelled = async (event: ORDER_CANCELLED_EVENT) => {
  const { idempotencyKey } = event;
  const { orderId } = event.payload.data;
  console.log(
    `[DB_POLLER] Processing order.cancelled event for order: ${orderId} (idempotencyKey: ${idempotencyKey})`,
  );

  await prismaClient.$transaction(async (tx) => {
    let exists = await tx.processedEvent.findFirst({
      where: { id: idempotencyKey },
    });

    if (exists) {
      console.log(`[DB_POLLER] Event already processed: ${idempotencyKey}`);
      return;
    }

    await tx.processedEvent.create({
      data: { id: idempotencyKey },
    });

    console.log(
      `[DB_POLLER] Updating order: ${orderId} status to CANCELLED in database`,
    );
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
      },
    });
  });
};

const handleEvent = async (passedEvent: unknown) => {
  const event = DB_POLLER_SCHEMA.parse(passedEvent);

  switch (event.payload.type) {
    case "fills.created":
      await handleFillsCreated(event as FILLS_CREATED_EVENT);
      break;
    case "order.created":
      await handleOrderCreated(event as ORDER_CREATED_EVENT);
      break;
    case "order.cancelled":
      await handleOrderCancelled(event as ORDER_CANCELLED_EVENT);
      break;
    default:
      break;
  }
};

export {
  handleEvent,
  handleFillsCreated,
  handleOrderCreated,
  handleOrderCancelled,
};
