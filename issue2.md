1. start server only after getting index price once

### B10. `OrderBook.emitDepthUpdateEvents` — Depth updates never published

**File:** `apps/engine/src/classes/OrderBook.ts:372-402`

The `depthUpdates` parameter (typed as `any`) is completely ignored. All the actual depth update event emission logic is commented out (lines 150-174 in `placeMarketBuyOrder`, etc.). The only thing that happens is a counter increment.

---
