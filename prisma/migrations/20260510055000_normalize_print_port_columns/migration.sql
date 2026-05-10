-- Normalize PrintPort after earlier partial/idempotent migrations.

-- Ensure columns exist.
ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "paperWidth" INTEGER;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "localPrinterLabel" TEXT;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "localPrinterName" TEXT;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "localPrinterDisplayName" TEXT;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "terminalDeviceId" TEXT;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- Fill existing nulls.
UPDATE "PrintPort"
SET
  "sortOrder" = COALESCE("sortOrder", 0),
  "paperWidth" = COALESCE("paperWidth", 80),
  "active" = COALESCE("active", true),
  "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
  "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

-- Set safe defaults.
ALTER TABLE "PrintPort"
  ALTER COLUMN "sortOrder" SET DEFAULT 0;

ALTER TABLE "PrintPort"
  ALTER COLUMN "paperWidth" SET DEFAULT 80;

ALTER TABLE "PrintPort"
  ALTER COLUMN "active" SET DEFAULT true;

ALTER TABLE "PrintPort"
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PrintPort"
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- These are required.
ALTER TABLE "PrintPort"
  ALTER COLUMN "sortOrder" SET NOT NULL;

ALTER TABLE "PrintPort"
  ALTER COLUMN "paperWidth" SET NOT NULL;

ALTER TABLE "PrintPort"
  ALTER COLUMN "active" SET NOT NULL;

ALTER TABLE "PrintPort"
  ALTER COLUMN "createdAt" SET NOT NULL;

ALTER TABLE "PrintPort"
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- These should NOT be required because binding is done later by the terminal.
ALTER TABLE "PrintPort"
  ALTER COLUMN "description" DROP NOT NULL;

ALTER TABLE "PrintPort"
  ALTER COLUMN "terminalDeviceId" DROP NOT NULL;

ALTER TABLE "PrintPort"
  ALTER COLUMN "localPrinterName" DROP NOT NULL;

ALTER TABLE "PrintPort"
  ALTER COLUMN "localPrinterDisplayName" DROP NOT NULL;

ALTER TABLE "PrintPort"
  ALTER COLUMN "localPrinterLabel" DROP NOT NULL;

-- Indexes.
CREATE INDEX IF NOT EXISTS "PrintPort_companyId_sortOrder_idx"
  ON "PrintPort"("companyId", "sortOrder");

CREATE INDEX IF NOT EXISTS "PrintPort_terminalDeviceId_idx"
  ON "PrintPort"("terminalDeviceId");