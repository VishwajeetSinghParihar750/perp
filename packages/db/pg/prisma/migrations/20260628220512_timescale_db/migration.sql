-- CreateEnum
CREATE TYPE "ORDER_SIDE" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "MARKET_SYMBOL" AS ENUM ('ETHUSD', 'BTCUSD', 'SOLUSD');

-- CreateEnum
CREATE TYPE "ORDER_TYPE" AS ENUM ('MARKET', 'LIMIT');

-- CreateEnum
CREATE TYPE "MARGIN_TYPE" AS ENUM ('ISOLATED', 'CROSS');

-- CreateEnum
CREATE TYPE "ORDER_STATUS" AS ENUM ('OPEN', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "symbol" "MARKET_SYMBOL" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processedEvent" (
    "id" TEXT NOT NULL,

    CONSTRAINT "processedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "ORDER_SIDE" NOT NULL,
    "symbol" "MARKET_SYMBOL" NOT NULL,
    "margin" DECIMAL(18,2) NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "filledQuantity" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,
    "status" "ORDER_STATUS" NOT NULL,
    "type" "ORDER_TYPE" NOT NULL,
    "marginType" "MARGIN_TYPE" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fill" (
    "id" TEXT NOT NULL,
    "symbol" "MARKET_SYMBOL" NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "bidPrice" DECIMAL(18,2) NOT NULL,
    "longUserId" TEXT NOT NULL,
    "shortUserId" TEXT NOT NULL,
    "longOrderId" TEXT NOT NULL,
    "shortOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fill_pkey" PRIMARY KEY ("id","createdAt")
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_symbol_key" ON "Market"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Fill_symbol_createdAt_idx" ON "Fill"("symbol", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Market"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_longUserId_fkey" FOREIGN KEY ("longUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_shortUserId_fkey" FOREIGN KEY ("shortUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_longOrderId_fkey" FOREIGN KEY ("longOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_shortOrderId_fkey" FOREIGN KEY ("shortOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Market"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;




-- Timescale db
CREATE EXTENSION IF NOT EXISTS timescaledb;

SELECT create_hypertable('"Fill"', 'createdAt');

CREATE MATERIALIZED VIEW candles_1m
WITH (timescaledb.continuous)
AS
SELECT 
    time_bucket('1 minute', "createdAt") AS bucket,
    max(id) as lastTradeId,
    symbol,
    sum(quantity) AS volume,
    count(*) AS trades,
    max(price) AS high, min(price) AS low, 
    first(price, "createdAt") AS open,
    last(price, "createdAt") AS close
FROM "Fill" 
GROUP BY bucket, symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'candles_1m',
    start_offset => INTERVAL '10 minutes',
    end_offset => INTERVAL '0 seconds',
    schedule_interval => INTERVAL '5 seconds'
);

CREATE INDEX candles_1m_bucket_index 
ON candles_1m(symbol, bucket DESC);


CREATE MATERIALIZED VIEW candles_1h
WITH (timescaledb.continuous)
AS
SELECT
    time_bucket('1 hour', bucket) AS bucket,
    max(lastTradeId) as lastTradeId,
    symbol,
    sum(volume) AS volume,
    sum(trades) AS trades,
    max(high) AS high,
    min(low) AS low,
    first(open, bucket) AS open,
    last(close, bucket) AS close
FROM candles_1m
GROUP BY
    time_bucket('1 hour', bucket),
    symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'candles_1h',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '0 seconds',
    schedule_interval => INTERVAL '1 minute'
);

CREATE INDEX candles_1h_bucket_index 
ON candles_1h(symbol, bucket DESC);

CREATE MATERIALIZED VIEW candles_1d
WITH (timescaledb.continuous)
AS
SELECT 
    time_bucket('1 day', bucket) AS bucket,
    max(lastTradeId) as lastTradeId,
    symbol,
    sum(volume) AS volume,
    sum(trades) AS trades,
    max(high) AS high, min(low) AS low, 
    first(open, bucket) AS open,
    last(close, bucket) AS close
FROM candles_1h 
GROUP BY time_bucket('1 day', bucket), symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'candles_1d',
    start_offset => INTERVAL '2 days',
    end_offset => INTERVAL '0 seconds',
    schedule_interval => INTERVAL '5 minutes'
);

CREATE INDEX candles_1d_bucket_index 
ON candles_1d(symbol, bucket DESC);