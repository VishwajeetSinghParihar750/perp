import "dotenv/config";

import Communicator from "./classes/infrastructure/communicator.js";
import RequestHandler from "./classes/interface/requestHandler.js";

import CreateOrderHandler from "./classes/application/createOrderHandler.js";
import AddBalanceHandler from "./classes/application/addBalanceHandler.js";
import GetBalanceHandler from "./classes/application/getBalanceHandler.js";
import GetDepthHandler from "./classes/application/getDepthHandler.js";
import CancelOrderHandler from "./classes/application/cancelOrderHandler.js";
import GetPositionHandler from "./classes/application/getPositionHandler.js";
import SubscribeEventHandler from "./classes/application/subscribeEventHandler.js";
import UnsubscribeEventHandler from "./classes/application/unsubscribeEventHandler.js";
import RiskEngine from "./classes/domain/riskEngine.js";
import Account, { type ACCOUNT_SNAPSHOT } from "./classes/domain/account.js";
import EventBus from "./classes/domain/eventBus.js";
import Market, { type MARKET_SNAPSHOT } from "./classes/domain/market.js";
import { OrderFactory, type ORDER_FACTORY_SNAPSHOT } from "./classes/domain/order.js";
import Orderbook, { type ORDERBOOK_SNAPSHOT } from "./classes/domain/orderbook.js";
import { TradeFactory } from "./classes/domain/trade.js";
import PositionManager, { type POSITION_MANAGER_SNAPSHOT } from "./classes/domain/positionManager.js";
import EventPublisher, { type EVENT_PUBLISHER_SNAPSHOT } from "./classes/interface/eventPublisher.js";
import IndexPriceObserver from "./classes/interface/indexPriceObserver.js";
import FundingHandler from "./classes/application/fundingHandler.js";
import IndexPriceUpdateHandler from "./classes/application/indexPriceHandler.js";
import SnapshotManager, { type Snapshotable } from "./classes/infrastructure/snapshotManager.js";

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});

type ENGINE_SERVER_SNAPSHOT = {
  account: ACCOUNT_SNAPSHOT;
  market: MARKET_SNAPSHOT;
  orderFactory: ORDER_FACTORY_SNAPSHOT;
  orderbook: ORDERBOOK_SNAPSHOT;
  positionManager: POSITION_MANAGER_SNAPSHOT;
  eventPublisher: EVENT_PUBLISHER_SNAPSHOT;
};

class EngineServer implements Snapshotable<ENGINE_SERVER_SNAPSHOT> {
  private requestHandler: RequestHandler;
  private communicator: Communicator;
  private eventBus: EventBus;
  private market: Market;
  private account: Account;
  private riskEngine: RiskEngine;
  private tradeFactory: TradeFactory;
  private orderFactory: OrderFactory;
  private orderbook: Orderbook;
  private positionManager: PositionManager;
  private eventPublisher: EventPublisher;
  private indexPriceObserver: IndexPriceObserver;
  private snapshotManager: SnapshotManager;

  constructor() {
    this.requestHandler = new RequestHandler();
    this.communicator = new Communicator(this.requestHandler);

    this.eventBus = new EventBus();
    this.market = new Market(
      this.eventBus,
      { redisStreamId: process.env.REDIS_ENGINE_STREAM! },
      this.communicator,
    );
    this.account = new Account(this.eventBus);

    this.riskEngine = new RiskEngine(this.account, this.market);
    this.tradeFactory = new TradeFactory();
    this.orderFactory = new OrderFactory();
    this.orderbook = new Orderbook(this.riskEngine, this.tradeFactory, this.eventBus);
    this.positionManager = new PositionManager(this.eventBus, this.riskEngine, this.market);

    this.eventPublisher = new EventPublisher(this.eventBus, this.communicator);
    this.snapshotManager = new SnapshotManager(this);

    this.communicator.setSnapshotDeps(this.eventPublisher, this.snapshotManager);

    const createOrderHandler = new CreateOrderHandler(
      this.orderFactory,
      this.riskEngine,
      this.orderbook,
      this.account,
      this.positionManager,
    );
    const addBalanceHandler = new AddBalanceHandler(this.account);
    const getBalanceHandler = new GetBalanceHandler(this.account);
    const getDepthHandler = new GetDepthHandler(this.orderbook);
    const cancelOrderHandler = new CancelOrderHandler(this.orderbook);
    const getPositionHandler = new GetPositionHandler(this.positionManager);
    const subscribeEventHandler = new SubscribeEventHandler(this.eventPublisher);
    const unsubscribeEventHandler = new UnsubscribeEventHandler(this.eventPublisher);
    const fundingHandler = new FundingHandler(
      this.positionManager,
      this.orderbook,
      this.orderFactory,
      this.riskEngine,
      this.market,
    );
    const indexPriceUpdateHandler = new IndexPriceUpdateHandler(
      this.market,
      this.positionManager,
    );

    this.requestHandler.setDeps({
      addBalanceHandler,
      cancelOrderHandler,
      createOrderHandler,
      getBalanceHandler,
      getDepthHandler,
      getPositionHandler,
      subscribeEventHandler,
      unsubscribeEventHandler,
      fundingHandler,
      indexPriceUpdateHandler,
    });

    this.indexPriceObserver = new IndexPriceObserver(this.communicator, {
      redisStreamId: process.env.REDIS_ENGINE_STREAM!,
    });
  }

  getSnapshot(): ENGINE_SERVER_SNAPSHOT {
    return {
      account: this.account.getSnapshot(),
      market: this.market.getSnapshot(),
      orderFactory: this.orderFactory.getSnapshot(),
      orderbook: this.orderbook.getSnapshot(),
      positionManager: this.positionManager.getSnapshot(),
      eventPublisher: this.eventPublisher.getSnapshot(),
    };
  }

  loadSnapshot(snapshot: ENGINE_SERVER_SNAPSHOT) {
    this.account.loadSnapshot(snapshot.account);
    this.market.loadSnapshot(snapshot.market);
    this.orderFactory.loadSnapshot(snapshot.orderFactory);
    this.orderbook.loadSnapshot(snapshot.orderbook);
    this.positionManager.loadSnapshot(snapshot.positionManager);
    this.eventPublisher.loadSnapshot(snapshot.eventPublisher);
  }

  async initialize() {
    const lastRedisMessageId = this.snapshotManager.initialize();

    await this.communicator.initialize();
    await this.indexPriceObserver.initialize();
    await this.communicator.receiveRequests(lastRedisMessageId);
  }
}

const engineServer = new EngineServer();
engineServer.initialize();
