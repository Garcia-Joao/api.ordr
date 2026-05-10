/*
  Warnings:

  - A unique constraint covering the columns `[testSourceCompanyId]` on the table `Company` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "testSourceCompanyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_testSourceCompanyId_key" ON "Company"("testSourceCompanyId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_testSourceCompanyId_fkey" FOREIGN KEY ("testSourceCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
