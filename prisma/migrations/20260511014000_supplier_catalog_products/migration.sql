-- Supplier catalog products and table item links.
-- This migration separates supplier product catalog from price table items.

CREATE TABLE IF NOT EXISTS "SupplierCatalogProduct" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "category" TEXT,
  "unit" "StockUnit" NOT NULL DEFAULT 'unit',
  "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "stockEnabled" BOOLEAN NOT NULL DEFAULT false,
  "stockQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "minStockQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "stockUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierCatalogProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierCatalogProduct_supplierId_name_key" ON "SupplierCatalogProduct"("supplierId", "name");
CREATE INDEX IF NOT EXISTS "SupplierCatalogProduct_supplierId_idx" ON "SupplierCatalogProduct"("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierCatalogProduct_active_idx" ON "SupplierCatalogProduct"("active");
CREATE INDEX IF NOT EXISTS "SupplierCatalogProduct_sku_idx" ON "SupplierCatalogProduct"("sku");
CREATE INDEX IF NOT EXISTS "SupplierCatalogProduct_category_idx" ON "SupplierCatalogProduct"("category");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SupplierCatalogProduct_supplierId_fkey'
  ) THEN
    ALTER TABLE "SupplierCatalogProduct"
    ADD CONSTRAINT "SupplierCatalogProduct_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "SupplierPriceTableItem"
ADD COLUMN IF NOT EXISTS "supplierProductId" TEXT;

CREATE INDEX IF NOT EXISTS "SupplierPriceTableItem_supplierProductId_idx" ON "SupplierPriceTableItem"("supplierProductId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SupplierPriceTableItem_supplierProductId_fkey'
  ) THEN
    ALTER TABLE "SupplierPriceTableItem"
    ADD CONSTRAINT "SupplierPriceTableItem_supplierProductId_fkey"
    FOREIGN KEY ("supplierProductId") REFERENCES "SupplierCatalogProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
