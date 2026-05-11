-- Add public listing support for supplier portal visibility.
ALTER TABLE "Supplier"
ADD COLUMN IF NOT EXISTS "publicListingEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "SupplierAccess" (
  "id" TEXT NOT NULL,
  "businessCompanyId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "codeUsed" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierAccess_businessCompanyId_supplierId_key"
ON "SupplierAccess"("businessCompanyId", "supplierId");

CREATE INDEX IF NOT EXISTS "SupplierAccess_businessCompanyId_idx"
ON "SupplierAccess"("businessCompanyId");

CREATE INDEX IF NOT EXISTS "SupplierAccess_supplierId_idx"
ON "SupplierAccess"("supplierId");

CREATE INDEX IF NOT EXISTS "Supplier_publicListingEnabled_idx"
ON "Supplier"("publicListingEnabled");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SupplierAccess_businessCompanyId_fkey'
      AND table_name = 'SupplierAccess'
  ) THEN
    ALTER TABLE "SupplierAccess"
    ADD CONSTRAINT "SupplierAccess_businessCompanyId_fkey"
    FOREIGN KEY ("businessCompanyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SupplierAccess_supplierId_fkey'
      AND table_name = 'SupplierAccess'
  ) THEN
    ALTER TABLE "SupplierAccess"
    ADD CONSTRAINT "SupplierAccess_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
