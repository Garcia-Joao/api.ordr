ALTER TABLE "PrintPort"
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "PrintPort_companyId_sortOrder_idx"
  ON "PrintPort"("companyId", "sortOrder");