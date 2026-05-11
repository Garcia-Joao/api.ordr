-- Default/fixed cashier receipt port.
ALTER TABLE "PrintPort"
ADD COLUMN IF NOT EXISTS "isDefaultReceipt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "PrintPort_isDefaultReceipt_idx" ON "PrintPort"("isDefaultReceipt");
CREATE INDEX IF NOT EXISTS "PrintPort_isSystem_idx" ON "PrintPort"("isSystem");

-- Reuse an existing cashier port when one already has the expected name.
UPDATE "PrintPort"
SET
  "isDefaultReceipt" = true,
  "isSystem" = true,
  "active" = true,
  "sortOrder" = LEAST("sortOrder", -100),
  "updatedAt" = NOW()
WHERE "name" = 'Caixa / Recibos'
  AND "isDefaultReceipt" = false;

INSERT INTO "PrintPort" ("id", "companyId", "name", "description", "active", "sortOrder", "isDefaultReceipt", "isSystem", "createdAt", "updatedAt")
SELECT
  'receipt_' || c."id",
  c."id",
  'Caixa / Recibos',
  'Port fixa para recibos do caixa e listas de compras.',
  true,
  -100,
  true,
  true,
  NOW(),
  NOW()
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "PrintPort" p
  WHERE p."companyId" = c."id" AND p."isDefaultReceipt" = true
)
AND NOT EXISTS (
  SELECT 1 FROM "PrintPort" p
  WHERE p."companyId" = c."id" AND p."name" = 'Caixa / Recibos'
);
