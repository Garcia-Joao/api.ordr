ALTER TABLE "UserCompany" ADD COLUMN IF NOT EXISTS "activeEventDateId" TEXT;

CREATE INDEX IF NOT EXISTS "UserCompany_activeEventDateId_idx" ON "UserCompany"("activeEventDateId");

DO $$
BEGIN
  ALTER TABLE "UserCompany"
  ADD CONSTRAINT "UserCompany_activeEventDateId_fkey"
  FOREIGN KEY ("activeEventDateId") REFERENCES "EventDate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
