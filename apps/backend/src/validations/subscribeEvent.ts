import z from "zod";

const SUBSCRIBED_EVENT = z.union([
  z.literal("depth.updated.sol_usd"),
  z.literal("depth.updated.btc_usd"),
  z.literal("depth.updated.eth_usd"),
]);

const subscribeEventSchema = z.object({
  eventType: SUBSCRIBED_EVENT,
});

const unsubscribeEventSchema = z.object({
  eventType: SUBSCRIBED_EVENT,
});

export { subscribeEventSchema, unsubscribeEventSchema };
