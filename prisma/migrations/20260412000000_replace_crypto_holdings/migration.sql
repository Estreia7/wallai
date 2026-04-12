-- DropTable
DROP TABLE "CryptoHolding";

-- CreateTable
CREATE TABLE "CryptoHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coinId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "avgCostEur" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoSnapshot" (
    "id" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "priceEur" DOUBLE PRECISION NOT NULL,
    "valueEur" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CryptoSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CryptoHolding_userId_coinId_key" ON "CryptoHolding"("userId", "coinId");

-- CreateIndex
CREATE INDEX "CryptoHolding_userId_idx" ON "CryptoHolding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoSnapshot_holdingId_date_key" ON "CryptoSnapshot"("holdingId", "date");

-- CreateIndex
CREATE INDEX "CryptoSnapshot_holdingId_date_idx" ON "CryptoSnapshot"("holdingId", "date");

-- AddForeignKey
ALTER TABLE "CryptoHolding" ADD CONSTRAINT "CryptoHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoSnapshot" ADD CONSTRAINT "CryptoSnapshot_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "CryptoHolding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
