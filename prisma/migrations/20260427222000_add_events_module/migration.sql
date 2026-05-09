-- CreateEnum
CREATE TYPE "EventDateStatus" AS ENUM ('scheduled', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "EventPersonStatus" AS ENUM ('pending', 'confirmed', 'declined', 'maybe');

-- CreateTable
CREATE TABLE "EventTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "defaultExpectedPublic" INTEGER,
    "defaultStartTime" TEXT,
    "defaultEndTime" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTemplatePerson" (
    "id" TEXT NOT NULL,
    "eventTemplateId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "functionName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventTemplatePerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventTemplateId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "expectedPublic" INTEGER,
    "status" "EventDateStatus" NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDatePerson" (
    "id" TEXT NOT NULL,
    "eventDateId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "functionName" TEXT,
    "status" "EventPersonStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventDatePerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventTemplate_companyId_idx" ON "EventTemplate"("companyId");

-- CreateIndex
CREATE INDEX "EventTemplate_active_idx" ON "EventTemplate"("active");

-- CreateIndex
CREATE INDEX "EventTemplatePerson_eventTemplateId_idx" ON "EventTemplatePerson"("eventTemplateId");

-- CreateIndex
CREATE INDEX "EventTemplatePerson_personId_idx" ON "EventTemplatePerson"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "EventTemplatePerson_eventTemplateId_personId_functionName_key" ON "EventTemplatePerson"("eventTemplateId", "personId", "functionName");

-- CreateIndex
CREATE INDEX "EventDate_companyId_idx" ON "EventDate"("companyId");

-- CreateIndex
CREATE INDEX "EventDate_eventTemplateId_idx" ON "EventDate"("eventTemplateId");

-- CreateIndex
CREATE INDEX "EventDate_date_idx" ON "EventDate"("date");

-- CreateIndex
CREATE INDEX "EventDate_status_idx" ON "EventDate"("status");

-- CreateIndex
CREATE INDEX "EventDatePerson_eventDateId_idx" ON "EventDatePerson"("eventDateId");

-- CreateIndex
CREATE INDEX "EventDatePerson_personId_idx" ON "EventDatePerson"("personId");

-- CreateIndex
CREATE INDEX "EventDatePerson_status_idx" ON "EventDatePerson"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EventDatePerson_eventDateId_personId_functionName_key" ON "EventDatePerson"("eventDateId", "personId", "functionName");

-- AddForeignKey
ALTER TABLE "EventTemplate" ADD CONSTRAINT "EventTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTemplatePerson" ADD CONSTRAINT "EventTemplatePerson_eventTemplateId_fkey" FOREIGN KEY ("eventTemplateId") REFERENCES "EventTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTemplatePerson" ADD CONSTRAINT "EventTemplatePerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDate" ADD CONSTRAINT "EventDate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDate" ADD CONSTRAINT "EventDate_eventTemplateId_fkey" FOREIGN KEY ("eventTemplateId") REFERENCES "EventTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDatePerson" ADD CONSTRAINT "EventDatePerson_eventDateId_fkey" FOREIGN KEY ("eventDateId") REFERENCES "EventDate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDatePerson" ADD CONSTRAINT "EventDatePerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
