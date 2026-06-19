import type { EngineTypes } from "@repo/shared-types";

export interface Position {
  userId: EngineTypes.USER_ID;
  price: EngineTypes.PRICE;
  quantity: EngineTypes.QUANTITY;
  side: EngineTypes.SIDE;
  marketId: string;
  margin: EngineTypes.PRICE;
  marginType: EngineTypes.MARGIN_TYPE;
  liquidationPrice: EngineTypes.PRICE;
}
