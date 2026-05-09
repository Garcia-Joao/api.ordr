-- CreateEnum
CREATE TYPE "BuyRequestStatus" AS ENUM ('pending', 'partially_received', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE "BuyRequestItemStatus" AS ENUM ('pending', 'bought', 'not_bought', 'partial');

-- CreateTable
CREATE TABLE "BuyRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventDateId" TEXT,
    "title" TEXT NOT NULL,
    "supplierName" TEXT,
    "notes" TEXT,
    "status" "BuyRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "BuyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyRequestItem" (
    "id" TEXT NOT NULL,
    "buyRequestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedQuantity" DOUBLE PRECISION NOT NULL,
    "boughtQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(10,2),
    "totalPrice" DECIMAL(10,2),
    "status" "BuyRequestItemStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuyRequest_companyId_idx" ON "BuyRequest"("companyId");

-- CreateIndex
CREATE INDEX "BuyRequest_eventDateId_idx" ON "BuyRequest"("eventDateId");

-- CreateIndex
CREATE INDEX "BuyRequest_status_idx" ON "BuyRequest"("status");

-- CreateIndex
CREATE INDEX "BuyRequest_createdAt_idx" ON "BuyRequest"("createdAt");

-- CreateIndex
CREATE INDEX "BuyRequestItem_buyRequestId_idx" ON "BuyRequestItem"("buyRequestId");

-- CreateIndex
CREATE INDEX "BuyRequestItem_productId_idx" ON "BuyRequestItem"("productId");

-- CreateIndex
CREATE INDEX "BuyRequestItem_status_idx" ON "BuyRequestItem"("status");

-- AddForeignKey
ALTER TABLE "BuyRequest" ADD CONSTRAINT "BuyRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyRequest" ADD CONSTRAINT "BuyRequest_eventDateId_fkey" FOREIGN KEY ("eventDateId") REFERENCES "EventDate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyRequestItem" ADD CONSTRAINT "BuyRequestItem_buyRequestId_fkey" FOREIGN KEY ("buyRequestId") REFERENCES "BuyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyRequestItem" ADD CONSTRAINT "BuyRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
