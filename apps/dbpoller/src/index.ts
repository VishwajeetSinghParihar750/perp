import "dotenv/config";

import {
  redisClient as globalRedisClient,
  prismaClient,
  Prisma,
} from "@repo/db";
import { handleEvent } from "./handlers.ts";

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
