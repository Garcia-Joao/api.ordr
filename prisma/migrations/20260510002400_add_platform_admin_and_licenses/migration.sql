-- CreateEnum
CREATE TYPE "PlatformAdminRole" AS ENUM ('OWNER', 'ADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "CompanyAccessStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompanyLicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'REPLACED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "platformAccessStatus" "CompanyAccessStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "platformBlockedAt" TIMESTAMP(3),
ADD COLUMN     "platformBlockedReason" TEXT;

-- CreateTable
CREATE TABLE "PlatformAdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" "PlatformAdminRole" NOT NULL DEFAULT 'OWNER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicensePlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "durationMonths" INTEGER,
    "isLifetime" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByAdminId" TEXT,

    CONSTRAINT "LicensePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyLicense" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "CompanyLicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByAdminId" TEXT,

    CONSTRAINT "CompanyLicense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdminUser_username_key" ON "PlatformAdminUser"("username");

-- CreateIndex
CREATE INDEX "PlatformAdminUser_username_idx" ON "PlatformAdminUser"("username");

-- CreateIndex
CREATE INDEX "PlatformAdminUser_active_idx" ON "PlatformAdminUser"("active");

-- CreateIndex
CREATE INDEX "PlatformAdminUser_role_idx" ON "PlatformAdminUser"("role");

-- CreateIndex
CREATE UNIQUE INDEX "LicensePlan_slug_key" ON "LicensePlan"("slug");

-- CreateIndex
CREATE INDEX "LicensePlan_slug_idx" ON "LicensePlan"("slug");

-- CreateIndex
CREATE INDEX "LicensePlan_active_idx" ON "LicensePlan"("active");

-- CreateIndex
CREATE INDEX "LicensePlan_createdByAdminId_idx" ON "LicensePlan"("createdByAdminId");

-- CreateIndex
CREATE INDEX "CompanyLicense_companyId_idx" ON "CompanyLicense"("companyId");

-- CreateIndex
CREATE INDEX "CompanyLicense_planId_idx" ON "CompanyLicense"("planId");

-- CreateIndex
CREATE INDEX "CompanyLicense_status_idx" ON "CompanyLicense"("status");

-- CreateIndex
CREATE INDEX "CompanyLicense_startsAt_idx" ON "CompanyLicense"("startsAt");

-- CreateIndex
CREATE INDEX "CompanyLicense_endsAt_idx" ON "CompanyLicense"("endsAt");

-- CreateIndex
CREATE INDEX "CompanyLicense_createdByAdminId_idx" ON "CompanyLicense"("createdByAdminId");

-- AddForeignKey
ALTER TABLE "LicensePlan" ADD CONSTRAINT "LicensePlan_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLicense" ADD CONSTRAINT "CompanyLicense_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLicense" ADD CONSTRAINT "CompanyLicense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLicense" ADD CONSTRAINT "CompanyLicense_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LicensePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
