-- Add company-level POS settings and persist the tax rate used by each order.
ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "pdvRequireComanda" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "pdvTaxEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "pdvTaxRate" DECIMAL(5, 2) NOT NULL DEFAULT 10.00;

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5, 2) NOT NULL DEFAULT 10.00;
