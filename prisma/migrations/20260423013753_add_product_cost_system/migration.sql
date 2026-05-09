-- CreateEnum
CREATE TYPE "ProductCostMode" AS ENUM ('simple', 'recipe');

-- CreateEnum
CREATE TYPE "StockUnit" AS ENUM ('unit', 'ml', 'l', 'g', 'kg');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costMode" "ProductCostMode" NOT NULL DEFAULT 'simple',
ADD COLUMN     "referenceCost" DECIMAL(10,2),
ADD COLUMN     "referenceQuantity" DECIMAL(10,3),
ADD COLUMN     "simpleCost" DECIMAL(10,2),
ADD COLUMN     "stockUnit" "StockUnit";

-- CreateTable
CREATE TABLE "ProductRecipeItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientProductId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "StockUnit" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRecipeItem_productId_idx" ON "ProductRecipeItem"("productId");

-- CreateIndex
CREATE INDEX "ProductRecipeItem_ingredientProductId_idx" ON "ProductRecipeItem"("ingredientProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecipeItem_productId_ingredientProductId_unit_key" ON "ProductRecipeItem"("productId", "ingredientProductId", "unit");

-- AddForeignKey
ALTER TABLE "ProductRecipeItem" ADD CONSTRAINT "ProductRecipeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipeItem" ADD CONSTRAINT "ProductRecipeItem_ingredientProductId_fkey" FOREIGN KEY ("ingredientProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
