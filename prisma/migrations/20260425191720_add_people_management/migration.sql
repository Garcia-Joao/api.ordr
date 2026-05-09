-- CreateEnum
CREATE TYPE "PersonContractType" AS ENUM ('CLT', 'FREELANCER', 'PJ', 'NONE', 'OTHER');

-- CreateEnum
CREATE TYPE "PersonRateType" AS ENUM ('HOURLY', 'DAILY', 'EVENT', 'MONTHLY', 'NEGOTIABLE');

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "contractType" "PersonContractType" NOT NULL DEFAULT 'NONE',
    "salesEnvironmentId" TEXT,
    "rateType" "PersonRateType" NOT NULL DEFAULT 'EVENT',
    "rateAmount" DECIMAL(10,2),
    "rating" INTEGER,
    "observations" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "internalCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonFunction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonFunctionAssignment" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "functionId" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonFunctionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonFunction_name_key" ON "PersonFunction"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PersonFunctionAssignment_personId_functionId_detail_key" ON "PersonFunctionAssignment"("personId", "functionId", "detail");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_salesEnvironmentId_fkey" FOREIGN KEY ("salesEnvironmentId") REFERENCES "SalesEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_internalCustomerId_fkey" FOREIGN KEY ("internalCustomerId") REFERENCES "InternalCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonFunctionAssignment" ADD CONSTRAINT "PersonFunctionAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonFunctionAssignment" ADD CONSTRAINT "PersonFunctionAssignment_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "PersonFunction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
