-- AlterTable
ALTER TABLE "ProductVariationOption" ADD COLUMN     "costMode" "ProductCostMode" NOT NULL DEFAULT 'simple',
ADD COLUMN     "referenceCost" DECIMAL(10,2),
ADD COLUMN     "referenceQuantity" DECIMAL(10,3),
ADD COLUMN     "simpleCost" DECIMAL(10,2),
ADD COLUMN     "stockUnit" "StockUnit";
