-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "eventDateId" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_eventDateId_fkey" FOREIGN KEY ("eventDateId") REFERENCES "EventDate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
