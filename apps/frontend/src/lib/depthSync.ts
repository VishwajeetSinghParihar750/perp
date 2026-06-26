export type OrderbookState = {
  asks: [number, number][];
  bids: [number, number][];
};

export type DepthLevelUpdate = {
  asks: Record<string, number>;
  bids: Record<string, number>;
};

export type BufferedDepthUpdate = DepthLevelUpdate & {
  lastUpdatedDepthId: number;
};

export type DepthSyncState = "subscribing" | "fetching" | "live";

export interface DepthSyncInfo {
  state: DepthSyncState;
  buffer: BufferedDepthUpdate[];
  subReqId: string;
  lastAppliedDepthId: number;
}

export function createDepthSyncInfo(subReqId: string): DepthSyncInfo {
  return {
    state: "subscribing",
    buffer: [],
    subReqId,
    lastAppliedDepthId: 0,
  };
}

export function applyDepthSnapshot(
  snapshotAsks: { price: number; quantity: number }[],
  snapshotBids: { price: number; quantity: number }[],
): OrderbookState {
  const asksMap = new Map<number, number>();
  const bidsMap = new Map<number, number>();

  for (const { price, quantity } of snapshotAsks) {
    if (quantity > 0) asksMap.set(price, quantity);
  }
  for (const { price, quantity } of snapshotBids) {
    if (quantity > 0) bidsMap.set(price, quantity);
  }

  return {
    asks: Array.from(asksMap.entries()).sort((a, b) => a[0] - b[0]) as [
      number,
      number,
    ][],
    bids: Array.from(bidsMap.entries()).sort((a, b) => b[0] - a[0]) as [
      number,
      number,
    ][],
  };
}

export function applyDepthUpdate(
  prev: OrderbookState,
  update: DepthLevelUpdate,
): OrderbookState {
  const asksMap = new Map<number, number>(prev.asks);
  const bidsMap = new Map<number, number>(prev.bids);

  for (const [priceStr, qty] of Object.entries(update.asks)) {
    const price = parseFloat(priceStr);
    if (qty === 0) asksMap.delete(price);
    else asksMap.set(price, qty);
  }

  for (const [priceStr, qty] of Object.entries(update.bids)) {
    const price = parseFloat(priceStr);
    if (qty === 0) bidsMap.delete(price);
    else bidsMap.set(price, qty);
  }

  return {
    asks: Array.from(asksMap.entries()).sort((a, b) => a[0] - b[0]) as [
      number,
      number,
    ][],
    bids: Array.from(bidsMap.entries()).sort((a, b) => b[0] - a[0]) as [
      number,
      number,
    ][],
  };
}

export function getLatestBufferedDepthId(
  buffer: BufferedDepthUpdate[],
): number | undefined {
  if (buffer.length === 0) return undefined;
  return Math.max(...buffer.map((update) => update.lastUpdatedDepthId));
}

/**
 * After a snapshot arrives, discard buffered updates at or before the snapshot
 * sequence id, then replay the remaining updates in order.
 */
export function reconcileBufferedDepthUpdates(
  snapshotBook: OrderbookState,
  snapshotDepthId: number,
  buffer: BufferedDepthUpdate[],
): { book: OrderbookState; lastAppliedDepthId: number } {
  const relevantUpdates = buffer
    .filter((update) => update.lastUpdatedDepthId > snapshotDepthId)
    .sort((a, b) => a.lastUpdatedDepthId - b.lastUpdatedDepthId);

  let book = snapshotBook;
  let lastAppliedDepthId = snapshotDepthId;

  for (const update of relevantUpdates) {
    if (update.lastUpdatedDepthId <= lastAppliedDepthId) {
      continue;
    }
    book = applyDepthUpdate(book, update);
    lastAppliedDepthId = update.lastUpdatedDepthId;
  }

  return { book, lastAppliedDepthId };
}

export function shouldApplyLiveDepthUpdate(
  updateId: number,
  lastAppliedDepthId: number,
): boolean {
  return updateId > lastAppliedDepthId;
}
