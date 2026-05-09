/*
  Warnings:

  - You are about to drop the column `date` on the `EventDate` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `EventDate` table. All the data in the column will be lost.
  - You are about to drop the column `expectedPublic` on the `EventDate` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `EventDate` table. All the data in the column will be lost.
  - You are about to drop the column `defaultExpectedPublic` on the `EventTemplate` table. All the data in the column will be lost.
  - Added the required column `startAt` to the `EventDate` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "EventDate_date_idx";

-- AlterTable
ALTER TABLE "EventDate" DROP COLUMN "date",
DROP COLUMN "endTime",
DROP COLUMN "expectedPublic",
DROP COLUMN "startTime",
ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "expectedAudience" INTEGER,
ADD COLUMN     "startAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "EventTemplate" DROP COLUMN "defaultExpectedPublic",
ADD COLUMN     "defaultExpectedAudience" INTEGER;

-- CreateIndex
CREATE INDEX "EventDate_startAt_idx" ON "EventDate"("startAt");
