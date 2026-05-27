import "dotenv/config";

import {
  redisClient as globalRedisClient,
  prismaClient,
  Prisma,
} from "@repo/db";
import {
  DB_POLLER_SCHEMA,
  type FILLS_CREATED_EVENT,
  type ORDER_CREATED_EVENT,
} from "./validations.js";

const redisClient = globalRedisClient.duplicate();

const setupRedis = async () => {
  redisClient.on("error", (error) => {
    console.log("error in redis", error);
  });

  await redisClient.connect();
};
const tryCreatingMarkets = async () => {
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

  await prismaClient.$transaction(async (tx) => {
    await tx.processedEvent.create({ data: { id: idempotencyKey } });

    for (let fill of event.payload.data.fills) {
      const {
        bidPrice,
        buyOrderInfo,
        fillId,
        price,
        qty,
        sellOrderInfo,
        symbol,
      } = fill;

      await tx.fill.create({
        data: {
          id: fillId,
          bidPrice,
          price,
          quantity: qty,
          symbol: symbol,
          longOrderId: buyOrderInfo.orderId,
          longUserId: buyOrderInfo.buyerId,
          shortOrderId: sellOrderInfo.orderId,
          shortUserId: sellOrderInfo.sellerId,
        },
      });

      await tx.order.update({
        where: { id: fill.buyOrderInfo.orderId },
        data: {
          filledQuantity: fill.buyOrderInfo.filledQty,
          status: fill.buyOrderInfo.orderStatus,
        },
      });

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
    symbol,
    type,
    userId,
  } = event.payload.data;

  await prismaClient.$transaction(async (tx) => {
    let exists = await tx.processedEvent.findFirst({
      where: { id: idempotencyKey },
    });

    if (exists) return;

    await tx.processedEvent.create({
      data: { id: idempotencyKey },
    });

    await tx.order.create({
      data: {
        id: orderId,
        userId,
        side,
        symbol,
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

const handleEvent = async (passedEvent: any) => {
  // TODO : WHAT IF ERROR HAPPENS HERE

  const event = DB_POLLER_SCHEMA.parse(passedEvent);

  switch (event.payload.type) {
    case "fills.created":
      await handleFillsCreated(event as FILLS_CREATED_EVENT);
      break;
    case "order.created":
      await handleOrderCreated(event as ORDER_CREATED_EVENT);

      break;

    default:
      break;
  }
};

const processPendingUnackedEvents = async () => {
  const xreadGroupRes: any = await redisClient.xReadGroup(
    "group",
    "consumer",
    [{ id: "0", key: process.env.DB_POLLER_REDIS_STREAM! }],
    {
      BLOCK: 0,
      COUNT: 100,
    },
  );

  if (xreadGroupRes) {
    let messages: any[] = xreadGroupRes[0].messages;

    for (const { id, message } of messages) {
      //
      console.log(message.data);
      const event = JSON.parse(message.data);
      await handleEvent(event);
      await redisClient.xAck(process.env.DB_POLLER_REDIS_STREAM!, "group", id);
    }

    if (messages.length > 0) await processPendingUnackedEvents();
  } else throw new Error("xreadGroupRes is falsy even on blocking wtf");
};

const processNewEvents = async () => {
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
      //
      console.log(message.data);
      const event = JSON.parse(message.data);
      await handleEvent(event);

      await redisClient.xAck(process.env.DB_POLLER_REDIS_STREAM!, "group", id);
    }

    processNewEvents();
  } else throw new Error("xreadGroupRes is falsy even on blocking wtf");
};

const processEvents = async () => {
  console.log("processing pending unacked events on redis straem");
  await processPendingUnackedEvents();

  console.log("processing new events on redis straem");
  processNewEvents();
};

const startDbPoller = async () => {
  await setupRedis();
  await tryCreatingConsumerGroup();
  await tryCreatingMarkets();
  processEvents();
};

startDbPoller();
