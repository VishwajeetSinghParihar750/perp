const CURRENCY_SYMBOL_ARRAY = ["USD", "SOLUSD", "ETHUSD", "BTCUSD"] as const;
type CURRENCY_SYMBOL = (typeof CURRENCY_SYMBOL_ARRAY)[number];
const TRADABLE_CURRENCY_SYMBOL_ARRAY = ["SOLUSD", "ETHUSD", "BTCUSD"] as const;
type TRADABLE_CURRENCY_SYMBOL = (typeof TRADABLE_CURRENCY_SYMBOL_ARRAY)[number];

type TYPE = "LIMIT" | "MARKET";
type SIDE = "BUY" | "SELL";
type ORDER_ID = string;

type MARGIN_TYPE = "ISOLATED" | "CROSS";
type ORDER_STATUS = "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";

type FILL_INFO = {
  fillId: string;
  symbol: TRADABLE_CURRENCY_SYMBOL;
  qty: number;
  price: number;
  bidPrice: number;

  sellOrderInfo: {
    sellerId: string;
    orderId: string;
    totalQty: number;
    orderStatus: ORDER_STATUS;
    filledQty: number;
    margin: number;
    marginType: MARGIN_TYPE;
  };
  buyOrderInfo: {
    buyerId: string;
    orderId: string;
    orderStatus: ORDER_STATUS;
    filledQty: number;
    totalQty: number;
    margin: number;
    marginType: MARGIN_TYPE;
  };
};

type FILLS_INFO = FILL_INFO[];

type ORDER = {
  userId: string;
  price: number;
  qty: number;
  side: SIDE;
  symbol: TRADABLE_CURRENCY_SYMBOL;
  type: TYPE;
  filledQty: number;
  orderId: string;
  createdAt: Date;

  //  for perp
  margin: number;
  marginType: MARGIN_TYPE;
  status: ORDER_STATUS;
};

export type {
  CURRENCY_SYMBOL,
  TYPE,
  SIDE,
  ORDER_ID,
  MARGIN_TYPE,
  ORDER_STATUS,
  ORDER,
  FILLS_INFO,
  FILL_INFO,
  TRADABLE_CURRENCY_SYMBOL,
};

export { CURRENCY_SYMBOL_ARRAY, TRADABLE_CURRENCY_SYMBOL_ARRAY };
