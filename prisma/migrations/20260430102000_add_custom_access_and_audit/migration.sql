-- Dynamic access control for ORDR
CREATE TYPE "SystemRole" AS ENUM ('ADMIN', 'CUSTOM');

ALTER TABLE "UserCompany"
ADD COLUMN "systemRole" "SystemRole" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN "customRoleId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "permissionKey" TEXT NOT NULL,

  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");
CREATE INDEX "Role_active_idx" ON "Role"("active");

CREATE UNIQUE INDEX "RolePermission_roleId_permissionKey_key" ON "RolePermission"("roleId", "permissionKey");
CREATE INDEX "RolePermission_permissionKey_idx" ON "RolePermission"("permissionKey");

CREATE INDEX "UserCompany_systemRole_idx" ON "UserCompany"("systemRole");
CREATE INDEX "UserCompany_customRoleId_idx" ON "UserCompany"("customRoleId");

ALTER TABLE "Role"
ADD CONSTRAINT "Role_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RolePermission"
ADD CONSTRAINT "RolePermission_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserCompany"
ADD CONSTRAINT "UserCompany_customRoleId_fkey"
FOREIGN KEY ("customRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
