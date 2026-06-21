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
import Account from "./classes/domain/account.js";
import EventBus from "./classes/domain/eventBus.js";
import Market from "./classes/domain/market.js";
import { OrderFactory } from "./classes/domain/order.js";
import Orderbook from "./classes/domain/orderbook.js";
import { TradeFactory } from "./classes/domain/trade.js";
import PositionManager from "./classes/domain/positionManager.js";
import EventPublisher from "./classes/interface/eventPublisher.js";

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});

const eventBus = new EventBus();
const market = new Market(eventBus);
const account = new Account(eventBus);

const riskEngine = new RiskEngine(account, market);
const tradeFactory = new TradeFactory();
const orderFactory = new OrderFactory();
const orderbook = new Orderbook(riskEngine, tradeFactory, eventBus);
const positionManager = new PositionManager(eventBus, riskEngine);

const requestHandler = new RequestHandler();
const communicator = new Communicator(requestHandler);
const eventPublisher = new EventPublisher(communicator);

const createOrderHandler = new CreateOrderHandler(
  orderFactory,
  riskEngine,
  orderbook,
  account,
);
const addBalanceHandler = new AddBalanceHandler(account);
const getBalanceHandler = new GetBalanceHandler(account);
const getDepthHandler = new GetDepthHandler(orderbook);
const cancelOrderHandler = new CancelOrderHandler(orderbook);
const getPositionHandler = new GetPositionHandler(positionManager);
const subscribeEventHandler = new SubscribeEventHandler(eventPublisher);
const unsubscribeEventHandler = new UnsubscribeEventHandler(eventPublisher);

requestHandler.setDeps({
  addBalanceHandler,
  cancelOrderHandler,
  createOrderHandler,
  getBalanceHandler,
  getDepthHandler,
  getPositionHandler,
  subscribeEventHandler,
  unsubscribeEventHandler,
});

// thats it
// on error that is not caught, the owner of this process should restart the process and it will work fine

communicator.processRequests();
