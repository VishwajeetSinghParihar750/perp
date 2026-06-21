import "dotenv/config";
import { assert } from "node:console";
import type { RedisClientType } from "@repo/db";
import type Communicator from "../infrastructure/communicator.js";
import type { ReplyAddress } from "../infrastructure/types.js";

class IndexPriceObserver {
  private communicator: Communicator;
  private sendToAdrress: ReplyAddress;

  constructor(communicator: Communicator, sendToAddress: ReplyAddress) {
    this.communicator = communicator;
    this.sendToAdrress = sendToAddress;
  }

  private BINANCE_SUBSCIRPTION_REQUEST: {
    method: "SUBSCRIBE";
    params: string[];
    id: number;
  } = {
    method: "SUBSCRIBE",
    params: [],
    id: 1,
  };

  private readonly streamPairs: string[] = [
    "btcusd@indexPrice",
    "solusd@indexPrice",
    "ethusd@indexPrice",
  ];
  private receivedIndexPrices = new Set();

  private initResolver: ((val: unknown) => void) | undefined = undefined;

  async initialize() {
    let promise = new Promise((res, rej) => {
      this.initResolver = res;
    });
    this.setupPriceSubscriptions();
    return promise;
  }

  private setupPriceSubscriptions() {
    console.log(process.env.PRICE_UPDATES_WEBSOCKET_BACKEND_URL);

    let ws = new WebSocket(process.env.PRICE_UPDATES_WEBSOCKET_BACKEND_URL!);

    // maybe we will ahve to wait for ws.open using  promises

    // subscribe to streams
    this.streamPairs.forEach((streamPair) => {
      this.BINANCE_SUBSCIRPTION_REQUEST.params.push(streamPair);
    });

    ws.onopen = (ev) => {
      // send sub request
      console.log("binance ws server connection oopned ", ev);
      let subRequest = JSON.stringify(this.BINANCE_SUBSCIRPTION_REQUEST);
      // console.log(subRequest);
      ws.send(subRequest);
    };

    ws.onerror = (ev) => {
      throw new Error("mark price udpates ws server error");
    };

    ws.onmessage = ({ data }) => {
      // console.log("binance ws server connection sent message  ", data);

      data = JSON.parse(data);

      assert(!data.error && data.id == 1);

      ws.onmessage = async ({ data }) => {
        // console.log("binance ws server connection sent message  ", data);

        data = JSON.parse(data);
        // this needs to be pushed on redis input stream
        // to keep input to engien determinstic
        // console.log(data);

        await this.communicator.send(this.sendToAdrress, {
          type: "indexprice_updated",
          payload: { price: data.p, symbol: data.i },
        });

        // here the init should resolve, after getting
        if (
          this.initResolver &&
          this.receivedIndexPrices.size == this.streamPairs.length
        ) {
          console.log(
            "got index price udpates for all markets, resolving initialize in indexPriceObserver ",
          );
          this.initResolver(1);
          this.initResolver = undefined;
        } else this.receivedIndexPrices.add(data.i);
      };
    };
  }
}
export default IndexPriceObserver;
