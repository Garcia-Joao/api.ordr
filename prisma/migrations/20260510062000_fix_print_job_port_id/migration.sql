ALTER TABLE "PrintJob"
  ADD COLUMN IF NOT EXISTS "portId" TEXT;

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

CREATE INDEX IF NOT EXISTS "PrintJob_portId_idx"
  ON "PrintJob"("portId");

CREATE INDEX IF NOT EXISTS "PrintJob_terminalDeviceId_status_idx"
  ON "PrintJob"("terminalDeviceId", "status");

CREATE INDEX IF NOT EXISTS "PrintJob_companyId_status_idx"
  ON "PrintJob"("companyId", "status");