import "dotenv/config";

import {
  redisClient as globalRedisClient,
  prismaClient,
  Prisma,
} from "@repo/db";
import {
  DB_POLLER_SCHEMA,
  type FILLS_CREATED_EVENT,
  type ORDER_CANCELLED_EVENT,
  type ORDER_CREATED_EVENT,
} from "./validations.js";

process.on("uncaughtException", (err, origin) => {
  console.error("uncaughtException", err.message, err.name, origin);
  process.exit();
});
process.on("unhandledRejection", (err, origin) => {
  console.error("unhandledRejection", origin);
  process.exit();
});

const redisClient = globalRedisClient.duplicate();

const setupRedis = async () => {
  redisClient.on("error", (error) => {
    console.log("error in redis", error);
  });

  await redisClient.connect();
};
const tryCreatingMarkets = async () => {
  console.log("trying creating markets");

  await Promise.all(
    ["BTCUSD", "SOLUSD", "ETHUSD"].map(async (cur) => {
      try {
        await prismaClient.market.create({ data: { symbol: cur as any } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
          if (e.code == "P2002") {
            console.log("market already exist in schema");
          } else throw e;
        }
      }
    }),
  );
};

const tryCreatingConsumerGroup = async () => {
  console.log(
    "trying to make consumer group for redis stream ",
    process.env.DB_POLLER_REDIS_STREAM,
  );
  try {
    await redisClient.xGroupCreate(
      process.env.DB_POLLER_REDIS_STREAM!,
      "group",
      "0",
      { MKSTREAM: true },
    );
  } catch (error) {
    if (!(error as Error).message.includes("BUSYGROUP")) {
      console.log("error in creating consumer group for db poller", error);
      throw error;
    }
  }
};

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

const handleEvent = async (passedEvent: any) => {
  // there should not be an error in parsing
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

const processPendingUnackedEvents = async () => {
  while (true) {
    const xreadGroupRes: any = await redisClient.xReadGroup(
      "group",
      "consumer",
      [{ id: "0", key: process.env.DB_POLLER_REDIS_STREAM! }],
      {
        COUNT: 100,
      },
    );

    if (xreadGroupRes) {
      let messages: any[] = xreadGroupRes[0].messages;

      for (const { id, message } of messages) {
        console.log(`[DB_POLLER] Processing pending unacked message ID: ${id}`);
        const event = JSON.parse(message.data);
        await handleEvent(event);
        await redisClient.xAck(
          process.env.DB_POLLER_REDIS_STREAM!,
          "group",
          id,
        );
        console.log(
          `[DB_POLLER] Successfully processed and ACKed message ID: ${id}`,
        );
      }

      if (messages.length == 0) break;
    } else throw new Error("xreadGroupRes is falsy , this should not happen");
  }
};

const processNewEvents = async () => {
  while (true) {
    const xreadGroupRes: any = await redisClient.xReadGroup(
      "group",
      "consumer",
      [{ id: ">", key: process.env.DB_POLLER_REDIS_STREAM! }],
      {
        BLOCK: 0,
        COUNT: 100,
      },
    );

    if (xreadGroupRes) {
      let messages: any[] = xreadGroupRes[0].messages;

      for (const { id, message } of messages) {
        console.log(`[DB_POLLER] Processing new message ID: ${id}`);
        const event = JSON.parse(message.data);
        await handleEvent(event);

        await redisClient.xAck(
          process.env.DB_POLLER_REDIS_STREAM!,
          "group",
          id,
        );
        console.log(
          `[DB_POLLER] Successfully processed and ACKed message ID: ${id}`,
        );
      }
    } else throw new Error("xreadGroupRes is falsy , this should not happen");
  }
};

const processEvents = async () => {
  console.log("processing pending unacked events on redis straem");
  await processPendingUnackedEvents();

  console.log("processing new events on redis straem");
  await processNewEvents();
};

const startDbPoller = async () => {
  await setupRedis();
  await tryCreatingConsumerGroup();
  await tryCreatingMarkets();
  processEvents();
};

startDbPoller();
