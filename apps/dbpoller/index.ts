import "dotenv/config";

console.log(process.cwd());

import { redisClient as globalRedisClient } from "@repo/db";

const redisClient = globalRedisClient.duplicate();

const setupRedis = async () => {
  redisClient.on("error", (error) => {
    console.log("error in redis", error);
  });

  await redisClient.connect();
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

const handleEvent = async (event: any) => {
  console.log(event);
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
      const event = JSON.parse(message.data);
      await handleEvent(event);

      await redisClient.xAck(process.env.DB_POLLER_REDIS_STREAM!, "group", id);
    }

    processPendingUnackedEvents();
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
  processEvents();
};

startDbPoller();
