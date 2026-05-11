-- Allows supplier products/items to be activated/deactivated without deleting price history.
ALTER TABLE "SupplierPriceTableItem"
ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "SupplierPriceTableItem_active_idx"
ON "SupplierPriceTableItem"("active");
