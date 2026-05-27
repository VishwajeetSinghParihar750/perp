import OrderBook, { type ORDERBOOK_SNAPSHOT } from "./OrderBook.js";
import type {
  FILLS_INFO,
  ORDER,
  TRADABLE_CURRENCY_SYMBOL,
} from "../types/order.js";
import Balances, { type BALANCE_SNAPSHOT } from "./Balances.js";
import type {
  CURRENCY_SYMBOL,
  MARGIN_TYPE,
  ORDER_ID,
  SIDE,
  TYPE,
} from "../types/order.js";
import EventBus from "./EventBus.js";
import PositionManager, { type POSITION_SNAPSHOT } from "./PositionManager.js";
import LiquidationEngine, {
  type LIQUIDATION_SNAPSHOT,
  type LiquidationOrderInfo,
} from "./LiquidationEngine.js";
import type { Snapshotable } from "./SnapshotManger.js";
import type { POSITION } from "../types/positions.js";

type EXCHANGE_SNAPSHOT = {
  balance: BALANCE_SNAPSHOT;
  orderbook: ORDERBOOK_SNAPSHOT;
  position: POSITION_SNAPSHOT;
  liquidation: LIQUIDATION_SNAPSHOT;
};

export default class Exchange implements Snapshotable<EXCHANGE_SNAPSHOT> {
  private balances: Balances;
  private orderBook: OrderBook;
  private positionManager: PositionManager;
  private liquidationEngine: LiquidationEngine;
  private eventBus: EventBus;

  getSnapshot() {
    return {
      balance: this.balances.getSnapshot(),
      orderbook: this.orderBook.getSnapshot(),
      position: this.positionManager.getSnapshot(),
      liquidation: this.liquidationEngine.getSnapshot(),
    };
  }
  loadSnapshot(data: EXCHANGE_SNAPSHOT) {
    this.balances.loadSnapshot(data.balance);
    this.orderBook.loadSnapshot(data.orderbook);
    this.positionManager.loadSnapshot(data.position);
    this.liquidationEngine.loadSnapshot(data.liquidation);
  }

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.balances = new Balances(eventBus);
    this.orderBook = new OrderBook(eventBus);
    this.positionManager = new PositionManager();
    this.liquidationEngine = new LiquidationEngine(eventBus);
  }

  createOrder = (
    type: TYPE,
    side: SIDE,
    symbol: TRADABLE_CURRENCY_SYMBOL,
    qty: number,

    userId: string,
    margin: number,
    marginType: MARGIN_TYPE,
    price?: number,
    liquidation?: boolean,
  ):
    | {
        status: "REJECTED";
      }
    | {
        status: "OPEN" | "FILLED";
        orderId: ORDER_ID;
        fills: FILLS_INFO;
      } => {
    // check if account locked
    if (this.balances.isAccountLocked(userId, symbol)) {
      return { status: "REJECTED" };
    }

    // get initial balance
    let initialUSDBalance = this.balances.getBalance(userId, "USD") as number;

    // check if have claimed margin
    if (margin > initialUSDBalance) {
      return { status: "REJECTED" };
    }

    // check and reduce balance for margin
    let marginNeeded = this.liquidationEngine.getMarginRequired({
      qty,
      side,
      symbol,
      type,
      price,
    });
    if (marginNeeded > margin) {
      return { status: "REJECTED" };
    }

    // lock margin
    this.balances.removeBalance(userId, "USD", margin);

    // // check if liquid positoins care about this order
    // this.liquidationEngine.notifyIncomingOrder(
    //   type,
    //   side,
    //   symbol,
    //   qty,
    //   price,
    // );

    // place order in orderbook
    let { newOrderId, totalFilledQuantity, fills } = this.orderBook.createOrder(
      type,
      side,
      symbol,
      qty,
      userId,
      margin,
      marginType,
      price,
    );

    // update users positions based on placed order
    let { pnlUpdates: usersPnlUpdate, positionUpdates } =
      this.positionManager.applyFills(fills);

    // update users balance based on updated margin/pnl
    this.balances.applyUsersPnl(usersPnlUpdate);

    // change liquidation price for udpated positions
    this.liquidationEngine.applyPositionUpdates(positionUpdates);

    // return new order info
    return {
      status: totalFilledQuantity == qty ? "FILLED" : "OPEN",
      orderId: newOrderId,
      fills,
    };
  };

  cancelOrder(orderId: ORDER_ID): {
    status: "CANCELLED" | "ALREADY_FILLED" | "NOT_CANCELLABLE";
  } {
    try {
      // try caneling
      const { status, order } = this.orderBook.cancelOrder(orderId);

      if (status == "NOT_CANCELLABLE") {
        return { status: "NOT_CANCELLABLE" };
      }

      const { filledQty, qty, margin, userId } = order!;

      if (filledQty == qty) {
        return { status: "ALREADY_FILLED" };
      }

      // if cancelled return margin locked still
      this.balances.addBalance(
        userId,
        "USD",
        (margin * (qty - filledQty)) / qty,
      );

      return {
        status: "CANCELLED",
      };
    } catch (error) {
      // if order doesnt exist etc, or already filled
      // would have to see some error handling here , maybe we need entity baesd errors like ordererror, balanceerror isntead of class based
      throw error;
    }
  }

  getBalance(userId: string, symbol?: CURRENCY_SYMBOL) {
    return this.balances.getBalance(userId, symbol);
  }
  addBalance(userId: string, amount: number, symbol: CURRENCY_SYMBOL) {
    // u can only deposit usd
    this.balances.addBalance(userId, symbol, amount);
  }
  getDepth(symbol: TRADABLE_CURRENCY_SYMBOL) {
    return this.orderBook.getDepth(symbol);
  }
  getPosition(userId: string, symbol?: TRADABLE_CURRENCY_SYMBOL) {
    return this.positionManager.getPosition(userId, symbol);
  }
  getOrderbookSnapshot(symbol: TRADABLE_CURRENCY_SYMBOL) {
    return this.orderBook.getOrderbookSnapshot(symbol);
  }
  handleMarkPriceUpdate({
    newPrice,
    symbol,
  }: {
    newPrice: number;
    symbol: TRADABLE_CURRENCY_SYMBOL;
  }) {
    let { toLiquidatePositions } =
      this.liquidationEngine.handleIndexPriceUpdate({ symbol, newPrice });

    toLiquidatePositions.forEach((position) => {
      let { totalFilledQuantity, fills } = this.orderBook.createOrder(
        "MARKET",
        position.type == "LONG" ? "SELL" : "BUY",
        position.symbol,
        position.qty,
        position.userId,
        0,
        "ISOLATED",
      );
      // update users positions based on placed order
      let { pnlUpdates: usersPnlUpdate, positionUpdates } =
        this.positionManager.applyFills(fills);

      // update users balance based on updated margin/pnl
      this.balances.applyUsersPnl(usersPnlUpdate);

      // change liquidation price for udpated positions
      this.liquidationEngine.applyPositionUpdates(positionUpdates);

      if (totalFilledQuantity != position.qty) {
        // cause adl

        // get most winning positions from position manager
        let { winningPositions } = this.positionManager.getWinningPositions(
          position.symbol,
          position.qty - totalFilledQuantity,
        );
        // place limit order for these positions
        winningPositions.forEach((winPosition: POSITION) => {
          this.orderBook.createOrder(
            "LIMIT",
            winPosition.type == "LONG" ? "SELL" : "BUY",
            winPosition.symbol,
            winPosition.qty,
            winPosition.userId,
            0,
            "ISOLATED",
            marketPrice,
          );
        });

        // place your market order again
        // and do whole processing again...

        // todo ; separate this logic , DRY PRINCIPLE
      }
    });
  }

  handleFunding() {
    let indexPrices = this.liquidationEngine.indexPrices;
    let markPrices = this.orderBook.markPrices;

    let symbols: TRADABLE_CURRENCY_SYMBOL[] = [];

    let fundingRates = Object.entries(markPrices).reduce(
      (toRet, [symbol, markprice]) => {
        let typedSymbol = symbol as TRADABLE_CURRENCY_SYMBOL;

        if (indexPrices[typedSymbol]) {
          let premium =
            (markprice - indexPrices[typedSymbol]) / indexPrices[typedSymbol];
          let interestRate = 20;
          let fundingRate =
            premium + Math.min(Math.max(interestRate - premium, -30), 30);
          toRet[typedSymbol] = fundingRate;

          symbols.push(typedSymbol);
        }
        return toRet;
      },
      {} as Partial<Record<TRADABLE_CURRENCY_SYMBOL, number>>,
    );

    this.eventBus.emit({
      type: "funding.created",
      data: { symbol: symbols },
    });

    let { positionUpdates, usersPnl } =
      this.positionManager.applyFunding(fundingRates);
    this.balances.applyUsersPnl(usersPnl);
    this.liquidationEngine.applyPositionUpdates(positionUpdates);
  }
}

export type { EXCHANGE_SNAPSHOT };
