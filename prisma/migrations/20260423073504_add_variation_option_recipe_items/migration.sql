-- DropIndex
DROP INDEX "ProductVariationOption_groupId_idx";

-- DropIndex
DROP INDEX "ProductVariationOption_groupId_name_key";

-- AlterTable
ALTER TABLE "ProductVariationOption" ALTER COLUMN "priceModifier" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ProductVariationOptionRecipeItem" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "ingredientProductId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariationOptionRecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariationOptionRecipeItem_optionId_idx" ON "ProductVariationOptionRecipeItem"("optionId");

-- CreateIndex
CREATE INDEX "ProductVariationOptionRecipeItem_ingredientProductId_idx" ON "ProductVariationOptionRecipeItem"("ingredientProductId");

-- AddForeignKey
ALTER TABLE "ProductVariationOptionRecipeItem" ADD CONSTRAINT "ProductVariationOptionRecipeItem_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProductVariationOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariationOptionRecipeItem" ADD CONSTRAINT "ProductVariationOptionRecipeItem_ingredientProductId_fkey" FOREIGN KEY ("ingredientProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
