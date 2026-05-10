-- 20260510050000_print_ports_jobs_terminal
-- Safe/idempotent-ish migration for print ports, print jobs and Electron terminal support.

-- ============================================================================
-- Enums
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE "DeviceClientType" AS ENUM ('WEB', 'ELECTRON');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PrintJobStatus" AS ENUM (
    'PENDING',
    'CLAIMED',
    'PRINTING',
    'PRINTED',
    'FAILED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PrintJobType" AS ENUM (
    'ORDER_TICKET',
    'TEST'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Device terminal fields
-- ============================================================================

ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "clientType" "DeviceClientType" NOT NULL DEFAULT 'WEB';

ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "isPrintTerminal" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "printTerminalEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "localPrinters" JSONB;

ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "terminalApprovedAt" TIMESTAMP(3);

-- ============================================================================
-- PrintPort
-- ============================================================================

CREATE TABLE IF NOT EXISTS "PrintPort" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "terminalDeviceId" TEXT,
  "localPrinterName" TEXT,
  "localPrinterDisplayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PrintPort_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PrintPort_companyId_fkey'
  ) THEN
    ALTER TABLE "PrintPort"
      ADD CONSTRAINT "PrintPort_companyId_fkey"
      FOREIGN KEY ("companyId")
      REFERENCES "Company"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PrintPort_terminalDeviceId_fkey'
  ) THEN
    ALTER TABLE "PrintPort"
      ADD CONSTRAINT "PrintPort_terminalDeviceId_fkey"
      FOREIGN KEY ("terminalDeviceId")
      REFERENCES "Device"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PrintPort_companyId_name_key"
  ON "PrintPort"("companyId", "name");

CREATE INDEX IF NOT EXISTS "PrintPort_companyId_idx"
  ON "PrintPort"("companyId");

CREATE INDEX IF NOT EXISTS "PrintPort_terminalDeviceId_idx"
  ON "PrintPort"("terminalDeviceId");

-- ============================================================================
-- Category/Product print port references
-- ============================================================================

ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "printPortId" TEXT;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "printPortId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Category_printPortId_fkey'
  ) THEN
    ALTER TABLE "Category"
      ADD CONSTRAINT "Category_printPortId_fkey"
      FOREIGN KEY ("printPortId")
      REFERENCES "PrintPort"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Product_printPortId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_printPortId_fkey"
      FOREIGN KEY ("printPortId")
      REFERENCES "PrintPort"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Category_printPortId_idx"
  ON "Category"("printPortId");

CREATE INDEX IF NOT EXISTS "Product_printPortId_idx"
  ON "Product"("printPortId");

-- ============================================================================
-- PrintJob
-- ============================================================================

CREATE TABLE IF NOT EXISTS "PrintJob" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "orderId" TEXT,
  "printerId" TEXT,
  "printPortId" TEXT,
  "terminalDeviceId" TEXT,
  "type" "PrintJobType" NOT NULL DEFAULT 'ORDER_TICKET',
  "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "printingAt" TIMESTAMP(3),
  "printedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PrintJob_companyId_fkey'
  ) THEN
    ALTER TABLE "PrintJob"
      ADD CONSTRAINT "PrintJob_companyId_fkey"
      FOREIGN KEY ("companyId")
      REFERENCES "Company"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PrintJob_orderId_fkey'
  ) THEN
    ALTER TABLE "PrintJob"
      ADD CONSTRAINT "PrintJob_orderId_fkey"
      FOREIGN KEY ("orderId")
      REFERENCES "Order"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PrintJob_printPortId_fkey'
  ) THEN
    ALTER TABLE "PrintJob"
      ADD CONSTRAINT "PrintJob_printPortId_fkey"
      FOREIGN KEY ("printPortId")
      REFERENCES "PrintPort"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

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

CREATE INDEX IF NOT EXISTS "PrintJob_companyId_status_idx"
  ON "PrintJob"("companyId", "status");

CREATE INDEX IF NOT EXISTS "PrintJob_terminalDeviceId_status_idx"
  ON "PrintJob"("terminalDeviceId", "status");

CREATE INDEX IF NOT EXISTS "PrintJob_printPortId_status_idx"
  ON "PrintJob"("printPortId", "status");

CREATE INDEX IF NOT EXISTS "PrintJob_orderId_idx"
  ON "PrintJob"("orderId");

CREATE INDEX IF NOT EXISTS "PrintJob_createdAt_idx"
  ON "PrintJob"("createdAt");

-- ============================================================================
-- Device indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS "Device_clientType_idx"
  ON "Device"("clientType");

CREATE INDEX IF NOT EXISTS "Device_companyId_clientType_idx"
  ON "Device"("companyId", "clientType");

CREATE INDEX IF NOT EXISTS "Device_companyId_isPrintTerminal_idx"
  ON "Device"("companyId", "isPrintTerminal");