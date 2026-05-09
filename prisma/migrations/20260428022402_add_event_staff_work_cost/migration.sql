-- AlterTable
ALTER TABLE "EventDatePerson" ADD COLUMN     "costNotes" TEXT,
ADD COLUMN     "costOverride" DECIMAL(10,2),
ADD COLUMN     "workHours" DECIMAL(10,2),
ADD COLUMN     "worksFullEvent" BOOLEAN NOT NULL DEFAULT true;
