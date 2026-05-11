ALTER TYPE "PrintJobType" ADD VALUE IF NOT EXISTS 'BUY_LIST';

CREATE TABLE IF NOT EXISTS "PrintTemplate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PrintTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PrintTemplate_companyId_kind_key" ON "PrintTemplate"("companyId", "kind");
CREATE INDEX IF NOT EXISTS "PrintTemplate_companyId_idx" ON "PrintTemplate"("companyId");
CREATE INDEX IF NOT EXISTS "PrintTemplate_kind_idx" ON "PrintTemplate"("kind");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PrintTemplate_companyId_fkey'
  ) THEN
    ALTER TABLE "PrintTemplate"
    ADD CONSTRAINT "PrintTemplate_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
