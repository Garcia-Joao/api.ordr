/*
  Warnings:

  - Made the column `categoryId` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropIndex
DROP INDEX "Product_companyId_name_key";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "madeOnDemand" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recipeOutputQuantity" DECIMAL(10,3),
ADD COLUMN     "recipeOutputUnit" "StockUnit",
ADD COLUMN     "unlimitedStock" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "categoryId" SET NOT NULL,
ALTER COLUMN "minStock" SET DEFAULT 0,
ALTER COLUMN "minStock" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "stockQuantity" SET DEFAULT 0,
ALTER COLUMN "stockQuantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "previousQty" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "newQty" SET DATA TYPE DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "Product"("active");

-- CreateIndex
CREATE INDEX "Product_costMode_idx" ON "Product"("costMode");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
