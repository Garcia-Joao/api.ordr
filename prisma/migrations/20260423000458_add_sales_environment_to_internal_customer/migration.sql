-- CreateTable
CREATE TABLE "ProductEnvironmentPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "salesEnvironmentId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductEnvironmentPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductEnvironmentPrice_productId_idx" ON "ProductEnvironmentPrice"("productId");

-- CreateIndex
CREATE INDEX "ProductEnvironmentPrice_salesEnvironmentId_idx" ON "ProductEnvironmentPrice"("salesEnvironmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductEnvironmentPrice_productId_salesEnvironmentId_key" ON "ProductEnvironmentPrice"("productId", "salesEnvironmentId");

-- AddForeignKey
ALTER TABLE "ProductEnvironmentPrice" ADD CONSTRAINT "ProductEnvironmentPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductEnvironmentPrice" ADD CONSTRAINT "ProductEnvironmentPrice_salesEnvironmentId_fkey" FOREIGN KEY ("salesEnvironmentId") REFERENCES "SalesEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
