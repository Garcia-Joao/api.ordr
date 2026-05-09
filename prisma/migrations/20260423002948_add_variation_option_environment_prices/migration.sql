-- CreateTable
CREATE TABLE "ProductVariationOptionEnvironmentPrice" (
    "id" TEXT NOT NULL,
    "productVariationOptionId" TEXT NOT NULL,
    "salesEnvironmentId" TEXT NOT NULL,
    "priceModifier" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariationOptionEnvironmentPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariationOptionEnvironmentPrice_productVariationOpti_idx" ON "ProductVariationOptionEnvironmentPrice"("productVariationOptionId");

-- CreateIndex
CREATE INDEX "ProductVariationOptionEnvironmentPrice_salesEnvironmentId_idx" ON "ProductVariationOptionEnvironmentPrice"("salesEnvironmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariationOptionEnvironmentPrice_productVariationOpti_key" ON "ProductVariationOptionEnvironmentPrice"("productVariationOptionId", "salesEnvironmentId");

-- AddForeignKey
ALTER TABLE "ProductVariationOptionEnvironmentPrice" ADD CONSTRAINT "ProductVariationOptionEnvironmentPrice_productVariationOpt_fkey" FOREIGN KEY ("productVariationOptionId") REFERENCES "ProductVariationOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariationOptionEnvironmentPrice" ADD CONSTRAINT "ProductVariationOptionEnvironmentPrice_salesEnvironmentId_fkey" FOREIGN KEY ("salesEnvironmentId") REFERENCES "SalesEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
