-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerId" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCustomerComanda" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventDateId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "comandaNumber" INTEGER NOT NULL,
    "comandaName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCustomerComanda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_active_idx" ON "Customer"("active");

-- CreateIndex
CREATE INDEX "EventCustomerComanda_companyId_idx" ON "EventCustomerComanda"("companyId");

-- CreateIndex
CREATE INDEX "EventCustomerComanda_eventDateId_idx" ON "EventCustomerComanda"("eventDateId");

-- CreateIndex
CREATE INDEX "EventCustomerComanda_customerId_idx" ON "EventCustomerComanda"("customerId");

-- CreateIndex
CREATE INDEX "EventCustomerComanda_comandaNumber_idx" ON "EventCustomerComanda"("comandaNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EventCustomerComanda_eventDateId_customerId_key" ON "EventCustomerComanda"("eventDateId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "EventCustomerComanda_eventDateId_comandaNumber_key" ON "EventCustomerComanda"("eventDateId", "comandaNumber");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCustomerComanda" ADD CONSTRAINT "EventCustomerComanda_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCustomerComanda" ADD CONSTRAINT "EventCustomerComanda_eventDateId_fkey" FOREIGN KEY ("eventDateId") REFERENCES "EventDate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCustomerComanda" ADD CONSTRAINT "EventCustomerComanda_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
