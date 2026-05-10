CREATE TABLE IF NOT EXISTS "PrintPortBinding" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "portId" TEXT NOT NULL,
  "terminalDeviceId" TEXT NOT NULL,
  "localPrinterName" TEXT NOT NULL,
  "localPrinterLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrintPortBinding_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrintPortBinding_companyId_fkey') THEN
    ALTER TABLE "PrintPortBinding" ADD CONSTRAINT "PrintPortBinding_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrintPortBinding_portId_fkey') THEN
    ALTER TABLE "PrintPortBinding" ADD CONSTRAINT "PrintPortBinding_portId_fkey"
    FOREIGN KEY ("portId") REFERENCES "PrintPort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrintPortBinding_terminalDeviceId_fkey') THEN
    ALTER TABLE "PrintPortBinding" ADD CONSTRAINT "PrintPortBinding_terminalDeviceId_fkey"
    FOREIGN KEY ("terminalDeviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PrintPortBinding_portId_terminalDeviceId_localPrinterName_key"
  ON "PrintPortBinding"("portId", "terminalDeviceId", "localPrinterName");
CREATE INDEX IF NOT EXISTS "PrintPortBinding_companyId_idx" ON "PrintPortBinding"("companyId");
CREATE INDEX IF NOT EXISTS "PrintPortBinding_portId_idx" ON "PrintPortBinding"("portId");
CREATE INDEX IF NOT EXISTS "PrintPortBinding_terminalDeviceId_idx" ON "PrintPortBinding"("terminalDeviceId");

INSERT INTO "PrintPortBinding" ("id", "companyId", "portId", "terminalDeviceId", "localPrinterName", "localPrinterLabel", "createdAt", "updatedAt")
SELECT concat('legacy_', "id"), "companyId", "id", "terminalDeviceId", "localPrinterName", "localPrinterLabel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PrintPort"
WHERE "terminalDeviceId" IS NOT NULL AND "localPrinterName" IS NOT NULL
ON CONFLICT DO NOTHING;
