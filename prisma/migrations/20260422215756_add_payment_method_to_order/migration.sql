-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('money', 'pix', 'credit', 'debit');

-- AddColumn as nullable first
ALTER TABLE "Order"
ADD COLUMN "paymentMethod" "PaymentMethod";

-- Fill existing rows
UPDATE "Order"
SET "paymentMethod" = 'money'
WHERE "paymentMethod" IS NULL;

-- Make it required
ALTER TABLE "Order"
ALTER COLUMN "paymentMethod" SET NOT NULL;