ALTER TABLE "SupplierPriceTableItem"
ADD COLUMN IF NOT EXISTS "category" TEXT;

CREATE INDEX IF NOT EXISTS "SupplierPriceTableItem_category_idx"
ON "SupplierPriceTableItem"("category");
