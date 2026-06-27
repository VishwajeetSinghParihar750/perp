import { fetchOpenOrders, signIn, signUp } from "../api";
import { API_URL, getMarket, resolveReferencePrice, WS_URL } from "../constants";
import type { MarginType, Side, TradableSymbol } from "../types";

export interface LoadTestConfig {
  userCount: number;
  /** How many random orders each user places */
  decisionsPerUser: number;
  /** Random pause between a user's orders [min, max] ms */
  delayMs: [number, number];
  marketSymbol: TradableSymbol;
  price: number;
  /** Random order size range [min, max] */
  qtyRange: [number, number];
  leverage: number;
  usernamePrefix: string;
  password: string;
}

export interface LoadTestTimings {
  setupMs: number;
  buyOrderLatenciesMs: number[];
  sellOrderLatenciesMs: number[];
  firstOrderAt: number;
  lastOrderAt: number;
}

export interface LoadTestResult {
  ok: boolean;
  error?: string;
  users: string[];
  ordersSubmitted: number;
  bidsPlaced: number;
  asksPlaced: number;
  openOrdersInDb: number;
  timings: LoadTestTimings;
  summary: {
    buyAvgMs: number;
    buyP99Ms: number;
    sellAvgMs: number;
    sellP99Ms: number;
    placementSpanMs: number;
    ordersPerSec: number;
  };
}

type LogFn = (line: string) => void;

interface WsResponse {
  type: string;
  requestId: string;
  payload?: unknown;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[idx];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Demo balance — effectively unlimited for load testing. */
const DEMO_USER_BALANCE = 100_000_000;

function marginForLoadTest(
  orderPrice: number,
  qty: number,
  indexPrice: number,
  side: Side,
): number {
  const notional = orderPrice * qty;
  const indexDistance =
    side === "BUY"
      ? Math.max(0, indexPrice - orderPrice)
      : Math.max(0, orderPrice - indexPrice);

  const forIndexDistance = (indexDistance * qty) / 0.995;
  const forMaxLeverage = notional / 100;
  const generousFloor = notional * 3;

  const margin = Math.max(forIndexDistance, forMaxLeverage, generousFloor, 1) * 1.5;
  return parseFloat(margin.toFixed(4));
}

function randomDelayMs(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomSide(): Side {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]!;
  return n % 2 === 0 ? "BUY" : "SELL";
}

/** Side first, then price — mostly rests on the correct side of mid, sometimes crosses for fills. */
function randomPriceForSide(
  side: Side,
  mid: number,
  pricePrecision: number,
): number {
  const pct = 0.002 + Math.random() * 0.028;
  const cross = Math.random() < 0.35;
  if (side === "BUY") {
    const mult = cross ? 1 + pct : 1 - pct;
    return parseFloat((mid * mult).toFixed(pricePrecision));
  }
  const mult = cross ? 1 - pct : 1 + pct;
  return parseFloat((mid * mult).toFixed(pricePrecision));
}

function randomQty(min: number, max: number, qtyPrecision: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const raw = lo + Math.random() * (hi - lo);
  return parseFloat(raw.toFixed(qtyPrecision));
}

class LoadTestSocket {
  private ws: WebSocket | null = null;
  private pending = new Map<
    string,
    { resolve: (msg: WsResponse) => void; reject: (err: Error) => void }
  >();
  private eventWaiters: Array<{
    match: (payload: { type: string; data: unknown }) => boolean;
    resolve: (data: unknown) => void;
  }> = [];
  private counter = 0;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}?jwt_token=${token}`);
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error("WS connect timeout")), 15_000);

      ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("WS connection error"));
      };
      ws.onclose = () => {
        for (const { reject: rej } of this.pending.values()) {
          rej(new Error("WS closed"));
        }
        this.pending.clear();
      };
      ws.onmessage = (event) => {
        let msg: WsResponse & { payload?: { type?: string; data?: unknown } };
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (msg.type === "event" && msg.payload?.type) {
          for (let i = this.eventWaiters.length - 1; i >= 0; i--) {
            const waiter = this.eventWaiters[i]!;
            if (waiter.match(msg.payload as { type: string; data: unknown })) {
              this.eventWaiters.splice(i, 1);
              waiter.resolve((msg.payload as { data: unknown }).data);
            }
          }
          return;
        }
        if (msg.type === "event" || !msg.requestId) return;
        const pending = this.pending.get(msg.requestId);
        if (!pending) return;
        this.pending.delete(msg.requestId);
        pending.resolve(msg);
      };
    });
  }

  request(type: string, payload: Record<string, unknown>): Promise<WsResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WS not open"));
        return;
      }
      const requestId = `lt_${++this.counter}`;
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Request timeout: ${type}`));
      }, 20_000);
      this.pending.set(requestId, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.ws.send(JSON.stringify({ requestId, type, payload }));
    });
  }

  close() {
    this.ws?.close();
    this.ws = null;
    this.eventWaiters = [];
  }

  waitForEvent<T>(
    match: (payload: { type: string; data: unknown }) => boolean,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.eventWaiters.findIndex((w) => w.resolve === resolveWrapper);
        if (idx >= 0) this.eventWaiters.splice(idx, 1);
        reject(new Error("Event wait timeout"));
      }, timeoutMs);

      const resolveWrapper = (data: unknown) => {
        clearTimeout(timer);
        resolve(data as T);
      };

      this.eventWaiters.push({ match, resolve: resolveWrapper });
    });
  }
}

async function resolveTradePrice(
  socket: LoadTestSocket,
  marketSymbol: TradableSymbol,
  hintPrice: number,
  log: LogFn,
): Promise<number> {
  await socket.request("subscribe_event", {
    events: ["indexprice.updated", "markprice.updated", "lastTradedPrice.updated"],
  });

  const matchPrice =
    (types: string[]) =>
    (p: { type: string; data: unknown }) => {
      if (!types.includes(p.type)) return false;
      const d = p.data as { marketSymbol?: string; price?: number };
      return d.marketSymbol === marketSymbol && typeof d.price === "number";
    };

  try {
    const data = await socket.waitForEvent<{ marketSymbol: string; price: number }>(
      matchPrice(["indexprice.updated"]),
      10_000,
    );
    log(`Index price $${data.price} (live feed)`);
    return data.price;
  } catch {
    try {
      const data = await socket.waitForEvent<{ marketSymbol: string; price: number }>(
        matchPrice(["markprice.updated", "lastTradedPrice.updated"]),
        3_000,
      );
      log(`Reference price $${data.price} (mark/last feed)`);
      return data.price;
    } catch {
      if (hintPrice > 0) {
        log(`No live feed within 13s — using trading UI price $${hintPrice}`);
        return hintPrice;
      }
      const fallback = resolveReferencePrice(marketSymbol);
      log(`No live feed for ${marketSymbol} — using fallback $${fallback}`);
      return fallback;
    }
  }
}

async function ensureUser(
  username: string,
  password: string,
): Promise<string> {
  try {
    await signUp(username, password);
  } catch {
    // already exists
  }
  return signIn(username, password);
}

function emptyResult(error: string, setupMs = 0): LoadTestResult {
  return {
    ok: false,
    error,
    users: [],
    ordersSubmitted: 0,
    bidsPlaced: 0,
    asksPlaced: 0,
    openOrdersInDb: 0,
    timings: {
      setupMs,
      buyOrderLatenciesMs: [],
      sellOrderLatenciesMs: [],
      firstOrderAt: 0,
      lastOrderAt: 0,
    },
    summary: {
      buyAvgMs: 0,
      buyP99Ms: 0,
      sellAvgMs: 0,
      sellP99Ms: 0,
      placementSpanMs: 0,
      ordersPerSec: 0,
    },
  };
}

export async function runLoadTest(
  config: LoadTestConfig,
  log: LogFn = console.log,
): Promise<LoadTestResult> {
  const {
    userCount,
    decisionsPerUser,
    delayMs,
    marketSymbol,
    price: configuredPrice,
    qtyRange,
    usernamePrefix,
    password,
  } = config;

  const [delayMin, delayMax] = delayMs;
  const [qtyMin, qtyMax] = qtyRange;
  const { pricePrecision, qtyPrecision } = getMarket(marketSymbol);
  const totalTarget = userCount * decisionsPerUser;

  if (userCount < 1) return emptyResult("userCount must be >= 1");
  if (decisionsPerUser < 1) return emptyResult("decisionsPerUser must be >= 1");
  if (qtyMin <= 0 || qtyMax <= 0) return emptyResult("qty range must be > 0");

  const marginType: MarginType = "ISOLATED";
  const setupStart = performance.now();

  log(`API: ${API_URL}  WS: ${WS_URL}`);
  log(
    `${userCount} users × ${decisionsPerUser} random orders on ${marketSymbol} ` +
      `(qty ${Math.min(qtyMin, qtyMax)}–${Math.max(qtyMin, qtyMax)}, ` +
      `delay ${delayMin}–${delayMax}ms)`,
  );

  const usernames = Array.from(
    { length: userCount },
    (_, i) => `${usernamePrefix}-${Date.now()}-${i}`,
  );
  const sockets: LoadTestSocket[] = [];

  const buyLatencies: number[] = [];
  const sellLatencies: number[] = [];
  let firstOrderAt = 0;
  let lastOrderAt = 0;
  let ordersSubmitted = 0;
  let bidsPlaced = 0;
  let asksPlaced = 0;

  const recordOrder = (side: Side, ms: number, t0: number, ok: boolean) => {
    if (!ok) return;
    if (side === "BUY") {
      buyLatencies.push(ms);
      bidsPlaced++;
    } else {
      sellLatencies.push(ms);
      asksPlaced++;
    }
    ordersSubmitted++;
    if (firstOrderAt === 0) firstOrderAt = t0;
    lastOrderAt = performance.now();
  };

  try {
    log("Creating users and opening sockets...");
    for (const username of usernames) {
      const token = await ensureUser(username, password);
      const socket = new LoadTestSocket();
      await socket.connect(token);
      sockets.push(socket);
      const balRes = await socket.request("add_balance", {
        marketSymbol: "USD",
        amount: DEMO_USER_BALANCE,
      });
      if (balRes.type === "error") {
        throw new Error(`add_balance failed for ${username}: ${balRes.payload}`);
      }
    }

    const mid = await resolveTradePrice(
      sockets[0]!,
      marketSymbol,
      configuredPrice,
      log,
    );

    const setupMs = performance.now() - setupStart;
    log(`Setup done in ${setupMs.toFixed(0)}ms — placing ${totalTarget} orders...`);
    log(`Each user funded with $${DEMO_USER_BALANCE.toLocaleString()} — generous margin per order`);

    await Promise.all(
      usernames.map(async (username, userIdx) => {
        const socket = sockets[userIdx]!;

        for (let d = 0; d < decisionsPerUser; d++) {
          const side = randomSide();
          const price = randomPriceForSide(side, mid, pricePrecision);
          const qty = randomQty(qtyMin, qtyMax, qtyPrecision);
          const t0 = performance.now();

          const margin = marginForLoadTest(price, qty, mid, side);

          const res = await socket.request("create_order", {
            side,
            type: "LIMIT",
            price,
            qty,
            margin,
            marginType,
            marketSymbol,
          });

          const ms = performance.now() - t0;
          const ok = res.type !== "error";
          recordOrder(side, ms, t0, ok);

          const label = side === "BUY" ? "bid" : "ask";
          if (ok) {
            log(`  ${username}: ${label} ${qty} @ $${price} (${d + 1}/${decisionsPerUser})`);
          } else {
            log(`  ${username}: SKIP ${label} ${qty} @ $${price}: ${String(res.payload)}`);
          }

          if (d < decisionsPerUser - 1) {
            await sleep(randomDelayMs(delayMin, delayMax));
          }
        }
      }),
    );

    const placementSpanMs = lastOrderAt - (firstOrderAt || lastOrderAt);
    const ordersPerSec =
      placementSpanMs > 0 ? ordersSubmitted / (placementSpanMs / 1000) : 0;

    const probeToken = await ensureUser(usernames[0]!, password);
    let openOrdersInDb = 0;
    try {
      await sleep(500);
      openOrdersInDb = (await fetchOpenOrders(probeToken, marketSymbol)).length;
      log(`Open orders in DB (probe user): ${openOrdersInDb}`);
    } catch {
      log("Could not fetch open orders from REST");
    }

    const summary = {
      buyAvgMs: avg(buyLatencies),
      buyP99Ms: percentile(buyLatencies, 99),
      sellAvgMs: avg(sellLatencies),
      sellP99Ms: percentile(sellLatencies, 99),
      placementSpanMs,
      ordersPerSec,
    };

    log("");
    log("=== Results ===");
    log(`Orders submitted:  ${ordersSubmitted} / ${totalTarget}`);
    log(`Bids:              ${bidsPlaced}`);
    log(`Asks:              ${asksPlaced}`);
    log(`BUY  avg/p99:      ${summary.buyAvgMs.toFixed(1)} / ${summary.buyP99Ms.toFixed(1)} ms`);
    log(`SELL avg/p99:      ${summary.sellAvgMs.toFixed(1)} / ${summary.sellP99Ms.toFixed(1)} ms`);
    log(`Span:              ${summary.placementSpanMs.toFixed(0)} ms`);

    const ok = ordersSubmitted >= totalTarget * 0.85;

    return {
      ok,
      users: usernames,
      ordersSubmitted,
      bidsPlaced,
      asksPlaced,
      openOrdersInDb,
      timings: {
        setupMs,
        buyOrderLatenciesMs: buyLatencies,
        sellOrderLatenciesMs: sellLatencies,
        firstOrderAt,
        lastOrderAt,
      },
      summary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`ERROR: ${message}`);
    return {
      ...emptyResult(message, performance.now() - setupStart),
      users: usernames,
      ordersSubmitted,
      bidsPlaced,
      asksPlaced,
    };
  } finally {
    for (const socket of sockets) socket.close();
  }
}

export const DEFAULT_LOAD_TEST_CONFIG: LoadTestConfig = {
  userCount: 4,
  decisionsPerUser: 10,
  delayMs: [0, 10_000],
  marketSymbol: "BTCUSD",
  price: 0,
  qtyRange: [0.001, 0.01],
  leverage: 10,
  usernamePrefix: "loadtest",
  password: "loadtest-pass",
};
