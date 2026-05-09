-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "internalCustomerId" TEXT;

-- CreateTable
CREATE TABLE "InternalCustomer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternalCustomer_companyId_idx" ON "InternalCustomer"("companyId");

-- CreateIndex
CREATE INDEX "InternalCustomer_name_idx" ON "InternalCustomer"("name");

-- CreateIndex
CREATE INDEX "InternalCustomer_active_idx" ON "InternalCustomer"("active");

-- CreateIndex
CREATE INDEX "Order_internalCustomerId_idx" ON "Order"("internalCustomerId");

-- AddForeignKey
ALTER TABLE "InternalCustomer" ADD CONSTRAINT "InternalCustomer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_internalCustomerId_fkey" FOREIGN KEY ("internalCustomerId") REFERENCES "InternalCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
