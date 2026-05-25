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
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "ORDER_SIDE" NOT NULL,
    "symbol" "MARKET_SYMBOL" NOT NULL,
    "margin" DECIMAL(18,0) NOT NULL,
    "price" DECIMAL(18,0) NOT NULL,
    "filledQuantity" DECIMAL(18,0) NOT NULL,
    "quantity" DECIMAL(18,0) NOT NULL,
    "status" "ORDER_STATUS" NOT NULL,
    "type" "ORDER_TYPE" NOT NULL,
    "marginType" "MARGIN_TYPE" NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fill" (
    "id" TEXT NOT NULL,
    "symbol" "MARKET_SYMBOL" NOT NULL,
    "quantity" DECIMAL(18,0) NOT NULL,
    "price" DECIMAL(18,0) NOT NULL,
    "bidPrice" DECIMAL(18,0) NOT NULL,
    "longUserId" TEXT NOT NULL,
    "shortUserId" TEXT NOT NULL,
    "longOrderId" TEXT NOT NULL,
    "shortOrderId" TEXT NOT NULL,

    CONSTRAINT "Fill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_symbol_key" ON "Market"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

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
