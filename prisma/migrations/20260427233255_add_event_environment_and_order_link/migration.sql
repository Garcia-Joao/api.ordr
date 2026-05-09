-- AlterTable
ALTER TABLE "EventDate" ADD COLUMN     "salesEnvironmentId" TEXT;

-- AlterTable
ALTER TABLE "EventTemplate" ADD COLUMN     "salesEnvironmentId" TEXT;

-- AddForeignKey
ALTER TABLE "EventTemplate" ADD CONSTRAINT "EventTemplate_salesEnvironmentId_fkey" FOREIGN KEY ("salesEnvironmentId") REFERENCES "SalesEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDate" ADD CONSTRAINT "EventDate_salesEnvironmentId_fkey" FOREIGN KEY ("salesEnvironmentId") REFERENCES "SalesEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
