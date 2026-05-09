CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create SalesEnvironment first
CREATE TABLE "SalesEnvironment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesEnvironment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesEnvironment_companyId_idx" ON "SalesEnvironment"("companyId");
CREATE INDEX "SalesEnvironment_companyId_isDefault_idx" ON "SalesEnvironment"("companyId", "isDefault");
CREATE INDEX "SalesEnvironment_active_idx" ON "SalesEnvironment"("active");
CREATE UNIQUE INDEX "SalesEnvironment_companyId_name_key" ON "SalesEnvironment"("companyId", "name");

ALTER TABLE "SalesEnvironment"
ADD CONSTRAINT "SalesEnvironment_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Add nullable column first
ALTER TABLE "InternalCustomer"
ADD COLUMN "salesEnvironmentId" TEXT;

-- Ensure every company has Default
INSERT INTO "SalesEnvironment" ("id", "companyId", "name", "color", "isDefault", "active", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  c."id",
  'Default',
  '#64748B',
  true,
  true,
  NOW(),
  NOW()
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "SalesEnvironment" se
  WHERE se."companyId" = c."id"
    AND se."isDefault" = true
);

-- Backfill existing internal customers
UPDATE "InternalCustomer" ic
SET "salesEnvironmentId" = se."id"
FROM "SalesEnvironment" se
WHERE se."companyId" = ic."companyId"
  AND se."isDefault" = true
  AND ic."salesEnvironmentId" IS NULL;

-- Make required
ALTER TABLE "InternalCustomer"
ALTER COLUMN "salesEnvironmentId" SET NOT NULL;

CREATE INDEX "InternalCustomer_salesEnvironmentId_idx"
ON "InternalCustomer"("salesEnvironmentId");

ALTER TABLE "InternalCustomer"
ADD CONSTRAINT "InternalCustomer_salesEnvironmentId_fkey"
FOREIGN KEY ("salesEnvironmentId") REFERENCES "SalesEnvironment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;