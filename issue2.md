1. start server only after getting index price once
2. keep timeout in request, and reject when timeout expires

### B10. `OrderBook.emitDepthUpdateEvents` — Depth updates never published

**File:** `apps/engine/src/classes/OrderBook.ts:372-402`

The `depthUpdates` parameter (typed as `any`) is completely ignored. All the actual depth update event emission logic is commented out (lines 150-174 in `placeMarketBuyOrder`, etc.). The only thing that happens is a counter increment.

---

### C6. `PositionManager` — Inconsistent price update for LONG vs SHORT reductions ( maybeeeeee letssee , my code seems correct on checking to me )

**File:** `apps/engine/src/classes/PositionManager.ts:170-178`

When reducing a LONG position: entry price stays the same (correct).
When reducing a SHORT position: entry price changes to `weighedAvgPrice` (incorrect — should keep original).

When flipping direction (LONG→SHORT): uses new avg price (debatable).
When flipping (SHORT→LONG): keeps old entry price (incorrect — should use new avg).
