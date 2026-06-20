import type { EngineTypes } from "@repo/shared-types";

export interface Position {
  userId: EngineTypes.USER_ID;
  price: EngineTypes.PRICE;
  quantity: EngineTypes.QUANTITY;
  type: "LONG" | "SHORT";
  marketSymbol: EngineTypes.CURRENCY_SYMBOL;
  createdAt: string;
  margin: EngineTypes.PRICE;
  marginType: EngineTypes.MARGIN_TYPE;
  liquidationPrice: EngineTypes.PRICE;
}
