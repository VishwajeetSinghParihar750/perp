import z from "zod";

const USER_ID_SCHEMA = z.string();
type USER_ID = z.infer<typeof USER_ID_SCHEMA>;

const ORDER_ID_SCHEMA = z.string();
type ORDER_ID = z.infer<typeof ORDER_ID_SCHEMA>;

const FILL_ID_SCHEMA = z.string();
type FILL_ID = z.infer<typeof FILL_ID_SCHEMA>;

const PRICE_SCHEMA = z.number();
type PRICE = z.infer<typeof PRICE_SCHEMA>;

const QUANTITY_SCHEMA = z.number();
type QUANTITY = z.infer<typeof QUANTITY_SCHEMA>;

const SIDE_SCHEMA = z.union([z.literal("BUY"), z.literal("SELL")]);
type SIDE = z.infer<typeof SIDE_SCHEMA>;

const TYPE_SCHEMA = z.union([z.literal("MARKET"), z.literal("LIMIT")]);
type TYPE = z.infer<typeof TYPE_SCHEMA>;

const MARGIN_TYPE_SCHEMA = z.union([z.literal("ISOLATED"), z.literal("CROSS")]);
type MARGIN_TYPE = z.infer<typeof MARGIN_TYPE_SCHEMA>;

//
const ORDER_STATUS_SCHEMA = z.union([
  z.literal("OPEN"),
  z.literal("CANCELLED"),
  z.literal("PARTIALLY_FILLED"),
  z.literal("FILLED"),
]);
type ORDER_STATUS = z.infer<typeof ORDER_STATUS_SCHEMA>;

const CURRENCY_SYMBOL_SCHEMA = z.union([
  z.literal("USD"),
  z.literal("BTCUSD"),

  z.literal("SOLUSD"),
  z.literal("ETHUSD"),
]);
type CURRENCY_SYMBOL = z.infer<typeof CURRENCY_SYMBOL_SCHEMA>;

const TRADBLE_SYMBOL_SCHEMA = z.union([
  z.literal("BTCUSD"),
  z.literal("SOLUSD"),
  z.literal("ETHUSD"),
]);
type TRADABLE_SYMBOL = z.infer<typeof TRADBLE_SYMBOL_SCHEMA>;

export type {
  SIDE,
  TYPE,
  MARGIN_TYPE,
  CURRENCY_SYMBOL,
  TRADABLE_SYMBOL,
  ORDER_STATUS,
  PRICE,
  QUANTITY,
  USER_ID,
  FILL_ID,
  ORDER_ID,
};

export {
  MARGIN_TYPE_SCHEMA,
  TYPE_SCHEMA,
  SIDE_SCHEMA,
  ORDER_STATUS_SCHEMA,
  CURRENCY_SYMBOL_SCHEMA,
  TRADBLE_SYMBOL_SCHEMA,
  PRICE_SCHEMA,
  QUANTITY_SCHEMA,
  USER_ID_SCHEMA,
  FILL_ID_SCHEMA,
  ORDER_ID_SCHEMA,
};
