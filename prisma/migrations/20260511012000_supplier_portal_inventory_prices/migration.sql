-- Supplier portal: automatic availability flag + simple stock control for supplier items

ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "automaticAvailability" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SupplierPriceTableItem"
  ADD COLUMN IF NOT EXISTS "stockEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stockQuantity" DECIMAL(10, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "minStockQuantity" DECIMAL(10, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "stockUpdatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SupplierPriceTableItem_stockEnabled_idx" ON "SupplierPriceTableItem"("stockEnabled");
