ALTER TABLE "Order"
ADD COLUMN "taxApplied" BOOLEAN;

UPDATE "Order"
SET "taxApplied" = true
WHERE "taxApplied" IS NULL;

ALTER TABLE "Order"
ALTER COLUMN "taxApplied" SET NOT NULL;

ALTER TABLE "Order"
ALTER COLUMN "taxApplied" SET DEFAULT true;