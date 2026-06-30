import "dotenv/config";

import {
  redisClient as globalRedisClient,
  prismaClient,
  Prisma,
} from "@repo/db";
import { handleBatchEvents } from "./batching.ts";

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
          if ((e as any).code == "P2002") {
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

const processPendingUnackedEvents = async () => {
  while (true) {
    const xreadGroupRes: any = await redisClient.xReadGroup(
      "group",
      "consumer",
      [{ id: "0", key: process.env.DB_POLLER_REDIS_STREAM! }],
      {
        COUNT: 1000,
      },
    );

    if (xreadGroupRes) {
      let messages: any[] = xreadGroupRes[0].messages;

      if (messages.length === 0) break;

      await handleBatchEvents(messages);
      await redisClient.xAck(
        process.env.DB_POLLER_REDIS_STREAM!,
        "group",
        messages.map((msg) => msg.id),
      );
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
        BLOCK: 200,
        COUNT: 1000,
      },
    );

    if (xreadGroupRes) {
      let messages: any[] = xreadGroupRes[0].messages;

      if (messages.length === 0) continue;

      await handleBatchEvents(messages);
      await redisClient.xAck(
        process.env.DB_POLLER_REDIS_STREAM!,
        "group",
        messages.map((msg) => msg.id),
      );
    }
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
