import "dotenv/config";
import type Communicator from "../infrastructure/communicator.js";
import type { ReplyAddress } from "../infrastructure/types.js";

const STREAM_TO_MARKET: Record<string, string> = {
  BTCUSD: "BTCUSD",
  ETHUSD: "ETHUSD",
  SOLUSD: "SOLUSD",
};

const REQUIRED_MARKETS = ["BTCUSD", "ETHUSD", "SOLUSD"] as const;

class IndexPriceObserver {
  private communicator: Communicator;
  private sendToAdrress: ReplyAddress;
  private receivedMarkets = new Set<string>();
  private initResolver: ((val: unknown) => void) | undefined;

  private readonly streamPairs = [
    "btcusd@indexPrice",
    "solusd@indexPrice",
    "ethusd@indexPrice",
  ];

  constructor(communicator: Communicator, sendToAddress: ReplyAddress) {
    this.communicator = communicator;
    this.sendToAdrress = sendToAddress;
  }

  async initialize() {
    return new Promise<void>((resolve) => {
      this.initResolver = () => resolve();
      const timeout = setTimeout(() => {
        if (this.initResolver) {
         throw new Error(
            "[INDEX_PRICE] Timed out waiting for all index prices — continuing",
          );
        }
      }, 600_000);

      const finish = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.initResolver = () => finish();
      this.setupPriceSubscriptions();
    });
  }

  private maybeFinishInit() {
    if (
      !this.initResolver ||
      this.receivedMarkets.size < REQUIRED_MARKETS.length
    ) {
      return;
    }
    console.log(
      "[INDEX_PRICE] Got index prices for all markets — feed is live",
    );
    this.initResolver(undefined);
    this.initResolver = undefined;
  }

  private parseIndexUpdate(raw: unknown): {
    marketSymbol: string;
    price: number;
  } | null {
    if (!raw || typeof raw !== "object") return null;

    const envelope = raw as Record<string, unknown>;
    const payload =
      envelope.data && typeof envelope.data === "object"
        ? (envelope.data as Record<string, unknown>)
        : envelope;

    const indexSymbol = String(
      payload.i ?? payload.s ?? payload.symbol ?? "",
    ).toUpperCase();
    const marketSymbol = STREAM_TO_MARKET[indexSymbol];
    if (!marketSymbol) return null;

    const price = Number(payload.p ?? payload.price);
    if (!Number.isFinite(price) || price <= 0) return null;

    return { marketSymbol, price };
  }

  private setupPriceSubscriptions() {
    const url = process.env.PRICE_UPDATES_WEBSOCKET_BACKEND_URL;
    console.log("[INDEX_PRICE] Connecting to", url);

    const ws = new WebSocket(url!);
    let subscribed = false;

    ws.onopen = () => {
      console.log("[INDEX_PRICE] WebSocket connected, subscribing");
      ws.send(
        JSON.stringify({
          method: "SUBSCRIBE",
          params: this.streamPairs,
          id: 1,
        }),
      );
    };

    ws.onerror = (ev) => {
      console.error("[INDEX_PRICE] WebSocket error", ev);
      throw new Error(
        "[INDEX_PRICE] WebSocket error",
      );
    };

    ws.onclose = () => {
      console.warn("[INDEX_PRICE] WebSocket closed — engine continues without live feed");
      throw new Error(
        "[INDEX_PRICE] WebSocket closed — engine continues without live feed",
      );
    };

    ws.onmessage = async ({ data }) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(data));
      } catch {
        return;
      }

      const message = parsed as Record<string, unknown>;

      // Subscription acknowledgement
      if (message.id === 1 && !subscribed) {
        if (message.error) {
          console.error("[INDEX_PRICE] Subscribe failed:", message.error);
          return;
        }
        subscribed = true;
        console.log("[INDEX_PRICE] Subscription confirmed");
        return;
      }

      const update = this.parseIndexUpdate(parsed);
      if (!update) return;

      await this.communicator.send(this.sendToAdrress, {
        type: "indexprice_updated",
        payload: {
          price: update.price,
          marketSymbol: update.marketSymbol,
        },
      });

      this.receivedMarkets.add(update.marketSymbol);
      this.maybeFinishInit();
    };
  }
}

export default IndexPriceObserver;
