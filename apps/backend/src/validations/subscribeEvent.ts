import z from "zod";

const SUBSCRIBED_EVENT = z.union([
  z.literal("depth.updated.sol_usd"),
  z.literal("depth.updated.btc_usd"),
  z.literal("depth.updated.eth_usd"),
]);

const SUBSCRIBE_EVENT_SCHEMA = z.object({
  eventType: SUBSCRIBED_EVENT,
});

const UNSUBSCRIBE_EVENT_SCHEMA = z.object({
  eventType: SUBSCRIBED_EVENT,
});

export { SUBSCRIBED_EVENT, SUBSCRIBE_EVENT_SCHEMA, UNSUBSCRIBE_EVENT_SCHEMA };
