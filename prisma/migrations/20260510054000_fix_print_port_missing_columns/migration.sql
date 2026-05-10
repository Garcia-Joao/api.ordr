ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "paperWidth" INTEGER NOT NULL DEFAULT 80;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "localPrinterLabel" TEXT;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "localPrinterName" TEXT;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "localPrinterDisplayName" TEXT;

ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "terminalDeviceId" TEXT;

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

CREATE INDEX IF NOT EXISTS "PrintPort_companyId_sortOrder_idx"
  ON "PrintPort"("companyId", "sortOrder");

CREATE INDEX IF NOT EXISTS "PrintPort_terminalDeviceId_idx"
  ON "PrintPort"("terminalDeviceId");