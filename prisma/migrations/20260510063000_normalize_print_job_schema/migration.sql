-- Normalize PrintJob table to match current Prisma schema.

-- Main columns expected by current schema.prisma
ALTER TABLE "PrintJob"
  ADD COLUMN IF NOT EXISTS "portId" TEXT;

ALTER TABLE "PrintJob"
  ADD COLUMN IF NOT EXISTS "terminalDeviceId" TEXT;

ALTER TABLE "PrintJob"
  ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);

ALTER TABLE "PrintJob"
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);

ALTER TABLE "PrintJob"
  ADD COLUMN IF NOT EXISTS "printedAt" TIMESTAMP(3);

ALTER TABLE "PrintJob"
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);

ALTER TABLE "PrintJob"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- If older migration used printPortId instead of portId, copy values.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'PrintJob'
      AND column_name = 'printPortId'
  ) THEN
    UPDATE "PrintJob"
    SET "portId" = COALESCE("portId", "printPortId")
    WHERE "portId" IS NULL;
  END IF;
END $$;

-- If older migration used printingAt instead of startedAt, copy values.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'PrintJob'
      AND column_name = 'printingAt'
  ) THEN
    UPDATE "PrintJob"
    SET "startedAt" = COALESCE("startedAt", "printingAt")
    WHERE "startedAt" IS NULL;
  END IF;
END $$;

-- Fill updatedAt for existing rows.
UPDATE "PrintJob"
SET "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

ALTER TABLE "PrintJob"
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PrintJob"
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- Foreign key: portId -> PrintPort.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PrintJob_portId_fkey'
  ) THEN
    ALTER TABLE "PrintJob"
      ADD CONSTRAINT "PrintJob_portId_fkey"
      FOREIGN KEY ("portId")
      REFERENCES "PrintPort"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Foreign key: terminalDeviceId -> Device.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PrintJob_terminalDeviceId_fkey'
  ) THEN
    ALTER TABLE "PrintJob"
      ADD CONSTRAINT "PrintJob_terminalDeviceId_fkey"
      FOREIGN KEY ("terminalDeviceId")
      REFERENCES "Device"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes expected by schema / services
CREATE INDEX IF NOT EXISTS "PrintJob_companyId_idx"
  ON "PrintJob"("companyId");

CREATE INDEX IF NOT EXISTS "PrintJob_orderId_idx"
  ON "PrintJob"("orderId");

CREATE INDEX IF NOT EXISTS "PrintJob_portId_idx"
  ON "PrintJob"("portId");

CREATE INDEX IF NOT EXISTS "PrintJob_terminalDeviceId_idx"
  ON "PrintJob"("terminalDeviceId");

CREATE INDEX IF NOT EXISTS "PrintJob_status_idx"
  ON "PrintJob"("status");

CREATE INDEX IF NOT EXISTS "PrintJob_createdAt_idx"
  ON "PrintJob"("createdAt");

CREATE INDEX IF NOT EXISTS "PrintJob_terminalDeviceId_status_idx"
  ON "PrintJob"("terminalDeviceId", "status");

CREATE INDEX IF NOT EXISTS "PrintJob_companyId_status_idx"
  ON "PrintJob"("companyId", "status");