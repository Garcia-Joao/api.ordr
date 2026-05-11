-- Supplier portal operational fields.
-- Defensive migration because some columns may already exist in deployed environments.

ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "supplierCompanyId" TEXT,
  ADD COLUMN IF NOT EXISTS "ordrCode" TEXT,
  ADD COLUMN IF NOT EXISTS "onlineEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "operatingHours" JSONB;

UPDATE "Supplier"
SET "ordrCode" = upper(substr(md5(random()::text || "id"), 1, 8))
WHERE "ordrCode" IS NULL OR "ordrCode" = '';

CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_supplierCompanyId_key" ON "Supplier"("supplierCompanyId") WHERE "supplierCompanyId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_ordrCode_key" ON "Supplier"("ordrCode") WHERE "ordrCode" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Supplier_supplierCompanyId_idx" ON "Supplier"("supplierCompanyId");
CREATE INDEX IF NOT EXISTS "Supplier_ordrCode_idx" ON "Supplier"("ordrCode");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Supplier_supplierCompanyId_fkey'
      AND table_name = 'Supplier'
  ) THEN
    ALTER TABLE "Supplier"
      ADD CONSTRAINT "Supplier_supplierCompanyId_fkey"
      FOREIGN KEY ("supplierCompanyId") REFERENCES "Company"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
