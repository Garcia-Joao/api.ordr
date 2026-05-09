DO $$
BEGIN
  CREATE TYPE "ProductCostHistorySource" AS ENUM (
    'manual',
    'buy_receive',
    'product_edit',
    'stock_adjustment',
    'migration'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ProductCostHistory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "categoryId" TEXT,
  "createdByUserId" TEXT,
  "source" "ProductCostHistorySource" NOT NULL DEFAULT 'manual',
  "reason" TEXT,
  "oldSimpleCost" DECIMAL(10,2),
  "newSimpleCost" DECIMAL(10,2),
  "oldReferenceCost" DECIMAL(10,2),
  "newReferenceCost" DECIMAL(10,2),
  "oldReferenceQuantity" DECIMAL(10,3),
  "newReferenceQuantity" DECIMAL(10,3),
  "oldStockUnit" "StockUnit",
  "newStockUnit" "StockUnit",
  "oldUnitContentQuantity" DECIMAL(10,3),
  "newUnitContentQuantity" DECIMAL(10,3),
  "oldUnitContentUnit" "StockUnit",
  "newUnitContentUnit" "StockUnit",
  "oldCostPerBaseUnit" DECIMAL(12,6),
  "newCostPerBaseUnit" DECIMAL(12,6),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductCostHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductCostHistory_companyId_idx" ON "ProductCostHistory"("companyId");
CREATE INDEX IF NOT EXISTS "ProductCostHistory_productId_idx" ON "ProductCostHistory"("productId");
CREATE INDEX IF NOT EXISTS "ProductCostHistory_categoryId_idx" ON "ProductCostHistory"("categoryId");
CREATE INDEX IF NOT EXISTS "ProductCostHistory_createdByUserId_idx" ON "ProductCostHistory"("createdByUserId");
CREATE INDEX IF NOT EXISTS "ProductCostHistory_source_idx" ON "ProductCostHistory"("source");
CREATE INDEX IF NOT EXISTS "ProductCostHistory_createdAt_idx" ON "ProductCostHistory"("createdAt");
CREATE INDEX IF NOT EXISTS "ProductCostHistory_productId_createdAt_idx" ON "ProductCostHistory"("productId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductCostHistory_categoryId_createdAt_idx" ON "ProductCostHistory"("categoryId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "ProductCostHistory"
  ADD CONSTRAINT "ProductCostHistory_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER TABLE "ProductCostHistory"
  ADD CONSTRAINT "ProductCostHistory_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER TABLE "ProductCostHistory"
  ADD CONSTRAINT "ProductCostHistory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER TABLE "ProductCostHistory"
  ADD CONSTRAINT "ProductCostHistory_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
