-- Menus allow one company to prepare multiple sale catalogs with different items/prices.
CREATE TABLE IF NOT EXISTS "Menu" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MenuItem" (
  "id" TEXT NOT NULL,
  "menuId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Menu_companyId_name_key" ON "Menu"("companyId", "name");
CREATE INDEX IF NOT EXISTS "Menu_companyId_idx" ON "Menu"("companyId");
CREATE INDEX IF NOT EXISTS "Menu_companyId_active_idx" ON "Menu"("companyId", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "MenuItem_menuId_productId_key" ON "MenuItem"("menuId", "productId");
CREATE INDEX IF NOT EXISTS "MenuItem_menuId_idx" ON "MenuItem"("menuId");
CREATE INDEX IF NOT EXISTS "MenuItem_productId_idx" ON "MenuItem"("productId");

ALTER TABLE "Menu"
  ADD CONSTRAINT "Menu_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce only one active menu per company. Prisma cannot express partial unique indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "Menu_one_active_per_company_idx"
  ON "Menu"("companyId")
  WHERE "active" = true;
