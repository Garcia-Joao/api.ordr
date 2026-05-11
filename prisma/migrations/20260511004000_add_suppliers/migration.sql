-- Create suppliers and supplier price tables
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierPriceTable" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPriceTable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierPriceTableItem" (
    "id" TEXT NOT NULL,
    "priceTableId" TEXT NOT NULL,
    "productId" TEXT,
    "itemName" TEXT NOT NULL,
    "sku" TEXT,
    "unit" "StockUnit" NOT NULL DEFAULT 'unit',
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "lastQuotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPriceTableItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_companyId_name_key" ON "Supplier"("companyId", "name");
CREATE INDEX "Supplier_companyId_idx" ON "Supplier"("companyId");
CREATE INDEX "Supplier_active_idx" ON "Supplier"("active");
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

CREATE UNIQUE INDEX "SupplierPriceTable_supplierId_name_key" ON "SupplierPriceTable"("supplierId", "name");
CREATE INDEX "SupplierPriceTable_supplierId_idx" ON "SupplierPriceTable"("supplierId");
CREATE INDEX "SupplierPriceTable_active_idx" ON "SupplierPriceTable"("active");

CREATE INDEX "SupplierPriceTableItem_priceTableId_idx" ON "SupplierPriceTableItem"("priceTableId");
CREATE INDEX "SupplierPriceTableItem_productId_idx" ON "SupplierPriceTableItem"("productId");
CREATE INDEX "SupplierPriceTableItem_itemName_idx" ON "SupplierPriceTableItem"("itemName");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPriceTable" ADD CONSTRAINT "SupplierPriceTable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPriceTableItem" ADD CONSTRAINT "SupplierPriceTableItem_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "SupplierPriceTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPriceTableItem" ADD CONSTRAINT "SupplierPriceTableItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
