import { WS_URL } from "../constants";
import type { EngineEventType, Side, OrderType, MarginType, TradableSymbol } from "../types";

export interface EngineEventMessage {
  type: "event";
  idempotencyKey: string;
  payload: { type: EngineEventType; data: unknown };
}

export interface EngineResponseMessage {
  type: string;
  requestId: string;
  payload?: unknown;
}

interface PendingRequest {
  resolve: (msg: EngineResponseMessage) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface SocketCallbacks {
  onOpen: () => void;
  onStatusChange: (connected: boolean) => void;
  onEvent: (payload: EngineEventMessage["payload"]) => void;
  onAuthExpired: () => void;
}

const REQUEST_TIMEOUT_MS = 20_000;
const RECONNECT_DELAY_MS = 3_000;

/**
 * Thin transport over the engine WebSocket. Owns connection lifecycle and
 * correlates request/response pairs by requestId. Streamed `event` messages
 * (which carry no requestId) are forwarded to `onEvent`.
 */
export class TradingSocket {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private callbacks: SocketCallbacks;

  private pending = new Map<string, PendingRequest>();
  private reqCounter = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;

  constructor(callbacks: SocketCallbacks) {
    this.callbacks = callbacks;
  }

  connect(token: string) {
    this.token = token;
    this.closedByUser = false;
    this.open();
  }

  disconnect() {
    this.closedByUser = true;
    this.clearReconnect();
    this.rejectAllPending(new Error("SOCKET_CLOSED"));
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private open() {
    if (!this.token) return;
    this.clearReconnect();

    const ws = new WebSocket(`${WS_URL}?jwt_token=${this.token}`);
    this.ws = ws;

    ws.onopen = () => {
      this.callbacks.onStatusChange(true);
      this.callbacks.onOpen();
    };

    ws.onclose = (event) => {
      this.callbacks.onStatusChange(false);
      this.rejectAllPending(new Error("SOCKET_CLOSED"));
      if (this.closedByUser) return;
      if (event.code === 4001) {
        this.callbacks.onAuthExpired();
        return;
      }
      this.reconnectTimer = setTimeout(() => this.open(), RECONNECT_DELAY_MS);
    };

    ws.onerror = () => {
      // close handler drives reconnect; nothing else to do here
    };

    ws.onmessage = (event) => this.handleMessage(event.data);
  }

  private handleMessage(raw: string) {
    let msg: EngineResponseMessage | EngineEventMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "event") {
      this.callbacks.onEvent((msg as EngineEventMessage).payload);
      return;
    }

    const response = msg as EngineResponseMessage;
    if (!response.requestId) return;
    const pending = this.pending.get(response.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(response.requestId);
    pending.resolve(response);
  }

  private rejectAllPending(err: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pending.clear();
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private nextRequestId(): string {
    return `req_${++this.reqCounter}`;
  }

  /** Send a request and resolve with the response that carries the same requestId. */
  request(type: string, payload: Record<string, unknown>): Promise<EngineResponseMessage> {
    return new Promise((resolve, reject) => {
      if (!this.isOpen()) {
        reject(new Error("SOCKET_NOT_OPEN"));
        return;
      }
      const requestId = this.nextRequestId();
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("REQUEST_TIMED_OUT"));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(requestId, { resolve, reject, timer });
      this.ws!.send(JSON.stringify({ requestId, type, payload }));
    });
  }

  // ---- typed convenience wrappers ------------------------------------------

  subscribe(events: EngineEventType[]) {
    return this.request("subscribe_event", { events });
  }

  getDepth(marketSymbol: TradableSymbol) {
    return this.request("get_depth", { marketSymbol });
  }

  getBalance() {
    return this.request("get_balance", {});
  }

  getPosition() {
    return this.request("get_position", {});
  }

  addBalance(marketSymbol: string, amount: number) {
    return this.request("add_balance", { marketSymbol, amount });
  }

  createOrder(params: {
    side: Side;
    type: OrderType;
    price: number;
    qty: number;
    margin: number;
    marginType: MarginType;
    marketSymbol: TradableSymbol;
  }) {
    return this.request("create_order", { ...params });
  }

  cancelOrder(orderId: string) {
    return this.request("cancel_order", { orderId });
  }
}
